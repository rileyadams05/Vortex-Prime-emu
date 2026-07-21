use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use uuid::Uuid;

const STORAGE_ROOT_NAME: &str = "Streamz";

const REQUIRED_SUBDIRS: &[&str] = &[
    "Config",
    "Database",
    "Recordings",
    "Clips",
    "Thumbnails",
    "Logs",
    "Temp",
];

const MIGRATIONS: &[&str] = &[r#"
    CREATE TABLE IF NOT EXISTS recordings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source_path TEXT NOT NULL,
        duration_ms INTEGER DEFAULT 0,
        resolution_w INTEGER DEFAULT 0,
        resolution_h INTEGER DEFAULT 0,
        fps REAL DEFAULT 0,
        video_codec TEXT,
        audio_codec TEXT,
        average_bitrate INTEGER,
        file_size_bytes INTEGER,
        format TEXT,
        created_at TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        notes TEXT,
        thumbnail_path TEXT,
        deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS clips (
        id TEXT PRIMARY KEY,
        recording_id TEXT NOT NULL,
        title TEXT NOT NULL,
        start_ms INTEGER NOT NULL,
        end_ms INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        export_status TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size_bytes INTEGER,
        format TEXT,
        video_codec TEXT,
        audio_codec TEXT,
        average_bitrate INTEGER,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        thumbnail_path TEXT,
        deleted_at TEXT,
        FOREIGN KEY(recording_id) REFERENCES recordings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        job_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    "#];

#[derive(Debug)]
pub enum StorageError {
    PathUnavailable,
    Io(std::io::Error),
    Database(rusqlite::Error),
}

impl StorageManager {
    fn normalize_path(path: &Path) -> Result<String, StorageError> {
        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        canonical
            .to_str()
            .map(|value| value.to_string())
            .ok_or_else(|| {
                StorageError::Io(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "Invalid path",
                ))
            })
    }

    fn recording_folder_path_from_config(&self, config: &RecordingFolderConfig) -> PathBuf {
        if let Some(path) = config.user_override_path.as_ref() {
            PathBuf::from(path)
        } else if let Some(path) = config.obs_reported_path.as_ref() {
            PathBuf::from(path)
        } else {
            self.recordings_root()
        }
    }
}

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StorageError::PathUnavailable => {
                write!(f, "Unable to resolve a user data directory for Streamz.")
            }
            StorageError::Io(err) => write!(f, "Filesystem error: {err}"),
            StorageError::Database(err) => write!(f, "Database error: {err}"),
        }
    }
}

impl std::error::Error for StorageError {}

impl From<std::io::Error> for StorageError {
    fn from(value: std::io::Error) -> Self {
        StorageError::Io(value)
    }
}

impl From<rusqlite::Error> for StorageError {
    fn from(value: rusqlite::Error) -> Self {
        StorageError::Database(value)
    }
}

fn as_io_error<E: std::error::Error + Send + Sync + 'static>(error: E) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidData, error)
}

#[derive(Clone)]
struct StoragePaths {
    root: PathBuf,
    database: PathBuf,
    #[allow(dead_code)]
    config: PathBuf,
    #[allow(dead_code)]
    recordings: PathBuf,
    #[allow(dead_code)]
    clips: PathBuf,
    #[allow(dead_code)]
    thumbnails: PathBuf,
    #[allow(dead_code)]
    logs: PathBuf,
    #[allow(dead_code)]
    temp: PathBuf,
}

impl StoragePaths {
    fn create(app_handle: &AppHandle) -> Result<Self, StorageError> {
        let resolver = app_handle.path();
        let mut root = resolver
            .app_local_data_dir()
            .or_else(|_| resolver.app_data_dir())
            .or_else(|_| resolver.local_data_dir())
            .or_else(|_| resolver.data_dir())
            .map_err(|_| StorageError::PathUnavailable)?;
        root.push(STORAGE_ROOT_NAME);
        Self::from_root(root)
    }

    fn from_root(root: PathBuf) -> Result<Self, StorageError> {
        if !root.exists() {
            fs::create_dir_all(&root)?;
        }

        for dir in REQUIRED_SUBDIRS {
            fs::create_dir_all(root.join(dir))?;
        }

        Ok(Self {
            database: root.join("Database"),
            config: root.join("Config"),
            recordings: root.join("Recordings"),
            clips: root.join("Clips"),
            thumbnails: root.join("Thumbnails"),
            logs: root.join("Logs"),
            temp: root.join("Temp"),
            root,
        })
    }

    fn database_file(&self) -> PathBuf {
        self.database.join("clips.db")
    }

    fn directories_ready(&self) -> bool {
        self.root.exists()
            && REQUIRED_SUBDIRS
                .iter()
                .all(|dir| self.root.join(dir).exists())
    }
}

#[derive(Clone)]
pub struct StorageManager {
    paths: StoragePaths,
}

impl StorageManager {
    pub fn initialize(app_handle: &AppHandle) -> Result<Self, StorageError> {
        let paths = StoragePaths::create(app_handle)?;
        let manager = Self { paths };
        manager.run_migrations()?;
        Ok(manager)
    }

    #[cfg(test)]
    fn from_root(root: PathBuf) -> Result<Self, StorageError> {
        let paths = StoragePaths::from_root(root)?;
        let manager = Self { paths };
        manager.run_migrations()?;
        Ok(manager)
    }

    fn open_connection(&self) -> Result<Connection, StorageError> {
        let conn = Connection::open(self.paths.database_file())?;
        conn.execute_batch("PRAGMA journal_mode = WAL;")?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        Ok(conn)
    }

    fn run_migrations(&self) -> Result<(), StorageError> {
        let conn = self.open_connection()?;
        let current_version: i64 =
            conn.pragma_query_value(None, "user_version", |row| row.get(0))?;

        for (index, migration) in MIGRATIONS.iter().enumerate() {
            let target_version = (index + 1) as i64;
            if current_version < target_version {
                conn.execute_batch(migration)?;
                conn.pragma_update(None, "user_version", &target_version)?;
            }
        }

        Ok(())
    }

    pub fn status(&self) -> Result<StorageStatus, StorageError> {
        let conn = self.open_connection()?;
        let version: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;

        Ok(StorageStatus {
            directories_ready: self.paths.directories_ready(),
            database_version: version as u32,
            schema_ready: version as usize >= MIGRATIONS.len(),
        })
    }

    pub fn recordings_root(&self) -> PathBuf {
        self.paths.recordings.clone()
    }

    pub fn resolved_recording_folder(&self) -> Result<PathBuf, StorageError> {
        let config = self.recording_folder_config()?.unwrap_or_default();
        Ok(self.recording_folder_path_from_config(&config))
    }

    pub fn recording_folder_status(&self) -> Result<RecordingFolderStatus, StorageError> {
        let config = self.recording_folder_config()?.unwrap_or_default();
        let resolved = self.recording_folder_path_from_config(&config);
        let resolved_path = resolved.to_string_lossy().into_owned();
        Ok(RecordingFolderStatus {
            using_override: config.user_override_path.is_some(),
            config,
            resolved_path,
        })
    }

    pub fn obs_connection_config(&self) -> Result<ObsConnectionConfig, StorageError> {
        let conn = self.open_connection()?;
        let record: Option<String> = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'obs_connection_config'",
                [],
                |row| row.get(0),
            )
            .optional()?;

        if let Some(json) = record {
            serde_json::from_str(&json)
                .map_err(as_io_error)
                .map_err(Into::into)
        } else {
            Ok(ObsConnectionConfig::default())
        }
    }

    pub fn update_obs_connection_config(
        &self,
        config: &ObsConnectionConfig,
    ) -> Result<(), StorageError> {
        let conn = self.open_connection()?;
        let value = serde_json::to_string(config).map_err(as_io_error)?;
        conn.execute(
            r#"
            INSERT INTO settings (key, value)
            VALUES ('obs_connection_config', ?1)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value;
            "#,
            [value],
        )?;
        Ok(())
    }

    pub fn insert_recording_reference(
        &self,
        id: &str,
        title: &str,
        source_path: &Path,
        created_at: &str,
    ) -> Result<(), StorageError> {
        let conn = self.open_connection()?;
        let source = Self::normalize_path(source_path)?;

        conn.execute(
            r#"
            INSERT INTO recordings (
                id, title, source_path, created_at, imported_at
            ) VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(id) DO NOTHING;
            "#,
            (id, title, source, created_at, created_at),
        )?;
        Ok(())
    }

    pub fn recording_exists_by_source_path(
        &self,
        source_path: &Path,
    ) -> Result<bool, StorageError> {
        let conn = self.open_connection()?;
        let normalized = Self::normalize_path(source_path)?;
        let exists: Option<u8> = conn
            .query_row(
                "SELECT 1 FROM recordings WHERE source_path = ?1 LIMIT 1",
                [normalized],
                |row| row.get(0),
            )
            .optional()?;
        Ok(exists.is_some())
    }

    pub fn import_recording_from_path(&self, source_path: &Path) -> Result<bool, StorageError> {
        if self.recording_exists_by_source_path(source_path)? {
            return Ok(false);
        }

        let metadata = fs::metadata(source_path)?;
        let created_time = metadata
            .created()
            .or_else(|_| metadata.modified())
            .unwrap_or_else(|_| std::time::SystemTime::now());
        let created_at: DateTime<Utc> = created_time.into();
        let created_at = created_at.to_rfc3339();
        let title = source_path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("Recording")
            .to_string();
        let id = Uuid::new_v4().to_string();

        self.insert_recording_reference(&id, &title, source_path, &created_at)?;
        Ok(true)
    }

    pub fn update_recording_folder(
        &self,
        config: &RecordingFolderConfig,
    ) -> Result<(), StorageError> {
        let conn = self.open_connection()?;
        let value = serde_json::to_string(config).map_err(as_io_error)?;
        conn.execute(
            r#"
            INSERT INTO settings (key, value)
            VALUES ('recording_folder', ?1)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value;
            "#,
            [value],
        )?;
        Ok(())
    }

    pub fn recording_folder_config(&self) -> Result<Option<RecordingFolderConfig>, StorageError> {
        let conn = self.open_connection()?;
        let record: Option<String> = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'recording_folder'",
                [],
                |row| row.get(0),
            )
            .optional()?;

        if let Some(json) = record {
            let config = serde_json::from_str(&json).map_err(as_io_error)?;
            Ok(Some(config))
        } else {
            Ok(None)
        }
    }
}

#[derive(Clone)]
pub struct StorageState {
    manager: StorageManager,
}

impl StorageState {
    pub fn new(manager: StorageManager) -> Self {
        Self { manager }
    }

    pub fn manager(&self) -> &StorageManager {
        &self.manager
    }
}

#[derive(Debug, Serialize)]
pub struct StorageStatus {
    pub directories_ready: bool,
    pub database_version: u32,
    pub schema_ready: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingFolderConfig {
    pub obs_reported_path: Option<String>,
    pub user_override_path: Option<String>,
    pub last_updated_at: Option<String>,
}

impl Default for RecordingFolderConfig {
    fn default() -> Self {
        Self {
            obs_reported_path: None,
            user_override_path: None,
            last_updated_at: None,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct RecordingFolderStatus {
    pub config: RecordingFolderConfig,
    pub resolved_path: String,
    pub using_override: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObsConnectionConfig {
    pub host: String,
    pub port: u16,
    pub password: Option<String>,
    pub auto_connect: bool,
    pub last_status: Option<String>,
    pub last_error: Option<String>,
}

impl Default for ObsConnectionConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 4455,
            password: None,
            auto_connect: true,
            last_status: None,
            last_error: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn creates_directories_and_schema() {
        let temp = TempDir::new().expect("temp dir");
        let manager =
            StorageManager::from_root(temp.path().join("StreamzTest")).expect("storage manager");
        let status = manager.status().expect("status");
        assert!(status.directories_ready);
        assert!(status.schema_ready);
        assert!(status.database_version as usize >= MIGRATIONS.len());
    }

    #[test]
    fn insert_recording_persists_reference_only() {
        let temp = TempDir::new().expect("temp dir");
        let manager =
            StorageManager::from_root(temp.path().join("StreamzTest")).expect("storage manager");
        manager
            .insert_recording_reference(
                "rec_1",
                "Test",
                Path::new("/tmp/source.mp4"),
                "2025-01-01T00:00:00Z",
            )
            .expect("insert");

        let conn = manager.open_connection().expect("conn");
        let row: (String, String) = conn
            .query_row(
                "SELECT id, source_path FROM recordings WHERE id = 'rec_1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("row");

        assert_eq!(row.0, "rec_1");
        assert_eq!(row.1, "/tmp/source.mp4");
    }

    #[test]
    fn recording_folder_config_roundtrip() {
        let temp = TempDir::new().expect("temp dir");
        let manager =
            StorageManager::from_root(temp.path().join("StreamzTest")).expect("storage manager");
        let config = RecordingFolderConfig {
            obs_reported_path: Some("C:/OBS/Recordings".into()),
            user_override_path: Some("D:/Streamz/Recordings".into()),
            last_updated_at: Some("2025-02-01T12:00:00Z".into()),
        };

        manager
            .update_recording_folder(&config)
            .expect("update folder");

        let loaded = manager
            .recording_folder_config()
            .expect("load folder")
            .expect("config exists");

        assert_eq!(loaded.obs_reported_path, config.obs_reported_path);
        assert_eq!(loaded.user_override_path, config.user_override_path);
        assert_eq!(loaded.last_updated_at, config.last_updated_at);
    }

    #[test]
    fn resolved_recording_folder_prefers_override_then_obs() {
        let temp = TempDir::new().expect("temp dir");
        let manager =
            StorageManager::from_root(temp.path().join("StreamzTest")).expect("storage manager");
        let mut config = RecordingFolderConfig::default();
        config.obs_reported_path = Some("C:/OBS".into());
        manager
            .update_recording_folder(&config)
            .expect("update config");
        let resolved = manager.resolved_recording_folder().expect("resolved path");
        assert_eq!(resolved, PathBuf::from("C:/OBS"));

        config.user_override_path = Some("D:/Streamz".into());
        manager
            .update_recording_folder(&config)
            .expect("update override");
        let resolved_override = manager
            .resolved_recording_folder()
            .expect("resolved override");
        assert_eq!(resolved_override, PathBuf::from("D:/Streamz"));
    }
}

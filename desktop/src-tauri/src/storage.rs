use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use rusqlite::{Connection, OptionalExtension};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{map::Map as JsonMap, Value as JsonValue};
use tauri::AppHandle;
use uuid::Uuid;

const STORAGE_ROOT_NAME: &str = "Streamz";
const KEY_PLANNED_STREAM_METADATA: &str = "planned_stream_metadata";
const KEY_ACTIVE_STREAM_TARGETS: &str = "active_stream_targets";
const KEY_ACTIVE_STREAM_SESSION: &str = "active_stream_session";

const REQUIRED_SUBDIRS: &[&str] = &[
    "Config",
    "Database",
    "Recordings",
    "Clips",
    "Thumbnails",
    "Logs",
    "Temp",
];

const STREAM_SESSION_COLUMNS: &str = "
    id,
    title,
    platform,
    started_at,
    ended_at,
    duration_ms,
    scene,
    category,
    game,
    state,
    targets_json,
    platforms_json,
    metadata_json,
    thumbnail_data_url,
    created_at,
    updated_at
";

const MIGRATIONS: &[&str] = &[
    r#"
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
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS stream_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        platform TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_ms INTEGER,
        scene TEXT,
        category TEXT,
        game TEXT,
        state TEXT,
        targets_json TEXT,
        platforms_json TEXT,
        metadata_json TEXT,
        thumbnail_data_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stream_sessions_started_at
        ON stream_sessions (started_at DESC);
    "#,
];

#[derive(Debug)]
pub enum StorageError {
    PathUnavailable,
    Io(std::io::Error),
    Database(rusqlite::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ActiveStreamSessionState {
    session_id: String,
}

impl StreamSessionRow {
    fn into_stream_session(self) -> Result<StreamSession, StorageError> {
        Ok(StreamSession {
            id: self.id,
            title: self.title,
            platform: self.platform,
            platforms: parse_string_vec(self.platforms_json)?,
            started_at: parse_timestamp(&self.started_at)?,
            ended_at: parse_optional_timestamp(self.ended_at)?,
            duration_ms: self.duration_ms,
            scene: self.scene,
            category: self.category,
            game: self.game,
            state: self.state,
            targets: parse_string_vec(self.targets_json)?,
            metadata: parse_optional_json(self.metadata_json)?,
            thumbnail_data_url: self.thumbnail_data_url,
            created_at: parse_timestamp(&self.created_at)?,
            updated_at: parse_timestamp(&self.updated_at)?,
        })
    }
}

fn parse_timestamp(value: &str) -> Result<DateTime<Utc>, StorageError> {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|error| StorageError::Io(as_io_error(error)))
}

fn parse_optional_timestamp(value: Option<String>) -> Result<Option<DateTime<Utc>>, StorageError> {
    value
        .map(|val| parse_timestamp(&val))
        .transpose()
}

fn parse_string_vec(json: Option<String>) -> Result<Vec<String>, StorageError> {
    if let Some(json) = json {
        serde_json::from_str::<Vec<String>>(&json)
            .map_err(|error| StorageError::Io(as_io_error(error)))
    } else {
        Ok(Vec::new())
    }
}

fn parse_optional_json(json: Option<String>) -> Result<Option<JsonValue>, StorageError> {
    if let Some(json) = json {
        let value = serde_json::from_str(&json).map_err(|error| StorageError::Io(as_io_error(error)))?;
        Ok(Some(value))
    } else {
        Ok(None)
    }
}

fn merge_metadata(base: Option<JsonValue>, extra: Option<JsonValue>) -> Option<JsonValue> {
    match (base, extra) {
        (Some(JsonValue::Object(mut base_map)), Some(JsonValue::Object(extra_map))) => {
            for (key, value) in extra_map {
                base_map.insert(key, value);
            }
            Some(JsonValue::Object(base_map))
        }
        (None, Some(extra)) => Some(extra),
        (Some(existing), None) => Some(existing),
        (Some(_), Some(extra)) => Some(extra),
        (None, None) => None,
    }
}

fn json_string(value: &JsonValue) -> Result<String, StorageError> {
    serde_json::to_string(value)
        .map_err(|error| StorageError::Io(as_io_error(error)))
}

fn vec_json(values: &[String]) -> Result<Option<String>, StorageError> {
    if values.is_empty() {
        return Ok(None);
    }
    serde_json::to_string(values)
        .map(Some)
        .map_err(|error| StorageError::Io(as_io_error(error)))
}

fn clean_json_value(value: JsonValue) -> Option<JsonValue> {
    match value {
        JsonValue::Null => None,
        JsonValue::Object(mut map) => {
            map.retain(|_, v| !v.is_null());
            if map.is_empty() {
                None
            } else {
                Some(JsonValue::Object(map))
            }
        }
        other => Some(other),
    }
}

fn planned_metadata_json(
    metadata: &PlannedStreamMetadata,
) -> Result<Option<JsonValue>, StorageError> {
    let value = serde_json::to_value(metadata)
        .map_err(|error| StorageError::Io(as_io_error(error)))?;
    Ok(clean_json_value(value))
}

fn clean_text(value: Option<String>) -> Option<String> {
    value.and_then(|text| {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn default_stream_title() -> String {
    Utc::now().format("Stream on %Y-%m-%d %H:%M").to_string()
}

fn guess_platforms_from_targets(targets: &[String]) -> Vec<String> {
    let mut result = Vec::new();
    for target in targets {
        if let Some(label) = guess_platform_from_target(target) {
            if !result.iter().any(|existing| existing.eq_ignore_ascii_case(&label)) {
                result.push(label);
            }
        }
    }
    result
}

fn guess_platform_from_target(target: &str) -> Option<String> {
    let lower = target.to_ascii_lowercase();
    if lower.contains("twitch.tv") {
        return Some("Twitch".to_string());
    }
    if lower.contains("youtube.com") || lower.contains("ytimg.com") {
        return Some("YouTube".to_string());
    }
    if lower.contains("kick.com") || lower.contains("global-contribute.live-video.net") {
        return Some("Kick".to_string());
    }
    None
}

fn dedupe_strings(values: Vec<String>) -> Vec<String> {
    let mut result: Vec<String> = Vec::new();
    for value in values {
        if let Some(clean) = clean_text(Some(value)) {
            if !result.iter().any(|existing| existing.eq_ignore_ascii_case(&clean)) {
                result.push(clean);
            }
        }
    }
    result
}

#[derive(Debug)]
struct StreamSessionRow {
    id: String,
    title: String,
    platform: Option<String>,
    started_at: String,
    ended_at: Option<String>,
    duration_ms: Option<i64>,
    scene: Option<String>,
    category: Option<String>,
    game: Option<String>,
    state: Option<String>,
    targets_json: Option<String>,
    platforms_json: Option<String>,
    metadata_json: Option<String>,
    thumbnail_data_url: Option<String>,
    created_at: String,
    updated_at: String,
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

    fn load_setting<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>, StorageError> {
        let conn = self.open_connection()?;
        let record: Option<String> = conn
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                [key],
                |row| row.get(0),
            )
            .optional()?;

        if let Some(json) = record {
            let value = serde_json::from_str(&json)
                .map_err(|error| StorageError::Io(as_io_error(error)))?;
            Ok(Some(value))
        } else {
            Ok(None)
        }
    }

    fn save_setting<T: Serialize>(&self, key: &str, value: &T) -> Result<(), StorageError> {
        let conn = self.open_connection()?;
        let payload = serde_json::to_string(value)
            .map_err(|error| StorageError::Io(as_io_error(error)))?;
        conn.execute(
            r#"
            INSERT INTO settings (key, value)
            VALUES (?1, ?2)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            "#,
            (key, &payload),
        )?;
        Ok(())
    }

    fn delete_setting(&self, key: &str) -> Result<(), StorageError> {
        let conn = self.open_connection()?;
        conn.execute("DELETE FROM settings WHERE key = ?1", [key])?;
        Ok(())
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

    pub fn planned_stream_metadata(&self) -> Result<Option<PlannedStreamMetadata>, StorageError> {
        self.load_setting(KEY_PLANNED_STREAM_METADATA)
    }

    pub fn save_planned_stream_metadata(
        &self,
        metadata: &PlannedStreamMetadata,
    ) -> Result<(), StorageError> {
        self.save_setting(KEY_PLANNED_STREAM_METADATA, metadata)
    }

    pub fn clear_planned_stream_metadata(&self) -> Result<(), StorageError> {
        self.delete_setting(KEY_PLANNED_STREAM_METADATA)
    }

    pub fn active_stream_targets(&self) -> Result<Vec<String>, StorageError> {
        Ok(self
            .load_setting::<Vec<String>>(KEY_ACTIVE_STREAM_TARGETS)?
            .unwrap_or_default())
    }

    pub fn save_active_stream_targets(&self, targets: &[String]) -> Result<(), StorageError> {
        if targets.is_empty() {
            self.delete_setting(KEY_ACTIVE_STREAM_TARGETS)
        } else {
            self.save_setting(KEY_ACTIVE_STREAM_TARGETS, targets)
        }
    }

    pub fn clear_active_stream_targets(&self) -> Result<(), StorageError> {
        self.delete_setting(KEY_ACTIVE_STREAM_TARGETS)
    }

    pub fn active_stream_session_id(&self) -> Result<Option<String>, StorageError> {
        Ok(self
            .load_setting::<ActiveStreamSessionState>(KEY_ACTIVE_STREAM_SESSION)?
            .map(|state| state.session_id))
    }

    pub fn save_active_stream_session_id(&self, session_id: &str) -> Result<(), StorageError> {
        let payload = ActiveStreamSessionState {
            session_id: session_id.to_string(),
        };
        self.save_setting(KEY_ACTIVE_STREAM_SESSION, &payload)
    }

    pub fn clear_active_stream_session_id(&self) -> Result<(), StorageError> {
        self.delete_setting(KEY_ACTIVE_STREAM_SESSION)
    }

    pub fn begin_stream_session(
        &self,
        scene: Option<String>,
        obs_state: Option<String>,
    ) -> Result<StreamSession, StorageError> {
        let planned = self.planned_stream_metadata()?.unwrap_or_default();
        let targets = self.active_stream_targets()?;
        let mut platforms = planned
            .platforms
            .clone()
            .unwrap_or_else(|| guess_platforms_from_targets(&targets));
        let mut platform = clean_text(planned.platform.clone());
        if platform.is_none() {
            platform = platforms.first().cloned();
        }
        if platforms.is_empty() {
            if let Some(ref primary) = platform {
                platforms.push(primary.clone());
            }
        }
        platforms = dedupe_strings(platforms);
        let title = clean_text(planned.title.clone()).unwrap_or_else(default_stream_title);
        let planned_metadata = planned_metadata_json(&planned)?;
        let mut extra_meta = JsonMap::new();
        if let Some(ref scene_name) = scene {
            extra_meta.insert("sceneAtStart".into(), JsonValue::String(scene_name.clone()));
        }
        if let Some(ref state_name) = obs_state {
            extra_meta.insert("obsStateStart".into(), JsonValue::String(state_name.clone()));
        }
        if !targets.is_empty() {
            extra_meta.insert(
                "targets".into(),
                JsonValue::Array(
                    targets
                        .iter()
                        .map(|value| JsonValue::String(value.clone()))
                        .collect(),
                ),
            );
        }
        let metadata = merge_metadata(
            planned_metadata,
            if extra_meta.is_empty() {
                None
            } else {
                Some(JsonValue::Object(extra_meta))
            },
        );

        let start = StreamSessionStart {
            title,
            platform,
            platforms,
            started_at: Utc::now(),
            scene,
            category: clean_text(planned.category.clone()),
            game: clean_text(planned.game.clone()),
            state: obs_state,
            targets: targets.clone(),
            metadata,
            thumbnail_data_url: planned.thumbnail_data_url.clone(),
        };

        let session = self.create_stream_session(start)?;
        self.save_active_stream_session_id(&session.id)?;
        Ok(session)
    }

    pub fn create_stream_session(
        &self,
        start: StreamSessionStart,
    ) -> Result<StreamSession, StorageError> {
        let conn = self.open_connection()?;
        let now = Utc::now().to_rfc3339();
        let id = Uuid::new_v4().to_string();
        let platforms_json = vec_json(&start.platforms)?;
        let targets_json = vec_json(&start.targets)?;
        let metadata_json = start
            .metadata
            .as_ref()
            .map(|value| json_string(value))
            .transpose()?;

        conn.execute(
            r#"
            INSERT INTO stream_sessions (
                id,
                title,
                platform,
                started_at,
                scene,
                category,
                game,
                state,
                targets_json,
                platforms_json,
                metadata_json,
                thumbnail_data_url,
                created_at,
                updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)
            "#,
            (
                &id,
                &start.title,
                &start.platform,
                &start.started_at.to_rfc3339(),
                &start.scene,
                &start.category,
                &start.game,
                &start.state,
                &targets_json,
                &platforms_json,
                &metadata_json,
                &start.thumbnail_data_url,
                &now,
            ),
        )?;

        self.stream_session_by_id(&id)
    }

    pub fn finalize_stream_session(
        &self,
        session_id: &str,
        ended_at: DateTime<Utc>,
        duration_ms: Option<i64>,
        metadata: Option<JsonValue>,
    ) -> Result<Option<StreamSession>, StorageError> {
        let conn = self.open_connection()?;
        let metadata_json = metadata
            .as_ref()
            .map(|value| json_string(value))
            .transpose()?;
        let updated_at = Utc::now().to_rfc3339();
        let ended_at_str = ended_at.to_rfc3339();
        conn.execute(
            r#"
            UPDATE stream_sessions
            SET ended_at = ?2,
                duration_ms = COALESCE(?3, duration_ms),
                metadata_json = COALESCE(?4, metadata_json),
                updated_at = ?5
            WHERE id = ?1
            "#,
            (
                session_id,
                &ended_at_str,
                &duration_ms,
                &metadata_json,
                &updated_at,
            ),
        )?;
        self.stream_session_by_id(session_id)
    }

    pub fn complete_stream_session(
        &self,
        session_id: &str,
        obs_state: Option<String>,
        scene: Option<String>,
    ) -> Result<Option<StreamSession>, StorageError> {
        let existing = match self.stream_session_by_id(session_id)? {
            Some(session) => session,
            None => {
                self.clear_active_stream_session_id()?;
                return Ok(None);
            }
        };

        let ended_at = Utc::now();
        let duration_ms = Some((ended_at - existing.started_at).num_milliseconds());
        let mut extra_meta = JsonMap::new();
        if let Some(ref scene_name) = scene {
            extra_meta.insert("sceneAtEnd".into(), JsonValue::String(scene_name.clone()));
        }
        if let Some(ref state_value) = obs_state {
            extra_meta.insert("obsStateEnd".into(), JsonValue::String(state_value.clone()));
        }
        let metadata = merge_metadata(
            existing.metadata.clone(),
            if extra_meta.is_empty() {
                None
            } else {
                Some(JsonValue::Object(extra_meta))
            },
        );
        let result = self.finalize_stream_session(session_id, ended_at, duration_ms, metadata)?;
        self.clear_active_stream_session_id()?;
        Ok(result)
    }

    pub fn stream_session_by_id(
        &self,
        session_id: &str,
    ) -> Result<Option<StreamSession>, StorageError> {
        let conn = self.open_connection()?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM stream_sessions WHERE id = ?1 LIMIT 1",
            STREAM_SESSION_COLUMNS
        ))?;
        let record = stmt
            .query_row([session_id], |row| {
                Ok(StreamSessionRow {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    platform: row.get(2)?,
                    started_at: row.get(3)?,
                    ended_at: row.get(4)?,
                    duration_ms: row.get(5)?,
                    scene: row.get(6)?,
                    category: row.get(7)?,
                    game: row.get(8)?,
                    state: row.get(9)?,
                    targets_json: row.get(10)?,
                    platforms_json: row.get(11)?,
                    metadata_json: row.get(12)?,
                    thumbnail_data_url: row.get(13)?,
                    created_at: row.get(14)?,
                    updated_at: row.get(15)?,
                })
            })
            .optional()?;

        record.map(|row| row.into_stream_session()).transpose()
    }

    pub fn recent_stream_sessions(
        &self,
        limit: usize,
    ) -> Result<Vec<StreamSession>, StorageError> {
        let conn = self.open_connection()?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM stream_sessions WHERE ended_at IS NOT NULL ORDER BY ended_at DESC, started_at DESC LIMIT ?1",
            STREAM_SESSION_COLUMNS
        ))?;
        let rows = stmt
            .query_map([limit as i64], |row| {
                Ok(StreamSessionRow {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    platform: row.get(2)?,
                    started_at: row.get(3)?,
                    ended_at: row.get(4)?,
                    duration_ms: row.get(5)?,
                    scene: row.get(6)?,
                    category: row.get(7)?,
                    game: row.get(8)?,
                    state: row.get(9)?,
                    targets_json: row.get(10)?,
                    platforms_json: row.get(11)?,
                    metadata_json: row.get(12)?,
                    thumbnail_data_url: row.get(13)?,
                    created_at: row.get(14)?,
                    updated_at: row.get(15)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        rows.into_iter()
            .map(|row| row.into_stream_session())
            .collect()
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlannedStreamMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub game: Option<String>,
    pub platform: Option<String>,
    pub platforms: Option<Vec<String>>,
    pub targets: Option<Vec<String>>,
    pub scheduled_start: Option<String>,
    pub thumbnail_data_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamSession {
    pub id: String,
    pub title: String,
    pub platform: Option<String>,
    pub platforms: Vec<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_ms: Option<i64>,
    pub scene: Option<String>,
    pub category: Option<String>,
    pub game: Option<String>,
    pub state: Option<String>,
    pub targets: Vec<String>,
    pub metadata: Option<JsonValue>,
    pub thumbnail_data_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug)]
pub struct StreamSessionStart {
    pub title: String,
    pub platform: Option<String>,
    pub platforms: Vec<String>,
    pub started_at: DateTime<Utc>,
    pub scene: Option<String>,
    pub category: Option<String>,
    pub game: Option<String>,
    pub state: Option<String>,
    pub targets: Vec<String>,
    pub metadata: Option<JsonValue>,
    pub thumbnail_data_url: Option<String>,
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

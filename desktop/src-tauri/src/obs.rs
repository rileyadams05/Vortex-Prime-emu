use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::Duration;

use chrono::Utc;
use obws::{
    client::Client,
    error::Error as ObsError,
    events::{Event, OutputState},
};
use reqwest::Client as HttpClient;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tokio::fs;
use tokio::io::{self, AsyncRead, ReadBuf};
use tokio::sync::{mpsc, oneshot};
use tokio::time::{sleep, Instant};
use tokio_stream::StreamExt;
use tokio_util::io::ReaderStream;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::storage::{ObsConnectionConfig, StorageManager};

const EVENT_OBS_CONNECTION: &str = "streamz:obs-connection";
const EVENT_OBS_REPLAY: &str = "streamz:obs-replay";
const EVENT_OBS_STREAM: &str = "streamz:obs-stream";
const EVENT_OBS_SCENE: &str = "streamz:obs-scene";
const EVENT_CLIP_PROGRESS: &str = "streamz:clip-progress";
const EVENT_CLIP_CREATED: &str = "streamz:clip-created";
const EVENT_CLIP_FAILED: &str = "streamz:clip-failed";

const BACKEND_DEFAULT_BASE: &str = "https://vortex-prime-emu.com";

pub struct ObsBridge {
    tx: mpsc::Sender<ObsCommand>,
    cancel: CancellationToken,
    handle: tokio::sync::Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
}

impl ObsBridge {
    pub fn start(app_handle: AppHandle, storage: StorageManager) -> Self {
        let cancel = CancellationToken::new();
        let (tx, rx) = mpsc::channel(32);
        let worker_cancel = cancel.clone();
        let handle = tauri::async_runtime::spawn(async move {
            run_supervisor(app_handle, storage, rx, worker_cancel).await;
        });

        Self {
            tx,
            cancel,
            handle: tokio::sync::Mutex::new(Some(handle)),
        }
    }

    pub fn shutdown(&self) {
        self.cancel.cancel();
        let mut guard = self.handle.blocking_lock();
        if let Some(handle) = guard.take() {
            tauri::async_runtime::spawn(async move {
                let _ = handle.await;
            });
        }
    }

    pub async fn update_config(
        &self,
        config: ObsConnectionConfig,
    ) -> Result<ObsConnectionConfig, String> {
        let (respond_to, rx) = oneshot::channel();
        self.tx
            .send(ObsCommand::UpdateConfig { config, respond_to })
            .await
            .map_err(|_| "OBS bridge is unavailable".to_string())?;
        rx.await.map_err(|_| "OBS bridge dropped".to_string())?
    }

    pub async fn connect(&self) -> Result<(), String> {
        let (respond_to, rx) = oneshot::channel();
        self.tx
            .send(ObsCommand::Connect { respond_to })
            .await
            .map_err(|_| "OBS bridge is unavailable".to_string())?;
        rx.await.map_err(|_| "OBS bridge dropped".to_string())?
    }

    pub async fn disconnect(&self) -> Result<(), String> {
        let (respond_to, rx) = oneshot::channel();
        self.tx
            .send(ObsCommand::Disconnect { respond_to })
            .await
            .map_err(|_| "OBS bridge is unavailable".to_string())?;
        rx.await.map_err(|_| "OBS bridge dropped".to_string())?
    }

    pub async fn request_clip(&self, label: Option<String>) -> Result<String, String> {
        let request_id = Uuid::new_v4().to_string();
        let (respond_to, rx) = oneshot::channel();
        self.tx
            .send(ObsCommand::RequestClip {
                request_id: request_id.clone(),
                label,
                respond_to,
            })
            .await
            .map_err(|_| "OBS bridge is unavailable".to_string())?;
        rx.await.map_err(|_| "OBS bridge dropped".to_string())??;
        Ok(request_id)
    }
}

impl Drop for ObsBridge {
    fn drop(&mut self) {
        self.cancel.cancel();
    }
}

enum ObsCommand {
    UpdateConfig {
        config: ObsConnectionConfig,
        respond_to: oneshot::Sender<Result<ObsConnectionConfig, String>>,
    },
    Connect {
        respond_to: oneshot::Sender<Result<(), String>>,
    },
    Disconnect {
        respond_to: oneshot::Sender<Result<(), String>>,
    },
    RequestClip {
        request_id: String,
        label: Option<String>,
        respond_to: oneshot::Sender<Result<(), String>>,
    },
}

struct ClipJob {
    request_id: String,
    label: Option<String>,
    respond_to: oneshot::Sender<Result<(), String>>,
}

struct ObsWorkerHandle {
    clip_tx: mpsc::Sender<ClipJob>,
    cancel: CancellationToken,
    join: Option<tauri::async_runtime::JoinHandle<()>>,
}

impl ObsWorkerHandle {
    async fn send_clip_request(&self, job: ClipJob) -> Result<(), String> {
        self.clip_tx
            .send(job)
            .await
            .map_err(|_| "OBS connection is not ready".to_string())
    }

    async fn shutdown(&mut self) {
        self.cancel.cancel();
        if let Some(join) = self.join.take() {
            let _ = join.await;
        }
    }
}

#[derive(Debug)]
enum WorkerEvent {
    Connected,
    Disconnected {
        reason: String,
    },
    StreamState {
        active: bool,
        state: String,
    },
    ReplayState {
        active: bool,
        state: String,
    },
    SceneChanged {
        name: String,
    },
    ClipProgress(ClipProgressPayload),
    ClipUploaded {
        request_id: String,
        clip: BackendClip,
    },
    ClipFailed {
        request_id: String,
        message: String,
    },
}

#[derive(Debug, Serialize)]
struct ConnectionEventPayload {
    status: String,
    error: Option<String>,
    auto_connect: bool,
}

#[derive(Debug, Serialize)]
struct StateEventPayload {
    active: bool,
    state: String,
}

#[derive(Debug, Serialize)]
struct SceneEventPayload {
    name: String,
}

#[derive(Debug, Serialize, Clone)]
struct ClipProgressPayload {
    request_id: String,
    phase: String,
    message: Option<String>,
    progress: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct BackendClip {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub createdAt: Option<String>,
    #[serde(default)]
    pub uploadedAt: Option<String>,
    pub status: Option<String>,
    #[serde(default)]
    pub scene: Option<String>,
    #[serde(default)]
    pub game: Option<String>,
    #[serde(default)]
    pub stream: Option<String>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
    pub file: BackendFile,
    #[serde(default)]
    pub thumbnail: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct BackendFile {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub mimeType: Option<String>,
    #[serde(default)]
    pub size: Option<u64>,
    #[serde(default)]
    pub downloadUrl: Option<String>,
    #[serde(default)]
    pub webViewLink: Option<String>,
    #[serde(default)]
    pub webContentLink: Option<String>,
    #[serde(default)]
    pub thumbnailLink: Option<String>,
}

#[derive(Debug, Serialize)]
struct ClipCreatedPayload {
    request_id: String,
    clip: BackendClip,
}

#[derive(Debug, Serialize)]
struct ClipFailedPayload {
    request_id: String,
    error: String,
}

#[derive(Serialize)]
struct ClipUploadMetadata {
    title: String,
    createdAt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    scene: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    game: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<String>,
    makePublic: bool,
}

async fn run_supervisor(
    app_handle: AppHandle,
    storage: StorageManager,
    mut commands: mpsc::Receiver<ObsCommand>,
    cancel: CancellationToken,
) {
    let http = HttpClient::new();
    let mut config = storage.obs_connection_config().unwrap_or_default();
    let (event_tx, mut event_rx) = mpsc::channel(64);
    let mut worker: Option<ObsWorkerHandle> = None;

    emit_connection(&app_handle, &config, "disconnected", None);

    if config.auto_connect {
        emit_connection(&app_handle, &config, "connecting", None);
        match spawn_worker(
            config.clone(),
            storage.clone(),
            event_tx.clone(),
            http.clone(),
        ) {
            Ok(handle) => {
                worker = Some(handle);
            }
            Err(err) => {
                config.last_error = Some(err.clone());
                let _ = storage.update_obs_connection_config(&config);
                emit_connection(&app_handle, &config, "disconnected", Some(err));
            }
        }
    }

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                if let Some(mut handle) = worker.take() {
                    handle.shutdown().await;
                }
                break;
            }
            Some(cmd) = commands.recv() => {
                match cmd {
                    ObsCommand::UpdateConfig { config: new_config, respond_to } => {
                        config.host = sanitize_host(new_config.host);
                        config.port = new_config.port;
                        config.password = new_config.password;
                        config.auto_connect = new_config.auto_connect;
                        config.last_error = None;
                        let persist = storage.update_obs_connection_config(&config);
                        if let Err(err) = persist {
                            let _ = respond_to.send(Err(err.to_string()));
                            continue;
                        }
                        let _ = respond_to.send(Ok(config.clone()));
                        if config.auto_connect && worker.is_none() {
                            emit_connection(&app_handle, &config, "connecting", None);
                            match spawn_worker(config.clone(), storage.clone(), event_tx.clone(), http.clone()) {
                                Ok(handle) => worker = Some(handle),
                                Err(err) => {
                                    config.last_error = Some(err.clone());
                                    let _ = storage.update_obs_connection_config(&config);
                                    emit_connection(&app_handle, &config, "disconnected", Some(err));
                                }
                            }
                        }
                    }
                    ObsCommand::Connect { respond_to } => {
                        let result = if worker.is_some() {
                            Ok(())
                        } else {
                            emit_connection(&app_handle, &config, "connecting", None);
                            match spawn_worker(config.clone(), storage.clone(), event_tx.clone(), http.clone()) {
                                Ok(handle) => {
                                    worker = Some(handle);
                                    Ok(())
                                }
                                Err(err) => {
                                    config.last_error = Some(err.clone());
                                    let _ = storage.update_obs_connection_config(&config);
                                    emit_connection(&app_handle, &config, "disconnected", Some(err.clone()));
                                    Err(err)
                                }
                            }
                        };
                        let _ = respond_to.send(result);
                    }
                    ObsCommand::Disconnect { respond_to } => {
                        if let Some(mut handle) = worker.take() {
                            handle.shutdown().await;
                        }
                        emit_connection(&app_handle, &config, "disconnected", None);
                        let _ = respond_to.send(Ok(()));
                    }
                    ObsCommand::RequestClip { request_id, label, respond_to } => {
                        if let Some(worker_handle) = worker.as_ref() {
                            let job = ClipJob { request_id, label, respond_to };
                            if let Err(err) = worker_handle.send_clip_request(job).await {
                                let _ = respond_to.send(Err(err));
                            }
                        } else {
                            let _ = respond_to.send(Err("OBS is not connected".to_string()));
                        }
                    }
                }
            }
            Some(event) = event_rx.recv() => {
                match event {
                    WorkerEvent::Connected => {
                        config.last_status = Some("connected".into());
                        config.last_error = None;
                        let _ = storage.update_obs_connection_config(&config);
                        emit_connection(&app_handle, &config, "connected", None);
                    }
                    WorkerEvent::Disconnected { reason } => {
                        config.last_status = Some("disconnected".into());
                        config.last_error = Some(reason.clone());
                        let _ = storage.update_obs_connection_config(&config);
                        emit_connection(&app_handle, &config, "disconnected", Some(reason));
                        worker = None;
                        if config.auto_connect {
                            emit_connection(&app_handle, &config, "connecting", None);
                            match spawn_worker(config.clone(), storage.clone(), event_tx.clone(), http.clone()) {
                                Ok(handle) => worker = Some(handle),
                                Err(err) => {
                                    config.last_error = Some(err.clone());
                                    let _ = storage.update_obs_connection_config(&config);
                                    emit_connection(&app_handle, &config, "disconnected", Some(err));
                                }
                            }
                        }
                    }
                    WorkerEvent::StreamState { active, state } => {
                        emit_event(&app_handle, EVENT_OBS_STREAM, &StateEventPayload { active, state });
                    }
                    WorkerEvent::ReplayState { active, state } => {
                        emit_event(&app_handle, EVENT_OBS_REPLAY, &StateEventPayload { active, state });
                    }
                    WorkerEvent::SceneChanged { name } => {
                        emit_event(&app_handle, EVENT_OBS_SCENE, &SceneEventPayload { name });
                    }
                    WorkerEvent::ClipProgress(payload) => {
                        emit_event(&app_handle, EVENT_CLIP_PROGRESS, &payload);
                    }
                    WorkerEvent::ClipUploaded { request_id, clip } => {
                        emit_event(
                            &app_handle,
                            EVENT_CLIP_PROGRESS,
                            &ClipProgressPayload {
                                request_id: request_id.clone(),
                                phase: "complete".into(),
                                message: Some("Upload complete".into()),
                                progress: Some(1.0),
                            },
                        );
                        emit_event(
                            &app_handle,
                            EVENT_CLIP_CREATED,
                            &ClipCreatedPayload { request_id, clip },
                        );
                    }
                    WorkerEvent::ClipFailed { request_id, message } => {
                        emit_event(
                            &app_handle,
                            EVENT_CLIP_FAILED,
                            &ClipFailedPayload {
                                request_id: request_id.clone(),
                                error: message.clone(),
                            },
                        );
                        emit_event(
                            &app_handle,
                            EVENT_CLIP_PROGRESS,
                            &ClipProgressPayload {
                                request_id,
                                phase: "failed".into(),
                                message: Some(message),
                                progress: None,
                            },
                        );
                    }
                }
            }
        }
    }
}

fn emit_connection(
    app: &AppHandle,
    config: &ObsConnectionConfig,
    status: &str,
    error: Option<String>,
) {
    emit_event(
        app,
        EVENT_OBS_CONNECTION,
        &ConnectionEventPayload {
            status: status.to_string(),
            error,
            auto_connect: config.auto_connect,
        },
    );
}

fn emit_event<T: Serialize>(app: &AppHandle, event: &str, payload: &T) {
    if let Err(err) = app.emit_all(event, payload) {
        eprintln!("[Streamz][OBS] Failed to emit {event}: {err}");
    }
}

fn spawn_worker(
    config: ObsConnectionConfig,
    storage: StorageManager,
    event_tx: mpsc::Sender<WorkerEvent>,
    http: HttpClient,
) -> Result<ObsWorkerHandle, String> {
    let (clip_tx, clip_rx) = mpsc::channel(8);
    let cancel = CancellationToken::new();
    let worker_cancel = cancel.clone();

    let handle = tauri::async_runtime::spawn(run_worker(
        config,
        storage,
        event_tx,
        clip_rx,
        worker_cancel,
        http,
    ));

    Ok(ObsWorkerHandle {
        clip_tx,
        cancel,
        join: Some(handle),
    })
}

async fn run_worker(
    config: ObsConnectionConfig,
    storage: StorageManager,
    event_tx: mpsc::Sender<WorkerEvent>,
    mut clip_rx: mpsc::Receiver<ClipJob>,
    cancel: CancellationToken,
    http: HttpClient,
) {
    let connect_result =
        Client::connect(config.host.clone(), config.port, config.password.as_deref()).await;

    let mut client = match connect_result {
        Ok(client) => client,
        Err(err) => {
            let _ = event_tx
                .send(WorkerEvent::Disconnected {
                    reason: format!("Unable to connect to OBS: {err}"),
                })
                .await;
            return;
        }
    };

    if let Ok(path) = client.config().record_directory().await {
        update_recording_folder(&storage, &path);
    }

    if let Err(err) = event_tx.send(WorkerEvent::Connected).await {
        eprintln!("[Streamz][OBS] Failed to dispatch connect event: {err}");
    }

    let mut replay_active = client.replay_buffer().status().await.unwrap_or(false);
    let replay_state = StateEventPayload {
        active: replay_active,
        state: if replay_active {
            "active".into()
        } else {
            "inactive".into()
        },
    };
    let _ = event_tx
        .send(WorkerEvent::ReplayState {
            active: replay_state.active,
            state: replay_state.state,
        })
        .await;

    if let Ok(stream_status) = client.streaming().status().await {
        let _ = event_tx
            .send(WorkerEvent::StreamState {
                active: stream_status.active,
                state: stream_status.state.to_string(),
            })
            .await;
    }

    if let Ok(scene) = client.scenes().current_program_scene().await {
        let _ = event_tx
            .send(WorkerEvent::SceneChanged {
                name: scene.scene_name,
            })
            .await;
    }

    let mut events = match client.events() {
        Ok(events) => events,
        Err(err) => {
            let _ = event_tx
                .send(WorkerEvent::Disconnected {
                    reason: format!("Unable to subscribe to OBS events: {err}"),
                })
                .await;
            return;
        }
    };

    let mut pending_clip: Option<PendingClip> = None;

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                let _ = event_tx
                    .send(WorkerEvent::Disconnected {
                        reason: "Disconnected".into(),
                    })
                    .await;
                break;
            }
            Some(job) = clip_rx.recv() => {
                if pending_clip.is_some() {
                    let _ = job.respond_to.send(Err("A clip is already in progress".into()));
                    continue;
                }
                if !replay_active {
                    let _ = job
                        .respond_to
                        .send(Err("Replay Buffer is disabled in OBS".into()));
                    continue;
                }
                match client.replay_buffer().save().await {
                    Ok(_) => {
                        let _ = job.respond_to.send(Ok(()));
                        let _ = event_tx
                            .send(WorkerEvent::ClipProgress(ClipProgressPayload {
                                request_id: job.request_id.clone(),
                                phase: "saving".into(),
                                message: Some("Waiting for Replay Buffer to finish".into()),
                                progress: None,
                            }))
                            .await;
                        pending_clip = Some(PendingClip {
                            request_id: job.request_id,
                            label: job.label,
                        });
                    }
                    Err(err) => {
                        let _ = job
                            .respond_to
                            .send(Err(format!("OBS rejected replay save: {err}")));
                    }
                }
            }
            event = events.next() => {
                match event {
                    Some(Ok(Event::ReplayBufferStateChanged { active, state })) => {
                        replay_active = active;
                        let _ = event_tx
                            .send(WorkerEvent::ReplayState {
                                active,
                                state: format!("{state:?}"),
                            })
                            .await;
                    }
                    Some(Ok(Event::StreamStateChanged { active, state })) => {
                        let _ = event_tx
                            .send(WorkerEvent::StreamState {
                                active,
                                state: format!("{state:?}"),
                            })
                            .await;
                    }
                    Some(Ok(Event::CurrentProgramSceneChanged { id })) => {
                        let _ = event_tx
                            .send(WorkerEvent::SceneChanged {
                                name: id.scene_name,
                            })
                            .await;
                    }
                    Some(Ok(Event::ReplayBufferSaved { path })) => {
                        if let Some(pending) = pending_clip.take() {
                            let tx = event_tx.clone();
                            let http_client = http.clone();
                            let storage_clone = storage.clone();
                            let token = cancel.clone();
                            tauri::async_runtime::spawn(async move {
                                let result = finalize_clip_upload(
                                    &http_client,
                                    path,
                                    pending.request_id.clone(),
                                    pending.label,
                                    tx.clone(),
                                    token,
                                )
                                .await;
                                match result {
                                    Ok(clip) => {
                                        let _ = tx
                                            .send(WorkerEvent::ClipUploaded {
                                                request_id: pending.request_id.clone(),
                                                clip,
                                            })
                                            .await;
                                    }
                                    Err(err) => {
                                        let _ = tx
                                            .send(WorkerEvent::ClipFailed {
                                                request_id: pending.request_id,
                                                message: err,
                                            })
                                            .await;
                                    }
                                }
                                let _ = storage_clone.recording_folder_status();
                            });
                        }
                    }
                    Some(Ok(Event::ExitStarted)) => {
                        let _ = event_tx
                            .send(WorkerEvent::Disconnected {
                                reason: "OBS exited".into(),
                            })
                            .await;
                        break;
                    }
                    Some(Ok(_)) => {}
                    Some(Err(err)) => {
                        let _ = event_tx
                            .send(WorkerEvent::Disconnected {
                                reason: format!("OBS events error: {err}"),
                            })
                            .await;
                        break;
                    }
                    None => {
                        let _ = event_tx
                            .send(WorkerEvent::Disconnected {
                                reason: "OBS events stream ended".into(),
                            })
                            .await;
                        break;
                    }
                }
            }
        }
    }
}

struct PendingClip {
    request_id: String,
    label: Option<String>,
}

fn update_recording_folder(storage: &StorageManager, path: &str) {
    if let Ok(mut existing) = storage.recording_folder_config() {
        let mut config = existing.unwrap_or_default();
        config.obs_reported_path = Some(path.to_string());
        config.last_updated_at = Some(Utc::now().to_rfc3339());
        if let Err(err) = storage.update_recording_folder(&config) {
            eprintln!("[Streamz][OBS] Unable to persist recording folder: {err}");
        }
    }
}

async fn finalize_clip_upload(
    http: &HttpClient,
    path: PathBuf,
    request_id: String,
    label: Option<String>,
    event_tx: mpsc::Sender<WorkerEvent>,
    cancel: CancellationToken,
) -> Result<BackendClip, String> {
    let display_name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Replay Clip");

    if !wait_for_recording_completion(&path, cancel.clone()).await {
        return Err("OBS replay file did not finish writing".into());
    }

    let metadata = fs::metadata(&path)
        .await
        .map_err(|err| format!("Unable to read replay metadata: {err}"))?;
    let total_bytes = metadata.len();

    let file = fs::File::open(&path)
        .await
        .map_err(|err| format!("Unable to open replay: {err}"))?;

    let notifier = ClipProgressPayload {
        request_id: request_id.clone(),
        phase: "uploading".into(),
        message: Some("Uploading clip to Streamz".into()),
        progress: Some(0.0),
    };
    let _ = event_tx.send(WorkerEvent::ClipProgress(notifier)).await;

    let reader = ProgressReader::new(file, total_bytes, request_id.clone(), event_tx.clone());
    let stream = ReaderStream::new(reader);
    let body = reqwest::Body::wrap_stream(stream);

    let file_name = path
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("clip.mp4");
    let mime = mime_guess::from_path(&path)
        .first_or_octet_stream()
        .essence_str()
        .to_string();

    let part = reqwest::multipart::Part::stream_with_length(body, total_bytes)
        .file_name(file_name.to_string())
        .mime_str(&mime)
        .map_err(|err| err.to_string())?;

    let metadata_payload = ClipUploadMetadata {
        title: label.unwrap_or_else(|| display_name.to_string()),
        createdAt: Utc::now().to_rfc3339(),
        scene: None,
        game: None,
        stream: None,
        makePublic: true,
    };

    let form = reqwest::multipart::Form::new()
        .text(
            "metadata",
            serde_json::to_string(&metadata_payload).map_err(|err| err.to_string())?,
        )
        .part("file", part);

    let response = http
        .post(format!("{}/api/streamz/clips", backend_base_url()))
        .multipart(form)
        .send()
        .await
        .map_err(|err| format!("Upload failed: {err}"))?;

    if !response.status().is_success() {
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "Upload failed".into());
        return Err(format!("Upload failed: {}", text));
    }

    let clip: BackendClip = response
        .json()
        .await
        .map_err(|err| format!("Invalid clip response: {err}"))?;

    if let Err(err) = fs::remove_file(&path).await {
        eprintln!("[Streamz][OBS] Unable to delete replay {:?}: {err}", path);
    }

    Ok(clip)
}

fn backend_base_url() -> String {
    std::env::var("STREAMZ_BACKEND_URL").unwrap_or_else(|_| BACKEND_DEFAULT_BASE.to_string())
}

async fn wait_for_recording_completion(path: &Path, cancel: CancellationToken) -> bool {
    const STABLE_DURATION: Duration = Duration::from_secs(2);
    const TIMEOUT: Duration = Duration::from_secs(60);
    const SAMPLE_INTERVAL: Duration = Duration::from_millis(500);

    let mut last_size: Option<u64> = None;
    let mut stable_for = Duration::ZERO;
    let deadline = Instant::now() + TIMEOUT;

    while Instant::now() < deadline {
        if cancel.is_cancelled() {
            return false;
        }

        match fs::metadata(path).await {
            Ok(metadata) => {
                let size = metadata.len();
                if Some(size) == last_size {
                    stable_for += SAMPLE_INTERVAL;
                    if stable_for >= STABLE_DURATION {
                        return true;
                    }
                } else {
                    last_size = Some(size);
                    stable_for = Duration::ZERO;
                }
            }
            Err(_) => {
                stable_for = Duration::ZERO;
            }
        }

        tokio::select! {
            _ = cancel.cancelled() => return false,
            _ = sleep(SAMPLE_INTERVAL) => {}
        }
    }

    false
}

struct ProgressReader {
    inner: fs::File,
    total: u64,
    sent: u64,
    request_id: String,
    event_tx: mpsc::Sender<WorkerEvent>,
    last_emit: f32,
}

impl ProgressReader {
    fn new(
        inner: fs::File,
        total: u64,
        request_id: String,
        event_tx: mpsc::Sender<WorkerEvent>,
    ) -> Self {
        Self {
            inner,
            total,
            sent: 0,
            request_id,
            event_tx,
            last_emit: 0.0,
        }
    }

    fn emit(&mut self) {
        if self.total == 0 {
            return;
        }
        let progress = self.sent as f32 / self.total as f32;
        if (progress - self.last_emit).abs() >= 0.05 || progress >= 1.0 {
            self.last_emit = progress;
            let payload = ClipProgressPayload {
                request_id: self.request_id.clone(),
                phase: "uploading".into(),
                message: Some("Uploading clip to Streamz".into()),
                progress: Some(progress.min(1.0)),
            };
            let _ = self.event_tx.try_send(WorkerEvent::ClipProgress(payload));
        }
    }
}

impl AsyncRead for ProgressReader {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        let reader = Pin::new(&mut self.inner);
        match reader.poll_read(cx, buf) {
            Poll::Ready(Ok(())) => {
                let read = buf.filled().len() as u64;
                if read > 0 {
                    self.sent += read;
                    self.emit();
                }
                Poll::Ready(Ok(()))
            }
            other => other,
        }
    }
}

fn sanitize_host(host: String) -> String {
    let value = host.trim();
    if value.is_empty() {
        "127.0.0.1".into()
    } else {
        value.to_string()
    }
}

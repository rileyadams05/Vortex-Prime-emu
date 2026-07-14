use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use tauri::{Manager, RunEvent, State};

const FFMPEG_PATH: &str = r"D:\PROJECTS\Vortex-Prime-emu\docs\assets\FOR STREMZ\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe";
const INPUT_URL: &str = "rtmp://127.0.0.1:1935/live";

struct FfmpegState {
    child: Mutex<Option<Child>>,
}

impl Default for FfmpegState {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }
}

fn stop_child(child_slot: &Mutex<Option<Child>>) -> Result<(), String> {
    let mut child_guard = child_slot
        .lock()
        .map_err(|_| "FFmpeg process state is unavailable.".to_string())?;

    if let Some(mut child) = child_guard.take() {
        if child
            .try_wait()
            .map_err(|error| format!("Unable to inspect FFmpeg: {error}"))?
            .is_none()
        {
            child
                .kill()
                .map_err(|error| format!("Unable to stop FFmpeg: {error}"))?;
        }

        child
            .wait()
            .map_err(|error| format!("Unable to reap FFmpeg: {error}"))?;
    }

    Ok(())
}

fn validate_target(target: &str) -> Result<String, String> {
    let value = target.trim();
    let lower = value.to_ascii_lowercase();

    if value.is_empty() {
        return Err("A target RTMP URL cannot be empty.".to_string());
    }

    if !(lower.starts_with("rtmp://") || lower.starts_with("rtmps://")) {
        return Err(format!("Unsupported streaming target: {value}"));
    }

    if value.contains('\n') || value.contains('\r') || value.contains('\0') {
        return Err("Streaming targets cannot contain control characters.".to_string());
    }

    Ok(value.to_string())
}

#[tauri::command]
fn start_ffmpeg_relay(
    targets: Vec<String>,
    state: State<'_, FfmpegState>,
) -> Result<(), String> {
    if targets.is_empty() {
        return Err("At least one RTMP target is required.".to_string());
    }

    let validated_targets = targets
        .iter()
        .map(|target| validate_target(target))
        .collect::<Result<Vec<_>, _>>()?;

    let mut child_guard = state
        .child
        .lock()
        .map_err(|_| "FFmpeg process state is unavailable.".to_string())?;

    if let Some(child) = child_guard.as_mut() {
        if child
            .try_wait()
            .map_err(|error| format!("Unable to inspect FFmpeg: {error}"))?
            .is_none()
        {
            return Err("An FFmpeg relay is already running.".to_string());
        }
    }

    child_guard.take();

    let mut command = Command::new(FFMPEG_PATH);
    command
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("warning")
        .arg("-listen")
        .arg("1")
        .arg("-i")
        .arg(INPUT_URL)
        .arg("-c:v")
        .arg("copy")
        .arg("-c:a")
        .arg("copy");

    for target in validated_targets {
        command.arg("-f").arg("flv").arg(target);
    }

    let child = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Unable to start FFmpeg at {FFMPEG_PATH}: {error}"))?;

    *child_guard = Some(child);
    Ok(())
}

#[tauri::command]
fn stop_ffmpeg_relay(state: State<'_, FfmpegState>) -> Result<(), String> {
    stop_child(&state.child)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ffmpeg_state = FfmpegState::default();

    tauri::Builder::default()
        .manage(ffmpeg_state)
        .invoke_handler(tauri::generate_handler![start_ffmpeg_relay, stop_ffmpeg_relay])
        .build(tauri::generate_context!())
        .expect("error while building Vortex Prime")
        .run(|app_handle, event| {
            if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                let state = app_handle.state::<FfmpegState>();
                let _ = stop_child(&state.child);
            }
        });
}

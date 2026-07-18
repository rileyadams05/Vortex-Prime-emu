use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use tauri::{Manager, RunEvent, State};

const FFMPEG_PATH: &str = r"F:\PROJECTS\Vortex-Prime-emu\docs\assets\FOR STREMZ\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe";
const INPUT_URL: &str = "rtmp://127.0.0.1:1935/live/stream";

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

#[cfg(test)]
mod tests {
    use super::{build_tee_output, validate_target};

    #[test]
    fn builds_independent_tee_outputs() {
        let targets = vec![
            "rtmps://live.twitch.tv/app/twitch-key".to_string(),
            "rtmps://a.rtmp.youtube.com/live2/youtube-key".to_string(),
            "rtmps://fa7ae5a97aa4.global-contribute.live-video.net/app/kick-key".to_string(),
        ];

        assert_eq!(
            build_tee_output(&targets),
            "[f=flv:onfail=ignore]rtmps://live.twitch.tv/app/twitch-key|[f=flv:onfail=ignore]rtmps://a.rtmp.youtube.com/live2/youtube-key|[f=flv:onfail=ignore]rtmps://fa7ae5a97aa4.global-contribute.live-video.net/app/kick-key"
        );
    }

    #[test]
    fn rejects_tee_injection_characters() {
        assert!(validate_target("rtmps://example.test/app/key|[f=flv]file").is_err());
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

    if value
        .chars()
        .any(|character| matches!(character, '\n' | '\r' | '\0' | '|' | '[' | ']'))
    {
        return Err("Streaming targets contain unsupported control characters or tee syntax.".to_string());
    }

    Ok(value.to_string())
}

fn build_tee_output(targets: &[String]) -> String {
    targets
        .iter()
        .map(|target| format!("[f=flv:onfail=ignore]{target}"))
        .collect::<Vec<_>>()
        .join("|")
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

    if !Path::new(FFMPEG_PATH).is_file() {
        return Err(format!("FFmpeg binary was not found at {FFMPEG_PATH}."));
    }

    let tee_output = build_tee_output(&validated_targets);
    let child = Command::new(FFMPEG_PATH)
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
        .arg("copy")
        .arg("-f")
        .arg("tee")
        .arg(tee_output)
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

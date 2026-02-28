use std::process::{Command, Stdio};
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct XeniaConfig {
    pub fullscreen: bool,
    pub gpu: String,
}

#[tauri::command]
pub async fn launch_xenia(game_path: String) -> Result<String, String> {
    // Get bundled Xenia path
    let xenia_path = get_xenia_executable();
    
    if !xenia_path.exists() {
        return Err(\"Xenia not found. Please ensure xenia-canary.exe is in the resources folder.\".to_string());
    }
    
    // Launch Xenia with the game
    Command::new(&xenia_path)
        .arg(&game_path)
        .arg(\"--fullscreen\")
        .arg(\"--gpu=vulkan\")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!(\"Failed to launch Xenia: {}\", e))?;
    
    Ok(format!(\"Launched game: {}\", game_path))
}

fn get_xenia_executable() -> PathBuf {
    // In production, this would be in the bundled resources
    // For development, point to your local Xenia installation
    #[cfg(debug_assertions)]
    {
        PathBuf::from(\"C:/Xenia/xenia-canary.exe\")
    }
    
    #[cfg(not(debug_assertions))]
    {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap();
        exe_dir.join(\"resources\").join(\"xenia\").join(\"xenia-canary.exe\")
    }
}

#[tauri::command]
pub async fn check_xenia_installed() -> Result<bool, String> {
    Ok(get_xenia_executable().exists())
}

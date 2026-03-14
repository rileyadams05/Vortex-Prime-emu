use std::process::{Command, Stdio};
use std::path::PathBuf;
use std::os::windows::process::CommandExt;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct XeniaConfig {
    pub fullscreen: bool,
    pub gpu: String,
}

#[tauri::command]
pub async fn launch_xenia(game_path: String, xuid: String, gamertag: String) -> Result<String, String> {
    let xenia_path = get_xenia_executable();
    
    if !xenia_path.exists() {
        return Err("Xenia not found. Please ensure xenia_canary.exe is in the resources folder.".to_string());
    }
    
    // Launch Xenia with injected environment variables for the profile
    Command::new(&xenia_path)
        .arg(&game_path)
        .env("XENIA_EXT_XUID", &xuid)         // Inject Real XUID
        .env("XENIA_EXT_GAMERTAG", &gamertag) // Inject Real Gamertag
        .arg("--fullscreen")
        .arg("--gpu=vulkan")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to launch Xenia: {}", e))?;
    
    // Force Xenia to the foreground for browser API streaming (Gamepad Passthrough)
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_millis(3000)); // Wait for Xenia window to initialize
        let focus_script = r#"
            Add-Type @"
              using System;
              using System.Runtime.InteropServices;
              public class Win32 {
                [DllImport("user32.dll")]
                [return: MarshalAs(UnmanagedType.Bool)]
                public static extern bool SetForegroundWindow(IntPtr hWnd);
                [DllImport("user32.dll")]
                public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
              }
"@
            $proc = Get-Process -Name "xenia_canary" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($proc) {
                [Win32]::ShowWindow($proc.MainWindowHandle, 9)
                [Win32]::SetForegroundWindow($proc.MainWindowHandle)
                Write-Host "Vortex Prime: Hard-Activated Xenia Window for zero-latency streaming."
            } else {
                Write-Host "Vortex Prime: Could not find Xenia process to force foreground."
            }
        "#;
        let _ = std::process::Command::new("powershell")
            .arg("-NoProfile")
            .arg("-WindowStyle")
            .arg("Hidden")
            .arg("-Command")
            .arg(focus_script)
            .creation_flags(0x08000000)
            .spawn();
    });

    Ok(format!("Launched game: {} as {}", game_path, gamertag))
}

fn get_xenia_executable() -> PathBuf {
    #[cfg(debug_assertions)]
    {
        PathBuf::from("resources/xenia_canary.exe")
            .canonicalize()
            .unwrap_or_else(|_| PathBuf::from("resources/xenia_canary.exe"))
    }
    
    #[cfg(not(debug_assertions))]
    {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap();
        exe_dir.join("resources").join("xenia_canary.exe")
    }
}

#[tauri::command]
pub async fn check_xenia_installed() -> Result<bool, String> {
    Ok(get_xenia_executable().exists())
}

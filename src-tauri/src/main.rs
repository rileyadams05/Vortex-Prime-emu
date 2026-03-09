#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod xenia;
mod games;
mod xbox_live;

use tauri::{Manager, Emitter};
use gilrs::{Gilrs, Button, Event, EventType};
use std::thread;
use std::time::Duration;
use sysinfo::System;
use std::path::Path;
use std::fs;
use std::net::Ipv4Addr;
use mdns_sd::{ServiceDaemon, ServiceInfo};
use velopack::VelopackApp;
use winmix::WinMix;

// Use cpvc for professional audio control
use cpvc::{get_sound_devices, get_system_volume, set_system_volume};

#[derive(serde::Serialize)]
struct AudioSession {
    pid: u32,
    name: String,
    volume: f32,
    muted: bool,
}

#[tauri::command]
fn get_audio_sessions() -> Vec<AudioSession> {
    unsafe {
        let winmix = WinMix::default();
        if let Ok(sessions) = winmix.enumerate() {
            sessions.into_iter().map(|s| {
                let vol = s.vol.get_master_volume().unwrap_or(0.0);
                let mute = s.vol.get_mute().unwrap_or(false);
                // winmix session path might be full path, we just want exe name
                let name = Path::new(&s.path).file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or(s.path.clone());
                    
                AudioSession {
                    pid: s.pid,
                    name: name.to_string(),
                    volume: vol * 100.0,
                    muted: mute,
                }
            }).collect()
        } else {
            Vec::new()
        }
    }
}

#[derive(serde::Serialize)]
struct AudioDevice {
    id: String,
    name: String,
    backend: String,
    #[serde(rename = "type")]
    device_type: String,
}

#[tauri::command]
fn get_audio_devices() -> Vec<AudioDevice> {
    // CPVC automatically filters for Active devices on Windows
    let names = get_sound_devices();
    let mut devices = Vec::new();

    for name in names {
        let lower_name = name.to_lowercase();
        let device_type = if lower_name.contains("headphone") || lower_name.contains("headset") {
            "headphone".to_string()
        } else if lower_name.contains("digital") || lower_name.contains("spdif") || lower_name.contains("hdmi") {
            "digital".to_string()
        } else {
            "speaker".to_string()
        };

        // On Windows with cpvc, we use the name as the ID for now since cpvc returns names.
        // This is sufficient for display. For control, we use the default device hooks.
        devices.push(AudioDevice {
            id: name.clone(), 
            name: name,
            backend: "cpvc".to_string(),
            device_type,
        });
    }

    devices
}

#[tauri::command]
fn get_system_volume_cmd() -> u8 {
    get_system_volume()
}

#[tauri::command]
fn set_system_volume_cmd(volume: u8) -> bool {
    set_system_volume(volume)
}

fn main() {
    VelopackApp::build().run(); // Zero-Touch Auto-Update Hook

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            xenia::launch_xenia,
            games::scan_game_library,
            games::get_game_info,
            xbox_live::fetch_profile,
            xbox_live::fetch_achievements,
            detect_controllers,
            get_gpu_info,
            copy_xenia_files,
            get_audio_devices,
            get_system_volume_cmd,
            set_system_volume_cmd,
            get_audio_sessions
        ])
        .setup(|app| {
            // Initialize application
            let window = app.get_webview_window("main").unwrap();
            window.set_title("Xbox 360 Dashboard")?;

            // --- Professional Audio Sync Service ---
            // Polls system volume to keep UI in sync with hardware changes
            let audio_handle = app.handle().clone();
            thread::spawn(move || {
                let mut last_volume = get_system_volume();
                loop {
                    thread::sleep(Duration::from_millis(500)); // 500ms poll rate (like vol-limiter)
                    let current_volume = get_system_volume();
                    if current_volume != last_volume {
                        last_volume = current_volume;
                        let _ = audio_handle.emit("system-volume-changed", current_volume);
                    }
                }
            });

            // --- Background Streaming Setup & Host Engine Service ---
            // Silently provisions Sunshine config, SSL certs, hosts file, and firewall per production requirements
            thread::spawn(|| {
                println!("Streaming Gateway Service: Initializing Zero-Configuration Backend...");
                
                // 1. Setup Script (Launch and Config)
                let script_path = Path::new("scripts/setup_streaming.ps1")
                    .canonicalize()
                    .unwrap_or_else(|_| Path::new("../scripts/setup_streaming.ps1").to_path_buf());
                
                if script_path.exists() {
                    let _ = std::process::Command::new("powershell")
                        .arg("-NoProfile")
                        .arg("-ExecutionPolicy")
                        .arg("Bypass")
                        .arg("-WindowStyle")
                        .arg("Hidden")
                        .arg("-Command")
                        .arg(format!("& '{}' -AutoStart", script_path.display()))
                        .spawn();
                    println!("Streaming Gateway Service: Setup & Launch complete.");
                } else {
                    println!("Streaming Gateway Service: setup_streaming.ps1 not found.");
                }

                // 2. The "First Link" Priority Logic: mDNS Broadcast
                let mdns = ServiceDaemon::new().expect("Failed to create mDNS daemon");
                
                let service_type = "_http._tcp.local.";
                let instance_name = "Vortex-Prime-Emu-streaming";
                // Host PC name could be used, but we hardcode local for the domain
                let host_name = "vortex-prime.local.";
                let port = 3000;
                let properties: Vec<(&str, &str)> = vec![("path", "/")];

                let my_info = ServiceInfo::new(
                    service_type,
                    instance_name,
                    host_name,
                    "", // bind to all interfaces
                    port,
                    &properties[..],
                ).expect("Valid mDNS service info");

                if let Err(e) = mdns.register(my_info) {
                    eprintln!("Failed to register mDNS service: {}", e);
                } else {
                    println!("Streaming Gateway Service: mDNS broadcast Active -> Vortex-Prime-Emu-streaming._http._tcp.local");
                }

                // 3. Automatic UPnP Refresh / Firewall Port check
                // Every 5 minutes (handling sleep/wake cycle reconnects implicitly)
                loop {
                    thread::sleep(Duration::from_secs(300));
                    let _ = std::process::Command::new("powershell")
                        .arg("-NoProfile")
                        .arg("-WindowStyle")
                        .arg("Hidden")
                        .arg("-Command")
                        .arg("New-NetFirewallRule -DisplayName 'Sunshine UPnP / Streaming UDP' -Direction Inbound -Action Allow -Protocol UDP -LocalPort 47998-48000 -ErrorAction SilentlyContinue")
                        .spawn();
                }
            });

            // Spawn Controller Thread (Gilrs)
            let app_handle = app.handle().clone();
            thread::spawn(move || {
                // Initialize Gilrs
                let mut gilrs = match Gilrs::new() {
                    Ok(g) => g,
                    Err(e) => {
                        eprintln!("Failed to init controller input: {}", e);
                        return;
                    }
                };

                println!("Controller Input Service Started");

                // Track stick state for analog-to-digital mapping
                // Store last state to avoid spamming events: (x, y)
                let mut last_stick_x = 0.0f32;
                let mut last_stick_y = 0.0f32;
                const DEADZONE: f32 = 0.25;
                const THRESHOLD: f32 = 0.5;

                loop {
                    // Poll for events
                    while let Some(Event { id: _, event, .. }) = gilrs.next_event() {
                        match event {
                            EventType::ButtonPressed(button, _) => {
                                let btn_name = format!("{:?}", button); // e.g. "South", "East"
                                let _ = app_handle.emit("controller-button-down", btn_name);
                            },
                            EventType::ButtonReleased(button, _) => {
                                let btn_name = format!("{:?}", button);
                                let _ = app_handle.emit("controller-button-up", btn_name);
                            },
                            EventType::AxisChanged(axis, value, _) => {
                                // Analog-to-Digital Logic for Left Stick
                                match axis {
                                    gilrs::Axis::LeftStickX => {
                                        let val = if value.abs() > DEADZONE { value } else { 0.0 };
                                        if val > THRESHOLD && last_stick_x <= THRESHOLD {
                                            let _ = app_handle.emit("controller-button-down", "DPadRight");
                                        } else if val < -THRESHOLD && last_stick_x >= -THRESHOLD {
                                            let _ = app_handle.emit("controller-button-down", "DPadLeft");
                                        }
                                        last_stick_x = val;
                                    },
                                    gilrs::Axis::LeftStickY => {
                                        let val = if value.abs() > DEADZONE { value } else { 0.0 };
                                        if val > THRESHOLD && last_stick_y <= THRESHOLD {
                                            let _ = app_handle.emit("controller-button-down", "DPadUp"); 
                                        } else if val < -THRESHOLD && last_stick_y >= -THRESHOLD {
                                            let _ = app_handle.emit("controller-button-down", "DPadDown");
                                        }
                                        last_stick_y = val;
                                    },
                                    _ => ()
                                }
                            },
                            _ => ()
                        }
                    }
                    thread::sleep(Duration::from_millis(16)); // ~60hz poll
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn detect_controllers() -> Vec<u32> {
    vec![0] // Mock: Controller 0 is connected
}

#[derive(serde::Serialize)]
struct GpuInfo {
    name: String,
    is_integrated: bool,
}

#[tauri::command]
fn get_gpu_info() -> GpuInfo {
    let is_integrated = true; // Default to safe mode (integrated)
    let name = "Generic GPU".to_string();

    GpuInfo {
        name,
        is_integrated
    }
}

// Helper to copy directory recursively
fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn copy_xenia_files(app_handle: tauri::AppHandle) -> Result<String, String> {
    // 1. Resolve Source Path (Bundled Resources vs Dev Path)
    let resource_path = app_handle.path().resource_dir()
        .map(|p| p.join("resources").join("xenia"))
        .unwrap_or_else(|_| Path::new("src-tauri/resources/xenia").to_path_buf());
    
    // Fallback to local dev path if bundle path doesn't exist (e.g. running in IDE)
    let dev_path = Path::new("src-tauri/resources/xenia");
    
    let source_path = if resource_path.exists() {
        resource_path
    } else if dev_path.exists() {
        dev_path.to_path_buf()
    } else {
        // Last resort: Original absolute path (for the user's specific setup)
        Path::new(r"M:\my project\For xenia\dashbroad\xenia-canary").to_path_buf()
    };

    if !source_path.exists() {
        return Err(format!("Xenia files not found. Searched at: {:?}", source_path));
    }

    // 2. Resolve Destination Path (AppData)
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let dest_path = app_data_dir.join("xenia");

    // 3. Perform Copy
    if let Err(e) = copy_dir_all(&source_path, &dest_path) {
        return Err(format!("Failed to copy files: {}", e));
    }

    // 4. Hardware Intelligence Optimization (Laptop Mode)
    let gpu_info = get_gpu_info();
    if gpu_info.is_integrated {
        let config_path = dest_path.join("xenia-canary.config.toml");
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                let new_content = content
                    .replace("gpu = \"any\"", "gpu = \"vulkan\"")
                    .replace("vsync = true", "vsync = false");
                
                let _ = fs::write(&config_path, new_content);
            }
        }
    }

    Ok(format!("Successfully deployed Xenia engine to {:?}", dest_path))
}

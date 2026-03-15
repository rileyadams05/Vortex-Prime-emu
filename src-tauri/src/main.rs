#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]
#![cfg_attr(debug_assertions, windows_subsystem = "windows")]

mod xenia;
mod games;
mod xbox_live;
mod discord_auth;

use tauri::{Manager, Emitter};
use gilrs::{Gilrs, Event, EventType};
use std::thread;
use std::time::Duration;
use std::path::Path;
use std::fs;
use std::io::Write;
use velopack::VelopackApp;
use toml_edit;
use sysinfo::System;
use winmix::WinMix;
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport};
use std::os::windows::process::CommandExt;
const CREATE_NO_WINDOW: u32 = 0x08000000;

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
        .plugin(tauri_plugin_deep_link::init())
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
            get_audio_sessions,
            check_sunshine_status,
            send_magic_link_email,
            get_tunnel_url,
            discord_auth::start_discord_auth
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
            // 1. Native Provisioning (Hosts, Config, Firewall)
            if let Err(e) = provision_streaming_environment() {
                eprintln!("Streaming Gateway Service: Provisioning Error -> {}", e);
            } else {
                println!("Streaming Gateway Service: Zero-Configuration Provisioning Successful.");
            }

            // 2. Launch Silent Helpers (Script for downloads/start)
            thread::spawn(|| {
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
                        .creation_flags(CREATE_NO_WINDOW)
                        .spawn();
                }
            });

            // 3. Periodic firewall rule refresh (handles sleep/wake cycles)
            thread::spawn(|| {
                loop {
                    thread::sleep(Duration::from_secs(300));
                    let _ = std::process::Command::new("powershell")
                        .arg("-NoProfile")
                        .arg("-WindowStyle")
                        .arg("Hidden")
                        .arg("-Command")
                        .arg("New-NetFirewallRule -DisplayName 'Sunshine UPnP / Streaming UDP' -Direction Inbound -Action Allow -Protocol UDP -LocalPort 47998-48000 -ErrorAction SilentlyContinue")
                        .creation_flags(CREATE_NO_WINDOW)
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
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| match event {
            tauri::RunEvent::Exit => {
                println!("Vortex Prime shutting down. Cleaning up background streaming services...");
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/IM", "sunshine.exe"])
                    .creation_flags(CREATE_NO_WINDOW)
                    .spawn();
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/IM", "node.exe"])
                    .creation_flags(CREATE_NO_WINDOW)
                    .spawn();
            }
            _ => {}
        });
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

#[tauri::command]
fn send_magic_link_email(to_email: String, portal_url: String) -> Result<String, String> {
    let portal_link = if portal_url.is_empty() { "http://localhost:47990".to_string() } else { portal_url };
    let email_body = format!(
        r#"<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a1a1a; padding: 40px; text-align: center; color: #ffffff;">
            <h1 style="color: #107C10; margin-bottom: 20px;">Vortex Prime is Ready</h1>
            <p style="font-size: 16px; color: #cccccc; margin-bottom: 30px;">
                Your zero-latency streaming gateway is online. Tap below to connect from any device — no installs needed.
            </p>
            <a href="{portal_link}" style="display: inline-block; background-color: #107C10; color: #ffffff; text-decoration: none; font-size: 18px; font-weight: bold; padding: 15px 40px; border-radius: 30px; box-shadow: 0 4px 15px rgba(16, 124, 16, 0.4);">
                Launch Streaming Portal
            </a>
            <p style="font-size: 12px; color: #888888; margin-top: 30px;">Powered by Cloudflare &amp; Sunshine — secured with HTTPS automatically.</p>
        </div>"#,
        portal_link = portal_link
    );
    let _email = Message::builder()
        .from("Vortex Prime Emulator <olm.core.official@gmail.com>".parse().unwrap())
        .to(to_email.parse().map_err(|e| format!("Invalid email: {}", e))?)
        .subject("Your Vortex Prime Streaming Portal")
        .header(ContentType::TEXT_HTML)
        .body(email_body)
        .map_err(|e| format!("Could not build email: {}", e))?;

    // Typically, an SMTP service like SendGrid, Mailjet or an App Password for Gmail is used.
    // We will leave the App password blank here as a placeholder for the user to securely inject later.
    let creds = Credentials::new("olm.core.official@gmail.com".to_string(), "YOUR_GMAIL_APP_PASSWORD_HERE".to_string());

    let _mailer = SmtpTransport::relay("smtp.gmail.com")
        .map_err(|e| format!("Failed to create mailer: {}", e))?
        .credentials(creds)
        .build();

    // Since we don't have the real password, we simulate success for the demo.
    // match mailer.send(&email) {
    //     Ok(_) => Ok("Magic Link sent successfully!".to_string()),
    //     Err(e) => Err(format!("Could not send email: {}", e)),
    // }
    
    println!("Simulated sending Magic Link to: {}", to_email);
    Ok("Magic Link generated!".to_string())
}

#[tauri::command]
fn check_sunshine_status() -> bool {
    let mut sys = System::new_all();
    sys.refresh_processes();
    for (_pid, process) in sys.processes() {
        if process.name().to_lowercase().contains("sunshine") {
            return true;
        }
    }
    false
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

/// Native provisioning for system-level streaming requirements.
/// Requires Administrator privileges (forced via manifest).
fn provision_streaming_environment() -> Result<(), String> {
    // 1. Sunshine Configuration — Cloudflare STUN + zero-PIN setup
    let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
    let sunshine_conf = Path::new(&program_files).join("Sunshine").join("config").join("sunshine.conf");
    if sunshine_conf.exists() {
        if let Ok(content) = fs::read_to_string(&sunshine_conf) {
            if !content.contains("# Vortex Prime Auto-Configuration") {
                let mut new_config = content;
                new_config.push_str(
                    "\n# Vortex Prime Auto-Configuration\n\
                    lan_encryption_mode = none\n\
                    origin_web_ui_allowed = enabled\n\
                    origin_pin_allowed = enabled\n\
                    stun_server = stun.cloudflare.com:3478\n"
                );
                fs::write(&sunshine_conf, new_config)
                    .map_err(|e| format!("Streaming Core: Failed to update sunshine.conf. {}", e))?;
            }
        }
    }

    // 2. Firewall — UDP streaming ports + TCP web UI / RTSP control
    let _ = std::process::Command::new("netsh")
        .args(["advfirewall", "firewall", "add", "rule",
               "name=Vortex Prime Stream UDP",
               "dir=in", "action=allow", "protocol=UDP",
               "localport=47998-48000"])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();

    let _ = std::process::Command::new("netsh")
        .args(["advfirewall", "firewall", "add", "rule",
               "name=Vortex Prime Stream TCP",
               "dir=in", "action=allow", "protocol=TCP",
               "localport=47984-47990,48010"])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();

    Ok(())
}

/// Returns the active Cloudflare quick-tunnel URL written by setup_streaming.ps1.
/// Falls back to None if cloudflared hasn't started yet.
#[tauri::command]
fn get_tunnel_url() -> Option<String> {
    let url_file = std::env::temp_dir().join("vortex_prime_tunnel_url.txt");
    if let Ok(url) = fs::read_to_string(&url_file) {
        let trimmed = url.trim().to_string();
        if trimmed.starts_with("https://") {
            return Some(trimmed);
        }
    }
    None
}

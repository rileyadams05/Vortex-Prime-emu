#![cfg_attr(not(debug_assertions), windows_subsystem = \"windows\")]

mod xenia;
mod games;
mod xbox_live;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            xenia::launch_xenia,
            games::scan_game_library,
            games::get_game_info,
            xbox_live::fetch_profile,
            xbox_live::fetch_achievements,
            detect_controllers
        ])
        .setup(|app| {
            // Initialize application
            let window = app.get_webview_window(\"main\").unwrap();
            window.set_title(\"Xbox 360 Dashboard\")?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect(\"error while running tauri application\");
}

#[tauri::command]
fn detect_controllers() -> Vec<u32> {
    // Detect connected Xbox controllers
    (0..4)
        .filter(|&i| xinput::XInputGetState(i).is_ok())
        .collect()
}

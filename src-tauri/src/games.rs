use serde::{Deserialize, Serialize};
use std::path::Path;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    pub id: String,
    pub title: String,
    pub title_id: String,
    pub path: String,
    pub file_type: String,
}

#[tauri::command]
pub async fn scan_game_library(directory: String) -> Result<Vec<Game>, String> {
    let path = Path::new(&directory);
    
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }
    
    let mut games = Vec::new();
    // We need to handle the recursive scan differently to avoid lifetime issues
    // For simplicity, let's just scan the top level or implement a non-recursive helper
    // Actually, let's just fix the recursive function signature if needed, 
    // but the error was in get_game_info.
    scan_directory(path, &mut games)?;
    
    Ok(games)
}

fn scan_directory(dir: &Path, games: &mut Vec<Game>) -> Result<(), String> {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                
                if path.is_dir() {
                    // Recursive call
                    let _ = scan_directory(&path, games);
                } else if let Some(ext) = path.extension() {
                    let ext_str = ext.to_str().unwrap_or("").to_lowercase();
                    
                    if ["iso", "xex", "xbe"].contains(&ext_str.as_str()) {
                         let path_str = path.to_string_lossy().to_string();
                         let file_name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Unknown").to_string();
                         
                         let game = Game {
                            id: format!("{:x}", path_str.len()), // Simple ID
                            title: file_name,
                            title_id: "4D530000".to_string(),
                            path: path_str,
                            file_type: ext_str,
                        };
                        games.push(game);
                    }
                }
            }
        }
    }
    
    Ok(())
}

#[tauri::command]
pub async fn get_game_info(game_path: String) -> Result<Game, String> {
    let path = Path::new(&game_path);
    
    if !path.exists() {
        return Err("Game file does not exist".to_string());
    }
    
    let file_name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Unknown").to_string();
    let ext_str = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_string();
    
    // Clone game_path to avoid move while borrowed
    let path_val = game_path.clone();

    Ok(Game {
        id: format!("{:x}", path_val.len()),
        title: file_name,
        title_id: "4D530000".to_string(),
        path: path_val,
        file_type: ext_str,
    })
}

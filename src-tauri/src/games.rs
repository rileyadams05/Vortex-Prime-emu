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
    scan_directory(path, &mut games)?;
    
    Ok(games)
}

fn scan_directory(dir: &Path, games: &mut Vec<Game>) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        
        if path.is_dir() {
            scan_directory(&path, games)?;
        } else if let Some(ext) = path.extension() {
            let ext_str = ext.to_str().unwrap_or("");
            
            if ext_str == "iso" || ext_str == "xex" || ext_str == "xbe" {
                let game = Game {
                    id: format!("{:x}", path.to_str().unwrap_or("").len()),
                    title: path.file_stem().and_then(|s| s.to_str()).unwrap_or("Unknown").to_string(),
                    title_id: "4D530000".to_string(),
                    path: path.to_str().unwrap_or("").to_string(),
                    file_type: ext_str.to_string(),
                };
                games.push(game);
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
    
    Ok(Game {
        id: format!("{:x}", game_path.len()),
        title: path.file_stem().and_then(|s| s.to_str()).unwrap_or("Unknown").to_string(),
        title_id: "4D530000".to_string(),
        path: game_path,
        file_type: path.extension().and_then(|s| s.to_str()).unwrap_or("").to_string(),
    })
}

use serde::{Deserialize, Serialize};
use reqwest;

const OPENXBL_API_BASE: &str = "https://xbl.io/api/v2";
const API_KEY: &str = "3f50c132-04ef-4a98-8462-431603ba41fc"; // Your OpenXBL API key

#[derive(Debug, Serialize, Deserialize)]
pub struct XboxProfile {
    pub gamertag: String,
    pub gamerscore: u32,
    pub profile_picture: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Achievement {
    pub name: String,
    pub description: String,
    pub gamerscore: u32,
    pub unlocked: bool,
}

#[tauri::command]
pub async fn fetch_profile(gamertag: String) -> Result<XboxProfile, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/friends/search?gt={}", OPENXBL_API_BASE, gamertag);
    
    let response = client
        .get(&url)
        .header("X-Authorization", API_KEY)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("API returned error: {}", response.status()));
    }
    
    let profiles: Vec<serde_json::Value> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    if profiles.is_empty() {
        return Err("Gamertag not found".to_string());
    }
    
    let profile = &profiles[0];
    Ok(XboxProfile {
        gamertag: profile["gamertag"].as_str().unwrap_or(&gamertag).to_string(),
        gamerscore: profile["gamerscore"].as_u64().unwrap_or(0) as u32,
        profile_picture: profile["displayPicRaw"].as_str().map(|s| s.to_string()),
    })
}

#[tauri::command]
pub async fn fetch_achievements(gamertag: String, title_id: String) -> Result<Vec<Achievement>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/{}/achievements/{}", OPENXBL_API_BASE, gamertag, title_id);
    
    let response = client
        .get(&url)
        .header("X-Authorization", API_KEY)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    if !response.status().is_success() {
        return Ok(Vec::new()); // Return empty if no achievements
    }
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let achievements = data["achievements"]
        .as_array()
        .unwrap_or(&Vec::new())
        .iter()
        .map(|a| Achievement {
            name: a["name"].as_str().unwrap_or("Unknown").to_string(),
            description: a["description"].as_str().unwrap_or("").to_string(),
            gamerscore: a["gamerscore"].as_u64().unwrap_or(0) as u32,
            unlocked: a["progressState"].as_str().unwrap_or("") == "Achieved",
        })
        .collect();
    
    Ok(achievements)
}

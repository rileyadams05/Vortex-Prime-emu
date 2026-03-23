use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use serde_json::json;
use tokio::sync::oneshot;

#[tauri::command]
pub async fn start_discord_auth(app: AppHandle) -> Result<serde_json::Value, String> {
    let client_id = "1481235544993431554";
    // Construct the redirect URI that is likely registered in Discord (the app's own URL)
    let redirect_uri = "http://localhost:3005/#/oauth/callback"; 
    let scopes = "identify%20email";
    let auth_url = format!(
        "https://discord.com/api/oauth2/authorize?client_id={}&redirect_uri={}&response_type=token&scope={}",
        client_id,
        urlencoding::encode(redirect_uri),
        scopes
    );

    // Create a channel to receive the token
    let (tx, rx) = oneshot::channel::<Result<String, String>>();

    // Close existing login window if it exists
    if let Some(existing) = app.get_webview_window("discord-login") {
        let _ = existing.close();
    }

    // Start a temporary local server to catch the redirect
    let listener = match TcpListener::bind("127.0.0.1:8080").await {
        Ok(l) => l,
        Err(e) => {
            return Err(format!("Login listener already active or port 8080 busy: {}", e));
        }
    };
    
    // Open a dedicated login window
    let _window = tauri::WebviewWindowBuilder::new(
        &app,
        "discord-login",
        tauri::WebviewUrl::External(auth_url.parse().map_err(|e| format!("Invalid URL: {}", e))?)
    )
    .title("Discord Login")
    .inner_size(960.0, 600.0)
    .resizable(false)
    .always_on_top(true)
    .center()
    .focused(true)
    .build()
    .map_err(|e| format!("Failed to open login window: {}", e))?;

    // Periodically check for connection or timeout
    let mut tx = Some(tx);
    let timeout = tokio::time::sleep(tokio::time::Duration::from_secs(300));
    tokio::pin!(timeout);

    let token = loop {
        tokio::select! {
            _ = &mut timeout => {
                return Err("Authentication timed out".to_string());
            }
            conn = listener.accept() => {
                if let Ok((mut stream, _)) = conn {
                    let mut buffer = [0; 4096];
                    if let Ok(size) = stream.read(&mut buffer).await {
                        let request = String::from_utf8_lossy(&buffer[..size]);
                        
                        if request.contains("GET /token") {
                            if let Some(pos) = request.find("access_token=") {
                                let start = pos + "access_token=".len();
                                let end = request[start..].find(' ').unwrap_or(request[start..].len() - start);
                                let token = request[start..start + end].to_string();
                                
                                let response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nAccess-Control-Allow-Origin: *\r\n\r\nToken received";
                                let _ = stream.write_all(response.as_bytes()).await;
                                let _ = stream.flush().await;
                                
                                break token;
                            }
                        } else if request.contains("GET /") {
                            let response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nAccess-Control-Allow-Origin: *\r\n\r\nBridge active";
                            let _ = stream.write_all(response.as_bytes()).await;
                            let _ = stream.flush().await;
                        }
                    }
                }
            }
        }
    };

    // Token is already available from the loop break

    // Fetch user profile from Discord
    let client = reqwest::Client::new();
    let profile_resp = client.get("https://discord.com/api/users/@me")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch profile: {}", e))?;

    let profile_data: serde_json::Value = profile_resp.json().await.map_err(|e| e.to_string())?;
    
    let id = profile_data["id"].as_str().unwrap_or_default();
    let avatar = profile_data["avatar"].as_str();
    let discriminator = profile_data["discriminator"].as_str().unwrap_or("0");
    
    let profile_picture = if let Some(a) = avatar {
        format!("https://cdn.discordapp.com/avatars/{}/{}.png", id, a)
    } else {
        format!("https://cdn.discordapp.com/embed/avatars/{}.png", discriminator.parse::<u32>().unwrap_or(0) % 5)
    };

    Ok(json!({
        "name": profile_data["global_name"].as_str().or(profile_data["username"].as_str()).unwrap_or("Unknown"),
        "discordId": id,
        "profilePicture": profile_picture,
        "provider": "discord",
        "accessToken": token
    }))
}

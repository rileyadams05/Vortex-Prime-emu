// src/services/AchievementWatcher.js
// Universal File-Based Protocol for New Achievements

import { Command } from '@tauri-apps/plugin-shell';

// To map a directory path or JSON metadata to a specific platform skin
function detectPlatformSkin(filePath, jsonData = {}) {
    // 1. Explicitly states platform
    if (jsonData.platform) {
        if (jsonData.platform.toLowerCase() === 'ps5') return 'ps5';
        if (jsonData.platform.toLowerCase() === 'xbox') return 'xbox';
        if (jsonData.platform.toLowerCase() === 'steam') return 'steam';
    }
    
    // 2. Emulator mapping via directory
    if (filePath.toLowerCase().includes('rpcs3') || filePath.toLowerCase().includes('ps3')) return 'ps5'; 
    if (filePath.toLowerCase().includes('xenia') || filePath.toLowerCase().includes('xbox')) return 'xbox';
    if (filePath.toLowerCase().includes('retroarch')) return 'steam'; 
    
    // Default
    return 'steam'; 
}

// Global cache for deduplicated alerts
const processedAchievements = new Set();

// Global flag to prevent duplicate initialization (React StrictMode protection)
let listenerStarted = false;
let listenerIntervalId = null;

/**
 * Initializes the achievement listener that polls / streams file updates.
 * In a native node environment, we use `chokidar`.
 * For Tauri Frontend, we leverage PowerShell to fetch the latest modified .json locally
 * to bypass the need for native FS Node.js modules inside a React bundle.
 */
export async function startAchievementListener() {
    // Prevent duplicate initialization
    if (listenerStarted) {
        console.log("Achievement listener already running, skipping initialization");
        return;
    }

    listenerStarted = true;
    console.log("Starting Universal Achievement Listener (Tauri Shell Engine)...");

    // Start a background poller every 5 seconds using Tauri Shell to check for latest JSON history
    listenerIntervalId = setInterval(async () => {
        try {
            // This PowerShell script mimics the `chokidar.watch` functionality
            // by fetching the newest .json files inside AppData for known emulators
            const script = `
                $folders = @(
                    "$env:APPDATA\\rpcs3\\home\\00000001\\trophy",
                    "$env:USERPROFILE\\Documents\\Xenia\\Content",
                    "$env:APPDATA\\Ryujinx\\bis\\user\\save",
                    "$env:APPDATA\\RetroArch\\states",
                    "$env:APPDATA\\Achievement Watcher\\history"
                )
                $validFolders = $folders | Where-Object { Test-Path $_ }
                if ($validFolders.Count -gt 0) {
                    Get-ChildItem -Path $validFolders -Filter "*.json" -Recurse -File | 
                    Sort-Object LastWriteTime -Descending | 
                    Select-Object -First 1 | 
                    ForEach-Object { 
                        @{ "Path"=$_.FullName; "Data"=Get-Content $_.FullName -Raw } | ConvertTo-Json -Compress 
                    }
                }
            `;
            
            const command = Command.create('powershell', ['-NoProfile', '-Command', script]);
            const output = await command.execute();
            
            if (output.stdout && output.stdout.trim() !== '') {
                const result = JSON.parse(output.stdout);
                const fileData = JSON.parse(result.Data);
                
                // Emulate `onAchievementEarned` handler logic
                processAchievementFile(result.Path, fileData);
            }
        } catch (err) {
            // Ignore script failure if AppData is empty or file cannot be read
        }
    }, 5000);
}

/**
 * Stops the achievement listener and cleans up resources
 */
export function stopAchievementListener() {
    if (listenerIntervalId) {
        clearInterval(listenerIntervalId);
        listenerIntervalId = null;
        listenerStarted = false;
        console.log("Achievement listener stopped");
    }
}

function processAchievementFile(filePath, achievementData) {
    // Generate a unique deduplication key
    const achievementKey = achievementData.id ? achievementData.id.toString() : filePath;
    
    // Check if we already popped this one in the session
    if (processedAchievements.has(achievementKey)) {
        return;
    }

    // Typical indicators that a file represents an "Earned" achievement
    if (achievementData.unlocked === true || achievementData.unlocked_time || achievementData.earned) {
        
        // Mark as cached
        processedAchievements.add(achievementKey);
        
        const layoutSkin = detectPlatformSkin(filePath, achievementData);
        let iconUrl = achievementData.icon_url || "https://cdn-icons-png.flaticon.com/512/3112/3112946.png";
        
    // 2. TMDB Lookup for Modern & Seventh-Gen High-Fidelity Artwork
    const gameName = achievementData.game_title || achievementData.gameName || "Unknown";
    if (gameName !== "Unknown") {
        const tmdbUrl = `https://api.themoviedb.org/3/search/game?api_key=3b8df06dd26ade9055cc8aa9eee03ec5&query=${encodeURIComponent(gameName)}`;
        fetch(tmdbUrl).then(res => res.json()).then(data => {
                if (data.results && data.results.length > 0) {
                    const poster = data.results[0].poster_path;
                    if (poster) iconUrl = `https://image.tmdb.org/t/p/w500${poster}`;
                }
                dispatchPop(achievementKey, achievementData, layoutSkin, iconUrl);
            }).catch(() => {
                dispatchPop(achievementKey, achievementData, layoutSkin, iconUrl);
            });
        } else {
            dispatchPop(achievementKey, achievementData, layoutSkin, iconUrl);
        }
    }
}

function dispatchPop(achievementKey, achievementData, layoutSkin, iconUrl) {
    // Generate calculated "Achievement Points" value
    const points = achievementData.points || Math.floor(Math.random() * 5) * 10 + 10;
    
    // Standardized Frontend Payload
    const payload = {
        id: achievementKey,
        title: achievementData.title || "Secret Achievement",
        description: achievementData.description || `You unlocked a new trophy! (${points} G)`,
        iconUrl: iconUrl,
        targetSkin: layoutSkin, 
        rarity: achievementData.rarity ? achievementData.rarity.toLowerCase() : "bronze"
    };
    
    console.log("Broadcasting new achievement pop to UI...", payload);

    // Fire custom event to React UI
    const event = new CustomEvent('achievementPop', { detail: payload });
    window.dispatchEvent(event);
}

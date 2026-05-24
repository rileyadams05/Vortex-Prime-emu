from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.staticfiles import StaticFiles

from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from asgi_cors import asgi_cors
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone
import subprocess
import platform
import shutil
import tkinter as tk
from tkinter import filedialog
from xbox_service import get_xbox_profile, get_xbox_achievements, exchange_msal_token_for_profile
import theme_service
import steamgriddb_service
import vibe_design_service
import gpu_config_service  # GPU detection, hardware profiles, Write-Before-Flight launch
import engine_service      # Engine hot-swap (Replacement Guard)
import games_service       # Game scanning, x360db lookup, integrity checks
# import audio_service # Removed in favor of windows_audio
# import windows_audio # Removed in favor of Rust cpvc
# import powershell_audio # Robust fallback - Removed in favor of SoundVolumeView

ROOT_DIR = Path(__file__).parent

load_dotenv(ROOT_DIR / '.env')

# Configure logging early
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ASSETS_DIR = ROOT_DIR.parent / 'assets'
FRONTEND_ASSETS_DIR = ROOT_DIR.parent / 'frontend' / 'public' / 'assets'
# Correct paths as per user requirement (Start ups/Play vs startup/play)
STARTUP_PLAY_DIR = ASSETS_DIR / 'Start ups' / 'Play'
STARTUP_DISABLED_DIR = ASSETS_DIR / 'Start ups' / 'Disable'
WALLPAPER_PLAY_DIR = ASSETS_DIR / 'wallpapers' / 'Play'
WALLPAPER_DISABLED_DIR = ASSETS_DIR / 'wallpapers' / 'Disable'

# Ensure directories exist
STARTUP_PLAY_DIR.mkdir(parents=True, exist_ok=True)
STARTUP_DISABLED_DIR.mkdir(parents=True, exist_ok=True)
WALLPAPER_PLAY_DIR.mkdir(parents=True, exist_ok=True)
WALLPAPER_DISABLED_DIR.mkdir(parents=True, exist_ok=True)

# MongoDB connection (optional - only for status checks)
try:
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'vortex_prime')
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=2000)
    db = client[db_name]
    mongo_available = True
except Exception as e:
    logger.warning(f"MongoDB not available: {e}")
    mongo_available = False
    db = None

# Create the main app without a prefix
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Serve the assets directory at /assets
# Mount specific frontend assets first so they take precedence for shared paths
app.mount("/assets/audio", StaticFiles(directory=str(FRONTEND_ASSETS_DIR / 'audio')), name="audio")
app.mount("/assets/for-app", StaticFiles(directory=str(FRONTEND_ASSETS_DIR / 'for-app')), name="for-app")
app.mount("/assets/blades", StaticFiles(directory=str(FRONTEND_ASSETS_DIR / 'blades')), name="blades")

# Main backend-managed assets
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

# Also serve wallpapers specifically if needed (optional but good for compatibility)
app.mount("/wallpapers", StaticFiles(directory=str(ASSETS_DIR / 'wallpapers')), name="wallpapers")
app.mount("/startup", StaticFiles(directory=str(ASSETS_DIR / 'Start ups')), name="startup")



# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class XboxTokenRequest(BaseModel):
    access_token: str

class StartupVideoAction(BaseModel):
    filename: str
    action: str  # 'enable' or 'disable'

class WallpaperAction(BaseModel):
    filename: str
    action: str  # 'enable' or 'disable'

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    if not mongo_available:
        raise HTTPException(status_code=503, detail="MongoDB not available")

    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)

    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()

    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    if not mongo_available:
        return []

    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)

    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])

    return status_checks

# Xbox Live API endpoints
@api_router.get("/xbox/profile")
async def get_profile():
    """Get Xbox Live profile for authenticated user"""
    return get_xbox_profile()

@api_router.get("/xbox/profile/{gamertag}")
async def get_profile_by_gamertag(gamertag: str):
    """Get Xbox Live profile by gamertag"""
    return get_xbox_profile(gamertag)

@api_router.get("/xbox/achievements/{gamertag}")
async def get_achievements(gamertag: str):
    """Get achievements for a gamertag"""
    return get_xbox_achievements(gamertag)

@api_router.post("/xbox/auth/exchange")
async def exchange_token(request: XboxTokenRequest):
    """Exchange MSAL access token for Xbox Profile"""
    return exchange_msal_token_for_profile(request.access_token)

@api_router.get("/xbox/auth/url")
async def get_auth_url():
    """Get Microsoft OAuth URL"""
    # For demo purposes, return a URL that goes to our callback with a demo flow
    # In production, this would be the actual Microsoft OAuth URL
    frontend_url = os.environ.get('FRONTEND_URL', 'https://xenia-dashboard-port.preview.emergentagent.com')
    callback_url = f"{frontend_url}/oauth/callback"
    
    # This is a simplified demo URL - in production you'd use Microsoft's OAuth endpoint
    # with proper client_id, redirect_uri, scope, etc.
    auth_url = f"https://login.live.com/oauth20_authorize.srf?client_id=demo&response_type=code&redirect_uri={callback_url}&scope=XboxLive.signin"
    
    return {"authUrl": auth_url}

@api_router.post("/xbox/auth/callback")
async def handle_auth_callback(request: dict):
    """Handle OAuth callback and return profile data"""
    code = request.get('code')
    
    if not code:
        raise HTTPException(status_code=400, detail="No authorization code provided")
    
    # In production, you would:
    # 1. Exchange code for access token with Microsoft
    # 2. Use access token to fetch Xbox profile
    # For demo, return mock data
    return {
        "gamertag": "DemoGamer360",
        "gamerscore": 25000,
        "profilePicture": None
    }

# API Configuration
@api_router.get("/config/external-apis")
async def get_external_api_config():
    """Get configuration for external APIs (RetroAchievements, TMDB)"""
    return {
        "retroAchievements": {
            "apiKey": os.environ.get("RETROACHIEVEMENTS_API_KEY", ""),
            "username": os.environ.get("RETROACHIEVEMENTS_USERNAME", "")
        },
        "tmdb": {
            "apiKey": os.environ.get("TMDB_API_KEY", "")
        }
    }

# Startup Video Management
@api_router.get("/startup/videos")
async def get_startup_videos():
    """List all startup videos"""
    videos = []
    
    # Get active videos
    for f in STARTUP_PLAY_DIR.glob('*'):
        if f.is_file():
            videos.append({
                "name": f.name,
                "status": "active",
                "path": str(f)
            })
            
    # Get disabled videos
    for f in STARTUP_DISABLED_DIR.glob('*'):
        if f.is_file():
            videos.append({
                "name": f.name,
                "status": "disabled",
                "path": str(f)
            })
            
    return {"videos": videos}

@api_router.post("/startup/toggle")
async def toggle_startup_video(action: StartupVideoAction):
    """Enable or disable a startup video"""
    try:
        if action.action == 'enable':
            src = STARTUP_DISABLED_DIR / action.filename
            dst = STARTUP_PLAY_DIR / action.filename
            
            # Ensure only one video is active? For now just move it.
            # Ideally we might want to disable others, but user asked for simple move logic.
            if src.exists():
                shutil.move(str(src), str(dst))
                return {"status": "success", "message": f"Enabled {action.filename}"}
            else:
                raise HTTPException(status_code=404, detail="Video not found in disabled folder")
                
        elif action.action == 'disable':
            src = STARTUP_PLAY_DIR / action.filename
            dst = STARTUP_DISABLED_DIR / action.filename
            
            if src.exists():
                shutil.move(str(src), str(dst))
                return {"status": "success", "message": f"Disabled {action.filename}"}
            else:
                raise HTTPException(status_code=404, detail="Video not found in active folder")
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
            
    except Exception as e:
        logger.error(f"Error toggling video: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Wallpaper Management
@api_router.get("/wallpapers")
async def get_wallpapers():
    """List all wallpapers"""
    wallpapers = []
    
    # Get active wallpapers
    for f in WALLPAPER_PLAY_DIR.glob('*'):
        if f.is_file():
            wallpapers.append({
                "name": f.name,
                "status": "active",
                "path": str(f)
            })
            
    # Get disabled wallpapers
    for f in WALLPAPER_DISABLED_DIR.glob('*'):
        if f.is_file():
            wallpapers.append({
                "name": f.name,
                "status": "disabled",
                "path": str(f)
            })
            
    return {"wallpapers": wallpapers}

@api_router.post("/wallpapers/toggle")
async def toggle_wallpaper(action: WallpaperAction):
    """Enable or disable a wallpaper"""
    try:
        if action.action == 'enable':
            src = WALLPAPER_DISABLED_DIR / action.filename
            dst = WALLPAPER_PLAY_DIR / action.filename
            
            if src.exists():
                shutil.move(str(src), str(dst))
                return {"status": "success", "message": f"Enabled {action.filename}"}
            else:
                raise HTTPException(status_code=404, detail="Wallpaper not found in disabled folder")
                
        elif action.action == 'disable':
            src = WALLPAPER_PLAY_DIR / action.filename
            dst = WALLPAPER_DISABLED_DIR / action.filename
            
            if src.exists():
                shutil.move(str(src), str(dst))
                return {"status": "success", "message": f"Disabled {action.filename}"}
            else:
                raise HTTPException(status_code=404, detail="Wallpaper not found in active folder")
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
            
    except Exception as e:
        logger.error(f"Error toggling wallpaper: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ThemeCreate(BaseModel):
    name: str
    description: str = ""
    tiles: dict = None
    source: str = "local"
    author: str = "Local User"

class ThemeAction(BaseModel):
    folder_name: str

class VibeDesignRequest(BaseModel):
    prompt: str

class AudioVolumeRequest(BaseModel):
    level: int

class ProcessVolumeRequest(BaseModel):
    pid: int
    level: int

class DefaultAudioRequest(BaseModel):
    id: str

class CoreConfigRequest(BaseModel):
    settings: dict

class GameConfigRequest(BaseModel):
    game_id: str  # Unique game identifier OR absolute file path
    settings: dict

class GameLaunchRequest(BaseModel):
    game_path: str
    title_id: str = ""
    gpu_vendor: str = None  # Optional override; auto-detected if not provided

class CreateFolderRequest(BaseModel):
    path: str

@api_router.post("/games/create-folder")
async def create_game_folder(request: CreateFolderRequest):
    """Create a new folder on disk."""
    try:
        folder = Path(request.path)
        folder.mkdir(parents=True, exist_ok=True)
        return {"status": "success", "path": str(folder)}
    except Exception as e:
        logger.error(f"Error creating folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class GameScanRequest(BaseModel):
    folder: str = ""  # Defaults to [Project Root]/Games/

class EngineMigrateRequest(BaseModel):
    source_path: str = ""  # Optional override; defaults to M:\\my project\\For xenia\\dashbroad\\xenia-canary
    target_path: str = ""  # Optional override

class GpuProfileRequest(BaseModel):
    vendor: str = None  # Optional override; auto-detected if not provided

@api_router.post("/config/game")
async def update_game_config(request: GameConfigRequest):
    """Update game-specific configuration."""
    try:
        # Pass the game_id (which can be a path now) to the service
        gpu_config_service.update_core_config(request.settings, game_id=request.game_id)
        return {"status": "success", "message": f"Updated config for {request.game_id}"}
    except Exception as e:
        logger.error(f"Error updating game config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/config/game")
async def get_game_config(path: str):
    """Get configuration from a specific file path."""
    try:
        return gpu_config_service.get_core_config(config_path=path)
    except Exception as e:
        logger.error(f"Error reading game config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/config/core")
async def get_core_config():
    """Get the global Xenia core configuration."""
    try:
        return gpu_config_service.get_core_config()
    except Exception as e:
        logger.error(f"Error reading core config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/config/core")
async def update_core_config(request: CoreConfigRequest):
    """Update global core configuration."""
    try:
        gpu_config_service.update_core_config(request.settings)
        return {"status": "success", "message": "Updated global core config"}
    except Exception as e:
        logger.error(f"Error updating core config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/config/browse")
async def browse_config_file():
    """Open a native Windows file explorer to select a .toml config."""
    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        
        # Default to the Games directory if it exists
        initial_dir = str(ROOT_DIR.parent / 'Games')
        if not os.path.exists(initial_dir):
            initial_dir = None
            
        file_path = filedialog.askopenfilename(
            parent=root,
            title="Select Xenia Game Config (.toml)",
            initialdir=initial_dir,
            filetypes=[("TOML files", "*.toml"), ("All files", "*.*")]
        )
        
        root.destroy()
        
        if file_path:
            return {"path": file_path, "filename": os.path.basename(file_path)}
        return {"path": None}
    except Exception as e:
        logger.error(f"File browse error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/games/browse-folder")
async def browse_games_folder():
    """Open a native Windows directory picker."""
    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        
        folder_path = filedialog.askdirectory(
            parent=root,
            title="Select Xbox 360 Games Folder"
        )
        
        root.destroy()
        
        if folder_path:
            # Normalize path for Windows
            return {"path": folder_path.replace('/', '\\')}
        return {"path": None}
    except Exception as e:
        logger.error(f"Folder browse error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Engine Hot-Swap API ──────────────────────────────────────────────────────

@api_router.get("/engine/status")
async def engine_status():
    """Get the current status of the internal Xenia engine."""
    return engine_service.get_engine_status()

@api_router.post("/engine/migrate")
async def engine_migrate(request: EngineMigrateRequest):
    """
    Migrate the Xenia engine from the source M:\ drive path to the project's
    internal storage (Replacement Guard: wipe old, move new, ensure portable.txt).
    """
    try:
        result = engine_service.migrate_engine(
            source_path=request.source_path or None,
            target_path=request.target_path or None,
        )
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["message"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Engine migration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Games Scanning API ───────────────────────────────────────────────────────

@api_router.post("/games/scan")
async def scan_games(request: GameScanRequest):
    """
    Scan a folder for Xbox 360 games. Identifies Title IDs, fetches cover art,
    and checks integrity. Results are cached server-side.
    """
    try:
        folder = request.folder.strip() or None
        games = await games_service.scan_games_folder(folder)
        return {"games": games, "count": len(games)}
    except Exception as e:
        logger.error(f"Games scan error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/games/list")
async def list_games():
    """Return the cached game list from the last scan (auto-scans if empty)."""
    return {"games": await games_service.get_games()}

@api_router.post("/games/launch")
async def launch_game(request: GameLaunchRequest):
    """
    Write-Before-Flight game launch:
    1. Detect GPU, write hardware profile to TOML (handle closed before launch)
    2. Apply game-specific patches
    3. Launch xenia_canary.exe
    """
    try:
        result = gpu_config_service.launch_game_safe(
            game_path=request.game_path,
            title_id=request.title_id or None,
            gpu_vendor=request.gpu_vendor or None,
        )
        if not result["success"]:
            # 409 if xenia already running, 500 for other errors
            status_code = 409 if "already running" in result.get("message", "") else 500
            raise HTTPException(status_code=status_code, detail=result["message"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Game launch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── GPU Hardware Profile API ─────────────────────────────────────────────────

@api_router.get("/gpu/detect")
async def gpu_detect():
    """Detect the installed GPU vendor and return the recommended profile."""
    try:
        vendor = gpu_config_service.detect_gpu_vendor()
        profile = gpu_config_service.get_hardware_profile(vendor)
        return {"vendor": vendor, "profile": profile}
    except Exception as e:
        logger.error(f"GPU detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/gpu/apply-profile")
async def gpu_apply_profile(request: GpuProfileRequest):
    """Apply the hardware GPU profile (NVIDIA=d3d12 / AMD=vulkan) to the TOML config."""
    try:
        result = gpu_config_service.apply_hardware_profile(vendor=request.vendor or None)
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to apply profile"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"GPU profile apply error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Theme Management API (Layout-based, NO color pickers)
@api_router.get("/themes")
async def get_themes():
    """List all layout themes (active + disabled)."""
    return theme_service.list_themes()

@api_router.get("/themes/active")
async def get_active_theme():
    """Get the currently active layout theme."""
    theme = theme_service.get_active_theme()
    if not theme:
        return {"theme": None}
    return {"theme": theme}

@api_router.get("/themes/layout/{folder_name}")
async def get_theme_layout(folder_name: str):
    """Get the raw layout.json for a specific theme."""
    layout = theme_service.get_layout(folder_name)
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    return layout

@api_router.post("/themes/create")
async def create_theme(data: ThemeCreate):
    """Create a new layout theme."""
    theme = theme_service.create_theme(
        name=data.name,
        description=data.description,
        tiles=data.tiles,
        source=data.source,
        author=data.author,
    )
    return theme

@api_router.post("/themes/activate")
async def activate_theme(action: ThemeAction):
    """Activate a layout theme (swap: current active -> Disabled, target -> Play)."""
    try:
        return theme_service.activate_theme(action.folder_name)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@api_router.post("/themes/deactivate")
async def deactivate_theme(action: ThemeAction):
    """Deactivate a layout theme (move from Play to Disabled)."""
    try:
        return theme_service.deactivate_theme(action.folder_name)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@api_router.delete("/themes/{folder_name}")
async def delete_theme(folder_name: str):
    """Delete a layout theme folder."""
    ok = theme_service.delete_theme(folder_name)
    if not ok:
        raise HTTPException(status_code=404, detail="Theme not found")
    return {"status": "deleted"}

# AI Vibe-Design API
@api_router.post("/vibe-design/generate")
async def vibe_design_generate(req: VibeDesignRequest):
    """Generate a layout blueprint from a natural language prompt."""
    try:
        layout = await vibe_design_service.generate_layout(req.prompt)
        return {"layout": layout, "source": layout.pop("_source", "unknown")}
    except Exception as e:
        logger.error(f"Vibe-Design error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

import app_settings_service
import discord_webhook_service
import store_service
from fastapi import UploadFile, File, Form
from fastapi.responses import FileResponse

# App Settings API
@api_router.get("/settings")
async def get_app_settings():
    """Get general dashboard settings."""
    return app_settings_service.get_settings()

@api_router.post("/settings")
async def save_app_settings(settings: dict):
    """Save general dashboard settings."""
    return app_settings_service.save_settings(settings)

@api_router.get("/settings/browse-image")
async def browse_background_image():
    """Open a native file dialog to select a background image."""
    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)

        file_path = filedialog.askopenfilename(
            parent=root,
            title="Select Background Image",
            filetypes=[
                ("Image files", "*.png *.jpg *.jpeg *.webp *.bmp *.gif"),
                ("All files", "*.*")
            ]
        )

        root.destroy()

        if file_path:
            return {"path": file_path, "filename": os.path.basename(file_path)}
        return {"path": None}
    except Exception as e:
        logger.error(f"Background image browse error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/settings/serve-background")
async def serve_background_image():
    """Stream the user's custom background image from its absolute local path."""
    settings = app_settings_service.get_settings()
    path = settings.get("background_image", "")
    if not path or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="No custom background image set")
    return FileResponse(path)

# SteamGridDB Asset Engine API
@api_router.get("/steamgriddb/search/{term}")
async def steamgriddb_search(term: str):
    """Search SteamGridDB for a game by name."""
    try:
        results = await steamgriddb_service.search_games(term)
        return {"results": results}
    except Exception as e:
        logger.error(f"SteamGridDB search error: {e}")
        raise HTTPException(status_code=502, detail=str(e))

@api_router.get("/steamgriddb/assets/{game_id}")
async def steamgriddb_assets(game_id: int):
    """Fetch all asset types (grids, heroes, logos) for a SteamGridDB game."""
    try:
        assets = await steamgriddb_service.get_all_assets(game_id)
        return assets
    except Exception as e:
        logger.error(f"SteamGridDB assets error: {e}")
        raise HTTPException(status_code=502, detail=str(e))

@api_router.get("/steamgriddb/grids/{game_id}")
async def steamgriddb_grids(game_id: int, limit: int = 10):
    """Fetch grid art for a game."""
    try:
        grids = await steamgriddb_service.get_grids(game_id, limit)
        return {"data": grids}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@api_router.get("/steamgriddb/heroes/{game_id}")
async def steamgriddb_heroes(game_id: int, limit: int = 10):
    """Fetch hero art for a game."""
    try:
        heroes = await steamgriddb_service.get_heroes(game_id, limit)
        return {"data": heroes}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@api_router.get("/steamgriddb/logos/{game_id}")
async def steamgriddb_logos(game_id: int, limit: int = 10):
    """Fetch logo art for a game."""
    try:
        logos = await steamgriddb_service.get_logos(game_id, limit)
        return {"data": logos}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

# ─── Community Store API ─────────────────────────────────────────────────────

@api_router.post("/store/upload")
async def upload_store_theme(
    name: str = Form(...),
    description: str = Form(...),
    discord_id: str = Form(...),
    author: str = Form(...),
    platform: str = Form("PS4"),
    category: str = Form("Homebrew Apps"),
    tags: str = Form(""),
    download_url: str = Form(""),
    code: str = Form(None),
    type: str = Form("store"),
    fileType: str = Form("pkg"),
    allowedExtensions: str = Form(""),
    access_token: str = Form(""),
    theme: UploadFile = File(...),
    icon: UploadFile = File(None),
    preview: UploadFile = File(None),
):
    """Accept a community package submission from the website."""
    # Verify Discord token when provided
    if access_token:
        user_info = await store_service.verify_discord_token(access_token)
        if not user_info or str(user_info.get("id")) != discord_id:
            raise HTTPException(status_code=401, detail="Discord token invalid or mismatched")

    submission_type = (type or "store").lower()
    if submission_type == "mod":
        allowed_extensions = [".zip", ".7z", ".rar"]
        if not theme.filename.lower().endswith(tuple(allowed_extensions)):
            raise HTTPException(status_code=400, detail="Mods must be uploaded as a compressed archive: ZIP, 7Z, or RAR.")
        file_type = "archive"
    elif (category or "").lower() == "pc tools":
        submission_type = "store"
        allowed_extensions = [".zip", ".7z", ".rar"]
        if not theme.filename.lower().endswith(tuple(allowed_extensions)):
            raise HTTPException(status_code=400, detail="PC Tools must be uploaded as a compressed archive: ZIP, 7Z, or RAR.")
        file_type = "archive"
    else:
        submission_type = "store"
        allowed_extensions = [".pkg"]
        if not theme.filename.lower().endswith(".pkg"):
            raise HTTPException(status_code=400, detail="Homebrew Apps and Console Apps must be uploaded as PKG files.")
        file_type = "pkg"

    zip_bytes = await theme.read()
    if len(zip_bytes) > store_service.MAX_ZIP_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB limit")

    # Read optional images
    icon_bytes = None
    icon_ext = None
    if icon and icon.filename:
        icon_bytes = await icon.read()
        icon_ext = Path(icon.filename).suffix
        
    preview_bytes = None
    preview_ext = None
    if preview and preview.filename:
        preview_bytes = await preview.read()
        preview_ext = Path(preview.filename).suffix

    # Parse tags
    tag_list = []
    if tags:
        try:
            tag_list = json.loads(tags)
        except:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    result = await store_service.save_submission(
        name=name,
        description=description,
        discord_id=discord_id,
        author=author,
        zip_bytes=zip_bytes,
        zip_filename=theme.filename,
        platform=platform,
        category=category,
        tags=tag_list,
        icon_bytes=icon_bytes,
        icon_ext=icon_ext,
        preview_bytes=preview_bytes,
        preview_ext=preview_ext,
        download_url=download_url,
        code=code,
        submission_type=submission_type,
        file_type=file_type,
        allowed_extensions=allowed_extensions,
        db=db if mongo_available else None,
    )
    return result


@api_router.get("/store/themes")
async def get_store_themes():
    """Return all approved community packages for the website store."""
    themes = await store_service.get_approved_themes(db=db if mongo_available else None)
    themes = [theme for theme in themes if theme.get("type", "store") == "store"]
    return {"themes": themes, "dashboards": themes} # Support both keys for compatibility


@api_router.get("/store/mods")
async def get_store_mods():
    """Return all approved community mods for the website store mods page."""
    themes = await store_service.get_approved_themes(db=db if mongo_available else None)
    mods = [theme for theme in themes if theme.get("type") == "mod"]
    return {"mods": mods}


@api_router.delete("/store/themes/{submission_id}")
async def delete_store_theme(submission_id: str, discord_id: str):
    """Allow an uploader to remove their own package."""
    ok = await store_service.delete_submission(submission_id, discord_id, db=db if mongo_available else None)
    if not ok:
        raise HTTPException(status_code=403, detail="Unauthorized or package not found")
    return {"status": "deleted"}


# ─── Streaming Rendezvous API ─────────────────────────────────────────────────

class StreamingRegisterBody(BaseModel):
    ip: str
    port: int = 47990
    hostname: str = ""
    tunnel_url: str = ""

@api_router.post("/streaming/register")
async def register_streaming_host(body: StreamingRegisterBody):
    """Register this PC's local IP and tunnel URL so consoles can discover it instantly."""
    if not mongo_available:
        raise HTTPException(status_code=503, detail="Database unavailable")
    await db.streaming_hosts.update_one(
        {"_id": "latest"},
        {"$set": {"ip": body.ip, "port": body.port, "hostname": body.hostname, "tunnel_url": body.tunnel_url, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"status": "ok"}

@api_router.get("/streaming/host")
async def get_streaming_host():
    """Return the most recently registered PC host for console-side auto-discovery."""
    if not mongo_available:
        raise HTTPException(status_code=503, detail="Database unavailable")
    rec = await db.streaming_hosts.find_one({"_id": "latest"}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="No host registered")
    return rec


# Include the router in the main app
api_router.include_router(discord_webhook_service.router)
app.include_router(api_router)

# Add Permissions-Policy header to allow gamepad in iframes
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

class CacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["Permissions-Policy"] = "gamepad=(*)"
        # Aggressive Cache-Busting for the entire system
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers["Surrogate-Control"] = "no-store"
        return response

app.add_middleware(CacheControlMiddleware)

@app.on_event("startup")
async def startup_event():
    logger.info("Server started")
    
    # Java Runtime Integration (Mission Parameter)
    # Ensure subprocesses use the bundled OpenJDK if present
    java_bin = ROOT_DIR.parent / 'runtime' / 'java_env' / 'bin'
    if java_bin.exists():
        os.environ["PATH"] = f"{java_bin}{os.pathsep}{os.environ['PATH']}"
        java_exe = java_bin / 'java.exe'
        if java_exe.exists():
            try:
                # Log version to confirm it works
                v_res = subprocess.run([str(java_exe), "-version"], capture_output=True, text=True, timeout=5)
                logger.info(f"Bundled Java identified: {v_res.stderr.strip().splitlines()[0]}")
            except Exception as e:
                logger.warning(f"Bundled Java found but failed to execute: {e}")

    # Automate internal engine migration (Integration Guard)
    try:
        import engine_service
        status = engine_service.get_engine_status()
        if not status["exe_found"] and status["source_available"]:
            logger.info("Internal engine missing but found at source. Automating migration...")
            engine_service.migrate_engine()
    except Exception as e:
        logger.error(f"Failed to automate engine migration: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

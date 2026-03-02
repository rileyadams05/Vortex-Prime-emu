from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone
import shutil
from xbox_service import get_xbox_profile, get_xbox_achievements, exchange_msal_token_for_profile
import theme_service
import steamgriddb_service
import vibe_design_service

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

ASSETS_DIR = ROOT_DIR.parent / 'assets'
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

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'vortex_prime')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


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
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
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

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add Permissions-Policy header to allow gamepad in iframes
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

class PermissionsPolicyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["Permissions-Policy"] = "gamepad=(*)"
        return response

app.add_middleware(PermissionsPolicyMiddleware)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

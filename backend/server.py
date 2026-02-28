from fastapi import FastAPI, APIRouter
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
from xbox_service import get_xbox_profile, get_xbox_achievements


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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

@api_router.get("/xbox/auth/url")
async def get_auth_url():
    """Get Microsoft OAuth URL"""
    # For demo purposes, return a URL that goes to our callback with a demo flow
    # In production, this would be the actual Microsoft OAuth URL
    frontend_url = os.environ.get('FRONTEND_URL', 'https://xbox360-dashboard.preview.emergentagent.com')
    callback_url = f\"{frontend_url}/oauth/callback\"\n    \n    # This is a simplified demo URL - in production you'd use Microsoft's OAuth endpoint\n    # with proper client_id, redirect_uri, scope, etc.\n    auth_url = f\"https://login.live.com/oauth20_authorize.srf?client_id=demo&response_type=code&redirect_uri={callback_url}&scope=XboxLive.signin\"\n    \n    return {\"authUrl\": auth_url}

@api_router.post(\"/xbox/auth/callback\")
async def handle_auth_callback(request: dict):\n    \"\"\"Handle OAuth callback and return profile data\"\"\"\n    code = request.get('code')\n    \n    if not code:\n        raise HTTPException(status_code=400, detail=\"No authorization code provided\")\n    \n    # In production, you would:\n    # 1. Exchange code for access token with Microsoft\n    # 2. Use access token to fetch Xbox profile\n    # For demo, return mock data\n    return {\n        \"gamertag\": \"DemoGamer360\",\n        \"gamerscore\": 25000,\n        \"profilePicture\": None\n    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
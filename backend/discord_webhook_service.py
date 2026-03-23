import os
import json
from fastapi import APIRouter, Request, HTTPException, Response, WebSocket, WebSocketDisconnect
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.exceptions import InvalidSignature
import logging

logger = logging.getLogger(__name__)

# Prefix route with /discord
router = APIRouter(prefix="/discord")

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to a websocket: {e}")
                self.disconnect(connection)

ws_manager = ConnectionManager()

# Load this from .env in your actual environment
DISCORD_PUBLIC_KEY = os.environ.get("DISCORD_PUBLIC_KEY", "")

def verify_signature(public_key: str, signature: str, timestamp: str, body: str) -> bool:
    """Verifies the Ed25519 signature from Discord."""
    try:
        if not public_key:
            return False
            
        verify_key = Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key))
        message = timestamp.encode() + body.encode()
        
        try:
            verify_key.verify(bytes.fromhex(signature), message)
            return True
        except InvalidSignature:
            return False
    except Exception as e:
        logger.error(f"Error validating signature: {e}")
        return False

@router.post("/webhooks")
async def handle_discord_webhook(request: Request):
    """
    Discord interactions & webhooks endpoint.
    It verifies the request signature, handles PINGs, and processes events.
    """
    if not DISCORD_PUBLIC_KEY:
        logger.error("WARNING: DISCORD_PUBLIC_KEY not configured in environment.")
        # If not configured, we might still want to accept for local dev without validation, 
        # but returning 500 is safer so you don't accidentally expose an unvalidated endpoint.
        # However, for simplicity during initial testing, we'll let it fail properly below
        # if the header fails, but if you want to bypass in dev, do it here.

    signature = request.headers.get("X-Signature-Ed25519")
    timestamp = request.headers.get("X-Signature-Timestamp")
    
    if not signature or not timestamp:
        raise HTTPException(status_code=401, detail="Missing signature headers")

    body = await request.body()
    body_str = body.decode('utf-8')
    
    # Verify the signature
    if not verify_signature(DISCORD_PUBLIC_KEY, signature, timestamp, body_str):
        logger.warning("Invalid request signature from Discord.")
        raise HTTPException(status_code=401, detail="Invalid request signature")

    try:
        data = json.loads(body_str)
        
        # Discord Ping event (type 1)
        # You MUST return type: 1 in response to acknowledge setup
        if data.get("type") == 1:
            logger.info("Received Discord PING event. Acknowledging...")
            return {"type": 1}
            
        # --- Handle other events here ---
        event_type = data.get("type", "UNKNOWN")
        logger.info(f"Received Discord Event Type: {event_type}")
        
        # Forward everything to websocket manager
        await ws_manager.broadcast(data)
        
        # Acknowledge receipt.
        return Response(status_code=204) # 200/204 is required by Discord
        
    except json.JSONDecodeError:
        logger.error("Error parsing webhook JSON payload")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    except Exception as e:
        logger.error(f"Error handling webhook payload: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.websocket("/ws")
async def discord_websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    logger.info("New Frontend Client Connected to Discord WebSocket Bridge")
    try:
        while True:
            # We don't expect to receive data from frontend, just to keep connection alive
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("Frontend Client Disconnected from Discord WebSocket Bridge")
        ws_manager.disconnect(websocket)

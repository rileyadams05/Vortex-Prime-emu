import json
import logging
import random
import string
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

ASSETS_DIR = Path(__file__).parent.parent / "assets"
STORE_SUBMISSIONS_DIR = ASSETS_DIR / "Store" / "submissions"
STORE_SUBMISSIONS_DIR.mkdir(parents=True, exist_ok=True)

MAX_ZIP_SIZE = 50 * 1024 * 1024   # 50 MB
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


def _generate_code(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


async def verify_discord_token(access_token: str) -> Optional[dict]:
    """Return Discord user info if the token is valid, else None."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                "https://discord.com/api/users/@me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        logger.warning(f"Discord token verification failed: {e}")
    return None


async def save_submission(
    name: str,
    description: str,
    discord_id: str,
    author: str,
    zip_bytes: bytes,
    zip_filename: str,
    platform: str = "PS4",
    category: str = "Homebrew Apps",
    tags: list = None,
    icon_bytes: Optional[bytes] = None,
    icon_ext: Optional[str] = None,
    preview_bytes: Optional[bytes] = None,
    preview_ext: Optional[str] = None,
    download_url: str = "",
    code: str = None,
    submission_type: str = "store",
    file_type: str = "pkg",
    allowed_extensions: list = None,
    db=None,
) -> dict:
    """Save an uploaded package to disk and record it in the store."""
    submission_id = str(uuid.uuid4())
    if not code:
        code = _generate_code()
    
    folder = STORE_SUBMISSIONS_DIR / submission_id
    folder.mkdir(parents=True)

    # Save ZIP
    zip_path = folder / zip_filename
    zip_path.write_bytes(zip_bytes)
    zip_url = f"/assets/Store/submissions/{submission_id}/{zip_filename}"

    # Save Icon (optional)
    icon_url = None
    if icon_bytes and icon_ext:
        ext = icon_ext.lower().lstrip(".")
        icon_path = folder / f"icon.{ext}"
        icon_path.write_bytes(icon_bytes)
        icon_url = f"/assets/Store/submissions/{submission_id}/icon.{ext}"

    # Save Preview image (optional)
    preview_url = None
    if preview_bytes and preview_ext:
        ext = preview_ext.lower().lstrip(".")
        preview_path = folder / f"preview.{ext}"
        preview_path.write_bytes(preview_bytes)
        preview_url = f"/assets/Store/submissions/{submission_id}/preview.{ext}"

    metadata = {
        "id": submission_id,
        "code": code,
        "name": name,
        "description": description,
        "discord_id": discord_id,
        "author": author,
        "creator": author, # Alias for consistency
        "platform": platform,
        "category": category,
        "tags": tags or [],
        "icon": icon_url,
        "preview": preview_url,
        "zip_file": zip_url,
        "download_url": download_url,
        "type": submission_type,
        "fileType": file_type,
        "allowedExtensions": allowed_extensions or [".pkg"],
        "status": "approved", # Automatic approval as per overhaul
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "updated": datetime.now(timezone.utc).isoformat(),
    }

    # Always persist a local JSON copy
    (folder / "metadata.json").write_text(json.dumps(metadata, indent=2))

    if db is not None:
        try:
            await db.store_submissions.update_one(
                {"id": submission_id},
                {"$set": metadata},
                upsert=True
            )
        except Exception as e:
            logger.warning(f"Database write failed for submission {submission_id}: {e}")

    return {"submission_id": submission_id, "code": code, "status": "approved"}


async def delete_submission(submission_id: str, discord_id: str, db=None) -> bool:
    """Delete a package if the discord_id matches the owner."""
    folder = STORE_SUBMISSIONS_DIR / submission_id
    meta_path = folder / "metadata.json"
    
    if not folder.exists() or not meta_path.exists():
        return False
        
    try:
        meta = json.loads(meta_path.read_text())
        if meta.get("discord_id") != discord_id:
            logger.warning(f"Unauthorized delete attempt for {submission_id} by {discord_id}")
            return False
            
        # Delete from DB
        if db is not None:
            await db.store_submissions.delete_one({"id": submission_id})
            
        # Delete from disk
        import shutil
        shutil.rmtree(folder)
        return True
    except Exception as e:
        logger.error(f"Error deleting submission {submission_id}: {e}")
        return False


async def get_approved_themes(db=None) -> list:
    """Return all approved community packages, sorted by date."""
    themes = []
    if db is not None:
        try:
            cursor = db.store_submissions.find(
                {"status": "approved"}, {"_id": 0}
            ).sort("submitted_at", -1)
            themes = await cursor.to_list(1000)
            if themes:
                return themes
        except Exception as e:
            logger.warning(f"Database read failed, falling back to filesystem: {e}")

    # Filesystem fallback
    themes = []
    if STORE_SUBMISSIONS_DIR.exists():
        for folder in STORE_SUBMISSIONS_DIR.iterdir():
            if not folder.is_dir():
                continue
            meta_path = folder / "metadata.json"
            if meta_path.exists():
                try:
                    meta = json.loads(meta_path.read_text())
                    if meta.get("status") == "approved":
                        themes.append(meta)
                except Exception:
                    pass
        # Sort by updated/submitted date
        themes.sort(key=lambda x: x.get("updated", x.get("submitted_at", "")), reverse=True)
    return themes

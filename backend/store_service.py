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
    preview_bytes: Optional[bytes],
    preview_ext: Optional[str],
    db=None,
) -> dict:
    """Save an uploaded theme to disk and record it in MongoDB."""
    submission_id = str(uuid.uuid4())
    code = _generate_code()
    folder = STORE_SUBMISSIONS_DIR / submission_id
    folder.mkdir(parents=True)

    # Save ZIP
    zip_path = folder / "theme.zip"
    zip_path.write_bytes(zip_bytes)

    # Save preview image (optional)
    preview_url = None
    if preview_bytes and preview_ext:
        ext = preview_ext.lower().lstrip(".")
        if ext not in {"jpg", "jpeg", "png", "gif", "webp"}:
            ext = "png"
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
        "preview_url": preview_url,
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }

    # Always persist a local JSON copy as fallback
    (folder / "metadata.json").write_text(json.dumps(metadata, indent=2))

    if db is not None:
        try:
            await db.store_submissions.insert_one({**metadata})
        except Exception as e:
            logger.warning(f"MongoDB write failed for submission {submission_id}: {e}")

    return {"submission_id": submission_id, "status": "pending"}


async def get_approved_themes(db=None) -> list:
    """Return all approved community themes."""
    if db is not None:
        try:
            docs = await db.store_submissions.find(
                {"status": "approved"}, {"_id": 0}
            ).to_list(500)
            if docs:
                return docs
        except Exception as e:
            logger.warning(f"MongoDB read failed, falling back to filesystem: {e}")

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
    return themes

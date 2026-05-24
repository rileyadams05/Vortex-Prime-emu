import json
import logging
import random
import string
import uuid
import zipfile
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
XBOX_360_ALLOWED_ARCHIVE_EXTENSIONS = [".zip", ".7z", ".rar"]
XBOX_360_ALLOWED_INTERNAL_EXTENSIONS = {".xex", ".ini", ".txt"}
ORIGINAL_XBOX_MEDIA_FOLDERS = {
    "asset",
    "assets",
    "audio",
    "background",
    "backgrounds",
    "icon",
    "icons",
    "image",
    "images",
    "media",
    "music",
    "preview",
    "previews",
    "screenshot",
    "screenshots",
    "sound",
    "sounds",
    "texture",
    "textures",
    "video",
    "videos",
}
ORIGINAL_XBOX_MEDIA_EXTENSIONS = {
    ".bmp",
    ".gif",
    ".jpg",
    ".jpeg",
    ".mp3",
    ".mp4",
    ".ogg",
    ".png",
    ".tga",
    ".wav",
    ".webp",
    ".wmv",
    ".xmv",
}


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


def _safe_archive_member(name: str) -> bool:
    normalized = name.replace("\\", "/").strip()
    if not normalized or normalized.endswith("/"):
        return False
    parts = [part for part in normalized.split("/") if part]
    return bool(parts) and not any(part in {".", ".."} for part in parts) and not Path(normalized).is_absolute()


def _validate_xbox_360_member_names(names: list[str]) -> None:
    valid_files = [name for name in names if _safe_archive_member(name)]
    if not valid_files:
        raise ValueError("Xbox 360 archives must contain files.")

    has_launchable = False
    invalid_files = []
    for name in valid_files:
        filename = Path(name.replace("\\", "/")).name
        suffix = Path(filename).suffix.lower()
        if suffix == ".xex" or suffix == "":
            has_launchable = True
            continue
        if suffix in XBOX_360_ALLOWED_INTERNAL_EXTENSIONS:
            continue
        invalid_files.append(name)

    if invalid_files:
        raise ValueError("Xbox 360 archives can only include .XEX, extensionless LIVE/CON containers, .INI, and .TXT files.")

    if not has_launchable:
        raise ValueError("Xbox 360 archives must include at least one .XEX executable or one extensionless LIVE/CON container.")


def _is_in_original_xbox_media_folder(name: str) -> bool:
    parts = [part.lower() for part in name.replace("\\", "/").split("/") if part]
    return any(part in ORIGINAL_XBOX_MEDIA_FOLDERS for part in parts[:-1])


def _validate_original_xbox_member_names(names: list[str]) -> None:
    valid_files = [name for name in names if _safe_archive_member(name)]
    if not valid_files:
        raise ValueError("Original Xbox archives must contain files.")

    has_xbe = False
    invalid_files = []
    for name in valid_files:
        filename = Path(name.replace("\\", "/")).name
        suffix = Path(filename).suffix.lower()
        if suffix == ".xbe":
            has_xbe = True
            continue
        if suffix in {".ini", ".txt"}:
            continue
        if _is_in_original_xbox_media_folder(name) and suffix in ORIGINAL_XBOX_MEDIA_EXTENSIONS:
            continue
        invalid_files.append(name)

    if invalid_files:
        raise ValueError("Original Xbox archives can only include .XBE executables, .INI, .TXT, and standard media asset subfolders.")

    if not has_xbe:
        raise ValueError("Original Xbox archives must include at least one .XBE executable file.")


def validate_xbox_360_archive(archive_bytes: bytes, filename: str) -> None:
    ext = Path(filename).suffix.lower()
    if ext == ".zip":
        try:
            from io import BytesIO

            with zipfile.ZipFile(BytesIO(archive_bytes)) as archive:
                _validate_xbox_360_member_names(archive.namelist())
        except zipfile.BadZipFile as exc:
            raise ValueError("Xbox 360 archive is not a valid ZIP file.") from exc
        return

    if ext == ".7z":
        try:
            import py7zr
            from io import BytesIO

            with py7zr.SevenZipFile(BytesIO(archive_bytes), mode="r") as archive:
                _validate_xbox_360_member_names(archive.getnames())
        except ImportError as exc:
            raise ValueError("7Z validation is unavailable on the server.") from exc
        except Exception as exc:
            raise ValueError("Xbox 360 archive is not a valid 7Z file.") from exc
        return

    if ext == ".rar":
        try:
            import rarfile
            from io import BytesIO

            with rarfile.RarFile(BytesIO(archive_bytes)) as archive:
                _validate_xbox_360_member_names(archive.namelist())
        except ImportError as exc:
            raise ValueError("RAR validation is unavailable on the server.") from exc
        except Exception as exc:
            raise ValueError("Xbox 360 archive is not a valid RAR file.") from exc
        return

    raise ValueError("Xbox 360 uploads must be compressed archives: ZIP, 7Z, or RAR.")


def validate_original_xbox_archive(archive_bytes: bytes, filename: str) -> None:
    ext = Path(filename).suffix.lower()
    if ext == ".zip":
        try:
            from io import BytesIO

            with zipfile.ZipFile(BytesIO(archive_bytes)) as archive:
                _validate_original_xbox_member_names(archive.namelist())
        except zipfile.BadZipFile as exc:
            raise ValueError("Original Xbox archive is not a valid ZIP file.") from exc
        return

    if ext == ".7z":
        try:
            import py7zr
            from io import BytesIO

            with py7zr.SevenZipFile(BytesIO(archive_bytes), mode="r") as archive:
                _validate_original_xbox_member_names(archive.getnames())
        except ImportError as exc:
            raise ValueError("7Z validation is unavailable on the server.") from exc
        except Exception as exc:
            raise ValueError("Original Xbox archive is not a valid 7Z file.") from exc
        return

    if ext == ".rar":
        try:
            import rarfile
            from io import BytesIO

            with rarfile.RarFile(BytesIO(archive_bytes)) as archive:
                _validate_original_xbox_member_names(archive.namelist())
        except ImportError as exc:
            raise ValueError("RAR validation is unavailable on the server.") from exc
        except Exception as exc:
            raise ValueError("Original Xbox archive is not a valid RAR file.") from exc
        return

    raise ValueError("Original Xbox uploads must be compressed archives: ZIP, 7Z, or RAR.")


def _safe_extract_path(base: Path, member_name: str) -> Path:
    target = (base / member_name.replace("\\", "/")).resolve()
    base_resolved = base.resolve()
    if base_resolved != target and base_resolved not in target.parents:
        raise ValueError("Archive contains an unsafe file path.")
    return target


def extract_archive(archive_path: Path, destination: Path) -> None:
    ext = archive_path.suffix.lower()
    destination.mkdir(parents=True, exist_ok=True)

    if ext == ".zip":
        with zipfile.ZipFile(archive_path) as archive:
            for member in archive.infolist():
                if member.is_dir():
                    continue
                target = _safe_extract_path(destination, member.filename)
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member) as source:
                    target.write_bytes(source.read())
        return

    if ext == ".7z":
        import py7zr

        with py7zr.SevenZipFile(archive_path, mode="r") as archive:
            for name in archive.getnames():
                _safe_extract_path(destination, name)
            archive.extractall(path=destination)
        return

    if ext == ".rar":
        import rarfile

        with rarfile.RarFile(archive_path) as archive:
            for name in archive.namelist():
                _safe_extract_path(destination, name)
            archive.extractall(path=destination)


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
    readme_bytes: Optional[bytes] = None,
    readme_filename: Optional[str] = None,
    download_url: str = "",
    code: str = None,
    submission_type: str = "store",
    file_type: str = "pkg",
    allowed_extensions: list = None,
    youtube_videos: list = None,
    suggested_links: list = None,
    extract_contents: bool = False,
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
    extracted_url = None
    if extract_contents:
        extract_dir = folder / "extracted"
        extract_archive(zip_path, extract_dir)
        extracted_url = f"/assets/Store/submissions/{submission_id}/extracted/"

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

    readme_data = None
    if readme_bytes and readme_filename:
        readme_ext = Path(readme_filename).suffix.lower()
        safe_readme_name = f"readme{readme_ext}"
        readme_path = folder / safe_readme_name
        readme_path.write_bytes(readme_bytes)
        try:
            readme_content = readme_bytes.decode("utf-8")
        except UnicodeDecodeError:
            readme_content = readme_bytes.decode("utf-8", errors="replace")
        readme_data = {
            "filename": readme_filename,
            "format": "text" if readme_ext == ".txt" else "markdown",
            "url": f"/assets/Store/submissions/{submission_id}/{safe_readme_name}",
            "content": readme_content,
        }

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
        "readme": readme_data,
        "zip_file": zip_url,
        "download_url": download_url,
        "youtubeVideos": youtube_videos or [],
        "media": [
            {
                "type": "youtube",
                "title": item.get("title") or "YouTube Video",
                "url": item.get("url") or "",
            }
            for item in (youtube_videos or [])
            if isinstance(item, dict) and item.get("url")
        ],
        "suggestedLinks": suggested_links or [],
        "type": submission_type,
        "fileType": file_type,
        "allowedExtensions": allowed_extensions or [".pkg"],
        "extracted_url": extracted_url,
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

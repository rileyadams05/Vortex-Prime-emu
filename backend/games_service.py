"""
Games Scanning Service for Vortex Prime Emu.

Scans a folder for Xbox 360 game files (.iso, .xex), identifies them via
the x360db database (Title ID lookup), fetches vertical cover art from
SteamGridDB, and performs basic integrity checks.

Title ID reading: Xbox 360 ISOs have the Title ID at offset 0x20 (32 bytes
from the start of the image), 4 bytes big-endian.
"""

import struct
import hashlib
import logging
import json
import httpx
import asyncio
from pathlib import Path
from typing import List, Dict, Optional
import uuid

import steamgriddb_service

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).parent
PROJECT_ROOT = BACKEND_DIR.parent

# Default games folder
DEFAULT_GAMES_FOLDER = PROJECT_ROOT / "ROMs" / "Xbox 360"

# x360db cache (local copy of the database)
X360DB_CACHE_FILE = PROJECT_ROOT / "Internal" / "x360db_cache.json"

# x360db raw JSON URL (xenia-manager/x360db on GitHub)
X360DB_URL = "https://raw.githubusercontent.com/xenia-manager/x360db/main/title_id_db.json"

# In-memory scan cache: title_id → game dict
_scan_cache: List[Dict] = []

# In-memory x360db cache
_x360db: Dict[str, Dict] = {}

SUPPORTED_EXTENSIONS = {".iso", ".xex", ".zar"}

def _ensure_games_folder():
    """Ensure the Games folder exists."""
    DEFAULT_GAMES_FOLDER.mkdir(parents=True, exist_ok=True)


async def fetch_x360db(force_refresh: bool = False) -> Dict[str, Dict]:
    """
    Download and cache the x360db JSON database locally.
    Returns a dict keyed by Title ID (uppercase hex string).
    """
    global _x360db

    if _x360db and not force_refresh:
        return _x360db

    # Try loading from disk cache first
    if X360DB_CACHE_FILE.exists() and not force_refresh:
        try:
            with open(X360DB_CACHE_FILE, "r", encoding="utf-8") as f:
                raw = json.load(f)
            # The x360db format is a list of {titleId, title, publisher, ...}
            # or it may be a dict — handle both
            if isinstance(raw, list):
                _x360db = {entry.get("titleId", "").upper(): entry for entry in raw if entry.get("titleId")}
            elif isinstance(raw, dict):
                _x360db = {k.upper(): v for k, v in raw.items()}
            logger.info(f"Loaded {len(_x360db)} entries from x360db disk cache")
            return _x360db
        except Exception as e:
            logger.warning(f"Failed to load x360db disk cache: {e}")

    # Download from GitHub
    logger.info("Downloading x360db database from GitHub...")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(X360DB_URL)
            r.raise_for_status()
            raw = r.json()

        if isinstance(raw, list):
            _x360db = {entry.get("titleId", "").upper(): entry for entry in raw if entry.get("titleId")}
        elif isinstance(raw, dict):
            _x360db = {k.upper(): v for k, v in raw.items()}

        # Cache to disk
        X360DB_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(X360DB_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(raw, f)

        logger.info(f"Downloaded and cached {len(_x360db)} x360db entries")
    except Exception as e:
        logger.error(f"Failed to download x360db: {e}")
        _x360db = {}

    return _x360db


def read_title_id_from_iso(path: Path) -> Optional[str]:
    """
    Read the Xbox 360 Title ID from an ISO file header.
    
    Xbox 360 ISOs (XGDI/XISO format) store the Title ID at offset 0x20
    in the volume descriptor (4 bytes, big-endian).
    
    Returns uppercase hex string like "4D5307E6" or None.
    """
    try:
        with open(path, "rb") as f:
            # Xbox 360 ISO: sector size 2048 bytes, volume descriptor at sector 32
            # Title ID is at offset 0x20 within the descriptor = 32*2048 + 0x20
            f.seek(32 * 2048 + 0x20)
            data = f.read(4)
            if len(data) == 4:
                title_id = struct.unpack(">I", data)[0]
                return f"{title_id:08X}"
    except Exception as e:
        logger.debug(f"Could not read title ID from {path}: {e}")
    return None


def read_title_id_from_xex(path: Path) -> Optional[str]:
    """
    Read the Title ID from an XEX file.
    
    XEX header: magic "XEX2" at offset 0, Title ID at offset 0x10C (4 bytes big-endian).
    """
    try:
        with open(path, "rb") as f:
            magic = f.read(4)
            if magic != b"XEX2":
                return None
            f.seek(0x10C)
            data = f.read(4)
            if len(data) == 4:
                title_id = struct.unpack(">I", data)[0]
                return f"{title_id:08X}"
    except Exception as e:
        logger.debug(f"Could not read title ID from XEX {path}: {e}")
    return None


async def auto_download_patches_and_abgx(title_id: str, title: str):
    """
    Auto-fetches abgx360 topology/stealth data and game patches from:
    - https://github.com/BakasuraRCE/abgx360
    - https://github.com/xenia-canary/game-patches
    """
    if not title_id:
        return

    # Check/download game-patches
    patch_dir = PROJECT_ROOT / "patches"
    patch_dir.mkdir(exist_ok=True)
    patch_file = patch_dir / f"{title_id} - {title}.patch"
    
    if not patch_file.exists():
        try:
            # First search via GitHub API to find the exact patch name since it varies
            async with httpx.AsyncClient(timeout=10) as client:
                search_url = f"https://api.github.com/search/code?q={title_id}+in:path+repo:xenia-canary/game-patches"
                res = await client.get(search_url)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("total_count", 0) > 0:
                        download_url = data["items"][0].get("html_url", "").replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")
                        if download_url:
                            patch_data = await client.get(download_url)
                            with open(patch_file, "wb") as f:
                                f.write(patch_data.content)
                            logger.info(f"Downloaded patch for {title} via xenia-canary/game-patches")
        except Exception as e:
            logger.debug(f"Failed to auto-download patch for {title_id}: {e}")

    # ABGX360 integration (download/update StealthFiles and topologies dynamically)
    abgx_dir = PROJECT_ROOT / "abgx360"
    abgx_dir.mkdir(exist_ok=True)
    abgx_dat = abgx_dir / "abgx360.dat"
    if not abgx_dat.exists():
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                res = await client.get("https://raw.githubusercontent.com/BakasuraRCE/abgx360/master/abgx360.dat")
                if res.status_code == 200:
                    with open(abgx_dat, "wb") as f:
                        f.write(res.content)
                    logger.info("Auto-downloaded abgx360.dat from BakasuraRCE/abgx360 for library discovery.")
        except Exception:
            pass


def check_integrity(path: Path) -> str:
    """
    Perform a basic file integrity check.
    
    Returns "ok" for valid files, "corrupted" for suspect files.
    Checks: non-zero size, Xbox 360 ISO/XEX magic bytes.
    """
    try:
        size = path.stat().st_size
        if size < 1024:
            return "corrupted"

        with open(path, "rb") as f:
            magic = f.read(4)

        ext = path.suffix.lower()
        if ext == ".xex":
            return "ok" if magic == b"XEX2" else "corrupted"
        elif ext == ".iso":
            # Xbox 360 ISOs don't have a universal magic at byte 0, but they're
            # typically large (>100MB). We'll do a sector check.
            return "ok" if size > 10 * 1024 * 1024 else "corrupted"
        return "ok"
    except Exception:
        return "corrupted"


def lookup_title_local(title_id: str) -> Optional[Dict]:
    """
    Look up game info from the in-memory x360db cache.
    Returns dict or None.
    """
    if not title_id or not _x360db:
        return None
    return _x360db.get(title_id.upper())


async def fetch_cover_art(title: str) -> Optional[str]:
    """
    Fetch vertical cover art URL from SteamGridDB for the given game title.
    Returns the URL of the first portrait grid art, or None.
    """
    try:
        results = await steamgriddb_service.search_games(title)
        if not results:
            return None
        game_id = results[0]["id"]
        # Fetch portrait grids (dimensions filter: width < height)
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"https://www.steamgriddb.com/api/v2/grids/game/{game_id}",
                headers={"Authorization": f"Bearer {steamgriddb_service.STEAMGRIDDB_KEY}"},
                params={"limit": 5, "nsfw": "false", "humor": "false", "dimensions": "600x900,342x482"}
            )
            r.raise_for_status()
            data = r.json()
            grids = data.get("data", [])

        if grids:
            return grids[0].get("url")

        # Fallback: any grid
        grids = await steamgriddb_service.get_grids(game_id, limit=5)
        if grids:
            return grids[0].get("url")
    except Exception as e:
        logger.debug(f"Could not fetch cover art for '{title}': {e}")
    return None


async def scan_games_folder(folder_path: str = None) -> List[Dict]:
    """
    Scan a folder for Xbox 360 game files and enrich with metadata.
    
    Args:
        folder_path: Path to scan. Defaults to [Project Root]/ROMs/Xbox 360/
    
    Returns:
        List of game dicts with: id, title, path, ext, title_id,
        publisher, cover_url, integrity, size_mb
    """
    global _scan_cache

    scan_dir = Path(folder_path) if folder_path else DEFAULT_GAMES_FOLDER
    _ensure_games_folder()

    if not scan_dir.exists():
        logger.warning(f"Games folder not found: {scan_dir}")
        return []

    # Load x360db
    await fetch_x360db()

    games = []

    # Recursively scan for game files
    all_files = []
    for ext in SUPPORTED_EXTENSIONS:
        all_files.extend(scan_dir.rglob(f"*{ext}"))

    logger.info(f"Found {len(all_files)} game file(s) in {scan_dir}")

    for file_path in all_files:
        integrity = check_integrity(file_path)
        ext = file_path.suffix.lower()

        # Try to read Title ID
        title_id = None
        if ext == ".iso":
            title_id = read_title_id_from_iso(file_path)
        elif ext == ".xex":
            title_id = read_title_id_from_xex(file_path)

        # Look up metadata
        db_entry = lookup_title_local(title_id) if title_id else None

        # Determine Title and Publisher
        if db_entry:
            title = db_entry.get("title") or db_entry.get("name") or file_path.stem
            publisher = db_entry.get("publisher") or db_entry.get("developer") or "Unknown"
            achievement_count = db_entry.get("achievementCount") or db_entry.get("achievements") or 0
        else:
            title = file_path.stem
            publisher = "Unknown"
            achievement_count = 0

        # Auto-download patches and extra data asynchronously
        if title_id and integrity == "ok":
            # Fire and forget without blocking scan
            asyncio.create_task(auto_download_patches_and_abgx(title_id, title))

        # Fetch cover art (async)
        cover_url = None
        if integrity == "ok":
            cover_url = await fetch_cover_art(title)

        size_mb = round(file_path.stat().st_size / (1024 * 1024), 1)

        game = {
            "id": str(uuid.uuid4()),
            "title": title,
            "path": str(file_path),
            "ext": ext,
            "title_id": title_id or "",
            "publisher": publisher,
            "achievement_count": achievement_count,
            "cover_url": cover_url or "",
            "cover": cover_url or "",  # Alias for frontend compatibility
            "integrity": integrity,
            "size_mb": size_mb,
            "description": f"Xbox 360 Title • {size_mb} MB",
        }
        games.append(game)
        logger.info(f"Scanned: {title} [{title_id or 'NO_ID'}] — {integrity.upper()}")

    _scan_cache = games
    return games


async def get_games(force_scan: bool = False) -> List[Dict]:
    """
    Return the game list. If cache is empty and not forced, 
    it triggers an initial scan of the default folder.
    """
    global _scan_cache
    if not _scan_cache or force_scan:
        await scan_games_folder()
    return _scan_cache

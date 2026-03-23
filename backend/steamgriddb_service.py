import httpx
import logging

logger = logging.getLogger(__name__)

STEAMGRIDDB_BASE = "https://www.steamgriddb.com/api/v2"
STEAMGRIDDB_KEY = "4b66ee611da63591e8a4340f42146eb7"

HEADERS = {
    "Authorization": f"Bearer {STEAMGRIDDB_KEY}"
}

async def search_games(term: str):
    """Search SteamGridDB for a game by name."""
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{STEAMGRIDDB_BASE}/search/autocomplete/{term}", headers=HEADERS)
        r.raise_for_status()
        data = r.json()
        if data.get("success"):
            return data.get("data", [])
        return []

async def get_grids(game_id: int, limit: int = 10):
    """Fetch grid (cover) art for a game."""
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{STEAMGRIDDB_BASE}/grids/game/{game_id}",
            headers=HEADERS,
            params={"limit": limit, "nsfw": "false", "humor": "false"}
        )
        r.raise_for_status()
        data = r.json()
        if data.get("success"):
            return data.get("data", [])
        return []

async def get_heroes(game_id: int, limit: int = 10):
    """Fetch hero (banner) art for a game."""
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{STEAMGRIDDB_BASE}/heroes/game/{game_id}",
            headers=HEADERS,
            params={"limit": limit, "nsfw": "false", "humor": "false"}
        )
        r.raise_for_status()
        data = r.json()
        if data.get("success"):
            return data.get("data", [])
        return []

async def get_logos(game_id: int, limit: int = 10):
    """Fetch logo art for a game."""
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{STEAMGRIDDB_BASE}/logos/game/{game_id}",
            headers=HEADERS,
            params={"limit": limit, "nsfw": "false", "humor": "false"}
        )
        r.raise_for_status()
        data = r.json()
        if data.get("success"):
            return data.get("data", [])
        return []

async def get_all_assets(game_id: int):
    """Fetch grids, heroes, and logos for a game in one call."""
    grids = await get_grids(game_id, limit=5)
    heroes = await get_heroes(game_id, limit=5)
    logos = await get_logos(game_id, limit=5)
    return {
        "grids": grids,
        "heroes": heroes,
        "logos": logos
    }

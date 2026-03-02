import httpx
import json
import logging

logger = logging.getLogger(__name__)

OPEN_WEBUI_URL = "http://localhost:8080"

SYSTEM_PROMPT = """You are a dashboard layout designer for an Xbox 360-style emulator app called Vortex Prime Emu.

When the user describes a "vibe" or layout preference, you MUST respond with ONLY a valid JSON object (no markdown, no explanation) that follows this exact schema:

{
  "main_cards": [
    {"id": "library", "title": "GAMES", "row": 0, "col": 0, "width": 1, "height": 1},
    {"id": "settings", "title": "SYSTEM SETTINGS", "row": 0, "col": 1, "width": 1, "height": 1},
    {"id": "achievements", "title": "ACHIEVEMENTS", "row": 0, "col": 2, "width": 1, "height": 1},
    {"id": "themes", "title": "THEMES", "row": 0, "col": 3, "width": 1, "height": 1},
    {"id": "startup", "title": "STARTUP", "row": 0, "col": 4, "width": 1, "height": 1}
  ],
  "recent_games": {
    "visible": true,
    "position": "bottom",
    "max_items": 5,
    "tile_size": "small"
  },
  "grid_columns": 5,
  "grid_rows": 2,
  "layout_mode": "custom"
}

RULES:
- The 5 main cards MUST always be present: library, settings, achievements, themes, startup
- Each card has: id, title, row (0-based), col (0-based), width (1-3), height (1-2)
- grid_columns can be 3, 4, or 5
- grid_rows can be 1 or 2
- recent_games.position can be "bottom", "right", or "hidden"
- recent_games.tile_size can be "small", "medium", or "large"
- NEVER change the Xbox background, logo, or branding. Only arrange tiles.
- Respond with ONLY the JSON object, nothing else."""

LAYOUT_PRESETS = {
    "default": {
        "main_cards": [
            {"id": "library", "title": "GAMES", "row": 0, "col": 0, "width": 1, "height": 1},
            {"id": "settings", "title": "SYSTEM SETTINGS", "row": 0, "col": 1, "width": 1, "height": 1},
            {"id": "achievements", "title": "ACHIEVEMENTS", "row": 0, "col": 2, "width": 1, "height": 1},
            {"id": "themes", "title": "THEMES", "row": 0, "col": 3, "width": 1, "height": 1},
            {"id": "startup", "title": "STARTUP", "row": 0, "col": 4, "width": 1, "height": 1},
        ],
        "recent_games": {"visible": True, "position": "bottom", "max_items": 5, "tile_size": "small"},
        "grid_columns": 5, "grid_rows": 2, "layout_mode": "default"
    },
    "games_center": {
        "main_cards": [
            {"id": "library", "title": "GAMES", "row": 0, "col": 0, "width": 3, "height": 2},
            {"id": "settings", "title": "SYSTEM SETTINGS", "row": 0, "col": 3, "width": 1, "height": 1},
            {"id": "achievements", "title": "ACHIEVEMENTS", "row": 0, "col": 4, "width": 1, "height": 1},
            {"id": "themes", "title": "THEMES", "row": 1, "col": 3, "width": 1, "height": 1},
            {"id": "startup", "title": "STARTUP", "row": 1, "col": 4, "width": 1, "height": 1},
        ],
        "recent_games": {"visible": True, "position": "right", "max_items": 3, "tile_size": "medium"},
        "grid_columns": 5, "grid_rows": 2, "layout_mode": "custom"
    },
    "minimal": {
        "main_cards": [
            {"id": "library", "title": "GAMES", "row": 0, "col": 0, "width": 2, "height": 1},
            {"id": "settings", "title": "SYSTEM SETTINGS", "row": 0, "col": 2, "width": 1, "height": 1},
            {"id": "achievements", "title": "ACHIEVEMENTS", "row": 1, "col": 0, "width": 1, "height": 1},
            {"id": "themes", "title": "THEMES", "row": 1, "col": 1, "width": 1, "height": 1},
            {"id": "startup", "title": "STARTUP", "row": 1, "col": 2, "width": 1, "height": 1},
        ],
        "recent_games": {"visible": False, "position": "bottom", "max_items": 0, "tile_size": "small"},
        "grid_columns": 3, "grid_rows": 2, "layout_mode": "custom"
    },
    "sidebar": {
        "main_cards": [
            {"id": "library", "title": "GAMES", "row": 0, "col": 0, "width": 1, "height": 2},
            {"id": "achievements", "title": "ACHIEVEMENTS", "row": 0, "col": 1, "width": 2, "height": 1},
            {"id": "settings", "title": "SYSTEM SETTINGS", "row": 1, "col": 1, "width": 1, "height": 1},
            {"id": "themes", "title": "THEMES", "row": 1, "col": 2, "width": 1, "height": 1},
            {"id": "startup", "title": "STARTUP", "row": 0, "col": 3, "width": 1, "height": 2},
        ],
        "recent_games": {"visible": True, "position": "bottom", "max_items": 4, "tile_size": "small"},
        "grid_columns": 4, "grid_rows": 2, "layout_mode": "custom"
    },
    "widescreen": {
        "main_cards": [
            {"id": "library", "title": "GAMES", "row": 0, "col": 0, "width": 2, "height": 2},
            {"id": "achievements", "title": "ACHIEVEMENTS", "row": 0, "col": 2, "width": 2, "height": 1},
            {"id": "settings", "title": "SYSTEM SETTINGS", "row": 1, "col": 2, "width": 1, "height": 1},
            {"id": "themes", "title": "THEMES", "row": 1, "col": 3, "width": 1, "height": 1},
            {"id": "startup", "title": "STARTUP", "row": 0, "col": 4, "width": 1, "height": 2},
        ],
        "recent_games": {"visible": True, "position": "bottom", "max_items": 5, "tile_size": "large"},
        "grid_columns": 5, "grid_rows": 2, "layout_mode": "custom"
    },
}


def _match_preset(prompt: str) -> dict:
    """Attempt smart keyword matching to select a preset layout."""
    p = prompt.lower()
    if any(w in p for w in ["big game", "games center", "games first", "game focus", "big center"]):
        return LAYOUT_PRESETS["games_center"]
    if any(w in p for w in ["minimal", "clean", "simple", "less"]):
        return LAYOUT_PRESETS["minimal"]
    if any(w in p for w in ["sidebar", "side", "left list", "right list", "vertical"]):
        return LAYOUT_PRESETS["sidebar"]
    if any(w in p for w in ["wide", "cinematic", "widescreen", "big"]):
        return LAYOUT_PRESETS["widescreen"]
    if any(w in p for w in ["default", "classic", "original", "nxe", "reset"]):
        return LAYOUT_PRESETS["default"]
    return None


async def generate_layout(prompt: str) -> dict:
    """Generate a layout blueprint. Tries Open WebUI first, falls back to smart presets."""
    # Try Open WebUI first
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{OPEN_WEBUI_URL}/api/chat/completions",
                json={
                    "model": "llama3",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ],
                    "stream": False,
                    "temperature": 0.7,
                },
                headers={"Content-Type": "application/json"}
            )
            if r.status_code == 200:
                data = r.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                # Parse the JSON from AI response
                layout = json.loads(content.strip())
                if _validate_layout(layout):
                    layout["_source"] = "open_webui"
                    return layout
    except Exception as e:
        logger.info(f"Open WebUI not available ({e}), using mock fallback")

    # Fallback: smart preset matching
    preset = _match_preset(prompt)
    if preset:
        result = {**preset, "_source": "mock_preset"}
        return result

    # Default fallback
    result = {**LAYOUT_PRESETS["default"], "_source": "mock_default"}
    return result


def _validate_layout(layout: dict) -> bool:
    """Validate that a layout has the required structure."""
    if "main_cards" not in layout:
        return False
    cards = layout["main_cards"]
    if not isinstance(cards, list) or len(cards) != 5:
        return False
    required_ids = {"library", "settings", "achievements", "themes", "startup"}
    found_ids = {c.get("id") for c in cards}
    return required_ids == found_ids

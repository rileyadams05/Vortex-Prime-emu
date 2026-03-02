import json
import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

# Theme directories
THEMES_DIR = Path(__file__).parent.parent / "assets" / "Themes"
THEMES_PLAY_DIR = THEMES_DIR / "Play"
THEMES_DISABLED_DIR = THEMES_DIR / "Disabled"

# Ensure directories exist
THEMES_PLAY_DIR.mkdir(parents=True, exist_ok=True)
THEMES_DISABLED_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_THEME = {
    "id": "",
    "name": "",
    "author": "Local User",
    "version": "1.0.0",
    "description": "",
    "created_at": "",
    "background": {
        "type": "color",
        "value": "#0a0c08"
    },
    "accent_color": "#90c31d",
    "hero_url": "",
    "grid_url": "",
    "logo_url": "",
    "steamgriddb_game_id": None,
    "published": False
}


def _read_theme(path: Path) -> dict:
    """Read a theme JSON file."""
    with open(path, "r") as f:
        return json.load(f)


def _write_theme(path: Path, data: dict):
    """Write a theme JSON file."""
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def list_themes() -> dict:
    """List all themes in Play and Disabled folders."""
    active = []
    disabled = []

    for f in THEMES_PLAY_DIR.glob("*.json"):
        theme = _read_theme(f)
        theme["_status"] = "active"
        theme["_filename"] = f.name
        active.append(theme)

    for f in THEMES_DISABLED_DIR.glob("*.json"):
        theme = _read_theme(f)
        theme["_status"] = "disabled"
        theme["_filename"] = f.name
        disabled.append(theme)

    return {"active": active, "disabled": disabled}


def activate_theme(filename: str) -> dict:
    """Move a theme from Disabled to Play, deactivating the current active theme."""
    src = THEMES_DISABLED_DIR / filename
    if not src.exists():
        raise FileNotFoundError(f"Theme '{filename}' not found in Disabled")

    # Move any currently active themes to Disabled first
    for active_file in THEMES_PLAY_DIR.glob("*.json"):
        shutil.move(str(active_file), str(THEMES_DISABLED_DIR / active_file.name))
        logger.info(f"Deactivated theme: {active_file.name}")

    # Move target theme to Play
    shutil.move(str(src), str(THEMES_PLAY_DIR / filename))
    logger.info(f"Activated theme: {filename}")

    theme = _read_theme(THEMES_PLAY_DIR / filename)
    theme["_status"] = "active"
    theme["_filename"] = filename
    return theme


def deactivate_theme(filename: str) -> dict:
    """Move a theme from Play to Disabled."""
    src = THEMES_PLAY_DIR / filename
    if not src.exists():
        raise FileNotFoundError(f"Theme '{filename}' not found in Play")

    shutil.move(str(src), str(THEMES_DISABLED_DIR / filename))
    logger.info(f"Deactivated theme: {filename}")

    theme = _read_theme(THEMES_DISABLED_DIR / filename)
    theme["_status"] = "disabled"
    theme["_filename"] = filename
    return theme


def create_theme(name: str, description: str = "", accent_color: str = "#90c31d",
                 background_value: str = "#0a0c08", background_type: str = "color",
                 hero_url: str = "", grid_url: str = "", logo_url: str = "",
                 steamgriddb_game_id: int = None) -> dict:
    """Create a new theme and save it to Disabled folder."""
    theme_id = str(uuid.uuid4())[:8]
    safe_name = "".join(c if c.isalnum() or c in " _-" else "" for c in name).strip()
    filename = f"{safe_name}_{theme_id}.json"

    theme = {
        **DEFAULT_THEME,
        "id": theme_id,
        "name": name,
        "description": description,
        "accent_color": accent_color,
        "background": {"type": background_type, "value": background_value},
        "hero_url": hero_url,
        "grid_url": grid_url,
        "logo_url": logo_url,
        "steamgriddb_game_id": steamgriddb_game_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    _write_theme(THEMES_DISABLED_DIR / filename, theme)
    theme["_status"] = "disabled"
    theme["_filename"] = filename
    return theme


def delete_theme(filename: str) -> bool:
    """Delete a theme file."""
    for folder in [THEMES_PLAY_DIR, THEMES_DISABLED_DIR]:
        path = folder / filename
        if path.exists():
            path.unlink()
            return True
    return False


def get_active_theme() -> dict:
    """Get the currently active theme, or None."""
    for f in THEMES_PLAY_DIR.glob("*.json"):
        theme = _read_theme(f)
        theme["_status"] = "active"
        theme["_filename"] = f.name
        return theme
    return None


def _seed_default_themes():
    """Create default themes if none exist."""
    all_themes = list(THEMES_PLAY_DIR.glob("*.json")) + list(THEMES_DISABLED_DIR.glob("*.json"))
    if all_themes:
        return

    defaults = [
        {
            "name": "Classic Xbox 360",
            "description": "The original Xbox 360 NXE green theme",
            "accent_color": "#90c31d",
            "bg_value": "#0a0c08",
        },
        {
            "name": "Midnight Blue",
            "description": "A deep blue theme inspired by the Xbox 360 media player",
            "accent_color": "#2196f3",
            "bg_value": "#0a0a1a",
        },
        {
            "name": "Crimson Red",
            "description": "A bold red theme for the ultimate gamer",
            "accent_color": "#e53935",
            "bg_value": "#1a0808",
        },
        {
            "name": "Halo Green",
            "description": "Master Chief approved, Spartan green and black",
            "accent_color": "#4caf50",
            "bg_value": "#081a08",
        },
        {
            "name": "Gears Gray",
            "description": "War-torn grays inspired by Gears of War",
            "accent_color": "#9e9e9e",
            "bg_value": "#1a1a1a",
        },
    ]

    for i, d in enumerate(defaults):
        theme = create_theme(
            name=d["name"],
            description=d["description"],
            accent_color=d["accent_color"],
            background_value=d["bg_value"],
        )
        # Make the first one active
        if i == 0:
            activate_theme(theme["_filename"])


# Seed on import
_seed_default_themes()

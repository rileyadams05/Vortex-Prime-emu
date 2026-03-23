import json
import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

THEMES_DIR = Path(__file__).parent.parent / "assets" / "Themes"
THEMES_PLAY_DIR = THEMES_DIR / "Play"
THEMES_DISABLED_DIR = THEMES_DIR / "Disabled"

THEMES_PLAY_DIR.mkdir(parents=True, exist_ok=True)
THEMES_DISABLED_DIR.mkdir(parents=True, exist_ok=True)

# Default layout blueprint schema
DEFAULT_LAYOUT = {
    "version": "1.0",
    "name": "",
    "author": "Local User",
    "description": "",
    "created_at": "",
    "source": "local",
    "tiles": {
        "main_cards": [
            {"id": "library", "title": "GAMES", "row": 0, "col": 0, "width": 1, "height": 1},
            {"id": "settings", "title": "SYSTEM SETTINGS", "row": 0, "col": 1, "width": 1, "height": 1},
            {"id": "achievements", "title": "ACHIEVEMENTS", "row": 0, "col": 2, "width": 1, "height": 1},
            {"id": "themes", "title": "THEMES", "row": 0, "col": 3, "width": 1, "height": 1},
            {"id": "startup", "title": "STARTUP", "row": 0, "col": 4, "width": 1, "height": 1},
        ],
        "recent_games": {
            "visible": True,
            "position": "bottom",
            "max_items": 5,
            "tile_size": "small"
        },
        "grid_columns": 5,
        "grid_rows": 2,
        "layout_mode": "default"
    }
}


def _read_layout(folder: Path) -> dict:
    """Read a layout.json from a theme folder."""
    layout_path = folder / "layout.json"
    if layout_path.exists():
        with open(layout_path, "r") as f:
            return json.load(f)
    return None


def _write_layout(folder: Path, data: dict):
    """Write layout.json to a theme folder."""
    folder.mkdir(parents=True, exist_ok=True)
    with open(folder / "layout.json", "w") as f:
        json.dump(data, f, indent=2)


def _get_theme_info(folder: Path, status: str) -> dict:
    """Get theme info from a folder."""
    layout = _read_layout(folder)
    if not layout:
        return None
    assets = []
    assets_dir = folder / "assets"
    if assets_dir.exists():
        assets = [f.name for f in assets_dir.iterdir() if f.is_file()]
    return {
        "folder_name": folder.name,
        "name": layout.get("name", folder.name),
        "author": layout.get("author", "Unknown"),
        "description": layout.get("description", ""),
        "version": layout.get("version", "1.0"),
        "source": layout.get("source", "local"),
        "created_at": layout.get("created_at", ""),
        "layout": layout.get("tiles", {}),
        "assets": assets,
        "_status": status,
    }


def list_themes() -> dict:
    """List all themes in Play and Disabled folders."""
    active = []
    disabled = []

    for d in THEMES_PLAY_DIR.iterdir():
        if d.is_dir() and (d / "layout.json").exists():
            info = _get_theme_info(d, "active")
            if info:
                active.append(info)

    for d in THEMES_DISABLED_DIR.iterdir():
        if d.is_dir() and (d / "layout.json").exists():
            info = _get_theme_info(d, "disabled")
            if info:
                disabled.append(info)

    return {"active": active, "disabled": disabled}


def activate_theme(folder_name: str) -> dict:
    """Move a theme from Disabled to Play, deactivating current active."""
    src = THEMES_DISABLED_DIR / folder_name
    if not src.exists():
        raise FileNotFoundError(f"Theme '{folder_name}' not found in Disabled")

    # Move all currently active themes to Disabled
    for active_dir in THEMES_PLAY_DIR.iterdir():
        if active_dir.is_dir():
            dest = THEMES_DISABLED_DIR / active_dir.name
            if dest.exists():
                shutil.rmtree(dest)
            shutil.move(str(active_dir), str(dest))
            logger.info(f"Deactivated theme: {active_dir.name}")

    # Move target theme to Play
    dest = THEMES_PLAY_DIR / folder_name
    shutil.move(str(src), str(dest))
    logger.info(f"Activated theme: {folder_name}")

    return _get_theme_info(dest, "active")


def deactivate_theme(folder_name: str) -> dict:
    """Move a theme from Play to Disabled."""
    src = THEMES_PLAY_DIR / folder_name
    if not src.exists():
        raise FileNotFoundError(f"Theme '{folder_name}' not found in Play")

    dest = THEMES_DISABLED_DIR / folder_name
    if dest.exists():
        shutil.rmtree(dest)
    shutil.move(str(src), str(dest))
    logger.info(f"Deactivated theme: {folder_name}")

    return _get_theme_info(dest, "disabled")


def create_theme(name: str, description: str = "", tiles: dict = None,
                 source: str = "local", author: str = "Local User") -> dict:
    """Create a new layout theme and save it to Disabled folder."""
    theme_id = str(uuid.uuid4())[:8]
    safe_name = "".join(c if c.isalnum() or c in " _-" else "" for c in name).strip()
    folder_name = f"{safe_name}_{theme_id}"

    layout = {
        **DEFAULT_LAYOUT,
        "name": name,
        "description": description,
        "author": author,
        "source": source,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if tiles:
        layout["tiles"] = tiles

    folder = THEMES_DISABLED_DIR / folder_name
    _write_layout(folder, layout)
    (folder / "assets").mkdir(exist_ok=True)

    return _get_theme_info(folder, "disabled")


def delete_theme(folder_name: str) -> bool:
    """Delete a theme folder."""
    for parent in [THEMES_PLAY_DIR, THEMES_DISABLED_DIR]:
        path = parent / folder_name
        if path.exists() and path.is_dir():
            shutil.rmtree(path)
            return True
    return False


def get_active_theme() -> dict:
    """Get the currently active theme layout, or None."""
    for d in THEMES_PLAY_DIR.iterdir():
        if d.is_dir() and (d / "layout.json").exists():
            return _get_theme_info(d, "active")
    return None


def get_layout(folder_name: str) -> dict:
    """Get the raw layout.json for a specific theme."""
    for parent in [THEMES_PLAY_DIR, THEMES_DISABLED_DIR]:
        folder = parent / folder_name
        layout = _read_layout(folder)
        if layout:
            return layout
    return None


def _seed_default_themes():
    """Create default layout themes if none exist."""
    all_dirs = [d for d in THEMES_PLAY_DIR.iterdir() if d.is_dir()] + \
               [d for d in THEMES_DISABLED_DIR.iterdir() if d.is_dir()]
    if all_dirs:
        return

    defaults = [
        {
            "name": "Classic NXE",
            "description": "The original Xbox 360 NXE dashboard layout — 5 equal cards in a row",
            "tiles": {
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
        },
        {
            "name": "Games First",
            "description": "Big center tile for Games, small tiles for the rest on the right",
            "tiles": {
                "main_cards": [
                    {"id": "library", "title": "GAMES", "row": 0, "col": 0, "width": 3, "height": 2},
                    {"id": "settings", "title": "SYSTEM SETTINGS", "row": 0, "col": 3, "width": 1, "height": 1},
                    {"id": "achievements", "title": "ACHIEVEMENTS", "row": 0, "col": 4, "width": 1, "height": 1},
                    {"id": "themes", "title": "THEMES", "row": 1, "col": 3, "width": 1, "height": 1},
                    {"id": "startup", "title": "STARTUP", "row": 1, "col": 4, "width": 1, "height": 1},
                ],
                "recent_games": {"visible": True, "position": "bottom", "max_items": 3, "tile_size": "medium"},
                "grid_columns": 5, "grid_rows": 2, "layout_mode": "custom"
            },
        },
        {
            "name": "Minimal",
            "description": "Clean 3-column layout with only the essentials",
            "tiles": {
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
        },
    ]

    for i, d in enumerate(defaults):
        theme = create_theme(name=d["name"], description=d["description"], tiles=d["tiles"])
        if i == 0:
            activate_theme(theme["folder_name"])


_seed_default_themes()

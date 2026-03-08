import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

SETTINGS_FILE = Path(__file__).parent.parent / "assets" / "app_settings.json"

DEFAULT_SETTINGS = {
    "theme_color": "#107C10",
    "master_volume": 50,
    "music_volume": 50,
    "bgm": "None",
    "country": "AU",
    "sound_effects": {
        "select": "Default",
        "back": "Default",
        "nav": "Default",
        "menuOpen": "Default",
        "bladeUp": "Default",
        "bladeDown": "Default",
        "tabLeft": "Default",
        "tabRight": "Default"
    }
}

def get_settings():
    """Load settings from file or return defaults."""
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r") as f:
                return {**DEFAULT_SETTINGS, **json.load(f)}
        except Exception as e:
            logger.error(f"Failed to load app settings: {e}")
    return DEFAULT_SETTINGS

def save_settings(settings: dict):
    """Save settings to file."""
    try:
        current = get_settings()
        updated = {**current, **settings}
        SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(SETTINGS_FILE, "w") as f:
            json.dump(updated, f, indent=2)
        return updated
    except Exception as e:
        logger.error(f"Failed to save app settings: {e}")
        return None

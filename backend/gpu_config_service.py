import os
import logging
from pathlib import Path
import tomlkit

logger = logging.getLogger(__name__)

# Define paths relative to this file
BACKEND_DIR = Path(__file__).parent
PROJECT_ROOT = BACKEND_DIR.parent
XENIA_DIR = PROJECT_ROOT / 'src-tauri' / 'resources'
CONFIG_FILE = XENIA_DIR / 'xenia-canary.config.toml'
PORTABLE_FILE = XENIA_DIR / 'portable.txt'

def ensure_portable_mode():
    """Ensure portable.txt exists to force Xenia to use local config."""
    try:
        if not XENIA_DIR.exists():
            logger.error(f"Xenia directory not found at {XENIA_DIR}")
            return False
            
        if not PORTABLE_FILE.exists():
            PORTABLE_FILE.touch()
            logger.info(f"Created portable.txt at {PORTABLE_FILE}")
        return True
    except Exception as e:
        logger.error(f"Error ensuring portable mode: {e}")
        return False

def update_core_config(new_core_data: dict, game_id: str = None):
    """
    Update multiple core configuration settings across sections.
    new_core_data: Dictionary of section names to settings dictionaries.
    game_id: Optional. If provided, updates a game-specific config file (e.g. 545408A7.config.toml).
             Can also be an absolute path to a config file.
    """
    if not ensure_portable_mode():
        raise Exception("Failed to setup portable mode")

    if game_id:
        # Check if game_id is actually an absolute path
        potential_path = Path(game_id)
        if potential_path.is_absolute():
             target_config_file = potential_path
        else:
            # Sanitize game_id to prevent directory traversal if it's just an ID
            safe_game_id = "".join(c for c in game_id if c.isalnum())
            target_config_file = XENIA_DIR / f"{safe_game_id}.config.toml"
    else:
        target_config_file = CONFIG_FILE

    if not target_config_file.exists():
         with open(target_config_file, "w", encoding="utf-8") as f:
            f.write(f"# Xenia Canary Configuration {'for ' + game_id if game_id else ''}\n")

    try:
        # "Write-Before-Flight" Logic
        with open(target_config_file, "r+", encoding="utf-8") as f:
            content = f.read()
            doc = tomlkit.parse(content)
            
            # Update only the specific core settings
            for section_name, settings in new_core_data.items():
                if section_name not in doc:
                    doc.add(section_name, tomlkit.table())
                
                # Get the section table
                section_table = doc[section_name]
                
                for key, value in settings.items():
                    # This replaces the specific value while keeping comments around it
                    section_table[key] = value

            # Write back the preserved document
            f.seek(0)
            f.write(tomlkit.dumps(doc))
            f.truncate()
            
        logger.info(f"Successfully updated core configuration settings")
        return True
        
    except Exception as e:
        logger.error(f"Error updating core config: {e}")
        raise e

def get_core_config(config_path: str = None):
    """
    Read current Xenia core configuration and return as a plain dictionary.
    Handles unwrapping of tomlkit types for JSON serialization.
    config_path: Optional absolute path to a specific config file.
    """
    if not ensure_portable_mode():
        return {}

    if config_path:
        target_file = Path(config_path)
    else:
        target_file = CONFIG_FILE

    if not target_file.exists():
        return {}

    try:
        with open(target_file, "r", encoding="utf-8") as f:
            content = f.read()
            doc = tomlkit.parse(content)
            
            # Convert TOMLDocument to plain dict
            # We iterate and unwrap explicitly to be safe, though .unwrap() on the root might work.
            config_dict = doc.unwrap()
            
            # Filter out top-level keys that aren't dicts (sections) if necessary
            # For Xenia config, almost everything is under a [Section]
            return config_dict

    except Exception as e:
        logger.error(f"Error reading core config: {e}")
        return {}

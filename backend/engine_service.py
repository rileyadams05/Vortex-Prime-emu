"""
Engine Hot-Swap Service for Vortex Prime Emu.

Handles migration of xenia-canary engine from an external source to
the project's internal storage. Implements the "Replacement Guard":
  1. Check if target exists
  2. If yes, wipe it completely (shutil.rmtree)
  3. Move engine from source into target
  4. Ensure portable.txt is present (forces "Project Only" mode)
"""

import os
import shutil
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Default paths
BACKEND_DIR = Path(__file__).parent
PROJECT_ROOT = BACKEND_DIR.parent

# Default source: M:\my project\For xenia\dashbroad\xenia-canary
DEFAULT_SOURCE = Path(r"M:\my project\For xenia\dashbroad\xenia-canary")

# Default target: [Project Root]/Internal/Engine/Xenia/
DEFAULT_TARGET = PROJECT_ROOT / "Internal" / "Engine" / "Xenia"

XENIA_EXE_NAME = "xenia_canary.exe"


def get_engine_status() -> dict:
    """
    Returns the current status of the internal engine.
    
    Returns a dict with:
      - present (bool): True if engine folder exists
      - exe_found (bool): True if xenia_canary.exe is in the folder
      - exe_path (str): Absolute path to the exe (or empty string)
      - portable_mode (bool): True if portable.txt exists
      - engine_dir (str): Path to engine directory
      - source_available (bool): Whether the migration source still exists
    """
    exe_path = DEFAULT_TARGET / XENIA_EXE_NAME
    portable_path = DEFAULT_TARGET / "portable.txt"

    present = DEFAULT_TARGET.exists()
    exe_found = exe_path.exists() if present else False
    portable_mode = portable_path.exists() if present else False

    return {
        "present": present,
        "exe_found": exe_found,
        "exe_path": str(exe_path) if exe_found else "",
        "portable_mode": portable_mode,
        "engine_dir": str(DEFAULT_TARGET),
        "source_available": DEFAULT_SOURCE.exists(),
        "source_path": str(DEFAULT_SOURCE),
    }


def migrate_engine(source_path: str = None, target_path: str = None) -> dict:
    """
    Perform a full engine hot-swap (Replacement Guard logic).
    
    Steps:
      1. Validate source exists
      2. If target exists → shutil.rmtree (full wipe)
      3. shutil.move source → target
      4. Ensure portable.txt in target
      5. Return status dict
    
    Args:
        source_path: Override source directory (default: DEFAULT_SOURCE)
        target_path: Override target directory (default: DEFAULT_TARGET)
    
    Returns:
        dict with success, message, and updated engine status
    """
    source = Path(source_path) if source_path else DEFAULT_SOURCE
    target = Path(target_path) if target_path else DEFAULT_TARGET

    # Step 1: Validate source
    if not source.exists():
        msg = f"Source engine not found at: {source}"
        logger.error(msg)
        return {"success": False, "message": msg, "status": get_engine_status()}

    if not source.is_dir():
        msg = f"Source path is not a directory: {source}"
        logger.error(msg)
        return {"success": False, "message": msg, "status": get_engine_status()}

    # Step 2: Wipe target if it exists
    if target.exists():
        logger.info(f"Wiping existing engine at: {target}")
        try:
            shutil.rmtree(target)
            logger.info(f"Wiped old engine directory: {target}")
        except Exception as e:
            msg = f"Failed to wipe old engine directory: {e}"
            logger.error(msg)
            return {"success": False, "message": msg, "status": get_engine_status()}

    # Ensure parent directory exists
    target.parent.mkdir(parents=True, exist_ok=True)

    # Step 3: Move source → target
    try:
        shutil.move(str(source), str(target))
        logger.info(f"Engine moved: {source} → {target}")
    except Exception as e:
        msg = f"Failed to move engine: {e}"
        logger.error(msg)
        return {"success": False, "message": msg, "status": get_engine_status()}

    # Step 4: Ensure portable.txt
    portable_path = target / "portable.txt"
    if not portable_path.exists():
        try:
            portable_path.touch()
            logger.info(f"Created portable.txt at: {portable_path}")
        except Exception as e:
            logger.warning(f"Could not create portable.txt: {e}")

    # Step 5: Return final status
    final_status = get_engine_status()
    msg = f"Engine migrated successfully to {target}"
    if not final_status["exe_found"]:
        msg += f" (WARNING: {XENIA_EXE_NAME} not found in target — verify source was complete)"

    logger.info(msg)
    return {"success": True, "message": msg, "status": final_status}

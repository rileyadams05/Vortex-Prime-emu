import os
import logging
import subprocess
import platform
from pathlib import Path
from typing import Optional
import tomlkit

logger = logging.getLogger(__name__)

# Define paths relative to this file
BACKEND_DIR = Path(__file__).parent
PROJECT_ROOT = BACKEND_DIR.parent
XENIA_DIR = PROJECT_ROOT / 'src-tauri' / 'resources'
CONFIG_FILE = XENIA_DIR / 'xenia-canary.config.toml'
PORTABLE_FILE = XENIA_DIR / 'portable.txt'

# Internal engine path (from engine_service migration)
INTERNAL_ENGINE_DIR = PROJECT_ROOT / 'Internal' / 'Engine' / 'Xenia'
INTERNAL_ENGINE_EXE = INTERNAL_ENGINE_DIR / 'xenia_canary.exe'
INTERNAL_ENGINE_CONFIG = INTERNAL_ENGINE_DIR / 'xenia-canary.config.toml'

# Hardware GPU Profiles
NVIDIA_PROFILE = {
    'GPU': {
        'gpu': 'd3d12',
        'd3d12_edram_rov': True,
        'gpu_allow_invalid_fetch_constants': True,
        'd3d12_readback_resolve': False,
    }
}

AMD_PROFILE = {
    'GPU': {
        'gpu': 'vulkan',
        'd3d12_edram_rov': False,      # CRITICAL for AMD stability
        'gpu_allow_invalid_fetch_constants': True,
        'vsync': False,
    }
}

DEFAULT_CONFIG = {
    'APU': {
        'apu': 'any',
        'enable_xmp': True,
        'debug': False,
        'max_simultaneous_voices': 64
    },
    'CPU': {
        'cpu': 'any',
        'break_on_unhandled_instruction': True,
        'enable_precompiler': True,
        'generate_optimized_code': True
    },
    'GPU': {
        'gpu': 'any',
        'vsync': True,
        'gamma_render_target_as_srgb': False,
        'gpu_allow_invalid_fetch_constants': False
    },
    'Display': {
        'fullscreen': False,
        'resolution': '1280x720',
        'window_width': 1280,
        'window_height': 720
    },
    'Storage': {
        'cache_root': 'cache',
        'content_root': 'content'
    },
    'General': {
        'discord': True,
        'language': 1
    }
}

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

def _get_config_size(path: Path) -> int:
    """Return config file size in bytes, or 0 if not exists."""
    try:
        return path.stat().st_size if path.exists() else 0
    except Exception:
        return 0


def _restore_config_from_source(target: Path) -> bool:
    """
    If the config at target is missing or too small (<1KB = likely damaged),
    try to restore it from the Internal engine or the M:\\ source.
    Returns True if successfully restored or config is already healthy.
    """
    import shutil

    # Source locations to try, in priority order
    source_candidates = [
        INTERNAL_ENGINE_DIR / 'xenia-canary.config.toml',
        Path(r"M:\my project\For xenia\dashbroad\xenia-canary\xenia-canary.config.toml"),
    ]

    if _get_config_size(target) >= 1024:
        return True  # Config is healthy, no restore needed

    for source in source_candidates:
        if source.exists() and _get_config_size(source) >= 1024:
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(str(source), str(target))
                logger.info(f"Restored config from {source} to {target} ({_get_config_size(target)} bytes)")
                return True
            except Exception as e:
                logger.warning(f"Failed to restore config from {source}: {e}")

    logger.error(f"Could not restore config — no healthy source found")
    return False


def update_core_config(new_core_data: dict, game_id: str = None):
    """
    Surgically update core configuration settings using tomlkit.

    Uses safe read → modify → write (NOT r+ seek/truncate) to preserve
    the full document, all comments, and all other sections untouched.

    new_core_data: {section_name: {key: value, ...}, ...}
    game_id: Optional. If provided, targets a game-specific config file.
             Can be an absolute path or a Title ID hex string.
    """
    if not ensure_portable_mode():
        raise Exception("Failed to setup portable mode")

    if game_id:
        potential_path = Path(game_id)
        if potential_path.is_absolute():
            target_config_file = potential_path
        else:
            safe_game_id = "".join(c for c in game_id if c.isalnum())
            target_config_file = XENIA_DIR / f"{safe_game_id}.config.toml"
    else:
        target_config_file = CONFIG_FILE

    # Guard: If targeting the primary global config and it's damaged, restore it
    if not game_id:
        _restore_config_from_source(target_config_file)

    # If the target still doesn't exist (game-specific, new), create a minimal one
    if not target_config_file.exists():
        target_config_file.parent.mkdir(parents=True, exist_ok=True)
        target_config_file.write_text(
            f"# Xenia Canary Config {'for ' + game_id if game_id else ''}\n",
            encoding="utf-8"
        )

    try:
        # ─── SAFE tomlkit pattern (Write-Before-Flight) ───────────────────────
        # Step 1: Read the COMPLETE file content
        content = target_config_file.read_text(encoding="utf-8")

        # Step 2: Parse with tomlkit — preserves ALL comments, formatting, sections
        doc = tomlkit.parse(content)

        # Step 3: Surgically update ONLY the requested keys
        for section_name, settings in new_core_data.items():
            if section_name not in doc:
                doc.add(section_name, tomlkit.table())

            section_table = doc[section_name]
            for key, value in settings.items():
                section_table[key] = value

        # Step 4: Write the complete preserved document back
        # Using write_text (open → write → close) ensures handle is fully released
        target_config_file.write_text(tomlkit.dumps(doc), encoding="utf-8")
        # ─────────────────────────────────────────────────────────────────────

        logger.info(f"tomlkit: Updated {list(new_core_data.keys())} in {target_config_file.name} "
                    f"({_get_config_size(target_config_file)} bytes preserved)")
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
        return DEFAULT_CONFIG

    try:
        with open(target_file, "r", encoding="utf-8") as f:
            content = f.read()
            doc = tomlkit.parse(content)
            
            # Convert TOMLDocument to plain dict
            # We iterate and unwrap explicitly to be safe, though .unwrap() on the root might work.
            config_dict = doc.unwrap()
            
            # Filter out top-level keys that aren't dicts (sections) if necessary
            # For Xenia config, almost everything is under a [Section]
            return config_dict if config_dict else DEFAULT_CONFIG

    except Exception as e:
        logger.error(f"Error reading core config: {e}")
        return DEFAULT_CONFIG

# ─── GPU Detection ────────────────────────────────────────────────────────────

def detect_gpu_vendor() -> str:
    """
    Detect the primary GPU vendor.
    
    Windows: Uses PowerShell Get-WmiObject (wmic is deprecated in Win11).
    Linux/Mac: Uses lspci.
    Returns: 'nvidia', 'amd', or 'unknown'
    """
    try:
        if platform.system() == 'Windows':
            # Use PowerShell — wmic is deprecated/removed in Windows 11
            result = subprocess.run(
                [
                    'powershell', '-NoProfile', '-NonInteractive', '-Command',
                    "(Get-WmiObject Win32_VideoController | Select-Object -ExpandProperty Name) -join ','"
                ],
                capture_output=True, text=True, timeout=15
            )
            output = result.stdout.lower()
            if result.returncode != 0 or not output.strip():
                # Fallback: try Get-CimInstance
                result2 = subprocess.run(
                    [
                        'powershell', '-NoProfile', '-NonInteractive', '-Command',
                        "(Get-CimInstance Win32_VideoController).Name"
                    ],
                    capture_output=True, text=True, timeout=15
                )
                output = result2.stdout.lower()
        else:
            result = subprocess.run(
                ['lspci'], capture_output=True, text=True, timeout=10
            )
            output = result.stdout.lower()

        if 'nvidia' in output:
            return 'nvidia'
        elif 'amd' in output or 'radeon' in output or 'advanced micro' in output:
            return 'amd'
        else:
            return 'unknown'
    except Exception as e:
        logger.warning(f"GPU detection failed: {e}")
        return 'unknown'


def get_hardware_profile(vendor: str) -> dict:
    """Return the hardware settings profile for the detected GPU vendor."""
    if vendor == 'nvidia':
        return NVIDIA_PROFILE
    elif vendor == 'amd':
        return AMD_PROFILE
    else:
        # Default safe profile (d3d12 without edram_rov)
        return {
            'GPU': {
                'gpu': 'd3d12',
                'd3d12_edram_rov': False,
                'gpu_allow_invalid_fetch_constants': True,
            }
        }


def apply_hardware_profile(vendor: str = None) -> dict:
    """
    Auto-detect GPU (if vendor not given) and apply the correct hardware profile.
    Uses tomlkit to surgically update the config — preserves formatting and comments.
    Returns: {vendor, profile_applied, success}
    """
    if vendor is None:
        vendor = detect_gpu_vendor()

    profile = get_hardware_profile(vendor)
    logger.info(f"Applying {vendor.upper()} hardware profile: {profile}")

    try:
        update_core_config(profile)
        return {
            'vendor': vendor,
            'profile_applied': profile,
            'success': True
        }
    except Exception as e:
        logger.error(f"Failed to apply hardware profile: {e}")
        return {
            'vendor': vendor,
            'profile_applied': profile,
            'success': False,
            'error': str(e)
        }


# ─── Write-Before-Flight Launch ────────────────────────────────────────────────

def _is_xenia_running() -> bool:
    """Check if xenia_canary.exe is currently running."""
    try:
        if platform.system() == 'Windows':
            result = subprocess.run(
                ['tasklist', '/FI', 'IMAGENAME eq xenia_canary.exe'],
                capture_output=True, text=True, timeout=5
            )
            return 'xenia_canary.exe' in result.stdout
        else:
            result = subprocess.run(
                ['pgrep', '-f', 'xenia_canary'],
                capture_output=True, timeout=5
            )
            return result.returncode == 0
    except Exception:
        return False


def _apply_game_patches(title_id: str) -> bool:
    """
    Apply game-specific patches from the patches/ folder in the engine directory.
    Looks for: [engine_dir]/patches/{title_id}.patch.toml
    Returns True if patches were applied, False if none found.
    """
    if not title_id:
        return False

    # Check internal engine patches folder first, then src-tauri/resources
    patch_dirs = [
        INTERNAL_ENGINE_DIR / 'patches',
        XENIA_DIR / 'patches',
    ]

    for patch_dir in patch_dirs:
        patch_file = patch_dir / f"{title_id.upper()}.patch.toml"
        if patch_file.exists():
            try:
                with open(patch_file, 'r', encoding='utf-8') as f:
                    patches = tomlkit.parse(f.read())

                # Convert patch doc to plain dict for update_core_config
                patch_dict = patches.unwrap() if hasattr(patches, 'unwrap') else dict(patches)
                update_core_config(patch_dict)
                logger.info(f"Applied patches from {patch_file}")
                return True
            except Exception as e:
                logger.warning(f"Failed to apply patches from {patch_file}: {e}")

    return False


def launch_game_safe(game_path: str, title_id: str = None, gpu_vendor: str = None) -> dict:
    """
    Write-Before-Flight game launch sequence:
    1. Verify xenia_canary.exe is NOT running
    2. Apply GPU hardware profile via tomlkit (handle opened + closed)
    3. Apply game-specific patches (if any)
    4. File handle is fully released (Python 'with' block closes it)
    5. Launch xenia_canary.exe with the game path

    Returns: {success, message, pid}
    """
    # Step 1: Ensure xenia is not already running
    if _is_xenia_running():
        msg = "xenia_canary.exe is already running. Close it first before launching a new game."
        logger.warning(msg)
        return {'success': False, 'message': msg, 'pid': None}

    # Determine engine exe path
    if INTERNAL_ENGINE_EXE.exists():
        exe_path = INTERNAL_ENGINE_EXE
    else:
        # Fallback to src-tauri/resources
        fallback_exe = XENIA_DIR / 'xenia_canary.exe'
        if fallback_exe.exists():
            exe_path = fallback_exe
        else:
            msg = "xenia_canary.exe not found in Internal/Engine/Xenia/ or src-tauri/resources/"
            logger.error(msg)
            return {'success': False, 'message': msg, 'pid': None}

    # Step 2: Detect GPU and apply hardware profile (writes + closes config)
    if gpu_vendor is None:
        gpu_vendor = detect_gpu_vendor()
    logger.info(f"Write-Before-Flight: Applying {gpu_vendor.upper()} profile")
    apply_hardware_profile(gpu_vendor)

    # Step 3: Apply game-specific patches (writes + closes config)
    if title_id:
        patched = _apply_game_patches(title_id)
        if patched:
            logger.info(f"Game patches applied for Title ID: {title_id}")

    # Step 4: Config file handle is now fully released (Python with-blocks have exited)
    # Step 5: Launch the emulator
    try:
        game_path_obj = Path(game_path)
        if not game_path_obj.exists():
            msg = f"Game file not found: {game_path}"
            logger.error(msg)
            return {'success': False, 'message': msg, 'pid': None}

        logger.info(f"Write-Before-Flight COMPLETE — launching: {exe_path} {game_path}")
        proc = subprocess.Popen(
            [str(exe_path), str(game_path)],
            cwd=str(exe_path.parent),
            creationflags=subprocess.CREATE_NEW_CONSOLE if platform.system() == 'Windows' else 0
        )
        return {
            'success': True,
            'message': f'Launched {game_path_obj.name} via {exe_path.name}',
            'pid': proc.pid,
            'gpu_vendor': gpu_vendor
        }
    except Exception as e:
        msg = f"Failed to launch game: {e}"
        logger.error(msg)
        return {'success': False, 'message': msg, 'pid': None}

from pathlib import Path
import ipaddress
import json
import logging
import os
from urllib.parse import quote

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, File, Form, HTTPException, UploadFile
import httpx
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request as StarletteRequest

import store_service


ROOT_DIR = Path(__file__).parent
ASSETS_DIR = ROOT_DIR.parent / "assets"

load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

ALLOWED_CONSOLE_METHODS = {
    "ps4": {"ps4-direct-package"},
    "ps5": {"ps5-direct-package"},
    "ps3": {"ps3-webman-mod"},
}
SUPPORTED_CONSOLE_FILE_TYPES = {".pkg"}

try:
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "vortex_prime_store")
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=2000)
    db = client[db_name]
    mongo_available = True
except Exception as exc:
    logger.warning("MongoDB is not available: %s", exc)
    client = None
    db = None
    mongo_available = False


app = FastAPI(title="Vortex Prime Store API")
api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ASSETS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


class CacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response


app.add_middleware(CacheControlMiddleware)


def _parse_tags(tags: str) -> list[str]:
    if not tags:
        return []
    try:
        parsed = json.loads(tags)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return [tag.strip() for tag in tags.split(",") if tag.strip()]


def _parse_youtube_videos(youtube_videos: str) -> list[dict]:
    if not youtube_videos:
        return []
    try:
        parsed = json.loads(youtube_videos)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return []


class ConsolePackageRequest(BaseModel):
    platform: str
    method: str
    consoleIp: str
    packageUrl: str


def _normalized_platform(platform: str) -> str:
    value = (platform or "").strip().lower().replace("playstation ", "ps")
    if value in {"ps4", "ps5", "ps3"}:
        return value
    raise HTTPException(status_code=400, detail="Unsupported console platform.")


def _validate_console_method(platform: str, method: str) -> str:
    value = (method or "").strip().lower()
    if value not in ALLOWED_CONSOLE_METHODS.get(platform, set()):
        raise HTTPException(status_code=400, detail="Unsupported console install method for this platform.")
    return value


def _validate_private_console_ip(console_ip: str) -> str:
    try:
        parsed = ipaddress.ip_address((console_ip or "").strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Enter a valid console IP address.") from exc

    if not isinstance(parsed, ipaddress.IPv4Address) or not parsed.is_private:
        raise HTTPException(status_code=400, detail="Console IP must be a private LAN address.")

    if parsed.is_loopback or parsed.is_link_local or parsed.is_multicast or parsed.is_unspecified:
        raise HTTPException(status_code=400, detail="Console IP must be a private LAN address.")

    return str(parsed)


def _validate_package_url(package_url: str) -> str:
    value = (package_url or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Package URL is required.")

    try:
        from urllib.parse import urlparse

        parsed = urlparse(value)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Enter a valid package URL.") from exc

    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Package URL must be HTTP or HTTPS.")

    if Path(parsed.path).suffix.lower() not in SUPPORTED_CONSOLE_FILE_TYPES:
        raise HTTPException(status_code=400, detail="Console package sending only supports PKG files.")

    return value


async def _send_ps_direct_package(platform: str, console_ip: str, package_url: str) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        try:
            response = await client.post(
                f"http://{console_ip}:12800/api/install",
                content=json.dumps({"type": "direct", "packages": [package_url]}),
                headers={"Content-Type": "application/json"},
            )
            body = response.text
            if response.is_success and ("success" in body.lower() or body.strip() in {"", "{}"}):
                return {"ok": True, "message": f"Install request sent to {platform.upper()}. Check your console."}
        except httpx.RequestError:
            body = ""

        try:
            files = {
                "file": ("", b"", "application/octet-stream"),
                "url": (None, package_url),
            }
            response = await client.post(f"http://{console_ip}:12800/upload", files=files)
            body = response.text
            if response.is_success and "success" in body.lower():
                return {"ok": True, "message": f"Install request sent to {platform.upper()}. Check your console."}
        except httpx.RequestError:
            pass

    return {
        "ok": False,
        "message": "Could not connect to console. Make sure the console is on the same network and the required console service is enabled.",
    }


async def _send_ps3_webman_package(console_ip: str, package_url: str) -> dict:
    encoded_url = quote(package_url, safe="")
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            await client.get(f"http://{console_ip}/", timeout=4.0)
        except httpx.RequestError:
            return {
                "ok": False,
                "message": "Could not send package to PS3. Make sure your PS3 is on the same network, HEN/CFW is enabled, and webMAN-MOD is running. You can still download the PKG and install it manually from Package Manager.",
            }

        try:
            response = await client.get(f"http://{console_ip}/xmb.ps3/install.ps3?url={encoded_url}")
            if response.status_code < 400:
                return {"ok": True, "message": "Package request sent to PS3. Check your PS3."}
        except httpx.RequestError:
            pass

    return {
        "ok": False,
        "message": "Could not send package to PS3. Make sure your PS3 is on the same network, HEN/CFW is enabled, and webMAN-MOD is running. You can still download the PKG and install it manually from Package Manager.",
    }


def _archive_rules(submission_type: str, platform: str, category: str, filename: str) -> tuple[str, str, list[str], bool]:
    platform_key = (platform or "").lower()
    category_key = (category or "").lower()
    normalized_type = (submission_type or "store").lower()
    archive_extensions = [".zip", ".7z", ".rar"]
    lower_filename = filename.lower()

    if normalized_type == "mod":
        if not lower_filename.endswith(tuple(archive_extensions)):
            raise HTTPException(status_code=400, detail="Mods must be uploaded as a compressed archive: ZIP, 7Z, or RAR.")
        return "mod", "archive", archive_extensions, False

    if platform_key == "xbox 360":
        if not lower_filename.endswith(tuple(archive_extensions)):
            raise HTTPException(status_code=400, detail="Xbox 360 uploads must be compressed archives: ZIP, 7Z, or RAR.")
        return "store", "archive", archive_extensions, True

    if platform_key == "original xbox":
        if not lower_filename.endswith(tuple(archive_extensions)):
            raise HTTPException(status_code=400, detail="Original Xbox uploads must be compressed archives: ZIP, 7Z, or RAR.")
        return "store", "archive", archive_extensions, True

    if platform_key == "ps2":
        if not lower_filename.endswith(tuple(archive_extensions)):
            raise HTTPException(status_code=400, detail="PlayStation 2 uploads must be compressed archives: ZIP, 7Z, or RAR.")
        return "store", "archive", archive_extensions, False

    if category_key == "pc tools":
        if not lower_filename.endswith(tuple(archive_extensions)):
            raise HTTPException(status_code=400, detail="PC Tools must be uploaded as a compressed archive: ZIP, 7Z, or RAR.")
        return "store", "archive", archive_extensions, False

    if not lower_filename.endswith(".pkg"):
        raise HTTPException(status_code=400, detail="Homebrew Apps and Console Apps must be uploaded as PKG files.")
    return "store", "pkg", [".pkg"], False


@api_router.get("/")
async def root():
    return {"status": "ok", "service": "Vortex Prime Store"}


@api_router.post("/store/upload")
async def upload_store_package(
    name: str = Form(...),
    description: str = Form(""),
    discord_id: str = Form(...),
    author: str = Form(...),
    platform: str = Form("PS4"),
    category: str = Form("Homebrew Apps"),
    tags: str = Form(""),
    download_url: str = Form(""),
    code: str = Form(None),
    type: str = Form("store"),
    consoleInstallEnabled: str = Form("false"),
    consoleMethod: str = Form("none"),
    requiresConsoleIp: str = Form("true"),
    usbInstructions: str = Form(""),
    networkInstructions: str = Form(""),
    installNotes: str = Form(""),
    externalGuideUrl: str = Form(""),
    youtubeGuideUrl: str = Form(""),
    youtubeVideos: str = Form(""),
    access_token: str = Form(""),
    theme: UploadFile = File(...),
    icon: UploadFile = File(None),
    preview: UploadFile = File(None),
    readme: UploadFile = File(None),
):
    if access_token:
        user_info = await store_service.verify_discord_token(access_token)
        if not user_info or str(user_info.get("id")) != discord_id:
            raise HTTPException(status_code=401, detail="Discord token invalid or mismatched")

    submission_type, file_type, allowed_extensions, should_extract_archive = _archive_rules(
        type,
        platform,
        category,
        theme.filename or "",
    )

    package_bytes = await theme.read()
    if len(package_bytes) > store_service.MAX_ZIP_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB limit")

    if should_extract_archive:
        try:
            if (platform or "").lower() == "original xbox":
                store_service.validate_original_xbox_archive(package_bytes, theme.filename)
            else:
                store_service.validate_xbox_360_archive(package_bytes, theme.filename)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    icon_bytes = None
    icon_ext = None
    if icon and icon.filename:
        icon_bytes = await icon.read()
        icon_ext = Path(icon.filename).suffix

    preview_bytes = None
    preview_ext = None
    if preview and preview.filename:
        preview_bytes = await preview.read()
        preview_ext = Path(preview.filename).suffix

    readme_bytes = None
    readme_filename = None
    if readme and readme.filename:
        readme_ext = Path(readme.filename).suffix.lower()
        if readme_ext not in {".txt", ".md", ".markdown"}:
            raise HTTPException(status_code=400, detail="README files must be TXT, MD, or MARKDOWN.")
        readme_bytes = await readme.read()
        if len(readme_bytes) > 1024 * 1024:
            raise HTTPException(status_code=413, detail="README files must be 1 MB or smaller.")
        readme_filename = readme.filename

    return await store_service.save_submission(
        name=name,
        description=description,
        discord_id=discord_id,
        author=author,
        zip_bytes=package_bytes,
        zip_filename=theme.filename,
        platform=platform,
        category=category,
        tags=_parse_tags(tags),
        icon_bytes=icon_bytes,
        icon_ext=icon_ext,
        preview_bytes=preview_bytes,
        preview_ext=preview_ext,
        readme_bytes=readme_bytes,
        readme_filename=readme_filename,
        download_url=download_url,
        code=code,
        submission_type=submission_type,
        file_type=file_type,
        allowed_extensions=allowed_extensions,
        console_install_enabled=consoleInstallEnabled.lower() in {"1", "true", "yes", "on"},
        console_method=consoleMethod,
        requires_console_ip=requiresConsoleIp.lower() not in {"0", "false", "no", "off"},
        usb_instructions=usbInstructions,
        network_instructions=networkInstructions,
        install_notes=installNotes,
        external_guide_url=externalGuideUrl,
        youtube_guide_url=youtubeGuideUrl,
        youtube_videos=_parse_youtube_videos(youtubeVideos),
        extract_contents=should_extract_archive,
        db=db if mongo_available else None,
    )


@api_router.get("/store/themes")
async def get_store_packages():
    themes = await store_service.get_approved_themes(db=db if mongo_available else None)
    store_items = [theme for theme in themes if theme.get("type", "store") == "store"]
    return {"themes": store_items, "dashboards": store_items}


@api_router.get("/store/mods")
async def get_store_mods():
    themes = await store_service.get_approved_themes(db=db if mongo_available else None)
    return {"mods": [theme for theme in themes if theme.get("type") == "mod"]}


@api_router.delete("/store/themes/{submission_id}")
async def delete_store_package(submission_id: str, discord_id: str):
    ok = await store_service.delete_submission(submission_id, discord_id, db=db if mongo_available else None)
    if not ok:
        raise HTTPException(status_code=403, detail="Unauthorized or package not found")
    return {"status": "deleted"}


@api_router.post("/console-package/send")
async def send_console_package(request: ConsolePackageRequest):
    platform = _normalized_platform(request.platform)
    method = _validate_console_method(platform, request.method)
    console_ip = _validate_private_console_ip(request.consoleIp)
    package_url = _validate_package_url(request.packageUrl)

    if method in {"ps4-direct-package", "ps5-direct-package"}:
        return await _send_ps_direct_package(platform, console_ip, package_url)

    if method == "ps3-webman-mod":
        return await _send_ps3_webman_package(console_ip, package_url)

    raise HTTPException(status_code=400, detail="Unsupported console install method.")


app.include_router(api_router)


@app.on_event("startup")
async def startup_event():
    logger.info("Vortex Prime Store API started")


@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        client.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))

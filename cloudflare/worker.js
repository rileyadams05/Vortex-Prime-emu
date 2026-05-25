const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const ARCHIVE_EXTENSIONS = [".zip", ".7z", ".rar"];
const PKG_EXTENSIONS = [".pkg"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
const README_EXTENSIONS = [".txt", ".md", ".markdown"];

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return json({}, 204);
    }

    if (!env.VORTEX_UPLOADS) {
      return json({ ok: false, message: "VORTEX_UPLOADS R2 bucket binding is missing." }, 500);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/?/, "/");

    try {
      if (request.method === "GET" && path === "/") {
        return json({ status: "ok", service: "Vortex Prime Store API" });
      }

      if (request.method === "GET" && path === "/store/themes") {
        const themes = await readCatalog(env, "themes");
        return json({ themes, dashboards: themes });
      }

      if (request.method === "GET" && path === "/store/mods") {
        return json({ mods: await readCatalog(env, "mods") });
      }

      if (request.method === "GET" && path.startsWith("/assets/")) {
        return serveAsset(request, env, path.slice("/assets/".length));
      }

      if (request.method === "POST" && path === "/store/upload") {
        return handleUpload(request, env, url.origin);
      }

      if (request.method === "DELETE" && path.startsWith("/store/themes/")) {
        return handleDelete(request, env, path.split("/").pop());
      }

      return json({ ok: false, message: "API route not found." }, 404);
    } catch (error) {
      return json({ ok: false, message: error.message || "Upload failed." }, error.status || 500);
    }
  },
};

async function handleUpload(request, env, origin) {
  const form = await request.formData();
  const submissionType = text(form, "type", "store").toLowerCase() === "mod" ? "mod" : "store";
  const packageFile = form.get("theme");

  if (!(packageFile instanceof File) || !packageFile.name) {
    throw httpError(400, submissionType === "mod" ? "Mod archive is required." : "Package file is required.");
  }

  const name = text(form, "name").trim();
  const author = text(form, "author", "Community").trim() || "Community";
  const platform = text(form, "platform", "PS4").trim();
  const category = text(form, "category", "Homebrew Apps").trim();
  const rules = getUploadRules(submissionType, platform, category, packageFile.name);
  const id = crypto.randomUUID();
  const baseKey = `Store/submissions/${id}`;
  const packageName = safeFileName(packageFile.name);
  const packageKey = `${baseKey}/${packageName}`;

  if (!hasExtension(packageName, rules.allowedExtensions)) {
    throw httpError(400, rules.invalidMessage);
  }

  await putFile(env, packageKey, packageFile);

  const icon = await optionalAsset(form, env, baseKey, "icon", IMAGE_EXTENSIONS);
  const preview = await optionalAsset(form, env, baseKey, "preview", IMAGE_EXTENSIONS);
  const readme = await optionalReadme(form, env, baseKey);
  const downloadUrl = text(form, "download_url").trim();
  const packageUrl = assetUrl(origin, packageKey);
  const publicDownloadUrl = downloadUrl || packageUrl;
  const platformKey = normalizePlatform(platform);
  const fileType = rules.fileType;
  const method = consoleMethod(platformKey, fileType);
  const consoleInstallEnabled = truthy(text(form, "consoleInstallEnabled")) && method !== "none";

  const item = {
    id,
    code: generateCode(),
    name,
    description: text(form, "description"),
    discord_id: text(form, "discord_id", "web-admin"),
    author,
    creator: author,
    platform,
    category,
    tags: parseJsonArray(text(form, "tags")),
    icon: icon?.url || "",
    preview: preview?.url || "",
    readme,
    zip_file: packageUrl,
    download_url: downloadUrl,
    download: {
      enabled: Boolean(publicDownloadUrl),
      url: publicDownloadUrl,
      type: fileType,
    },
    consoleInstall: {
      enabled: consoleInstallEnabled,
      platform: platformKey,
      method,
      url: publicDownloadUrl,
      requiresConsoleIp: true,
    },
    installInstructions: {
      usb: text(form, "usbInstructions"),
      network: text(form, "networkInstructions"),
      notes: text(form, "installNotes"),
    },
    externalGuideUrl: text(form, "externalGuideUrl"),
    youtubeGuideUrl: text(form, "youtubeGuideUrl"),
    youtubeVideos: parseJsonArray(text(form, "youtubeVideos")),
    fileType,
    allowedExtensions: rules.allowedExtensions,
    type: submissionType,
    status: "approved",
    uploaded_at: new Date().toISOString(),
  };

  const catalogName = submissionType === "mod" ? "mods" : "themes";
  const catalog = await readCatalog(env, catalogName);
  catalog.unshift(item);
  await writeCatalog(env, catalogName, catalog);

  return json({ ok: true, status: "uploaded", submission: item });
}

async function handleDelete(request, env, id) {
  const url = new URL(request.url);
  const discordId = url.searchParams.get("discord_id") || "";
  let deleted = false;

  for (const catalogName of ["themes", "mods"]) {
    const catalog = await readCatalog(env, catalogName);
    const next = catalog.filter((item) => {
      const match = item.id === id && (!discordId || item.discord_id === discordId);
      deleted = deleted || match;
      return !match;
    });
    if (next.length !== catalog.length) {
      await writeCatalog(env, catalogName, next);
    }
  }

  if (!deleted) throw httpError(403, "Unauthorized or package not found.");
  return json({ ok: true, status: "deleted" });
}

async function serveAsset(request, env, key) {
  const cleanKey = decodeURIComponent(key).replace(/^\/+/, "");
  const object = await env.VORTEX_UPLOADS.get(cleanKey);
  if (!object) return json({ ok: false, message: "Asset not found." }, 404);

  const headers = new Headers(CORS_HEADERS);
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  if (request.method === "HEAD") return new Response(null, { headers });
  return new Response(object.body, { headers });
}

async function optionalAsset(form, env, baseKey, field, extensions) {
  const file = form.get(field);
  if (!(file instanceof File) || !file.name) return null;
  const filename = safeFileName(file.name);
  if (!hasExtension(filename, extensions)) {
    throw httpError(400, `${field} must be PNG, JPG, JPEG, or WEBP.`);
  }
  const key = `${baseKey}/${field}.${extension(filename)}`;
  await putFile(env, key, file);
  return { key, url: assetUrl("", key) };
}

async function optionalReadme(form, env, baseKey) {
  const file = form.get("readme");
  if (!(file instanceof File) || !file.name) return null;
  const filename = safeFileName(file.name);
  if (!hasExtension(filename, README_EXTENSIONS)) {
    throw httpError(400, "README files must be TXT, MD, or MARKDOWN.");
  }
  const content = await file.text();
  const key = `${baseKey}/readme.${extension(filename)}`;
  await env.VORTEX_UPLOADS.put(key, content, {
    httpMetadata: { contentType: filename.endsWith(".txt") ? "text/plain; charset=utf-8" : "text/markdown; charset=utf-8" },
  });
  return {
    filename,
    format: filename.endsWith(".txt") ? "text" : "markdown",
    url: assetUrl("", key),
    content,
  };
}

async function putFile(env, key, file) {
  await env.VORTEX_UPLOADS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });
}

async function readCatalog(env, name) {
  const object = await env.VORTEX_UPLOADS.get(`catalog/${name}.json`);
  if (!object) return [];
  const data = await object.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function writeCatalog(env, name, items) {
  await env.VORTEX_UPLOADS.put(`catalog/${name}.json`, JSON.stringify(items, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

function getUploadRules(type, platform, category, filename) {
  const platformKey = platform.toLowerCase();
  const categoryKey = category.toLowerCase();

  if (type === "mod") {
    return archiveRules("Mods must be uploaded as a compressed archive: ZIP, 7Z, or RAR.");
  }
  if (["ps2", "xbox 360", "original xbox"].includes(platformKey) || categoryKey === "pc tools") {
    return archiveRules(`${platform} uploads must be compressed archives: ZIP, 7Z, or RAR.`);
  }
  if (!filename.toLowerCase().endsWith(".pkg")) {
    throw httpError(400, "Homebrew Apps and Console Apps must be uploaded as PKG files.");
  }
  return { fileType: "pkg", allowedExtensions: PKG_EXTENSIONS, invalidMessage: "PKG file required." };
}

function archiveRules(invalidMessage) {
  return { fileType: "archive", allowedExtensions: ARCHIVE_EXTENSIONS, invalidMessage };
}

function normalizePlatform(platform) {
  return platform.trim().toLowerCase().replace("playstation ", "ps");
}

function consoleMethod(platform, fileType) {
  if (fileType !== "pkg") return "none";
  if (platform === "ps4") return "ps4-direct-package";
  if (platform === "ps5") return "ps5-direct-package";
  if (platform === "ps3") return "ps3-webman-mod";
  return "none";
}

function text(form, key, fallback = "") {
  const value = form.get(key);
  return typeof value === "string" ? value : fallback;
}

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function safeFileName(filename) {
  return filename.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_").slice(0, 160);
}

function extension(filename) {
  return filename.toLowerCase().split(".").pop() || "bin";
}

function hasExtension(filename, extensions) {
  const lower = filename.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

function assetUrl(origin, key) {
  return `${origin || ""}/api/assets/${encodeURIComponent(key).replaceAll("%2F", "/")}`;
}

function generateCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function json(data, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

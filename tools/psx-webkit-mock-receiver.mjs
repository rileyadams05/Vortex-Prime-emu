#!/usr/bin/env node
// Development-only protocol mock. It binds only to loopback; never deploy as a receiver.
import http from "node:http";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PSX_MOCK_PORT || 19871);
const ALLOWED_ORIGINS = new Set([
  "https://vortex-prime-emu.com",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
]);
const requests = new Map();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function send(res, status, body, origin) {
  const headers = { "Vary": "Origin", "Cache-Control": "no-store" };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  if (status !== 204) headers["Content-Type"] = "application/json; charset=utf-8";
  res.writeHead(status, headers);
  res.end(status === 204 ? undefined : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > 16384) {
        tooLarge = true;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) return reject(new Error("too_large"));
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new Error("invalid_json")); }
    });
    req.on("error", reject);
  });
}
function error(res, status, code, message, origin) {
  send(res, status, { protocolVersion: 1, error: code, message }, origin);
}
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  if (!ALLOWED_ORIGINS.has(origin)) return error(res, 403, "origin_not_allowed", "Origin is not allowed.", origin);
  if (req.method === "OPTIONS") {
    const requestedHeaders = (req.headers["access-control-request-headers"] || "").toLowerCase().split(",").map(v => v.trim()).filter(Boolean);
    if (req.url !== "/api/v1/requests" ||
        req.headers["access-control-request-method"]?.toUpperCase() !== "POST" ||
        requestedHeaders.some(header => header !== "content-type")) {
      return error(res, 400, "invalid_preflight", "Unsupported preflight request.", origin);
    }
    return send(res, 204, {}, origin);
  }
  if (req.method !== "POST" || req.url !== "/api/v1/requests") {
    return error(res, 400, "invalid_request", "Only POST /api/v1/requests is supported.", origin);
  }

  try {
    const body = await readBody(req);
    let url = null;
    try { if (typeof body.downloadUrl === "string") url = new URL(body.downloadUrl); } catch {}
    const age = Date.now() - Date.parse(body.requestedAt);
    if (body.protocolVersion !== 1 || typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId) ||
        body.target !== "ps4-goldhen" || !url || !["http:", "https:"].includes(url.protocol) ||
        url.username || url.password || body.fileName !== null || !Number.isFinite(age) || age > 300000 || age < -60000 ||
        body.downloadUrl.length > 8192) {
      return error(res, 400, "invalid_request", "Request fields are invalid or stale.", origin);
    }
    const fingerprint = JSON.stringify(body);
    const previous = requests.get(body.requestId);
    if (previous && previous !== fingerprint) {
      return error(res, 409, "request_id_conflict", "Request ID was reused with different data.", origin);
    }
    requests.set(body.requestId, fingerprint);
    return send(res, 202, {
      protocolVersion: 1,
      requestId: body.requestId,
      status: "awaiting-user-confirmation"
    }, origin);
  } catch (err) {
    if (res.headersSent || res.destroyed) return;
    const tooLarge = err.message === "too_large";
    return error(res, 400, tooLarge ? "body_too_large" : "malformed_json",
      tooLarge ? "Request body exceeds 16 KiB." : "Request body must be valid JSON.", origin);
  }
});
server.listen(PORT, HOST, () => process.stdout.write("PSX WebKit mock listening at http://" + HOST + ":" + PORT + "\n"));
server.on("error", err => { process.stderr.write(err.message + "\n"); process.exitCode = 1; });

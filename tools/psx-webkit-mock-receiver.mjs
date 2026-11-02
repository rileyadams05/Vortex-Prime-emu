#!/usr/bin/env node
// Development-only protocol mock. It binds only to loopback; never deploy as a receiver.
import http from "node:http";
import { randomUUID } from "node:crypto";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PSX_MOCK_PORT || 19871);
const PAIRING_CODE = process.env.PSX_MOCK_PAIRING_CODE || "123456";
const sessions = new Map();
const requests = new Map();

function send(res, status, body, origin) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin || "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Vary": "Origin",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", chunk => { raw += chunk; if (raw.length > 16384) reject(new Error("too_large")); });
    req.on("end", () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error("invalid_json")); } });
    req.on("error", reject);
  });
}
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "null";
  if (req.method === "OPTIONS") return send(res, 204, {}, origin);
  if (req.method !== "POST") return send(res, 405, { protocolVersion: 1, error: "method_not_allowed" }, origin);
  try {
    const body = await readBody(req);
    if (req.url === "/api/v1/pair") {
      if (body.protocolVersion !== 1 || body.pairingCode !== PAIRING_CODE) {
        return send(res, 401, { protocolVersion: 1, error: "pairing_rejected", message: "Pairing code was rejected." }, origin);
      }
      const token = randomUUID();
      sessions.set(token, Date.now() + 600000);
      return send(res, 200, { protocolVersion: 1, token, expiresAt: new Date(Date.now() + 600000).toISOString() }, origin);
    }
    if (req.url === "/api/v1/requests") {
      const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!sessions.has(token) || sessions.get(token) < Date.now()) return send(res, 401, { protocolVersion: 1, error: "unauthorized" }, origin);
      if (body.protocolVersion !== 1 || typeof body.requestId !== "string" || !body.requestId ||
          body.target !== "ps4-goldhen" || typeof body.downloadUrl !== "string" ||
          !/^https?:\/\//i.test(body.downloadUrl)) return send(res, 400, { protocolVersion: 1, error: "invalid_request" }, origin);
      const previous = requests.get(body.requestId);
      if (previous && previous !== body.downloadUrl) return send(res, 409, { protocolVersion: 1, error: "request_id_conflict" }, origin);
      requests.set(body.requestId, body.downloadUrl);
      return send(res, 202, { protocolVersion: 1, requestId: body.requestId, status: "awaiting-user-confirmation" }, origin);
    }
    return send(res, 404, { protocolVersion: 1, error: "not_found" }, origin);
  } catch (error) {
    return send(res, 400, { protocolVersion: 1, error: error.message === "too_large" ? "too_large" : "invalid_json" }, origin);
  }
});
server.listen(PORT, HOST, () => process.stdout.write(`PSX WebKit mock listening at http://${HOST}:${PORT} (pairing code ${PAIRING_CODE})\n`));
server.on("error", error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });

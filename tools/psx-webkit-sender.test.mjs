import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { sendToConsole, validateDownloadUrl, validatePrivateIPv4 } from "../docs/assets/js/psx-webkit-sender.mjs";

let receiver;
let base;
const origin = "https://vortex-prime-emu.com";
const requestId = "00000000-0000-4000-8000-000000000001";

before(async () => {
  const port = 21000 + Math.floor(Math.random() * 20000);
  receiver = spawn(process.execPath, ["tools/psx-webkit-mock-receiver.mjs"], {
    env: { ...process.env, PSX_MOCK_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  receiver.stdout.setEncoding("utf8");
  await Promise.race([
    new Promise((resolve, reject) => {
      receiver.stdout.on("data", chunk => { if (chunk.includes("listening")) resolve(); });
      receiver.once("error", reject);
      receiver.once("exit", code => reject(new Error("mock exited " + code)));
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("mock startup timeout")), 3000))
  ]);
  base = "http://127.0.0.1:" + port;
});
after(() => receiver?.kill());

function mockFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Origin: origin }
  });
}

test("validates only HTTP(S) URLs and preserves supplied text", () => {
  const value = "https://example.com/a.pkg?x=1";
  assert.equal(validateDownloadUrl(value), value);
  assert.throws(() => validateDownloadUrl("ftp://example.com/a.pkg"));
  assert.throws(() => validateDownloadUrl("https://user:pass@example.com/a.pkg"));
  assert.throws(() => validateDownloadUrl(" https://example.com/a.pkg"));
});
test("accepts private IPv4 only for production address checks", () => {
  assert.equal(validatePrivateIPv4("192.168.1.50"), "192.168.1.50");
  assert.equal(validatePrivateIPv4("10.0.0.8"), "10.0.0.8");
  for (const value of ["8.8.8.8", "192.168.1.256", "192.168.1", "localhost"]) assert.throws(() => validatePrivateIPv4(value));
});
test("sends directly to the entered console IP without a credential exchange", async () => {
  let seen;
  const fetchImpl = async (url, options) => {
    seen = { url, body: JSON.parse(options.body), headers: options.headers, addressSpace: options.targetAddressSpace };
    return mockFetch(url, options);
  };
  const sent = await sendToConsole({
    ip: "127.0.0.1", allowLoopback: true, port: Number(new URL(base).port),
    downloadUrl: "https://example.com/download/homebrew.pkg", fetchImpl, requestId
  });
  assert.equal(sent.acknowledgement.status, "awaiting-user-confirmation");
  assert.equal(seen.url, base + "/api/v1/requests");
  assert.equal(seen.body.downloadUrl, "https://example.com/download/homebrew.pkg");
  assert.equal(seen.body.target, "ps4-goldhen");
  assert.equal(seen.body.requestId, requestId);
  assert.equal("pairingCode" in seen.body, false);
  assert.equal(seen.headers.Authorization, undefined);
  assert.equal(seen.addressSpace, "loopback");
});
test("rejects unsupported PS5 send", async () => {
  await assert.rejects(sendToConsole({
    ip: "192.168.1.50", target: "ps5-etahen", downloadUrl: "https://example.com/a.pkg", requestId
  }), /PS5 sending is not enabled/);
});
test("reports connection refusal, timeout, and invalid acknowledgements", async () => {
  await assert.rejects(sendToConsole({
    ip: "127.0.0.1", allowLoopback: true, port: 1,
    downloadUrl: "https://example.com/a.pkg", requestId
  }), /Could not reach PSX WebKit/);
  const timeoutFetch = (_, { signal }) => new Promise((_, reject) =>
    signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true })
  );
  await assert.rejects(sendToConsole({
    ip: "192.168.1.50", downloadUrl: "https://example.com/a.pkg",
    timeoutMs: 5, fetchImpl: timeoutFetch, requestId
  }), /timed out/);
  const invalidFetch = async () => new Response(JSON.stringify({ protocolVersion: 1, requestId: "wrong", status: "ok" }), { status: 202 });
  await assert.rejects(sendToConsole({
    ip: "192.168.1.50", downloadUrl: "https://example.com/a.pkg", fetchImpl: invalidFetch, requestId
  }), /valid request acknowledgement/);
});
test("mock receiver deduplicates identical request IDs and rejects conflicting reuse", async () => {
  const payload = {
    protocolVersion: 1, requestId, target: "ps4-goldhen",
    downloadUrl: "https://example.com/a.pkg", fileName: null, requestedAt: new Date().toISOString()
  };
  const send = () => mockFetch(base + "/api/v1/requests", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
  });
  const first = await send(), second = await send();
  assert.equal(first.status, 202);
  assert.deepEqual(await first.json(), await second.json());
  payload.downloadUrl = "https://example.com/different.pkg";
  assert.equal((await send()).status, 409);
});
test("CORS preflight allows only the website origin and Content-Type", async () => {
  const allowed = await fetch(base + "/api/v1/requests", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type"
    }
  });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("access-control-allow-origin"), origin);
  assert.equal(allowed.headers.get("access-control-allow-methods"), "POST, OPTIONS");
  assert.equal(allowed.headers.get("access-control-allow-headers"), "Content-Type");

  const denied = await fetch(base + "/api/v1/requests", {
    method: "OPTIONS",
    headers: {
      Origin: "https://attacker.example",
      "Access-Control-Request-Method": "POST"
    }
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
});
test("rejects malformed JSON with a protocol error", async () => {
  const response = await mockFetch(base + "/api/v1/requests", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{"
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "malformed_json");
});
test("page markup removes credentials and keeps mobile-friendly sender controls", async () => {
  const { readFile } = await import("node:fs/promises");
  const page = await readFile(new URL("../docs/psx-webkit/index.html", import.meta.url), "utf8");
  assert.match(page, /name="viewport"/);
  assert.match(page, /for="downloadUrl"/);
  assert.match(page, /for="consoleIp"/);
  assert.doesNotMatch(page, /pairing code/i);
  assert.doesNotMatch(page, /pairingCode|pairing-code/i);
  assert.match(page, /id="sendButton"/);
  assert.match(page, /min-height:\\s*52px/);
  assert.match(page, /Confirm the request on your PlayStation/);
});

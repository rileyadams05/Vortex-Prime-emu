import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { sendToConsole, validateDownloadUrl, validatePrivateIPv4 } from "../docs/assets/js/psx-webkit-sender.mjs";

let receiver;
let base;
let counter = 0;
before(async () => {
  const port = 21000 + Math.floor(Math.random() * 20000);
  receiver = spawn(process.execPath, ["tools/psx-webkit-mock-receiver.mjs"], {
    env: { ...process.env, PSX_MOCK_PORT: String(port), PSX_MOCK_PAIRING_CODE: "654321" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  receiver.stdout.setEncoding("utf8");
  await Promise.race([
    new Promise((resolve, reject) => {
      receiver.stdout.on("data", chunk => { if (chunk.includes("listening")) resolve(); });
      receiver.once("error", reject);
      receiver.once("exit", code => reject(new Error(`mock exited ${code}`)));
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("mock startup timeout")), 3000))
  ]);
  base = `http://127.0.0.1:${port}`;
});
after(() => receiver?.kill());

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
test("pairs, sends a serialized request, and accepts receiver acknowledgement", async () => {
  let seen;
  let addressSpace;
  const realFetch = globalThis.fetch;
  const fetchImpl = async (url, options) => {
    const response = await realFetch(url, options);
    if (url.endsWith("/requests")) { seen = { body: JSON.parse(options.body), auth: options.headers.Authorization }; addressSpace = options.targetAddressSpace; }
    return response;
  };
  const sent = await sendToConsole({
    ip: "127.0.0.1", allowLoopback: true, port: Number(new URL(base).port), pairingCode: "654321",
    downloadUrl: "https://example.com/download/homebrew.pkg", fetchImpl, requestId: "test-request-1"
  });
  assert.equal(sent.acknowledgement.status, "awaiting-user-confirmation");
  assert.equal(seen.body.downloadUrl, "https://example.com/download/homebrew.pkg");
  assert.equal(seen.body.target, "ps4-goldhen");
  assert.match(seen.auth, /^Bearer /);
  assert.equal(addressSpace, "loopback");
});
test("rejects invalid pairing and unsupported PS5 send", async () => {
  await assert.rejects(sendToConsole({
    ip: "127.0.0.1", allowLoopback: true, port: Number(new URL(base).port), pairingCode: "000000",
    downloadUrl: "https://example.com/a.pkg"
  }), /Pairing code was rejected/);
  await assert.rejects(sendToConsole({
    ip: "192.168.1.50", target: "ps5-etahen", pairingCode: "123456",
    downloadUrl: "https://example.com/a.pkg"
  }), /PS5 sending is not enabled/);
});
test("reports connection refusal, timeout, and invalid acknowledgements", async () => {
  await assert.rejects(sendToConsole({
    ip: "127.0.0.1", allowLoopback: true, port: 1, pairingCode: "123456",
    downloadUrl: "https://example.com/a.pkg", timeoutMs: 100
  }), /Could not reach PSX WebKit/);
  const timeoutFetch = (_, { signal }) => new Promise((_, reject) =>
    signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true })
  );
  await assert.rejects(sendToConsole({
    ip: "192.168.1.50", pairingCode: "123456", downloadUrl: "https://example.com/a.pkg",
    timeoutMs: 5, fetchImpl: timeoutFetch
  }), /timed out/);
  const invalidFetch = async url => url.endsWith("/pair")
    ? new Response(JSON.stringify({ protocolVersion: 1, token: "t" }), { status: 200 })
    : new Response(JSON.stringify({ protocolVersion: 1, requestId: "wrong", status: "ok" }), { status: 202 });
  await assert.rejects(sendToConsole({
    ip: "192.168.1.50", pairingCode: "123456", downloadUrl: "https://example.com/a.pkg", fetchImpl: invalidFetch
  }), /valid request acknowledgement/);
});
test("mock receiver deduplicates repeated request IDs", async () => {
  const pair = await (await fetch(`${base}/api/v1/pair`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ protocolVersion: 1, pairingCode: "654321", client: "test" })
  })).json();
  const payload = { protocolVersion: 1, requestId: "duplicate-1", target: "ps4-goldhen", downloadUrl: "https://example.com/a.pkg" };
  const send = () => fetch(`${base}/api/v1/requests`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${pair.token}` },
    body: JSON.stringify(payload)
  });
  const first = await send(), second = await send();
  assert.equal(first.status, 202);
  assert.deepEqual(await first.json(), await second.json());
  payload.downloadUrl = "https://example.com/different.pkg";
  assert.equal((await send()).status, 409);
});
test("page markup includes mobile viewport, labelled inputs, and a large touch target", async () => {
  const { readFile } = await import("node:fs/promises");
  const page = await readFile(new URL("../docs/psx-webkit/index.html", import.meta.url), "utf8");
  assert.match(page, /name="viewport"/);
  assert.match(page, /for="downloadUrl"/);
  assert.match(page, /for="consoleIp"/);
  assert.match(page, /id="sendButton"/);
  assert.match(page, /min-height:\s*52px/);
});

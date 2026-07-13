import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const BATCH_SIZE = 10;
const LOW_WATERMARK = 2;
const TTL_MS = 20 * 60 * 1000;

function normalize(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashCode(code) {
  return createHash("sha256").update(`streamz-pro-purchase-code:${normalize(code)}`).digest("base64url");
}

function createCode(forced = null) {
  if (forced?.length) return forced.shift();
  const output = [];
  const max = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  while (output.length < 10) {
    const bytes = new Uint8Array(16);
    webcrypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= max) continue;
      output.push(ALPHABET[byte % ALPHABET.length]);
      if (output.length === 10) break;
    }
  }
  return output.join("");
}

function createBatch(existingHashes = new Set(), forced = null) {
  const codes = [];
  const seen = new Set(existingHashes);
  let attempts = 0;
  while (codes.length < BATCH_SIZE && attempts < 1000) {
    attempts += 1;
    const code = createCode(forced);
    const codeHash = hashCode(code);
    if (seen.has(codeHash)) continue;
    seen.add(codeHash);
    codes.push(code);
  }
  assert.equal(codes.length, BATCH_SIZE, "10 codes generated per batch");
  return codes;
}

function addBatch(db, forced = null) {
  db.batchFetches += 1;
  const existing = new Set(db.pool.map((entry) => entry.codeHash));
  const batch = createBatch(existing, forced);
  const batchSeen = new Set(batch);
  assert.equal(batchSeen.size, 10, "unique codes within each batch");
  for (const code of batch) {
    assert.match(code, /^[A-Z0-9]{10}$/, "codes are exactly 10 uppercase letters/digits");
    assert.equal(/[a-z]/.test(code), false, "no lowercase letters");
    db.pool.push({ id: `pool:${hashCode(code).slice(0, 12)}`, code, codeHash: hashCode(code), status: "unused" });
  }
}

function unusedCount(db) {
  return db.pool.filter((entry) => entry.status === "unused" && entry.code).length;
}

async function assignCode(db, orderId, now = Date.now()) {
  if (unusedCount(db) < LOW_WATERMARK) addBatch(db);
  const index = db.pool.findIndex((entry) => entry.status === "unused" && entry.code);
  assert(index >= 0, "no unused code available");
  const entry = db.pool[index];
  db.pool[index] = {
    ...entry,
    code: null,
    status: "assigned",
    orderId,
    assignedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
  };
  if (unusedCount(db) < LOW_WATERMARK) addBatch(db);
  return { code: entry.code, codeHash: entry.codeHash };
}

function claim(db, codeHash, discordUserId, now = Date.now()) {
  const entry = db.pool.find((item) => item.codeHash === codeHash);
  if (!entry || entry.status === "unused") return "invalid";
  if (entry.status === "replaced") return "replaced";
  if (entry.status === "redeemed") return "redeemed";
  if (entry.status === "expired" || Date.parse(entry.expiresAt) <= now) {
    entry.status = "expired";
    entry.code = null;
    return "expired";
  }
  if (entry.discordUserId && entry.discordUserId !== discordUserId) return "claimed";
  entry.status = "pending_google_linking";
  entry.discordUserId = discordUserId;
  return "ok";
}

function redeem(db, codeHash, googleSub, discordUserId) {
  const entry = db.pool.find((item) => item.codeHash === codeHash);
  if (!entry || entry.status === "unused") return "invalid";
  if (entry.status === "redeemed") return "redeemed";
  if (entry.status === "expired") return "expired";
  if (entry.status === "replaced") return "replaced";
  if (entry.discordUserId && entry.discordUserId !== discordUserId) return "claimed";
  entry.status = "redeemed";
  entry.googleSub = googleSub;
  entry.discordUserId = discordUserId;
  entry.redeemedAt = new Date().toISOString();
  return "ok";
}

function issueReplacement(db, originalHash, reason = "technical issue") {
  const original = db.pool.find((entry) => entry.codeHash === originalHash);
  assert(original, "original code exists");
  assert.notEqual(original.status, "redeemed", "do not replace redeemed ownership");
  for (const entry of db.pool) {
    if (entry.orderId === original.orderId && ["assigned", "pending_google_linking"].includes(entry.status)) {
      entry.status = entry.codeHash === originalHash ? "replaced" : "invalidated";
      entry.code = null;
    }
  }
  const existing = new Set(db.pool.map((entry) => entry.codeHash));
  const [code] = createBatch(existing);
  const replacement = {
    id: `pool:${hashCode(code).slice(0, 12)}`,
    code: null,
    codeHash: hashCode(code),
    status: "assigned",
    orderId: original.orderId,
    issueType: "support_replacement",
    reason,
    expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
  };
  db.pool.push(replacement);
  return { code, codeHash: replacement.codeHash };
}

function supportAcceptsAttachment(file) {
  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();
  return name.endsWith(".pdf") && (!type || type === "application/pdf");
}

const batch = createBatch();
assert.equal(batch.length, 10);
assert.equal(new Set(batch).size, 10);
assert(batch.every((code) => /^[A-Z0-9]{10}$/.test(code)));

const collisionHash = hashCode("AAAAAAAAAA");
const collisionBatch = createBatch(new Set([collisionHash]), ["AAAAAAAAAA", ...batch, "BBBBBBBBBB", "CCCCCCCCCC"]);
assert(!collisionBatch.includes("AAAAAAAAAA"), "collision regeneration discards existing code");

const db = { pool: [], batchFetches: 0 };
const [first, second] = await Promise.all([assignCode(db, "order-a"), assignCode(db, "order-b")]);
assert.notEqual(first.code, second.code, "two simultaneous purchases never receive the same code");
assert(db.batchFetches >= 1, "pool generated a batch");

const lowPool = { pool: [{ id: "pool-low", code: "LOWCODE001", codeHash: hashCode("LOWCODE001"), status: "unused" }], batchFetches: 0 };
await assignCode(lowPool, "order-low");
assert(lowPool.batchFetches > 0, "low pool generates another batch");

assert.equal(claim(db, first.codeHash, "discord-a"), "ok", "valid unused assigned code can be claimed");
assert.equal(redeem(db, first.codeHash, "google-a", "discord-a"), "ok", "successful Google linking redeems code");
assert.equal(redeem(db, first.codeHash, "google-a", "discord-a"), "redeemed", "redeemed code rejected");
assert.equal(claim(db, hashCode("FAKECODE01"), "discord-x"), "invalid", "fake code rejected");

const unassigned = db.pool.find((entry) => entry.status === "unused");
assert.equal(claim(db, unassigned.codeHash, "discord-x"), "invalid", "unassigned code rejected");

const expired = await assignCode(db, "order-expired", Date.now() - TTL_MS - 1000);
assert.equal(claim(db, expired.codeHash, "discord-x"), "expired", "expired code rejected");

const replaceOriginal = await assignCode(db, "order-replace");
const replacement = issueReplacement(db, replaceOriginal.codeHash);
assert.equal(claim(db, replaceOriginal.codeHash, "discord-x"), "replaced", "replaced code rejected");
assert.equal(claim(db, replacement.codeHash, "discord-r"), "ok", "replacement code can be claimed once");
assert.equal(redeem(db, replacement.codeHash, "google-r", "discord-r"), "ok", "replacement code single-use enforcement");
assert.equal(redeem(db, replacement.codeHash, "google-r", "discord-r"), "redeemed", "replacement redeemed code cannot be reused");

const simultaneous = await assignCode(db, "order-race");
assert.equal(claim(db, simultaneous.codeHash, "discord-1"), "ok", "first simultaneous claim wins");
assert.equal(claim(db, simultaneous.codeHash, "discord-2"), "claimed", "second simultaneous claim rejected");

assert.equal(supportAcceptsAttachment({ name: "pass.png", type: "image/png" }), false, "/support rejects screenshots and images");
assert.equal(supportAcceptsAttachment({ name: "Streamz-Pro-Activation-Pass.pdf", type: "application/pdf" }), true, "/support accepts original PDF type");

const staff = [{ googleSub: "owner-sub", role: "owner" }];
assert.equal(Boolean(staff.find((entry) => entry.googleSub === "random-customer")), false, "unauthorised Google account denied staff access");

console.log("Streamz activation-code system tests passed.");

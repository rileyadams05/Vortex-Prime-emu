import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const LOW_WATERMARK = 2;
const TTL_MS = 20 * 60 * 1000;

function makeBatch(batchIndex) {
  return Array.from({ length: 10 }, (_, itemIndex) => {
    const value = (batchIndex * 10 + itemIndex).toString(36).toUpperCase().padStart(8, "0");
    return `T${value}Z`.slice(0, 10);
  });
}

const batches = Array.from({ length: 6 }, (_, index) => makeBatch(index + 1));
let batchFetches = 0;

function normalize(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashCode(code) {
  return createHash("sha256").update(`streamz-pro-purchase-code:${normalize(code)}`).digest("base64url");
}

function addBatch(db) {
  const batch = batches[batchFetches++];
  assert(batch, "test batch exhausted");
  const existing = new Set(db.pool.map((entry) => entry.codeHash));
  for (const code of batch) {
    const codeHash = hashCode(code);
    if (existing.has(codeHash)) continue;
    db.pool.push({ id: `pool:${codeHash.slice(0, 16)}`, code, codeHash, status: "unused" });
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

function redeem(db, codeHash, now = Date.now()) {
  const entry = db.pool.find((item) => item.codeHash === codeHash);
  if (!entry || entry.status === "unused") return "invalid";
  if (entry.status === "redeemed") return "redeemed";
  if (entry.status === "expired" || Date.parse(entry.expiresAt) <= now) {
    entry.status = "expired";
    entry.code = null;
    return "expired";
  }
  entry.status = "redeemed";
  entry.redeemedAt = new Date(now).toISOString();
  return "ok";
}

const db = { pool: [] };
const [first, second] = await Promise.all([
  assignCode(db, "order-a"),
  assignCode(db, "order-b"),
]);
assert.notEqual(first.code, second.code, "two simultaneous purchases must not receive the same code");

assert.equal(redeem(db, first.codeHash), "ok", "assigned code should redeem once");
assert.equal(redeem(db, first.codeHash), "redeemed", "redeemed code cannot be reused");

const expired = await assignCode(db, "order-expired", Date.now() - TTL_MS - 1000);
assert.equal(redeem(db, expired.codeHash), "expired", "expired code cannot be used");

const unassignedHash = db.pool.find((entry) => entry.status === "unused").codeHash;
assert.equal(redeem(db, unassignedHash), "invalid", "unassigned pool code must be rejected");

const lowPool = { pool: [{ id: "pool:low", code: "LOWCODE001", codeHash: hashCode("LOWCODE001"), status: "unused" }] };
const fetchesBefore = batchFetches;
await assignCode(lowPool, "order-refill");
assert(batchFetches > fetchesBefore, "new batch should be fetched when pool runs low");

console.log("Streamz RANDOM.ORG code-pool tests passed.");

import assert from "node:assert/strict";

const AI_UNAVAILABLE = "Automated troubleshooting is temporarily unavailable. DM the Streamz bot and use /contact-support for private assistance.";

function isLikelyBugReport(content, attachments = []) {
  const text = String(content || "").toLowerCase();
  if (text.length < 12 && attachments.length === 0) return false;
  const bugWords = [
    "bug", "error", "crash", "crashed", "broken", "not working", "doesn't work", "wont work", "won't work",
    "failed", "fails", "freeze", "frozen", "blank", "black screen", "login issue", "qr", "pro won",
    "update failed", "install failed", "can't open", "cant open", "cannot open",
  ];
  if (bugWords.some((word) => text.includes(word))) return true;
  return attachments.some((file) => /image|text|log|pdf|json/.test(file.contentType || "") || /\.(png|jpe?g|webp|gif|txt|log|json|pdf)$/i.test(file.filename || ""));
}

async function geminiFallback(models, call) {
  for (let i = 0; i < models.length; i += 1) {
    const attempts = i === 0 ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const reply = await call(models[i], attempt);
        if (reply) return { ok: true, model: models[i], reply };
      } catch {
        // test fallback behavior
      }
    }
  }
  return { ok: false, model: null, reply: AI_UNAVAILABLE };
}

function commandContext(command) {
  return { contexts: command.contexts, integrationTypes: command.integration_types };
}

function createSupportCase(db, discordUserId) {
  const existing = db.rateLimits.get(discordUserId) || [];
  if (existing.length >= 5) return "rate_limited";
  db.rateLimits.set(discordUserId, [...existing, Date.now()]);
  const id = `case_${db.cases.length + 1}`;
  db.cases.push({ id, discordUserId, status: "open" });
  return id;
}

function compareVersions(left, right) {
  const a = left.split(".").map((part) => Number(part) || 0);
  const b = right.split(".").map((part) => Number(part) || 0);
  for (let i = 0; i < Math.max(a.length, b.length, 3); i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

assert.equal(isLikelyBugReport("Streamz crashes when I open the chat overlay on Windows 11"), true, "crash report is detected");
assert.equal(isLikelyBugReport("hello everyone, how are you"), false, "normal conversation is ignored");
assert.equal(isLikelyBugReport("", [{ filename: "streamz.log", contentType: "text/plain" }]), true, "log attachment is useful");

const fallbackSuccess = await geminiFallback(["gemini-3-flash-preview", "gemini-2.5-flash"], async (model) => {
  if (model === "gemini-3-flash-preview") throw new Error("primary down");
  return "Try restarting Streamz and checking the overlay URL.";
});
assert.equal(fallbackSuccess.ok, true);
assert.equal(fallbackSuccess.model, "gemini-2.5-flash", "fallback model is used after primary retry fails");

const fallbackFailure = await geminiFallback(["gemini-3-flash-preview", "gemini-2.5-flash"], async () => {
  throw new Error("all models down");
});
assert.equal(fallbackFailure.reply, AI_UNAVAILABLE, "exact outage message is returned");

const contactSupportCommand = { contexts: [1], integration_types: [0] };
assert.deepEqual(commandContext(contactSupportCommand), { contexts: [1], integrationTypes: [0] }, "/contact-support is DM context only");

const db = { cases: [], rateLimits: new Map() };
for (let i = 0; i < 5; i += 1) assert.match(createSupportCase(db, "discord-a"), /^case_/);
assert.equal(createSupportCase(db, "discord-a"), "rate_limited", "support command spam is rate-limited");

assert.equal(compareVersions("0.2.0", "0.1.9"), 1, "newer version detected");
assert.equal(compareVersions("0.1.0", "0.1.0"), 0, "same version is not an update");

console.log("Streamz support system tests passed.");

# Vortex Prime PS4 Catalogue Service API v1

This is the frontend/API contract for the account-free catalogue manager at `/ps4/catalogues/`. **It is a proposed contract for a future PS4-side service; this website change does not install or implement that service on a PS4.** The manager shows disconnected/pending states until a compatible console service answers and confirms each write.

## Network and security requirements

- Listen on the console's private LAN interface at TCP port `12801`. Do not bind or forward this configuration API to a public interface or router WAN port.
- The only mutating origin allowed by CORS is `https://vortex-prime-emu.com`. Do not use `Access-Control-Allow-Origin: *`.
- Handle CORS `OPTIONS` preflight for `GET`, `POST`, and the `Authorization`, `Content-Type`, `If-Match`, and `Idempotency-Key` headers. Support the browser's Private Network Access preflight (`Access-Control-Request-Private-Network`) where the browser requires it; reply with `Access-Control-Allow-Private-Network: true` only for the configured website origin.
- Require a paired bearer token for every catalogue read or write, including refresh requests. The unauthenticated `/status` endpoint is read-only and returns no pairing secret or catalogue contents.
- Pairing code: one-time, console-displayed, single-use, expires within two minutes, rate-limited, and accepted only after a user confirms pairing on the PS4. Return a short-lived token scoped to `catalogues:read` and `catalogues:write`; revoke it from the console's local settings. Do not log pairing codes or tokens.
- Validate every URL and operation again on the PS4. Never fetch arbitrary URLs from the API server unless that is the console application's supported catalogue refresh behavior.
- Browser-side calls use plain HTTP to a private LAN address because the console service has no public TLS certificate. Modern browsers may require the user to grant local-network access. If blocked, the manager reports a connection error; it must not proxy local traffic through Vortex Prime.

## Catalogue document format accepted by the current browser adapter

The `vortex-v1` adapter accepts JSON shaped like this:

```json
{
  "schema": "vortex-prime.ps4-catalogue/v1",
  "name": "Homebrew",
  "items": [
    {
      "id": "publisher.application-id",
      "name": "Example application",
      "pkg_url": "https://downloads.example.org/example.pkg"
    }
  ]
}
```

Required fields are `schema`, non-empty `name`, and an `items` array. Every item needs a unique, stable string `id`, non-empty `name`, and absolute HTTP(S) `pkg_url` whose path ends in `.pkg`. The browser validates but does not rewrite or invent item records. The selected manager category is one of `games`, `updates`, `dlc`, `homebrew`, or `applications`. Other formats must be added as separate validators/adapters; the browser must not guess a format.

## Endpoints

Base URL: `http://<PS4-private-IP>:12801/api/v1`

### `GET /status` — unauthenticated, read-only

```json
{
  "service": "vortex-prime.ps4-catalogue-service",
  "api_version": 1,
  "console_name": "PS4"
}
```

### `POST /pairing/challenge` — start explicit pairing

Request:

```json
{ "client": "Vortex Prime browser", "api_version": 1 }
```

Response:

```json
{ "challenge_id": "opaque-id", "expires_at": "2026-11-05T10:00:00Z" }
```

The console displays a one-time pairing code and asks the user to approve this browser. `POST /pairing/authorize` accepts `{ "challenge_id": "opaque-id", "code": "console-displayed-code" }` after that approval and returns `{ "access_token": "opaque-short-lived-token", "expires_at": "...", "scopes": ["catalogues:read", "catalogues:write"], "console_name": "PS4" }`. Do not authorize merely because a website requested a challenge.

### `GET /catalogues` — paired bearer required

Returns the opaque revision and the existing source objects. Preserve server-owned and unknown fields when returning sources.

```json
{
  "revision": "opaque-revision",
  "sources": [
    { "id": "stable-source-id", "url": "https://example.org/catalogue.json", "name": "Homebrew", "category": "homebrew", "enabled": true, "schema": "vortex-prime.ps4-catalogue/v1", "adapter_id": "vortex-v1" }
  ]
}
```

### `POST /catalogues/operations` — apply per-source changes

Headers: `Authorization: Bearer ...`, `If-Match: <revision>`, `Idempotency-Key: <batch_id>`.

```json
{
  "batch_id": "opaque-batch-id",
  "base_revision": "opaque-revision",
  "operations": [
    { "operation_id": "op-1", "op": "add", "source_id": "stable-source-id", "source": { "id": "stable-source-id", "url": "https://example.org/catalogue.json", "name": "Homebrew", "category": "homebrew", "enabled": true, "schema": "vortex-prime.ps4-catalogue/v1", "adapter_id": "vortex-v1" } },
    { "operation_id": "op-2", "op": "set-enabled", "source_id": "existing-source-id", "enabled": false },
    { "operation_id": "op-3", "op": "set-category", "source_id": "existing-source-id", "category": "updates" },
    { "operation_id": "op-4", "op": "remove", "source_id": "another-source-id" }
  ]
}
```

Successful response **must confirm persistence**, not merely queue receipt:

```json
{ "revision": "new-opaque-revision", "applied_operation_ids": ["op-1", "op-2", "op-3", "op-4"], "sources": [] }
```

The service must apply operations against individual source IDs and preserve unrelated sources/preferences. It must treat `batch_id` and each `operation_id` idempotently and reject duplicate normalized source URLs. If `base_revision` does not match current storage, return HTTP `409` with `{ "code": "revision_conflict", "revision": "current-revision" }` and make no changes. Do not silently replace the whole configuration. Reject unknown source IDs, invalid categories, invalid source URLs, unsupported adapters, or malformed operations with a 4xx response.

### `POST /catalogues/refresh` — paired bearer required

Request `{ "source_ids": ["stable-source-id"] }` for selected sources or `{}` to refresh all enabled sources. Response `{ "refresh_id": "opaque-id", "status": "queued" }`.

### `GET /catalogues/refresh/{refresh_id}` — paired bearer required

Returns `{ "refresh_id": "opaque-id", "status": "queued|running|complete|failed", "message": "optional status" }`. Only `complete` is a completed refresh acknowledgement; `failed` includes a useful message.

## Frontend sync behavior

Source edits are stored locally in browser storage as per-source operations. The browser merges pending operations over the PS4 snapshot by stable source ID, sends a revision-guarded operations batch, and clears only operation IDs explicitly acknowledged with a new revision. Network errors leave changes pending. A `409` reloads the PS4 snapshot but leaves local edits queued for review and explicit retry. The browser does not display “Synced” or “Refresh complete” based solely on request submission.

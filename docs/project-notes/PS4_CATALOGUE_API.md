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

Required fields are `schema`, non-empty `name`, and an `items` array. Every item needs a unique, stable string `id`, non-empty `name`, and absolute HTTP(S) `pkg_url` whose path ends in `.pkg`. The browser validates but does not rewrite or invent item records. The manager uses this supported JSON schema automatically; it does not ask users to select a category or format. If the PS4 already has category metadata on a source, preserve it as-is.

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

The console displays a one-time pairing code and asks the user to approve this browser. `POST /pairing/authorize` accepts `{ "challenge_id": "opaque-id", "code": "console-displayed-code" }` after that approval and returns `{ "access_token": "opaque-short-lived-token", "expires_at": "...", "scopes": ["catalogues:read", "catalogues:write", "packages:install"], "console_name": "PS4" }`. Do not authorize merely because a website requested a challenge. A user may grant catalogue access and package-install access separately; deny an endpoint if its specific scope was not granted.

### `GET /catalogues` — paired bearer required

Returns the opaque revision and the existing source objects. Preserve server-owned and unknown fields when returning sources.

```json
{
  "revision": "opaque-revision",
  "sources": [
    { "id": "stable-source-id", "url": "https://example.org/catalogue.json", "name": "Homebrew", "enabled": true, "schema": "vortex-prime.ps4-catalogue/v1", "adapter_id": "vortex-v1" }
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
    { "operation_id": "op-1", "op": "add", "source_id": "stable-source-id", "source": { "id": "stable-source-id", "url": "https://example.org/catalogue.json", "name": "Homebrew", "enabled": true, "schema": "vortex-prime.ps4-catalogue/v1", "adapter_id": "vortex-v1" } },
    { "operation_id": "op-2", "op": "set-enabled", "source_id": "existing-source-id", "enabled": false },
    { "operation_id": "op-4", "op": "remove", "source_id": "another-source-id" }
  ]
}
```

Successful response **must confirm persistence**, not merely queue receipt:

```json
{ "revision": "new-opaque-revision", "applied_operation_ids": ["op-1", "op-2", "op-3", "op-4"], "sources": [] }
```

The service must apply add, enable/disable, and remove operations against individual source IDs and preserve unrelated sources/preferences and any legacy category metadata. It must treat `batch_id` and each `operation_id` idempotently and reject duplicate normalized source URLs. If `base_revision` does not match current storage, return HTTP `409` with `{ "code": "revision_conflict", "revision": "current-revision" }` and make no changes. Do not silently replace the whole configuration. Reject unknown source IDs, invalid source URLs, unsupported schemas, or malformed operations with a 4xx response.

### `POST /catalogues/refresh` — paired bearer required

Request `{ "source_ids": ["stable-source-id"] }` for selected sources or `{}` to refresh all enabled sources. Response `{ "refresh_id": "opaque-id", "status": "queued" }`.

### `GET /catalogues/refresh/{refresh_id}` — paired bearer required

Returns `{ "refresh_id": "opaque-id", "status": "queued|running|complete|failed", "message": "optional status" }`. Only `complete` is a completed refresh acknowledgement; `failed` includes a useful message.

## BGFT package installation bridge (required for the manager's install controls)

The manager reuses the PS4 IP stored by the Install on PS4 page (`vortexPrime.consoleIp.ps4`) and checks the documented Remote Package Installer API on port 12800. If detected, direct package URLs use its documented `POST /api/install` direct-package request; this endpoint internally registers the console's package download/install task. The manager can also send a URL through the separate BGFT bridge described below. A local PKG upload still requires that separate paired PS4-side bridge: the flatz Remote Package Installer direct-URL endpoint does not provide a browser file-upload route. The bridge described here is not implemented by this website repository; the manager reports connection or unsupported-endpoint errors instead of simulating a transfer.

When no address is saved from the installer (for example, the user chose a USB download), the Catalogue sources card has a manual private-IP fallback. The page does not attempt broad LAN subnet scans.

The bridge must use the same versioned base URL and pairing token, require the `packages:install` scope for every route below, validate package URLs and metadata on-console, and bind to the console's private LAN only. Honor the website-origin CORS/PNA rules above. Never accept WAN/public exposure or unauthenticated installation requests. The bridge must route tasks through the console's supported BGFT/AppInstUtil flow and report its real state. The flatz Remote Package Installer on port 12800 remains a different service/protocol.

### `POST /bgft/tasks` — direct URL, paired `packages:install` scope

Request:

```json
{ "source": "url", "package_url": "https://downloads.example.org/authorized-homebrew.pkg" }
```

The PS4 resolves/validates package metadata and registers its own BGFT download/install task for that URL. It downloads package data itself; the Vortex website neither fetches nor relays the PKG. A successful response means BGFT registration was confirmed, not that installation completed:

```json
{ "task_id": "opaque-service-task-id", "source": "url", "status": "registered" }
```

Only return `registered` or `queued` after the console has actually accepted/registered the task. Return a useful 4xx/5xx error when URL fetch, metadata validation, BGFT registration or storage checks fail.

### `POST /bgft/uploads?filename=<url-encoded-name.pkg>` — browser-to-console file upload

Headers: `Authorization: Bearer ...`, `Content-Type: application/vnd.vortex-prime.pkg`. The request body is the raw `.pkg` byte stream, sent directly by the browser to the console service. Enforce a configured size limit and free-space checks, validate the filename and package metadata, and stream without buffering the full package in RAM. Do not put uploaded PKGs in the Vortex Prime website, cloud, store, catalogue, or any Vortex server. The console service owns staging/cleanup and must delete its temporary copy after the BGFT/install flow no longer needs it. It must only return success after the upload is accepted and the BGFT task is registered; if the console's BGFT implementation cannot safely install an uploaded file, reject the request and report unsupported instead of claiming success.

Successful response:

```json
{ "task_id": "opaque-service-task-id", "source": "upload", "status": "registered" }
```

Upload progress in the website measures bytes sent from the browser to the console. It is not PS4 installation progress. The console must return task progress separately.

### `GET /bgft/tasks/{task_id}` — paired task status

Returns the real service status:

```json
{ "task_id": "opaque-service-task-id", "status": "downloading", "progress_percent": 42, "message": "optional console status" }
```

`status` is `registered|queued|downloading|installing|complete|failed|cancelled`. `progress_percent` is optional and must only be included when the console can report a meaningful value. `complete` may be returned only after the console installation flow confirms completion; a completed HTTP transfer alone is not installation completion. `failed` includes a useful error message. Return 404 for unknown task IDs and never expose another browser's task details without the paired token.

### Upload/task lifecycle safeguards

- Do not trust client-supplied package title/content IDs. Resolve metadata from the PKG or a trusted receiver-specific parser, and preserve valid update identifiers/version metadata.
- Do not uninstall an existing app automatically. Keep the website's pre-install confirmation: “Important: Completely close the application on your PS4 before continuing. Make sure no downloads are active.”
- Direct URLs and file uploads must remain individually visible as tasks. Do not mark them complete until a real console status reports it.
- Pairing tokens and package bytes must not be logged. Provide a console-side revoke control and task cleanup policy.
- The browser has no reliable raw-subnet discovery API; manual private IPv4 entry and last-address retry remain the supported connection fallback.

## Frontend sync behavior

Source edits are stored locally in browser storage as per-source operations. The browser merges pending operations over the PS4 snapshot by stable source ID, sends a revision-guarded operations batch, and clears only operation IDs explicitly acknowledged with a new revision. Network errors leave changes pending. A `409` reloads the PS4 snapshot but leaves local edits queued for review and explicit retry. The browser does not display “Synced” or “Refresh complete” based solely on request submission.

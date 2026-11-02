# PSX WebKit website sender protocol

**Status:** Proposed website contract, version 1. The website implementation is on a development branch. The separate PSX WebKit console receiver must implement this contract before real hardware can work. The mock is not a real-console test.

## Transport and safety

- The receiver listens only on the console's local network interface, with configurable port **19871** by default. This is a PSX WebKit port, not a GoldHEN payload port.
- Requests are direct from the user's browser to `http://<console-ip>:19871`. The public website backend does not proxy or fetch local addresses and stores no pairing data.
- Only user-entered private IPv4 addresses are accepted by the website. It does not scan addresses or accept public IPs.
- The receiver must require pairing and console-side user confirmation. It must not begin a download or installation when a request arrives.
- Serve CORS preflight and replies for the exact production origin `https://vortex-prime-emu.com` (and an explicit development origin when enabled). Allow methods `POST, OPTIONS`; headers `Authorization, Content-Type`; do not use wildcard origins with credentials.
- Browsers may gate website-to-LAN traffic with local-network permission, mixed-content rules, or platform-specific controls. On Chrome, declare `targetAddressSpace: 'local'` on the browser fetch so an HTTP LAN request can use the LNA permission flow. A failed browser request must be shown as failure. Do not treat an attempted fetch as delivery.
- Bind to LAN only, use short-lived pairing credentials, rate-limit pairing attempts, and never expose the listener through router port forwarding.

## Pairing

The user reads a short-lived pairing code on the console and enters it in the website form. The website sends:

```http
POST /api/v1/pair HTTP/1.1
Content-Type: application/json
Origin: https://vortex-prime-emu.com
```

```json
{"protocolVersion":1,"pairingCode":"<console displayed code>","client":"Vortex Prime Web"}
```

On success, return HTTP `200`:

```json
{"protocolVersion":1,"token":"<opaque random bearer token>","expiresAt":"2026-11-03T12:00:00Z"}
```

The token should be high entropy, in memory only on the website, scoped to this receiver, and expire within 10 minutes. The pairing code is one-use and expires within 2 minutes. Return `401` with `{"protocolVersion":1,"error":"pairing_rejected","message":"Pairing code was rejected."}` otherwise. Apply a short lockout after repeated failures.

## Request

```http
POST /api/v1/requests HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
Origin: https://vortex-prime-emu.com
```

```json
{
  "protocolVersion": 1,
  "requestId": "UUID",
  "target": "ps4-goldhen",
  "downloadUrl": "https://example.com/download/homebrew.pkg",
  "fileName": null,
  "requestedAt": "2026-11-03T12:00:00.000Z"
}
```

The website preserves the supplied URL string, accepts HTTP/HTTPS only, and does not fetch, proxy, rewrite, or download it. The receiver should independently validate the schema and URL before showing it. `fileName` is reserved and currently null. Version 1 website sending supports only `ps4-goldhen`; `ps5-etahen` is reserved for future verification.

The receiver must deduplicate by `requestId`. A repeated identical request returns the same acknowledgement without creating another pending item. A conflicting reuse of an ID returns HTTP `409`.

When the item is displayed in the console's pending-confirmation screen, return HTTP `202`:

```json
{"protocolVersion":1,"requestId":"UUID","status":"awaiting-user-confirmation"}
```

This response means the receiver accepted and displayed the URL for user review. It does not mean the download started or installation succeeded. Return `400` for malformed/unsupported data, `401` for missing/expired token, `409` for an ID collision, and `429` when rate-limited. Error bodies use `{"protocolVersion":1,"error":"stable_code","message":"Human readable text"}`.

## Limits and future changes

- Pairing and request JSON are UTF-8; maximum request body is 16 KiB and URL length is 8192 characters.
- The receiver should reject embedded URL username/password, unsupported protocols, invalid targets, stale timestamps (older than 5 minutes), and malformed request IDs.
- No request queue or URL history needs to survive receiver shutdown. A successful ack is emitted only after the URL appears on the console screen.
- PS5 support requires a separately verified PSX WebKit receiver and explicit target implementation. The website deliberately does not send PS5 requests yet.

## Browser behavior

The website sets CORS mode, declares the local target address space, checks supported browser permission state, and applies an 8 second timeout. The console must answer `OPTIONS` preflight for both POST routes and include CORS headers on success and error responses. Chrome may ask the user to grant local-network access after the Send button is pressed. iOS, Android, Firefox, Safari, and managed browsers can apply different local-network and mixed-content policies; hardware/browser testing is still required.

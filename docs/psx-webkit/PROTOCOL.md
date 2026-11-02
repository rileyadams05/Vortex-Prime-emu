# PSX WebKit website sender protocol

**Protocol version:** 1. The website sender and the separate PSX WebKit console receiver use this contract.

## Transport and safety

- The receiver listens only on the console's local network interface, on configurable port **19871** by default. This is not a GoldHEN payload port.
- The browser sends directly to http://<console-ip>:19871. The public website backend does not proxy, fetch, or store the request.
- The user enters the console's private IPv4 address. The website does not scan addresses or accept public IPs.
- No account sign-in, shared secret, or code is required. The IP address is the destination, not a credential.
- The receiver must display every accepted URL and require console-side confirmation. It must not download or install anything before the user confirms.
- Bind to the selected LAN address. Do not expose the receiver through router port forwarding.
- CORS must allow only the exact production origin https://vortex-prime-emu.com, plus explicitly configured development origins. Allow POST and OPTIONS methods and the Content-Type header. Never use a wildcard origin.
- CORS and a local IP are not authentication. Local-network reachability and explicit confirmation on the console are the safety boundary. The receiver must not perform actions beyond displaying the URL before confirmation.
- Browsers can gate local-network access with permission, mixed-content, and platform-specific rules. On Chrome, the sender declares the local target address space. A failed browser request is a failure; report success only after a valid receiver acknowledgement.

## Request

Expose one endpoint:

    POST /api/v1/requests
    Content-Type: application/json
    Origin: https://vortex-prime-emu.com

The website sends this UTF-8 JSON object:

    {
      "protocolVersion": 1,
      "requestId": "UUID",
      "target": "ps4-goldhen",
      "downloadUrl": "https://example.com/download/homebrew.pkg",
      "fileName": null,
      "requestedAt": "2026-11-03T12:00:00.000Z"
    }

The website preserves the supplied URL string. It accepts HTTP and HTTPS only; it does not fetch, proxy, rewrite, or download the URL. Version 1 supports ps4-goldhen only. ps5-etahen is reserved for future verification.

The receiver validates protocolVersion, UUID requestId, target, URL scheme and host, absence of embedded URL credentials, fileName equal to null, timestamp freshness, and message-size limits. Reject requests older than five minutes or more than one minute in the future. The maximum request body is 16 KiB and the maximum URL length is 8,192 characters.

## Acknowledgement and duplicate requests

Deduplicate by requestId. An identical retry returns the same acknowledgement without adding another pending item. Reusing the ID with different request data returns HTTP 409.

Only after the URL is visible on the console's pending-confirmation screen, return HTTP 202:

    {
      "protocolVersion": 1,
      "requestId": "UUID",
      "status": "awaiting-user-confirmation"
    }

This acknowledgement means the receiver displayed the URL for review. It does not mean that a download started or an installation succeeded.

## CORS preflight

The browser sends OPTIONS /api/v1/requests with Access-Control-Request-Method: POST and requests the Content-Type header. Respond with HTTP 204 and:

    Access-Control-Allow-Origin: https://vortex-prime-emu.com
    Access-Control-Allow-Methods: POST, OPTIONS
    Access-Control-Allow-Headers: Content-Type
    Vary: Origin

Include the allowed origin on responses so browser code can read acknowledgements and errors. Reject unknown origins without an Access-Control-Allow-Origin header.

## Errors

Return JSON error bodies in this form:

    {"protocolVersion":1,"error":"stable_code","message":"Human readable text"}

- 400 — malformed JSON, invalid fields, unsupported target, or oversized body.
- 403 — origin is not allowed.
- 409 — requestId was reused with different data.
- 429 — local request rate limit reached.

A receiver may enforce a local rate limit and bounded pending queue. Protocol version 1 has no authorization header, credential exchange, URL history, or pairing endpoint.

## Browser behavior

The sender uses CORS, declares the local target address space, checks supported browser permission state, and applies an eight-second timeout. The receiver must answer preflight and include CORS headers on success and error responses. Browser local-network behavior varies across Chrome, iOS, Android, Firefox, Safari, and managed browsers, so browser and hardware testing is required.

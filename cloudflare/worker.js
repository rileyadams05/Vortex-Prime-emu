const HOST_MAP = {
  "ps3.vortex-prime-emu.com": {
    entry: "/hen/han_enabler.html",
    prefix: "/hen",
    target: "ps3-hen"
  },
  "ps4.vortex-prime-emu.com": {
    entry: "/hen/ps4-golden-hen.html",
    prefix: "/hen",
    target: "ps4-goldhen"
  }
};

const ALTCHA_MAX_NUMBER = 750000;

async function sha256Hex(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt(length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), {
    ...init,
    headers
  });
}

async function handleAltcha(request) {
  if (request.method === "GET") {
    const salt = randomSalt(16);
    const nonce = Math.floor(Math.random() * ALTCHA_MAX_NUMBER);
    const challenge = await sha256Hex(`${salt}${nonce}`);

    return jsonResponse({
      algorithm: "SHA-256",
      challenge,
      maxNumber: ALTCHA_MAX_NUMBER,
      maxnumber: ALTCHA_MAX_NUMBER,
      salt,
      signature: ""
    });
  }

  if (request.method === "POST") {
    let payload;
    let encodedPayload = null;
    try {
      const { payload: encoded } = await request.json();
      encodedPayload = encoded ?? "";
      const decoded = atob(encodedPayload);
      payload = JSON.parse(decoded);
    } catch (error) {
      return jsonResponse({ verified: false, reason: "invalid-payload" }, { status: 400 });
    }

    const { algorithm, challenge, number, salt } = payload ?? {};

    if (algorithm !== "SHA-256" || typeof challenge !== "string" || typeof salt !== "string") {
      return jsonResponse({ verified: false, reason: "unsupported-algorithm" }, { status: 400 });
    }

    if (typeof number !== "number" || number < 0 || number > ALTCHA_MAX_NUMBER) {
      return jsonResponse({ verified: false, reason: "invalid-number" }, { status: 400 });
    }

    const expected = await sha256Hex(`${salt}${number}`);
    const match = expected === challenge;

    return jsonResponse({
      verified: match,
      payload: match ? encodedPayload : undefined,
      verificationData: match ? { salt, number } : undefined
    });
  }

  return new Response("Method not allowed", { status: 405 });
}

async function fetchAsset(request, env, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;

  const init = {
    method: request.method,
    headers: request.headers,
    body: request.body,
    cf: {
      cacheTtl: 0,
      cacheEverything: false
    }
  };

  return env.ASSETS.fetch(new Request(url.toString(), init));
}

function withDebugHeaders(response, targetLabel, meta = {}) {
  const headers = new Headers(response.headers);
  headers.set("x-vortex-worker", "console-subdomain-router");
  if (targetLabel) {
    headers.set("x-vortex-target", targetLabel);
  }
  if (meta.rewrittenFrom) {
    headers.set("x-vortex-rewrite", meta.rewrittenFrom);
  }

  headers.set("cache-control", "private, max-age=0, no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const mapping = HOST_MAP[host];

    if (url.pathname.startsWith("/security-check/api/")) {
      const endpoint = url.pathname.replace("/security-check/api", "");
      if (endpoint === "/challenge") {
        return handleAltcha(request);
      }
      if (endpoint === "/verify") {
        return handleAltcha(request);
      }
      return new Response("Not found", { status: 404 });
    }

    if (mapping) {
      const originalPath = url.pathname;

      if (originalPath === "/" || originalPath === "") {
        console.log(`Console host request`, { host, target: mapping.entry });
        const response = await fetchAsset(request, env, mapping.entry);
        return withDebugHeaders(response, mapping.target);
      }

      console.log(`Non-root console path`, { host, path: originalPath });

      const normalizedPath = originalPath.startsWith("/") ? originalPath : `/${originalPath}`;

      if (!normalizedPath.startsWith(mapping.prefix + "/")) {
        const rewrittenPath = `${mapping.prefix}${normalizedPath}`;
        console.log(`Rewriting console asset`, { host, from: normalizedPath, to: rewrittenPath });
        const response = await fetchAsset(request, env, rewrittenPath);

        if (response.status !== 404) {
          return withDebugHeaders(response, mapping.target, { rewrittenFrom: normalizedPath });
        }
      }

      const response = await fetchAsset(request, env, normalizedPath);
      return withDebugHeaders(response, mapping.target);
    }

    const fallback = await env.ASSETS.fetch(request);
    return withDebugHeaders(fallback);
  }
};

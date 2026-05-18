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

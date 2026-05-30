const DEFAULT_TIMEOUT_MS = 30_000;

export default {
  async fetch(request, env, ctx) {
    const companionOrigin = env.COMPANION_ORIGIN || env.COMPANION_BASE_URL || env.COMPANION_URL;
    if (!companionOrigin) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: 'Set a COMPANION_ORIGIN (or COMPANION_BASE_URL / COMPANION_URL) secret on the Worker to enable proxying.',
        }),
        {
          status: 500,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          },
        },
      );
    }

    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    const incomingUrl = new URL(request.url);
    const upstreamUrl = new URL(stripTrailingSlash(companionOrigin));
    upstreamUrl.pathname = normalizePath(upstreamUrl.pathname, incomingUrl.pathname.replace(/^\/api/, ''));
    upstreamUrl.search = incomingUrl.search;

    const upstreamRequest = new Request(upstreamUrl.toString(), request);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(upstreamRequest, {
        signal: controller.signal,
      });
      const proxiedHeaders = new Headers(response.headers);
      proxiedHeaders.set('access-control-allow-origin', incomingUrl.origin);
      proxiedHeaders.set('access-control-allow-credentials', 'true');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: proxiedHeaders,
      });
    } catch (error) {
      const message = error?.name === 'AbortError' ? 'Upstream Companion timed out.' : error?.message || 'Upstream request failed.';
      return new Response(JSON.stringify({ ok: false, message }), {
        status: 502,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'access-control-allow-origin': incomingUrl.origin,
          'access-control-allow-credentials': 'true',
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  },
};

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'Content-Type,Authorization',
      'access-control-max-age': '86400',
    },
  });
}

function normalizePath(basePath, incomingPath) {
  const cleanBase = basePath?.replace(/\/$/, '') || '';
  const segment = incomingPath.startsWith('/') ? incomingPath : `/${incomingPath}`;
  return `${cleanBase}${segment}`.replace(/\/+/g, '/');
}

function stripTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

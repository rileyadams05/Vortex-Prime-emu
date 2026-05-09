export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const allowedOrigins = new Set([
      'https://vortex-prime-emu.com',
      'https://www.vortex-prime-emu.com'
    ]);

    const origin = request.headers.get('Origin') || '';
    const corsHeaders = (okOrigin) => ({
      'Access-Control-Allow-Origin': okOrigin || '',
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400'
    });

    // Preflight
    if (request.method === 'OPTIONS') {
      const okOrigin = allowedOrigins.has(origin) ? origin : '';
      return new Response(null, { status: 204, headers: corsHeaders(okOrigin) });
    }

    // Route dispatch
    if (pathname.endsWith('/api/turnstile-verify')) {
      // Only POST supported
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ success: false, error: 'method-not-allowed' }), {
          status: 405,
          headers: { 'content-type': 'application/json', ...(allowedOrigins.has(origin) ? corsHeaders(origin) : {}) }
        });
      }

      let token = '';
      try {
        const body = await request.json();
        token = typeof body?.token === 'string' ? body.token : '';
      } catch (_) {}

      if (!token) {
        return new Response(JSON.stringify({ success: false, error: 'missing-input-response' }), {
          status: 400,
          headers: { 'content-type': 'application/json', ...(allowedOrigins.has(origin) ? corsHeaders(origin) : {}) }
        });
      }

    try {
      const ip = request.headers.get('CF-Connecting-IP') || '';
      const params = new URLSearchParams();
      params.append('secret', env.TURNSTILE_SECRET_KEY);
      params.append('response', token);
      if (ip) params.append('remoteip', ip);

      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: params,
        headers: { 'content-type': 'application/x-www-form-urlencoded' }
      });
      const data = await verifyRes.json();

      const ok = !!data?.success;
      const debug = {
        'error_codes': data?.['error-codes'] || [],
        'hostname': data?.hostname || null,
        'challenge_ts': data?.challenge_ts || null
      };
      return new Response(JSON.stringify({ success: ok, ...(!ok ? debug : {}) }), {
        status: ok ? 200 : 403,
        headers: { 'content-type': 'application/json', ...(allowedOrigins.has(origin) ? corsHeaders(origin) : {}) }
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: 'internal-error' }), {
        status: 500,
        headers: { 'content-type': 'application/json', ...(allowedOrigins.has(origin) ? corsHeaders(origin) : {}) }
      });
    }
    }

    // GitHub OAuth: /api/github/login
    if (pathname.endsWith('/api/github/login')) {
      const state = await randomState();
      const clientId = env.GITHUB_CLIENT_ID;
      const redirectUri = `https://vortex-prime-emu.com/oauth-callback.html`;
      const authorize = new URL('https://github.com/login/oauth/authorize');
      authorize.searchParams.set('client_id', clientId);
      authorize.searchParams.set('redirect_uri', redirectUri);
      authorize.searchParams.set('scope', 'read:user user:email');
      authorize.searchParams.set('state', state);
      // set state cookie
      const headers = new Headers({ Location: authorize.toString() });
      headers.append('Set-Cookie', cookie('vp_state', state, { path: '/', httpOnly: true, sameSite: 'Lax', secure: true, maxAge: 600 }));
      return new Response(null, { status: 302, headers });
    }

    // GitHub OAuth: /api/github/callback
    if (pathname.endsWith('/api/github/callback')) {
      const qs = url.searchParams;
      const code = qs.get('code') || '';
      const state = qs.get('state') || '';
      const cookies = parseCookies(request.headers.get('Cookie') || '');
      if (!code || !state || !cookies['vp_state'] || cookies['vp_state'] !== state) {
        return new Response('Invalid OAuth state.', { status: 400 });
      }

      const tokenParams = new URLSearchParams();
      tokenParams.set('client_id', env.GITHUB_CLIENT_ID);
      tokenParams.set('client_secret', env.GITHUB_CLIENT_SECRET);
      tokenParams.set('code', code);
      tokenParams.set('redirect_uri', `https://vortex-prime-emu.com/oauth-callback.html`);

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams
      });
      const tokenJson = await tokenRes.json();
      const access = tokenJson.access_token;
      if (!access) return new Response('OAuth failed', { status: 401 });

      const userRes = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${access}`, 'User-Agent': 'Vortex-Prime-Worker' }
      });
      const user = await userRes.json();
      if (!user || !user.login) return new Response('User fetch failed', { status: 401 });

      const session = await createSession({ sub: String(user.id), login: user.login, avatar_url: user.avatar_url, html_url: user.html_url }, env.SESSION_SECRET);
      const headers = new Headers({ Location: '/admin/?authed=1' });
      // clear state and set auth
      headers.append('Set-Cookie', cookie('vp_state', '', { path: '/', httpOnly: true, sameSite: 'Lax', secure: true, maxAge: 0 }));
      headers.append('Set-Cookie', cookie('vp_auth', session, { path: '/', httpOnly: true, sameSite: 'Lax', secure: true, maxAge: 60 * 60 * 24 * 7 }));
      return new Response(null, { status: 302, headers });
    }

    // GitHub OAuth: /api/github/me
    if (pathname.endsWith('/api/github/me')) {
      const cookies = parseCookies(request.headers.get('Cookie') || '');
      const token = cookies['vp_auth'];
      let data = null;
      if (token) data = await verifySession(token, env.SESSION_SECRET).catch(() => null);
      const body = data ? { authenticated: true, user: { login: data.login, avatar_url: data.avatar_url || null, html_url: data.html_url || null } } : { authenticated: false };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    // GitHub OAuth: /api/github/logout
    if (pathname.endsWith('/api/github/logout')) {
      const headers = new Headers({ 'content-type': 'application/json' });
      headers.append('Set-Cookie', cookie('vp_auth', '', { path: '/', httpOnly: true, sameSite: 'Lax', secure: true, maxAge: 0 }));
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    return new Response('Not found', { status: 404 });
  },
};

// Helpers
function parseCookies(header) {
  return Object.fromEntries(header.split(/;\s*/).filter(Boolean).map(kv => {
    const idx = kv.indexOf('=');
    const k = idx >= 0 ? kv.slice(0, idx) : kv;
    const v = idx >= 0 ? kv.slice(idx + 1) : '';
    return [k, v];
  }));
}

function cookie(name, value, opts = {}) {
  const parts = [`${name}=${value}`];
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join('; ');
}

async function randomState() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return base64url(a);
}

function base64url(input) {
  let b64 = '';
  if (input instanceof Uint8Array) {
    b64 = btoa(String.fromCharCode(...input));
  } else {
    b64 = btoa(input);
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function createSession(payload, secret) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = await hmac(`${header}.${body}`, secret);
  return `${header}.${body}.${sig}`;
}

async function verifySession(token, secret) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('bad');
  const expSig = await hmac(`${h}.${p}`, secret);
  if (expSig !== s) throw new Error('bad-sig');
  const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
  return payload;
}

async function hmac(data, key) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return base64url(new Uint8Array(sigBuf));
}

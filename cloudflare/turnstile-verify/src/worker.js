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

    // Google OAuth: /api/google/login
    if (pathname.endsWith('/api/google/login')) {
      const state = randomState();
      const codeVerifier = randomString(64);
      const codeChallenge = await pkceChallenge(codeVerifier);
      const clientId = env.GOOGLE_CLIENT_ID || '1031854944297-5fnr5ag53nnviq0av9htnctq733uae0k.apps.googleusercontent.com';
      const redirectUri = 'https://vortex-prime-emu.com/auth/google/callback.html';

      const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authorize.searchParams.set('client_id', clientId);
      authorize.searchParams.set('redirect_uri', redirectUri);
      authorize.searchParams.set('response_type', 'code');
      authorize.searchParams.set('scope', 'openid email profile');
      authorize.searchParams.set('state', state);
      authorize.searchParams.set('code_challenge', codeChallenge);
      authorize.searchParams.set('code_challenge_method', 'S256');
      authorize.searchParams.set('prompt', 'select_account');

      const headers = new Headers({ Location: authorize.toString() });
      headers.append('Set-Cookie', cookie('vp_state', state, { path: '/', httpOnly: true, sameSite: 'Lax', secure: true, maxAge: 600 }));
      headers.append('Set-Cookie', cookie('vp_pkce', codeVerifier, { path: '/', httpOnly: true, sameSite: 'Lax', secure: true, maxAge: 600 }));
      return new Response(null, { status: 302, headers });
    }

    // Google OAuth: /api/google/callback (POST from callback page)
    if (pathname.endsWith('/api/google/callback')) {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ ok: false, error: 'method-not-allowed' }), {
          status: 405,
          headers: { 'content-type': 'application/json' }
        });
      }

      let payload = {};
      try {
        payload = await request.json();
      } catch (_) {}

      const code = typeof payload.code === 'string' ? payload.code : '';
      const state = typeof payload.state === 'string' ? payload.state : '';
      const cookies = parseCookies(request.headers.get('Cookie') || '');
      const expectedState = cookies['vp_state'] || '';
      const codeVerifier = cookies['vp_pkce'] || '';

      if (!code || !state || !expectedState || state !== expectedState || !codeVerifier) {
        return new Response(JSON.stringify({ ok: false, error: 'invalid-state' }), {
          status: 400,
          headers: { 'content-type': 'application/json' }
        });
      }

      const clientId = env.GOOGLE_CLIENT_ID || '1031854944297-5fnr5ag53nnviq0av9htnctq733uae0k.apps.googleusercontent.com';
      const clientSecret = env.GOOGLE_CLIENT_SECRET;
      if (!clientSecret) {
        return new Response(JSON.stringify({ ok: false, error: 'server-misconfigured' }), {
          status: 500,
          headers: { 'content-type': 'application/json' }
        });
      }

      const redirectUri = 'https://vortex-prime-emu.com/auth/google/callback.html';
      const params = new URLSearchParams();
      params.set('code', code);
      params.set('client_id', clientId);
      params.set('client_secret', clientSecret);
      params.set('redirect_uri', redirectUri);
      params.set('grant_type', 'authorization_code');
      params.set('code_verifier', codeVerifier);

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: params
      });
      const tokenJson = await tokenRes.json().catch(() => ({}));
      const idToken = tokenJson.id_token;
      if (!tokenRes.ok || !idToken) {
        return new Response(JSON.stringify({ ok: false, error: 'token-exchange-failed' }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        });
      }

      const profile = parseJwt(idToken);
      if (!profile || profile.aud !== clientId) {
        return new Response(JSON.stringify({ ok: false, error: 'invalid-token' }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        });
      }

      const user = {
        sub: String(profile.sub || ''),
        email: profile.email || '',
        name: profile.name || profile.given_name || profile.email || 'Google User',
        picture: profile.picture || ''
      };

      const session = await createSession(user, env.SESSION_SECRET);
      const headers = new Headers({ 'content-type': 'application/json' });
      headers.append('Set-Cookie', cookie('vp_state', '', { path: '/', httpOnly: true, sameSite: 'Lax', secure: true, maxAge: 0 }));
      headers.append('Set-Cookie', cookie('vp_pkce', '', { path: '/', httpOnly: true, sameSite: 'Lax', secure: true, maxAge: 0 }));
      headers.append('Set-Cookie', cookie('vp_auth', session, { path: '/', httpOnly: true, sameSite: 'Lax', secure: true, maxAge: 60 * 60 * 24 * 7 }));
      return new Response(JSON.stringify({ ok: true, authenticated: true, user }), {
        status: 200,
        headers
      });
    }

    // Google OAuth: /api/google/me
    if (pathname.endsWith('/api/google/me')) {
      const cookies = parseCookies(request.headers.get('Cookie') || '');
      const token = cookies['vp_auth'];
      let data = null;
      if (token) data = await verifySession(token, env.SESSION_SECRET).catch(() => null);
      const body = data ? { authenticated: true, user: { name: data.name || data.email || 'Google User', email: data.email || null, picture: data.picture || null } } : { authenticated: false };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    // Google OAuth: /api/google/logout
    if (pathname.endsWith('/api/google/logout')) {
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

function randomState() {
  return randomString(16);
}

function randomString(length = 32) {
  const a = new Uint8Array(length);
  crypto.getRandomValues(a);
  return base64url(a);
}

async function pkceChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(new Uint8Array(digest));
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

function parseJwt(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  try {
    const json = atob(payload);
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

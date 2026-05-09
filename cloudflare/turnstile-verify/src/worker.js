export default {
  async fetch(request, env) {
    const allowedOrigins = new Set([
      'https://vortex-prime-emu.com',
      'https://www.vortex-prime-emu.com'
    ]);

    const origin = request.headers.get('Origin') || '';
    const corsHeaders = (okOrigin) => ({
      'Access-Control-Allow-Origin': okOrigin || '',
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400'
    });

    // Preflight
    if (request.method === 'OPTIONS') {
      const okOrigin = allowedOrigins.has(origin) ? origin : '';
      return new Response(null, { status: 204, headers: corsHeaders(okOrigin) });
    }

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
  },
};

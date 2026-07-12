const PRODUCTION_ORIGINS = [
  'https://vortex-prime-emu.com',
  'https://rileyadams05.github.io',
];

const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1']);

const DEFAULT_DB = {
  storeItems: [],
  storeMods: [],
  reports: [],
  adminSettings: {},
};

const UPLOAD_TARGETS = {
  package: {
    folderEnv: 'DRIVE_PACKAGES_FOLDER_ID',
    allowedExtensions: ['.pkg'],
    invalidMessage: 'PKG file required.',
    makePublic: true,
  },
  mod: {
    folderEnv: 'DRIVE_MODS_FOLDER_ID',
    allowedExtensions: ['.zip', '.7z', '.rar'],
    invalidMessage: 'Mod archive must be ZIP, 7Z, or RAR.',
    makePublic: true,
  },
  image: {
    folderEnv: 'DRIVE_ICONS_FOLDER_ID',
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
    invalidMessage: 'Icon must be PNG, JPG, JPEG, or WEBP.',
    makePublic: true,
  },
  preview: {
    folderEnv: 'DRIVE_PREVIEWS_FOLDER_ID',
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
    invalidMessage: 'Preview must be PNG, JPG, JPEG, or WEBP.',
    makePublic: true,
  },
  readme: {
    folderEnv: 'DRIVE_READMES_FOLDER_ID',
    allowedExtensions: ['.txt', '.md', '.markdown'],
    invalidMessage: 'README must be TXT or Markdown.',
    makePublic: true,
  },
};

let tokenCache = null;
let googleCertCache = null;
let riscConfigCache = null;
let adminEmailCache = null;

const GOOGLE_ISSUERS = new Set([
  'https://accounts.google.com',
  'accounts.google.com',
]);

const SESSION_COOKIE_NAME = 'vps_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days (persistent login)
const STREAMZ_STATE_TTL_SECONDS = 10 * 60;
const STREAMZ_CALLBACK_BASE = 'https://vortex-prime-emu.com/projects/streamz/auth';
const STREAMZ_DEFAULT_DEEP_LINK = 'streamz://auth/callback';
const STREAMZ_PRO_DEFAULT_AMOUNT_CENTS = 999;
const STREAMZ_PRO_DEFAULT_CURRENCY = 'usd';
const STREAMZ_PRO_DEFAULT_INTERVAL = 'month';
const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

const STREAMZ_OAUTH_PROVIDERS = {
  twitch: {
    label: 'Twitch',
    authorizeUrl: 'https://id.twitch.tv/oauth2/authorize',
    tokenUrl: 'https://id.twitch.tv/oauth2/token',
    clientIdEnv: 'STREAMZ_TWITCH_CLIENT_ID',
    redirectUriEnv: 'STREAMZ_TWITCH_REDIRECT_URI',
    defaultRedirectUri: `${STREAMZ_CALLBACK_BASE}/twitch/callback`,
    defaultScopes: [],
    usesPkce: true,
  },
  kick: {
    label: 'Kick',
    authorizeUrl: 'https://id.kick.com/oauth/authorize',
    tokenUrl: 'https://id.kick.com/oauth/token',
    clientIdEnv: 'STREAMZ_KICK_CLIENT_ID',
    clientSecretEnv: 'STREAMZ_KICK_CLIENT_SECRET',
    redirectUriEnv: 'STREAMZ_KICK_REDIRECT_URI',
    defaultRedirectUri: `${STREAMZ_CALLBACK_BASE}/kick/callback`,
    defaultScopes: [],
    usesPkce: true,
  },
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let sessionKeyCache = null;
let streamzStateKeyCache = null;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowedOrigin = resolveAllowedOrigin(origin);

    if (request.method === 'OPTIONS') {
      return optionsResponse(allowedOrigin);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, '');

    try {
      if (path === '' || path === 'api') {
        return json({ ok: true, service: 'Vortex Prime Companion Worker' }, 200, allowedOrigin);
      }

      if (path === 'api/status') {
        return handleStatus(request, env, allowedOrigin);
      }

      if (path === 'api/auth/config') {
        return handleAuthConfig(request, env, allowedOrigin);
      }

      if (path === 'api/auth/login') {
        return handleLogin(request, env, allowedOrigin);
      }

      if (path === 'api/auth/logout') {
        return handleLogout(env, allowedOrigin);
      }

      if (path.startsWith('api/streamz/auth/')) {
        return await handleStreamzAuthRequest(request, env, path, allowedOrigin);
      }

      if (path === 'api/streamz/pro/config') {
        return handleStreamzProConfig(request, env, allowedOrigin);
      }

      if (path === 'api/streamz/pro/checkout') {
        return await handleStreamzProCheckout(request, env, allowedOrigin);
      }

      if (path === 'api/streamz/pro/checkout-session') {
        return await handleStreamzProCheckoutSession(request, env, allowedOrigin);
      }

      if (path === 'api/streamz/pro/webhook') {
        return await handleStreamzProWebhook(request, env, allowedOrigin);
      }

      if (path === 'api/risc/events') {
        return handleRiscEvents(request, env, allowedOrigin);
      }

      if (path === 'api/public/catalogue') {
        return handlePublicCatalogue(env, allowedOrigin);
      }

      if (path === 'api/public/submit-video') {
        return handlePublicSubmitVideo(request, env, allowedOrigin);
      }

      if (path.startsWith('api/catalogue/')) {
        return handleCatalogueRequest(request, env, path, allowedOrigin);
      }

      if (path.startsWith('api/uploads/')) {
        return handleUploadRequest(request, env, path, allowedOrigin);
      }

      return json({ ok: false, message: 'API route not found.' }, 404, allowedOrigin);
    } catch (error) {
      console.error('Worker error:', error);
      const status = error.status || 500;
      const message = error.message || 'Internal server error';
      return json({ ok: false, message }, status, allowedOrigin);
    }
  },
};

function resolveAllowedOrigin(origin) {
  if (!origin) return PRODUCTION_ORIGINS[0];
  if (PRODUCTION_ORIGINS.includes(origin)) {
    return origin;
  }
  if (isAllowedLocalOrigin(origin)) {
    return origin;
  }
  return null;
}

function isAllowedLocalOrigin(origin) {
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }
    if (!LOCAL_DEV_HOSTS.has(url.hostname)) {
      return false;
    }
    if (url.port && Number.isNaN(Number(url.port))) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

function optionsResponse(origin) {
  const headers = new Headers({
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'Content-Type,Authorization',
    'access-control-max-age': '86400',
  });
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
  }
  return new Response(null, { status: 204, headers });
}

function json(data, status = 200, origin) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
  }
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers,
  });
}

async function handleStatus(request, env, origin) {
  const requiredSecrets = [
    'GOOGLE_DRIVE_CLIENT_ID',
    'GOOGLE_DRIVE_CLIENT_SECRET',
    'GOOGLE_DRIVE_REFRESH_TOKEN',
    'DRIVE_DATABASE_FILE_ID',
    'DRIVE_PACKAGES_FOLDER_ID',
    'DRIVE_MODS_FOLDER_ID',
    'DRIVE_ICONS_FOLDER_ID',
    'DRIVE_PREVIEWS_FOLDER_ID',
    'DRIVE_READMES_FOLDER_ID',
    'GOOGLE_OAUTH_CLIENT_ID',
    'SESSION_SECRET',
  ];

  const missing = requiredSecrets.filter((name) => !String(env[name] || '').trim());
  const status = {
    configured: missing.length === 0,
    googleAuthorized: false,
    message: missing.length ? `Missing Worker secrets: ${missing.join(', ')}` : 'Google Drive storage ready.',
    folders: buildFolderSummary(env),
    storeDbFileId: buildFileLink(env.DRIVE_DATABASE_FILE_ID),
    auth: buildAuthSummary(env, await readSession(request, env).catch(() => null)),
  };

  if (missing.length) {
    return json(status, 200, origin);
  }

  try {
    await assertDriveAccess(env);
    status.googleAuthorized = true;
  } catch (error) {
    status.configured = false;
    status.googleAuthorized = false;
    status.message = error.message || 'Unable to access Google Drive storage.';
  }

  return json(status, 200, origin);
}

async function handlePublicCatalogue(env, origin) {
  const db = await loadDatabase(env);
  return json(db, 200, origin);
}

async function handleAuthConfig(request, env, origin) {
  const session = await readSession(request, env).catch(() => null);
  const summary = buildAuthSummary(env, session);
  return json({ ok: true, ...summary }, 200, origin);
}

async function handleLogin(request, env, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Login requires POST.');
  }

  const body = await request.json().catch(() => null);
  const credential = body?.credential;
  if (!credential || typeof credential !== 'string') {
    throw httpError(400, 'Missing Google credential.');
  }

  const profile = await validateGoogleCredential(credential, env);
  const role = isAdminEmail(profile.email, env) ? 'admin' : 'uploader';
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: profile.sub,
    email: profile.email,
    name: profile.name || null,
    picture: profile.picture || null,
    role,
    exp: now + SESSION_TTL_SECONDS,
    iat: now,
  };
  const token = await createSessionToken(payload, env);
  const response = json({
    ok: true,
    user: sanitizeUserForResponse(payload),
    role,
  }, 200, origin);
  response.headers.append('Set-Cookie', buildSessionCookie(token));
  return response;
}

async function handleLogout(env, origin) {
  const response = json({ ok: true }, 200, origin);
  response.headers.append('Set-Cookie', buildSessionCookie('', { maxAge: 0 }));
  return response;
}

async function handleStreamzAuthRequest(request, env, path, origin) {
  const match = path.match(/^api\/streamz\/auth\/(twitch|kick)\/(start|callback)$/);
  if (!match) {
    throw httpError(404, 'Streamz OAuth route not found.');
  }

  const [, providerKey, action] = match;
  const provider = STREAMZ_OAUTH_PROVIDERS[providerKey];
  if (!provider) {
    throw httpError(404, 'Unsupported Streamz OAuth provider.');
  }

  if (action === 'start') {
    return handleStreamzAuthStart(request, env, providerKey, provider, origin);
  }
  return handleStreamzAuthCallback(request, env, providerKey, provider, origin);
}

async function handleStreamzAuthStart(request, env, providerKey, provider, origin) {
  if (!['GET', 'POST'].includes(request.method)) {
    throw httpError(405, 'Streamz OAuth start supports GET or POST.');
  }

  const clientId = requireEnv(env, provider.clientIdEnv);
  const redirectUri = getStreamzRedirectUri(env, provider);
  const url = new URL(request.url);
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  const scopeValue = readStreamzScope(url, body, provider);
  const returnTo = sanitizeStreamzReturnTo(
    body?.returnTo || url.searchParams.get('return_to') || url.searchParams.get('returnTo'),
    env,
  );
  const handoffKey = sanitizeStreamzHandoffKey(
    body?.handoffKey || url.searchParams.get('handoff_key') || url.searchParams.get('handoffKey'),
  );

  const now = Math.floor(Date.now() / 1000);
  const statePayload = {
    v: 1,
    provider: providerKey,
    nonce: base64UrlEncode(crypto.getRandomValues(new Uint8Array(24))),
    iat: now,
    exp: now + STREAMZ_STATE_TTL_SECONDS,
    returnTo,
  };
  if (handoffKey) {
    statePayload.handoffKey = handoffKey;
  }

  const authUrl = new URL(provider.authorizeUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  if (scopeValue) {
    authUrl.searchParams.set('scope', scopeValue);
  }

  if (provider.usesPkce) {
    const codeVerifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(64)));
    statePayload.codeVerifier = codeVerifier;
    authUrl.searchParams.set('code_challenge', await sha256Base64Url(codeVerifier));
    authUrl.searchParams.set('code_challenge_method', 'S256');
  }

  authUrl.searchParams.set('state', await encryptStreamzState(statePayload, env));

  return json({
    ok: true,
    provider: providerKey,
    authorizationUrl: authUrl.toString(),
    redirectUri,
    expiresIn: STREAMZ_STATE_TTL_SECONDS,
  }, 200, origin);
}

async function handleStreamzAuthCallback(request, env, providerKey, provider, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Streamz OAuth callback requires POST.');
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    throw httpError(400, 'Missing OAuth callback payload.');
  }

  const rawState = String(payload.state || '').trim();
  if (!rawState) {
    throw httpError(400, 'Missing OAuth state.');
  }

  const state = await decryptStreamzState(rawState, env);
  validateStreamzState(state, providerKey);

  if (payload.error) {
    throw httpError(400, `Authorization failed: ${String(payload.errorDescription || payload.error).trim()}`);
  }

  const code = String(payload.code || '').trim();
  if (!code) {
    throw httpError(400, 'Missing OAuth authorization code.');
  }

  const tokenResponse = await exchangeStreamzAuthorizationCode(env, provider, code, state);
  const deepLinkParams = {
    provider: providerKey,
    status: 'success',
    token_type: tokenResponse.token_type || '',
    expires_in: tokenResponse.expires_in || '',
    scope: normalizeScopeForResponse(tokenResponse.scope),
  };
  if (state.handoffKey) {
    deepLinkParams.payload = await encryptStreamzHandoff(state.handoffKey, {
      provider: providerKey,
      token: tokenResponse,
      authorizedAt: new Date().toISOString(),
    });
  }
  const deepLink = buildStreamzDeepLink(state.returnTo, deepLinkParams);

  return json({
    ok: true,
    provider: providerKey,
    message: `${provider.label} authorization completed. Return to Streamz to continue.`,
    deepLink,
    token: sanitizeStreamzTokenResponse(tokenResponse, Boolean(state.handoffKey)),
  }, 200, origin);
}

async function handleStreamzProConfig(request, env, origin) {
  if (request.method !== 'GET') {
    throw httpError(405, 'Streamz Pro config requires GET.');
  }

  const session = await readSession(request, env).catch(() => null);
  return json({
    ok: true,
    user: sanitizeUserForResponse(session),
    stripe: buildStreamzProStripeConfig(env),
  }, 200, origin);
}

async function handleStreamzProCheckout(request, env, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Streamz Pro checkout requires POST.');
  }

  const user = await ensureAuthenticated(request, env);
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    throw httpError(400, 'Missing contact details.');
  }

  const contact = validateStreamzProContact(payload, user);
  const siteOrigin = getCheckoutSiteOrigin(request, env, origin);
  const checkoutParams = buildStreamzProCheckoutParams(env, user, contact, siteOrigin);
  const checkoutSession = await stripeFormRequest(env, 'POST', '/checkout/sessions', checkoutParams);

  if (!checkoutSession?.id || !checkoutSession?.url) {
    throw httpError(502, 'Stripe did not return a Checkout Session URL.');
  }

  return json({
    ok: true,
    checkoutSessionId: checkoutSession.id,
    url: checkoutSession.url,
  }, 200, origin);
}

async function handleStreamzProCheckoutSession(request, env, origin) {
  if (request.method !== 'GET') {
    throw httpError(405, 'Checkout session lookup requires GET.');
  }

  const user = await ensureAuthenticated(request, env);
  const url = new URL(request.url);
  const sessionId = String(url.searchParams.get('session_id') || '').trim();
  if (!sessionId || !sessionId.startsWith('cs_')) {
    throw httpError(400, 'Missing Checkout Session ID.');
  }

  const checkoutSession = await stripeFormRequest(
    env,
    'GET',
    `/checkout/sessions/${encodeURIComponent(sessionId)}`,
  );

  const metadataSub = checkoutSession?.metadata?.google_sub;
  if (metadataSub && metadataSub !== user.sub) {
    throw httpError(403, 'Checkout Session does not belong to this Google account.');
  }

  return json({
    ok: true,
    id: checkoutSession.id,
    mode: checkoutSession.mode,
    status: checkoutSession.status,
    paymentStatus: checkoutSession.payment_status,
    amountTotal: checkoutSession.amount_total,
    currency: checkoutSession.currency,
    customerEmail: checkoutSession.customer_details?.email || checkoutSession.customer_email || null,
  }, 200, origin);
}

async function handleStreamzProWebhook(request, env, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Stripe webhook requires POST.');
  }

  const webhookSecret = requireEnv(env, 'STRIPE_WEBHOOK_SECRET');
  const signature = request.headers.get('Stripe-Signature') || '';
  const rawPayload = await request.text();
  await verifyStripeWebhookSignature(rawPayload, signature, webhookSecret);

  const event = JSON.parse(rawPayload);
  if (event?.type === 'checkout.session.completed') {
    const session = event.data?.object || {};
    console.log('Streamz Pro checkout completed', {
      checkoutSessionId: session.id,
      googleSub: session.metadata?.google_sub || null,
      email: session.metadata?.google_email || session.customer_details?.email || null,
      paymentStatus: session.payment_status || null,
    });
  }

  return json({ ok: true, received: true }, 200, origin);
}

async function exchangeStreamzAuthorizationCode(env, provider, code, state) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: requireEnv(env, provider.clientIdEnv),
    redirect_uri: getStreamzRedirectUri(env, provider),
    code,
  });

  if (provider.clientSecretEnv) {
    body.set('client_secret', requireEnv(env, provider.clientSecretEnv));
  }

  if (provider.usesPkce) {
    const codeVerifier = String(state.codeVerifier || '').trim();
    if (!codeVerifier) {
      throw httpError(400, `Missing ${provider.label} PKCE verifier in OAuth state.`);
    }
    body.set('code_verifier', codeVerifier);
  }

  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body,
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.access_token) {
    const detail = data?.error_description || data?.message || data?.error || response.statusText;
    throw httpError(response.status || 502, `Failed to exchange authorization code: ${detail}`);
  }

  return data;
}

function buildStreamzProStripeConfig(env) {
  const publishableKey = String(env.STRIPE_PUBLISHABLE_KEY || '').trim() || null;
  const priceId = String(env.STRIPE_STREAMZ_PRO_PRICE_ID || '').trim() || null;
  const mode = getStreamzProCheckoutMode(env);
  const currency = priceId ? null : getStreamzProCurrency(env);
  const amountCents = priceId ? null : getStreamzProAmountCents(env);
  return {
    publishableKey,
    configured: Boolean(String(env.STRIPE_SECRET_KEY || '').trim()) && (Boolean(priceId) || Number(amountCents) > 0),
    mode,
    productName: getStreamzProProductName(env),
    priceIdConfigured: Boolean(priceId),
    amountCents,
    currency,
  };
}

function validateStreamzProContact(payload, user) {
  const fullName = sanitizeSingleLine(payload.fullName, 120);
  const dateOfBirth = sanitizeSingleLine(payload.dateOfBirth, 20);
  const email = sanitizeSingleLine(payload.email, 254).toLowerCase();
  const sessionEmail = String(user?.email || '').trim().toLowerCase();

  if (!fullName) {
    throw httpError(400, 'Full name is required.');
  }
  if (!isValidIsoDate(dateOfBirth)) {
    throw httpError(400, 'Date of birth must be a valid date.');
  }
  if (!sessionEmail) {
    throw httpError(401, 'Signed-in Google account is missing an email address.');
  }
  if (email && email !== sessionEmail) {
    throw httpError(400, 'Email must match the signed-in Google account.');
  }

  return {
    fullName,
    dateOfBirth,
    email: sessionEmail,
  };
}

function buildStreamzProCheckoutParams(env, user, contact, siteOrigin) {
  const mode = getStreamzProCheckoutMode(env);
  const params = new URLSearchParams({
    mode,
    success_url: `${siteOrigin}/projects/streamz/pro/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteOrigin}/projects/streamz/pro/?checkout=cancelled`,
    customer_email: contact.email,
    client_reference_id: String(user.sub || contact.email),
    'metadata[product]': 'streamz_pro',
    'metadata[google_sub]': String(user.sub || ''),
    'metadata[google_email]': contact.email,
    'metadata[contact_full_name]': contact.fullName,
    'line_items[0][quantity]': '1',
    allow_promotion_codes: String(getBooleanEnv(env, 'STRIPE_STREAMZ_PRO_ALLOW_PROMOTION_CODES', false)),
  });

  const priceId = String(env.STRIPE_STREAMZ_PRO_PRICE_ID || '').trim();
  if (priceId) {
    params.set('line_items[0][price]', priceId);
  } else {
    params.set('line_items[0][price_data][currency]', getStreamzProCurrency(env));
    params.set('line_items[0][price_data][product_data][name]', getStreamzProProductName(env));
    params.set('line_items[0][price_data][unit_amount]', String(getStreamzProAmountCents(env)));
    if (mode === 'subscription') {
      params.set('line_items[0][price_data][recurring][interval]', getStreamzProInterval(env));
    }
  }

  if (mode === 'subscription') {
    params.set('subscription_data[metadata][product]', 'streamz_pro');
    params.set('subscription_data[metadata][google_sub]', String(user.sub || ''));
    params.set('subscription_data[metadata][google_email]', contact.email);
  } else {
    params.set('payment_intent_data[metadata][product]', 'streamz_pro');
    params.set('payment_intent_data[metadata][google_sub]', String(user.sub || ''));
    params.set('payment_intent_data[metadata][google_email]', contact.email);
  }

  return params;
}

async function stripeFormRequest(env, method, endpoint, formParams) {
  const secretKey = requireEnv(env, 'STRIPE_SECRET_KEY');
  const headers = new Headers({
    Authorization: `Bearer ${secretKey}`,
    Accept: 'application/json',
  });

  const options = { method, headers };
  if (method !== 'GET') {
    headers.set('Content-Type', 'application/x-www-form-urlencoded');
    options.body = formParams;
  }

  const response = await fetch(`${STRIPE_API_BASE}${endpoint}`, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.error?.message || data?.error || response.statusText;
    throw httpError(response.status || 502, `Stripe API error: ${detail}`);
  }
  return data;
}

async function verifyStripeWebhookSignature(payload, signatureHeader, secret) {
  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed.timestamp || !parsed.signatures.length) {
    throw httpError(400, 'Missing Stripe webhook signature.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > STRIPE_WEBHOOK_TOLERANCE_SECONDS) {
    throw httpError(400, 'Stripe webhook signature timestamp is outside the tolerance window.');
  }

  const expected = await hmacSha256Hex(secret, `${parsed.timestamp}.${payload}`);
  const expectedBytes = hexToBytes(expected);
  const valid = parsed.signatures.some((signature) => {
    try {
      return constantTimeEquals(expectedBytes, hexToBytes(signature));
    } catch (error) {
      return false;
    }
  });

  if (!valid) {
    throw httpError(400, 'Invalid Stripe webhook signature.');
  }
}

function parseStripeSignatureHeader(header) {
  return String(header || '')
    .split(',')
    .map((part) => part.split('='))
    .reduce((acc, [key, value]) => {
      const name = String(key || '').trim();
      const trimmedValue = String(value || '').trim();
      if (name === 't') {
        acc.timestamp = Number(trimmedValue);
      } else if (name === 'v1' && trimmedValue) {
        acc.signatures.push(trimmedValue);
      }
      return acc;
    }, { timestamp: 0, signatures: [] });
}

async function hmacSha256Hex(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const normalized = String(hex || '').trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error('Invalid hex value.');
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

function getCheckoutSiteOrigin(request, env, allowedOrigin) {
  const configured = String(env.PUBLIC_SITE_ORIGIN || env.SITE_ORIGIN || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  if (allowedOrigin) {
    return allowedOrigin.replace(/\/+$/, '');
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function getStreamzProCheckoutMode(env) {
  const mode = String(env.STRIPE_STREAMZ_PRO_MODE || 'payment').trim().toLowerCase();
  return mode === 'subscription' ? 'subscription' : 'payment';
}

function getStreamzProCurrency(env) {
  const currency = String(env.STRIPE_STREAMZ_PRO_CURRENCY || STREAMZ_PRO_DEFAULT_CURRENCY).trim().toLowerCase();
  return /^[a-z]{3}$/.test(currency) ? currency : STREAMZ_PRO_DEFAULT_CURRENCY;
}

function getStreamzProAmountCents(env) {
  const raw = String(env.STRIPE_STREAMZ_PRO_AMOUNT_CENTS || '').trim();
  const amount = raw ? Number(raw) : STREAMZ_PRO_DEFAULT_AMOUNT_CENTS;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw httpError(500, 'STRIPE_STREAMZ_PRO_AMOUNT_CENTS must be a positive integer.');
  }
  return amount;
}

function getStreamzProInterval(env) {
  const interval = String(env.STRIPE_STREAMZ_PRO_INTERVAL || STREAMZ_PRO_DEFAULT_INTERVAL).trim().toLowerCase();
  return ['day', 'week', 'month', 'year'].includes(interval) ? interval : STREAMZ_PRO_DEFAULT_INTERVAL;
}

function getStreamzProProductName(env) {
  return sanitizeSingleLine(env.STRIPE_STREAMZ_PRO_PRODUCT_NAME || 'Streamz Pro', 120) || 'Streamz Pro';
}

function getBooleanEnv(env, name, fallback = false) {
  const value = String(env[name] || '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function sanitizeSingleLine(value, maxLength) {
  return String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  if (date.toISOString().slice(0, 10) !== value) return false;
  return date.getTime() < Date.now();
}

async function handleRiscEvents(request, env, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Cross-Account Protection receiver requires POST.');
  }

  const token = await readSecurityEventToken(request);
  const event = await validateSecurityEventToken(token, env);
  await handleSecurityEvent(event, env);
  return json({ ok: true, received: true }, 202, origin);
}

async function handleCatalogueRequest(request, env, path, origin) {
  const segments = path.split('/');
  const mode = normaliseMode(segments[2]);

  if (request.method === 'GET') {
    const list = await readCatalogue(env, mode);
    return json(list, 200, origin);
  }

  if (request.method === 'POST') {
    let admin;
    try {
      admin = await ensureAdmin(request, env);
    } catch (error) {
      const status = Number(error?.status) || 403;
      const message = status === 401
        ? 'Sign in with Google to manage the catalogue.'
        : (error?.message || 'Admin privileges required.');
      return json({ ok: false, message }, status, origin);
    }
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      throw httpError(400, 'Missing JSON payload.');
    }
    const incoming = payload.item && typeof payload.item === 'object' ? payload.item : payload;
    const saved = await saveCatalogueItem(env, mode, incoming, admin);
    return json(saved, 200, origin);
  }

  if (request.method === 'DELETE') {
    try {
      await ensureAdmin(request, env);
    } catch (error) {
      const status = Number(error?.status) || 403;
      const message = status === 401
        ? 'Sign in with Google to manage the catalogue.'
        : (error?.message || 'Admin privileges required.');
      return json({ ok: false, message }, status, origin);
    }
    const itemId = segments[3];
    if (!itemId) {
      throw httpError(400, 'Missing item id.');
    }
    await deleteCatalogueItem(env, mode, itemId);
    return json({ success: true }, 200, origin);
  }

  return json({ ok: false, message: 'Method not allowed.' }, 405, origin);
}

async function handleUploadRequest(request, env, path, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Upload endpoint only supports POST.');
  }

  let user;
  try {
    user = await ensureAuthenticated(request, env);
  } catch (error) {
    const status = Number(error?.status) || 401;
    const message = error?.message || 'Sign in with Google to upload.';
    return json({ ok: false, message }, status, origin);
  }

  const type = path.split('/')[2];
  const target = UPLOAD_TARGETS[type];
  if (!target) {
    throw httpError(404, 'Unknown upload type.');
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.name) {
    throw httpError(400, 'No file uploaded.');
  }

  if (!hasAllowedExtension(file.name, target.allowedExtensions)) {
    throw httpError(400, target.invalidMessage);
  }

  const metadata = parseMetadata(form.get('metadata'));
  const folderId = requireEnv(env, target.folderEnv);

  let fileInfo;
  try {
    fileInfo = await uploadFileToDrive(env, folderId, file, target.makePublic !== false);
  } catch (error) {
    console.error('Upload failed for type', type, error);
    const status = Number(error?.status) || 500;
    const rawMessage = error?.message || 'Upload failed.';
    // Detect Drive quota errors and surface a clear diagnostic message.
    const isQuotaError = rawMessage.includes('storageQuotaExceeded') || rawMessage.toLowerCase().includes('storage quota');
    const message = isQuotaError
      ? 'Google Drive upload failed because the backend is using a service account with no storage quota. Configure Drive OAuth refresh-token storage.'
      : rawMessage;
    return json({ ok: false, message }, status, origin);
  }

  if (metadata?.replaceFileId) {
    await deleteDriveFile(env, metadata.replaceFileId).catch(() => {});
  }

  if (type === 'readme') {
    const maxPreview = 128 * 1024;
    const content = await file.text();
    fileInfo.content = content.slice(0, maxPreview);
    fileInfo.format = file.name.toLowerCase().endsWith('.txt') ? 'text' : 'markdown';
  }

  return json({ ...fileInfo, uploadedBy: sanitizeUserForResponse(user) }, 200, origin);
}

function buildFolderSummary(env) {
  return {
    packages: buildFolderLink(env.DRIVE_PACKAGES_FOLDER_ID),
    mods: buildFolderLink(env.DRIVE_MODS_FOLDER_ID),
    icons: buildFolderLink(env.DRIVE_ICONS_FOLDER_ID),
    previews: buildFolderLink(env.DRIVE_PREVIEWS_FOLDER_ID),
    readmes: buildFolderLink(env.DRIVE_READMES_FOLDER_ID),
  };
}

function buildFolderLink(folderId) {
  const trimmed = String(folderId || '').trim();
  if (!trimmed) return null;
  return `https://drive.google.com/drive/folders/${trimmed}`;
}

function buildFileLink(fileId) {
  const trimmed = String(fileId || '').trim();
  if (!trimmed) return null;
  return `https://drive.google.com/file/d/${trimmed}/view`;
}

async function assertDriveAccess(env) {
  const fileId = requireEnv(env, 'DRIVE_DATABASE_FILE_ID');
  const response = await driveRequest(env, `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name`, { method: 'GET' });
  if (response.status === 404) {
    throw httpError(500, 'Google Drive database file not found.');
  }
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw httpError(response.status, `Google Drive access failed: ${text}`);
  }
  await response.json();
}

async function loadDatabase(env) {
  const fileId = requireEnv(env, 'DRIVE_DATABASE_FILE_ID');
  const response = await driveRequest(env, `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { method: 'GET' });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw httpError(response.status, `Failed to load catalogue: ${text}`);
  }
  let json = null;
  try {
    json = await response.json();
  } catch (error) {
    json = null;
  }
  if (!json || typeof json !== 'object') {
    return { ...DEFAULT_DB };
  }
  return { ...DEFAULT_DB, ...json };
}

async function persistDatabase(env, data) {
  const fileId = requireEnv(env, 'DRIVE_DATABASE_FILE_ID');
  const body = JSON.stringify({ ...DEFAULT_DB, ...data }, null, 2);
  const response = await driveRequest(
    env,
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body,
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw httpError(response.status, `Failed to save catalogue: ${text}`);
  }
  return JSON.parse(body);
}

async function readCatalogue(env, mode) {
  const db = await loadDatabase(env);
  const listName = mode === 'mods' ? 'storeMods' : 'storeItems';
  const list = Array.isArray(db[listName]) ? db[listName] : [];
  return list.map((entry) => sanitizeItem(entry));
}

async function saveCatalogueItem(env, mode, incoming, actor) {
  const db = await loadDatabase(env);
  const listName = mode === 'mods' ? 'storeMods' : 'storeItems';
  const list = Array.isArray(db[listName]) ? [...db[listName]] : [];

  let item = assignItemId(incoming);
  const index = list.findIndex((entry) => entry.id === item.id);
  const existing = index >= 0 ? list[index] : null;
  item = timestampItem(item, existing);
  item = annotateItemWithActor(item, actor, existing);
  item = sanitizeItem(item);

  if (index >= 0) {
    list[index] = item;
  } else {
    list.push(item);
  }

  const nextDb = { ...db, [listName]: list };
  await persistDatabase(env, nextDb);
  return item;
}

async function deleteCatalogueItem(env, mode, itemId) {
  const db = await loadDatabase(env);
  const listName = mode === 'mods' ? 'storeMods' : 'storeItems';
  const list = Array.isArray(db[listName]) ? [...db[listName]] : [];
  const index = list.findIndex((entry) => entry.id === itemId);
  if (index === -1) {
    throw httpError(404, 'Item not found.');
  }

  const [removed] = list.splice(index, 1);
  const nextDb = { ...db, [listName]: list };
  await persistDatabase(env, nextDb);

  if (removed?.driveFiles && typeof removed.driveFiles === 'object') {
    const values = Object.values(removed.driveFiles).filter(Boolean);
    await Promise.all(values.map(async (info) => {
      if (info?.id) {
        await deleteDriveFile(env, info.id).catch(() => {});
      }
    }));
  }
}

async function uploadFileToDrive(env, folderId, file, makePublic = true) {
  const metadata = {
    name: file.name,
    parents: [folderId],
  };
  const boundary = `vortex-${crypto.randomUUID()}`;
  const mimeType = file.type || 'application/octet-stream';
  const preamble = textEncoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`);
  const closing = textEncoder.encode(`\r\n--${boundary}--\r\n`);

  const bodyStream = new ReadableStream({
    async start(controller) {
      controller.enqueue(preamble);
      const reader = file.stream().getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.enqueue(closing);
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });

  const response = await driveRequest(
    env,
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyStream,
    },
  );

  const json = await response.json().catch(() => null);
  if (!response.ok || !json) {
    const text = json ? JSON.stringify(json) : await response.text().catch(() => response.statusText);
    throw httpError(response.status, `Google Drive upload failed: ${text}`);
  }

  if (makePublic) {
    await ensureAnyoneCanRead(env, json.id);
  }

  return formatDriveFileResponse(json);
}

async function ensureAnyoneCanRead(env, fileId) {
  const response = await driveRequest(
    env,
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    },
  );

  if (response.ok) return;

  const errorJson = await response.json().catch(() => null);
  const reason = errorJson?.error?.errors?.[0]?.reason;
  if (reason === 'alreadyExists') {
    return;
  }
  const text = errorJson ? JSON.stringify(errorJson) : await response.text().catch(() => response.statusText);
  throw httpError(response.status, `Failed to set public permission: ${text}`);
}

async function deleteDriveFile(env, fileId) {
  const response = await driveRequest(env, `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: 'DELETE',
  });
  if (response.status === 404) return;
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw httpError(response.status, `Failed to delete Drive file: ${text}`);
  }
}

function formatDriveFileResponse(file) {
  const id = file.id;
  const downloadUrl = buildDownloadUrl(id);
  const webViewLink = file.webViewLink || buildFileLink(id);
  const webContentLink = file.webContentLink || downloadUrl;
  return {
    id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size ? Number(file.size) : undefined,
    downloadUrl,
    webViewLink,
    webContentLink,
  };
}

function buildDownloadUrl(fileId) {
  return `https://drive.google.com/uc?id=${fileId}&export=download`;
}

function sanitizeItem(raw) {
  const item = { ...(raw || {}) };
  item.id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : crypto.randomUUID();
  item.name = item.name || '';
  item.description = item.description || '';
  // Original Creator / Author of the package (e.g. "Cyb1k") — never overwritten
  // by the uploader's account name.
  item.creator = item.creator || item.author || '';
  // "Uploaded By" is the editable display label for who uploaded it to the
  // Vortex Prime Store (e.g. "Riley Adams"). Falls back to legacy uploader/owner.
  item.uploadedBy = (item.uploadedBy || item.uploader || item.owner || '').toString().trim();
  item.tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
  item.platform = item.platform || 'PS4';
  item.updated = item.updated || new Date().toISOString();
  item.type = item.type === 'mods' ? 'mods' : 'store';
  if (!item.driveFiles || typeof item.driveFiles !== 'object') {
    item.driveFiles = {};
  }
  if (item.download_url) {
    item.download = {
      enabled: true,
      url: item.download_url,
      type: item.fileType || (item.type === 'mods' ? 'archive' : 'pkg'),
    };
  }
  return item;
}

function assignItemId(item) {
  if (item?.id) return { ...item };
  return { ...item, id: crypto.randomUUID() };
}

function timestampItem(item, existing) {
  const now = new Date().toISOString();
  const next = { ...item, updated: now };
  next.created_at = existing?.created_at || next.created_at || now;
  next.uploaded_at = existing?.uploaded_at || next.uploaded_at || now;
  return next;
}

function annotateItemWithActor(item, actor, existing) {
  if (!actor) return item;
  const sanitized = sanitizeUserForResponse(actor);
  if (!sanitized) return item;
  const next = {
    ...item,
    lastModifiedBy: sanitized,
  };
  // Ownership account is set once when the item is first created and is then
  // preserved across edits. This is the signed-in account that owns the upload
  // for permission checks — kept separate from the editable "Uploaded By" label.
  next.uploaderAccount = existing?.uploaderAccount || item.uploaderAccount || sanitized;
  return next;
}

function normaliseMode(value) {
  return value === 'mods' ? 'mods' : 'store';
}

function hasAllowedExtension(fileName, allowed) {
  const lower = fileName.toLowerCase();
  return allowed.some((ext) => lower.endsWith(ext));
}

function parseMetadata(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireEnv(env, name) {
  const value = String(env[name] || '').trim();
  if (!value) {
    throw httpError(500, `Worker secret ${name} is not set.`);
  }
  return value;
}

function getStreamzRedirectUri(env, provider) {
  return String(env[provider.redirectUriEnv] || '').trim() || provider.defaultRedirectUri;
}

function readStreamzScope(url, body, provider) {
  const raw = body?.scope || body?.scopes || url.searchParams.get('scope') || provider.defaultScopes;
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value).trim()).filter(Boolean).join(' ');
  }
  return String(raw || '').trim();
}

function sanitizeStreamzReturnTo(value, env) {
  const fallback = String(env.STREAMZ_DEFAULT_DEEP_LINK || '').trim() || STREAMZ_DEFAULT_DEEP_LINK;
  const candidate = String(value || fallback).trim();
  try {
    const url = new URL(candidate);
    const allowedSchemes = getAllowedStreamzDeepLinkSchemes(env);
    if (!allowedSchemes.has(url.protocol.replace(/:$/, '').toLowerCase())) {
      throw httpError(400, 'Unsupported Streamz deep-link scheme.');
    }
    return url.toString();
  } catch (error) {
    if (error?.status) throw error;
    throw httpError(400, 'Invalid Streamz deep-link URL.');
  }
}

function getAllowedStreamzDeepLinkSchemes(env) {
  const configured = String(env.STREAMZ_ALLOWED_DEEP_LINK_SCHEMES || 'streamz')
    .split(/[,\s]+/)
    .map((value) => value.trim().replace(/:$/, '').toLowerCase())
    .filter(Boolean);
  return new Set(configured.length ? configured : ['streamz']);
}

function sanitizeStreamzHandoffKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  let bytes;
  try {
    bytes = base64UrlDecode(raw);
  } catch (error) {
    throw httpError(400, 'Invalid Streamz handoff key encoding.');
  }
  if (bytes.length !== 32) {
    throw httpError(400, 'Streamz handoff key must be 32 random bytes encoded as base64url.');
  }
  return base64UrlEncode(bytes);
}

async function importStreamzStateKey(env) {
  const secret = requireEnv(env, 'STREAMZ_OAUTH_STATE_SECRET');
  if (streamzStateKeyCache?.secret === secret) {
    return streamzStateKeyCache.key;
  }
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(secret));
  const key = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  streamzStateKeyCache = { secret, key };
  return key;
}

async function encryptStreamzState(payload, env) {
  const key = await importStreamzStateKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(JSON.stringify(payload)),
  );
  return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
}

async function decryptStreamzState(token, env) {
  const [ivPart, ciphertextPart] = String(token || '').split('.');
  if (!ivPart || !ciphertextPart) {
    throw httpError(400, 'Invalid OAuth state format.');
  }
  try {
    const key = await importStreamzStateKey(env);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlDecode(ivPart) },
      key,
      base64UrlDecode(ciphertextPart),
    );
    return JSON.parse(textDecoder.decode(plaintext));
  } catch (error) {
    throw httpError(400, 'Invalid or expired OAuth state.');
  }
}

function validateStreamzState(state, providerKey) {
  if (!state || state.v !== 1 || state.provider !== providerKey || !state.nonce) {
    throw httpError(400, 'OAuth state does not match this provider.');
  }
  const now = Math.floor(Date.now() / 1000);
  if (!state.exp || Number(state.exp) < now) {
    throw httpError(400, 'OAuth state has expired.');
  }
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(String(value)));
  return base64UrlEncode(new Uint8Array(digest));
}

async function encryptStreamzHandoff(handoffKey, payload) {
  const keyBytes = base64UrlDecode(handoffKey);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(JSON.stringify(payload)),
  );
  return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
}

function buildStreamzDeepLink(returnTo, params) {
  const url = new URL(returnTo || STREAMZ_DEFAULT_DEEP_LINK);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function normalizeScopeForResponse(scope) {
  if (Array.isArray(scope)) return scope.join(' ');
  return String(scope || '').trim();
}

function sanitizeStreamzTokenResponse(tokenResponse, handoffEncrypted = false) {
  return {
    tokenType: tokenResponse?.token_type || null,
    expiresIn: tokenResponse?.expires_in || null,
    scope: normalizeScopeForResponse(tokenResponse?.scope) || null,
    handoffEncrypted,
  };
}

function sanitizeUserForResponse(user) {
  if (!user || typeof user !== 'object') return null;
  const { email, name, picture, role } = user;
  const trimmedEmail = typeof email === 'string' ? email.trim() : null;
  if (!trimmedEmail) return null;
  return {
    email: trimmedEmail,
    name: typeof name === 'string' ? name.trim() : null,
    picture: typeof picture === 'string' ? picture.trim() : null,
    role: role || 'uploader',
  };
}

function buildAuthSummary(env, sessionUser) {
  return {
    googleClientId: String(env.GOOGLE_OAUTH_CLIENT_ID || '').trim() || null,
    adminEmails: getAdminEmails(env),
    user: sanitizeUserForResponse(sessionUser),
  };
}

async function ensureAuthenticated(request, env) {
  const session = await readSession(request, env);
  if (!session) {
    throw httpError(401, 'Sign in with Google to upload.');
  }
  return session;
}

async function ensureAdmin(request, env) {
  const session = await ensureAuthenticated(request, env);
  if (session.role !== 'admin') {
    throw httpError(403, 'Admin privileges required.');
  }
  return session;
}

function parseCookies(header) {
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.split('=');
    if (!key) return acc;
    const name = key.trim();
    const value = rest.join('=').trim();
    if (name) acc[name] = value;
    return acc;
  }, {});
}

async function readSession(request, env) {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  const cookies = parseCookies(header);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  const session = await verifySessionToken(token, env);
  if (env.RISC_EVENTS_KV && session?.sub) {
    const revoked = await env.RISC_EVENTS_KV.get(`revoked-sub:${session.sub}`);
    if (revoked) {
      throw httpError(401, 'Session revoked by Google security event.');
    }
  }
  return session;
}

function buildSessionCookie(value, options = {}) {
  const parts = [`${SESSION_COOKIE_NAME}=${value || ''}`];
  const maxAge = options.maxAge ?? SESSION_TTL_SECONDS;
  parts.push(`Path=/`);
  parts.push(`HttpOnly`);
  parts.push(`Secure`);
  parts.push(`SameSite=Lax`);
  parts.push(`Max-Age=${maxAge}`);
  if (options.expires instanceof Date) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  return parts.join('; ');
}

async function importSessionKey(env) {
  if (sessionKeyCache) return sessionKeyCache;
  const secret = requireEnv(env, 'SESSION_SECRET');
  const data = textEncoder.encode(secret);
  sessionKeyCache = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return sessionKeyCache;
}

async function createSessionToken(payload, env) {
  const key = await importSessionKey(env);
  const trimmed = sanitizeUserForResponse(payload);
  const toEncode = { ...payload, role: trimmed?.role || payload.role || 'uploader' };
  const json = JSON.stringify(toEncode);
  const base = base64UrlEncode(json);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, textEncoder.encode(base));
  const signature = base64UrlEncode(new Uint8Array(signatureBuffer));
  return `${base}.${signature}`;
}

async function verifySessionToken(token, env) {
  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) {
    throw httpError(401, 'Invalid session.');
  }
  const key = await importSessionKey(env);
  const expectedSignatureBuffer = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payloadPart));
  const expectedSignature = new Uint8Array(expectedSignatureBuffer);
  const providedSignature = base64UrlDecode(signaturePart);
  if (!constantTimeEquals(expectedSignature, providedSignature)) {
    throw httpError(401, 'Invalid signature.');
  }
  const payloadJson = textDecoder.decode(base64UrlDecode(payloadPart));
  const payload = JSON.parse(payloadJson);
  if (!payload?.exp || Math.floor(Date.now() / 1000) >= Number(payload.exp)) {
    throw httpError(401, 'Session expired.');
  }
  return payload;
}

function constantTimeEquals(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

function getAdminEmails(env) {
  const raw = String(env.GOOGLE_ADMIN_EMAILS || '').trim();
  if (!raw) {
    adminEmailCache = {
      raw: '',
      list: [],
      exact: new Set(),
      domains: new Set(),
    };
    return adminEmailCache.list;
  }
  if (adminEmailCache?.raw === raw) {
    return adminEmailCache.list;
  }
  const parts = raw
    .split(/[,\n]/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const exact = new Set();
  const domains = new Set();
  for (const entry of parts) {
    if (entry.startsWith('*@')) {
      domains.add(entry.slice(2));
    } else if (entry.startsWith('@')) {
      domains.add(entry.slice(1));
    } else {
      exact.add(entry);
    }
  }
  adminEmailCache = {
    raw,
    list: parts,
    exact,
    domains,
  };
  return adminEmailCache.list;
}

function isAdminEmail(email, env) {
  if (!email) return false;
  const lower = String(email).toLowerCase();
  const configRaw = String(env.GOOGLE_ADMIN_EMAILS || '').trim();
  const cache = adminEmailCache && adminEmailCache.raw === configRaw
    ? adminEmailCache
    : (getAdminEmails(env), adminEmailCache);
  if (cache.exact.has(lower)) {
    return true;
  }
  const domain = lower.split('@')[1];
  if (domain && cache.domains.has(domain)) {
    return true;
  }
  return false;
}

async function validateGoogleCredential(credential, env) {
  const parts = credential.split('.');
  if (parts.length !== 3) {
    throw httpError(400, 'Invalid Google credential.');
  }
  const [headerPart, payloadPart, signaturePart] = parts;
  const headerJson = textDecoder.decode(base64UrlDecode(headerPart));
  const payloadJson = textDecoder.decode(base64UrlDecode(payloadPart));
  let header;
  let payload;
  try {
    header = JSON.parse(headerJson);
    payload = JSON.parse(payloadJson);
  } catch (error) {
    throw httpError(400, 'Malformed Google credential.');
  }

  if (!GOOGLE_ISSUERS.has(payload.iss)) {
    throw httpError(401, 'Invalid Google issuer.');
  }

  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const clientId = requireEnv(env, 'GOOGLE_OAUTH_CLIENT_ID');
  if (!audience.includes(clientId)) {
    throw httpError(401, 'Google credential audience mismatch.');
  }

  if (!payload.email || payload.email_verified === false) {
    throw httpError(401, 'Google account email must be verified.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.exp) <= now) {
    throw httpError(401, 'Google credential expired.');
  }
  if (payload.nbf && Number(payload.nbf) > now) {
    throw httpError(401, 'Google credential not yet valid.');
  }

  const publicKey = await getGooglePublicKey(header.kid);
  const signedContent = textEncoder.encode(`${headerPart}.${payloadPart}`);
  const signature = base64UrlDecode(signaturePart);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, signedContent);
  if (!valid) {
    throw httpError(401, 'Failed to verify Google credential.');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

async function readSecurityEventToken(request) {
  const contentType = request.headers.get('content-type') || '';
  const raw = await request.text();
  if (!raw || !raw.trim()) {
    throw httpError(400, 'Missing security event token.');
  }

  if (contentType.includes('application/json')) {
    let body;
    try {
      body = JSON.parse(raw);
    } catch (error) {
      throw httpError(400, 'Malformed security event JSON body.');
    }
    const token = body?.jwt || body?.token || body?.security_event_token;
    if (!token || typeof token !== 'string') {
      throw httpError(400, 'Missing security event token in JSON body.');
    }
    return token.trim();
  }

  return raw.trim();
}

async function validateSecurityEventToken(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw httpError(400, 'Malformed security event token.');
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(textDecoder.decode(base64UrlDecode(headerPart)));
    payload = JSON.parse(textDecoder.decode(base64UrlDecode(payloadPart)));
  } catch (error) {
    throw httpError(400, 'Malformed security event token JSON.');
  }

  const riscConfig = await getRiscConfig();
  if (payload.iss !== riscConfig.issuer) {
    throw httpError(400, 'Security event token issuer mismatch.');
  }

  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const allowedAudience = getRiscAudiences(env);
  if (!audience.some((value) => allowedAudience.includes(value))) {
    throw httpError(400, 'Security event token audience mismatch.');
  }

  const publicKey = await getGooglePublicKey(header.kid, riscConfig.jwks_uri);
  const signedContent = textEncoder.encode(`${headerPart}.${payloadPart}`);
  const signature = base64UrlDecode(signaturePart);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, signedContent);
  if (!valid) {
    throw httpError(400, 'Security event token signature verification failed.');
  }

  if (!payload.events || typeof payload.events !== 'object') {
    throw httpError(400, 'Security event token has no events claim.');
  }

  return payload;
}

function getRiscAudiences(env) {
  const configured = String(env.RISC_AUDIENCES || '')
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
  const defaults = [
    String(env.GOOGLE_OAUTH_CLIENT_ID || '').trim(),
    String(env.GOOGLE_DRIVE_CLIENT_ID || '').trim(),
  ].filter(Boolean);
  return [...new Set([...configured, ...defaults])];
}

async function getRiscConfig() {
  const now = Date.now();
  if (riscConfigCache && riscConfigCache.expiresAt > now) {
    return riscConfigCache.config;
  }

  const response = await fetch('https://accounts.google.com/.well-known/risc-configuration');
  if (!response.ok) {
    throw httpError(response.status, 'Failed to retrieve Google RISC configuration.');
  }
  const config = await response.json();
  if (!config?.issuer || !config?.jwks_uri) {
    throw httpError(500, 'Google RISC configuration is missing required fields.');
  }

  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 300;
  riscConfigCache = {
    config,
    expiresAt: now + maxAgeSeconds * 1000,
  };
  return config;
}

async function handleSecurityEvent(event, env) {
  const eventTypes = Object.keys(event.events || {});
  const subjects = eventTypes
    .map((eventType) => event.events[eventType]?.subject)
    .filter(Boolean);

  if (env.RISC_EVENTS_KV) {
    await storeSecurityEvent(event, eventTypes, subjects, env);
  }

  console.log('Received Google Cross-Account Protection event', {
    jti: event.jti,
    aud: event.aud,
    eventTypes,
    subjects: subjects.map((subject) => ({
      subject_type: subject.subject_type,
      iss: subject.iss,
      sub: subject.sub,
    })),
  });
}

async function storeSecurityEvent(event, eventTypes, subjects, env) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = 60 * 60 * 24 * 90;
  if (event.jti) {
    await env.RISC_EVENTS_KV.put(`event:${event.jti}`, JSON.stringify({
      receivedAt: now,
      eventTypes,
      aud: event.aud,
      iat: event.iat,
    }), { expirationTtl: ttl });
  }

  const revocationEvent = eventTypes.some((eventType) => [
    'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked',
    'https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked',
    'https://schemas.openid.net/secevent/risc/event-type/account-disabled',
  ].includes(eventType));
  if (!revocationEvent) return;

  for (const subject of subjects) {
    if (subject?.sub) {
      await env.RISC_EVENTS_KV.put(`revoked-sub:${subject.sub}`, JSON.stringify({
        revokedAt: now,
        eventTypes,
        jti: event.jti || null,
      }), { expirationTtl: ttl });
    }
  }
}

async function getGooglePublicKey(kid) {
  return getGooglePublicKeyFromJwks(kid, 'https://www.googleapis.com/oauth2/v3/certs');
}

async function getGooglePublicKeyFromJwks(kid, jwksUri) {
  if (!kid) {
    throw httpError(401, 'Missing Google key id.');
  }
  const now = Date.now();
  if (!googleCertCache || googleCertCache.uri !== jwksUri || googleCertCache.expiresAt <= now) {
    await refreshGoogleCertCache(jwksUri);
  }
  let key = googleCertCache.keys.get(kid);
  if (!key) {
    await refreshGoogleCertCache(jwksUri);
    key = googleCertCache.keys.get(kid);
  }
  if (!key) {
    throw httpError(401, 'Unable to verify Google credential key.');
  }
  return key;
}

async function refreshGoogleCertCache(jwksUri = 'https://www.googleapis.com/oauth2/v3/certs') {
  const response = await fetch(jwksUri);
  if (!response.ok) {
    throw httpError(response.status, 'Failed to retrieve Google certificates.');
  }
  const data = await response.json();
  if (!data?.keys || !Array.isArray(data.keys)) {
    throw httpError(500, 'Google certificate response malformed.');
  }
  const keys = new Map();
  await Promise.all(data.keys.map(async (jwk) => {
    if (!jwk.kid) return;
    const key = await crypto.subtle.importKey(
      'jwk',
      {
        ...jwk,
        ext: true,
        key_ops: ['verify'],
      },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    keys.set(jwk.kid, key);
  }));
  const cacheControl = response.headers.get('Cache-Control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 300;
  googleCertCache = {
    uri: jwksUri,
    keys,
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  };
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  const padded = normalized + '='.repeat(pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function driveRequest(env, url, options = {}, retry = true) {
  const token = await getAccessToken(env);
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && retry) {
    tokenCache = null;
    return driveRequest(env, url, options, false);
  }
  return response;
}

// Obtains a Google Drive access token by exchanging the stored OAuth refresh
// token.  This uses the personal Google account that owns the Drive storage
// quota, not a service account (which has no quota).
async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt > now + 60) {
    return tokenCache.token;
  }

  const clientId     = requireEnv(env, 'GOOGLE_DRIVE_CLIENT_ID');
  const clientSecret = requireEnv(env, 'GOOGLE_DRIVE_CLIENT_SECRET');
  const refreshToken = requireEnv(env, 'GOOGLE_DRIVE_REFRESH_TOKEN');

  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    const detail = data?.error_description || data?.error || (data ? JSON.stringify(data) : response.statusText);
    const isInvalidGrant = data?.error === 'invalid_grant' || /expired|revoked/i.test(String(detail));
    if (isInvalidGrant) {
      throw httpError(
        503,
        'Google Drive authorization has expired or been revoked. Generate a new refresh token and update GOOGLE_DRIVE_REFRESH_TOKEN.',
      );
    }
    throw httpError(response.status, `Failed to obtain Google Drive access token: ${detail}`);
  }

  tokenCache = {
    token:     data.access_token,
    expiresAt: now + Number(data.expires_in || 3600),
  };
  return tokenCache.token;
}

function base64UrlEncode(input) {
  if (typeof input === 'string') {
    return base64UrlEncode(new TextEncoder().encode(input));
  }
  let binary = '';
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function handlePublicSubmitVideo(request, env, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Submit video endpoint only supports POST.');
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    throw httpError(400, 'Missing JSON payload.');
  }

  const { itemId, url, title, submittedBy } = payload;
  if (!itemId || !url || !title) {
    throw httpError(400, 'Missing required fields: itemId, url, and title are required.');
  }

  const videoId = getYoutubeId(url);
  if (!videoId) {
    throw httpError(400, 'Invalid YouTube video URL.');
  }

  const db = await loadDatabase(env);
  
  let foundItem = db.storeItems?.find(item => item.id === itemId || item.name === itemId || item.code === itemId);
  
  if (!foundItem) {
    foundItem = db.storeMods?.find(item => item.id === itemId || item.name === itemId || item.code === itemId);
  }

  if (!foundItem) {
    throw httpError(404, 'Catalogue item not found.');
  }

  if (!Array.isArray(foundItem.youtubeVideos)) {
    foundItem.youtubeVideos = [];
  }

  foundItem.youtubeVideos.push({
    title: title.trim(),
    url: `https://www.youtube.com/watch?v=${videoId}`,
    submittedBy: String(submittedBy || 'Anonymous').trim(),
    status: 'approved',
    submittedAt: new Date().toISOString()
  });

  await persistDatabase(env, db);

  return json({ ok: true, message: 'Video tutorial submitted successfully! It will appear once approved by an admin.' }, 200, origin);
}

function getYoutubeId(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (host.endsWith('youtube.com')) {
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/').filter(Boolean)[1] || '';
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/').filter(Boolean)[1] || '';
      return parsed.searchParams.get('v') || '';
    }
  } catch (error) {
    const match = value.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{6,})/);
    return match ? match[1] : '';
  }
  return '';
}

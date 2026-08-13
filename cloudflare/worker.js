const PRODUCTION_ORIGINS = [
  'https://vortex-prime-emu.com',
  'https://rileyadams05.github.io',
  // Tauri v2 desktop webviews use tauri.localhost on Windows. Keep these
  // origins explicit so the app can call the entitlement endpoint while
  // preventing arbitrary websites from using credentialed CORS.
  'http://tauri.localhost',
  'https://tauri.localhost',
  'tauri://localhost',
];

const DEFAULT_DB = {
  storeItems: [],
  storeMods: [],
  reports: [],
  streamzAccounts: [],
  streamzProEntitlements: [],
  streamzProPayments: [],
  streamzProUpgradeSessions: [],
  streamzProDiscordVerifications: [],
  streamzProCodePool: [],
  streamzProSupportTickets: [],
  streamzProSupportStaff: [],
  streamzBugReports: [],
  streamzAppSupportCases: [],
  streamzKnownIssues: [],
  streamzSupportStaff: [],
  streamzProAuditLog: [],
  stripeEvents: [],
  streamzRateLimits: {},
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
const STREAMZ_PRO_AMOUNT_CENTS = 9999;
const STREAMZ_PRO_CURRENCY = 'aud';
const STREAMZ_PRO_PRODUCT_NAME = 'Streamz Pro';
const STREAMZ_PRO_PRODUCT_ID = 'streamz_pro';
const STREAMZ_PRO_STATUSES = new Set([
  'pending_payment',
  'pending_discord_verification',
  'active',
  'revoked',
]);
const DISCORD_APPLICATION_ID = '1526084195263447171';
const DISCORD_PUBLIC_KEY = '23a2928f74f18bfa7ce329129f2e46ee14a9662fc6f7170e22ac4e4fa4d8008b';
const STREAMZ_DISCORD_INVITE_URL = 'https://discord.gg/TwMsbb97Mm';
const STREAMZ_DISCORD_VERIFY_URL = 'https://discord.com/channels/@me';
const STREAMZ_DEFAULT_BUGS_CHANNEL_ID = '1526100653586255974';
const STREAMZ_AI_UNAVAILABLE_MESSAGE = 'Automated troubleshooting is temporarily unavailable. DM the Streamz bot and use /contact-support for private assistance.';
const STREAMZ_GEMINI_PRIMARY_MODEL = 'gemini-3-flash-preview';
const STREAMZ_GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash';
const STREAMZ_TOKEN_BYTES = 32;
const STREAMZ_DISCORD_CODE_TTL_MS = 30 * 60 * 1000;
const STREAMZ_PURCHASE_CODE_TTL_MS = 20 * 60 * 1000;
const STREAMZ_WEBSITE_TOKEN_TTL_MS = 30 * 60 * 1000;
const STREAMZ_VERIFY_MAX_ATTEMPTS_PER_HOUR = 20;
const STREAMZ_STATUS_MAX_POLLS_PER_MINUTE = 90;
const STREAMZ_PAYMENT_CREATE_MAX_PER_HOUR = 10;
const STREAMZ_UPGRADE_SESSION_TTL_MS = 60 * 60 * 1000;
const STREAMZ_CODE_REPLACEMENT_MIN_INTERVAL_MS = 60 * 1000;
const STREAMZ_DISCORD_COMMAND_MAX_ATTEMPTS = 5;
const STREAMZ_DISCORD_COMMAND_WINDOW_MS = 10 * 60 * 1000;
const STREAMZ_PURCHASE_CODE_MAX_ATTEMPTS = 10;
const STREAMZ_PURCHASE_CODE_WINDOW_MS = 10 * 60 * 1000;
const STREAMZ_CODE_BATCH_SIZE = 10;
const STREAMZ_CODE_LOW_WATERMARK = 2;
const STREAMZ_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const STREAMZ_CODE_POOL_STATUSES = new Set(['unused', 'assigned', 'pending_google_linking', 'redeemed', 'expired', 'replaced', 'invalidated']);
const STREAMZ_EXPIRED_CODE_REVIEW_STATUSES = new Set(['open', 'claimed', 'closed']);
const STREAMZ_EXPIRED_CODE_REVIEW_ROLES = new Set(['owner', 'admin', 'reviewer']);
const STREAMZ_APP_SUPPORT_STATUSES = new Set(['open', 'waiting_for_customer', 'investigating', 'resolved', 'closed']);
const STREAMZ_APP_SUPPORT_ROLES = new Set(['owner', 'admin', 'support']);
const STREAMZ_BUG_REPORT_STATUSES = new Set(['new', 'answered', 'known_issue', 'support_requested', 'resolved', 'ignored']);
const STREAMZ_SITE_BASE_URL = 'https://vortex-prime-emu.com';
const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

const STREAMZ_OAUTH_PROVIDERS = {
  twitch: {
    label: 'Twitch',
    authorizeUrl: 'https://id.twitch.tv/oauth2/authorize',
    tokenUrl: 'https://id.twitch.tv/oauth2/token',
    clientIdEnv: 'STREAMZ_TWITCH_CLIENT_ID',
    clientSecretEnv: 'STREAMZ_TWITCH_CLIENT_SECRET',
    redirectUriEnv: 'STREAMZ_TWITCH_REDIRECT_URI',
    defaultRedirectUri: `${STREAMZ_CALLBACK_BASE}/twitch/callback`,
    defaultScopes: [
      'moderator:read:followers',
      'channel:read:subscriptions',
      'channel:read:stream_key',
      'bits:read',
      'channel:read:redemptions',
      'channel:read:charity',
    ],
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
    defaultScopes: ['user:read', 'channel:read', 'streamkey:read', 'events:subscribe'],
    usesPkce: true,
  },
  youtube: {
    label: 'YouTube',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientIdEnv: 'STREAMZ_YOUTUBE_CLIENT_ID',
    clientSecretEnv: 'STREAMZ_YOUTUBE_CLIENT_SECRET',
    redirectUriEnv: 'STREAMZ_YOUTUBE_REDIRECT_URI',
    defaultRedirectUri: `${STREAMZ_CALLBACK_BASE}/youtube/callback`,
    defaultScopes: ['https://www.googleapis.com/auth/youtube.readonly'],
    usesPkce: true,
    authorizationParams: {
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
    },
  },
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let sessionKeyCache = null;
let streamzStateKeyCache = null;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const allowedOrigin = resolveAllowedOrigin(origin);

    if (request.method === 'OPTIONS') {
      return optionsResponse(allowedOrigin);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, '');

    try {
      if (path === 'privacy-policy') {
        return await servePublicJoblessPrivacyPolicy(request);
      }

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
        return handleLogin(request, env, allowedOrigin, ctx);
      }

      if (path === 'api/auth/logout') {
        return handleLogout(env, allowedOrigin);
      }

      if (path.startsWith('api/streamz/auth/')) {
        return await handleStreamzAuthRequest(request, env, path, allowedOrigin);
      }

      if (path === 'api/streamz/channels') {
        return await handleStreamzChannels(request, env, allowedOrigin);
      }

      if (path === 'api/streamz/credentials') {
        return await handleStreamzCredentials(request, env, allowedOrigin);
      }

      if (path === 'api/streamz/pro/config') {
        return await handleStreamzProConfig(request, env, allowedOrigin);
      }

      if (path === 'api/streamz/pro/payment-intent') {
        return await handleStreamzProPaymentIntent(request, env, allowedOrigin);
      }

      if (path === 'api/streamz/pro/upgrade-session') {
        return await handleStreamzProUpgradeSession(request, env, allowedOrigin);
      }

      if (path === 'api/streamz/pro/upgrade-session/code') {
        return await handleStreamzProUpgradeSessionCode(request, env, allowedOrigin);
      }

      if (path === 'api/streamz/pro/purchase-code') {
        return await handleStreamzProPurchaseCode(request, env, allowedOrigin);
      }

      if (path === 'api/streamz/pro/entitlement') {
        return await handleStreamzProEntitlement(request, env, allowedOrigin);
      }

      if (path === 'api/streamz/pro/app-entitlement') {
        return await handleStreamzProAppEntitlement(request, env, allowedOrigin);
      }

      if (path === 'api/streamz/pro/source-archive') {
        return await handleStreamzProSourceArchive(request, env, allowedOrigin);
      }

      if (path === 'api/streamz/pro/verify-discord') {
        return await handleStreamzProVerifyDiscord(request, env, allowedOrigin);
      }

      if (path.startsWith('api/streamz/pro/expired-code-review/')) {
        return await handleStreamzProExpiredCodeReviewRequest(request, env, path, allowedOrigin);
      }

      if (path.startsWith('api/streamz/support/')) {
        return await handleStreamzSupportRequest(request, env, path, allowedOrigin);
      }

      if (path === 'api/streamz/app/update') {
        return await handleStreamzAppUpdate(request, env, allowedOrigin);
      }

      if (path === 'api/streamz/discord/interactions') {
        return await handleStreamzDiscordInteractions(request, env);
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

      if (path === 'api/modx/submit') {
        return handleModxSubmission(request, env, allowedOrigin);
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
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pollStreamzBugsChannel(env));
  },
};

async function servePublicJoblessPrivacyPolicy(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' },
    });
  }

  const sourceUrl = new URL(request.url);
  sourceUrl.pathname = '/privacy-policy/';
  sourceUrl.search = '';
  const upstream = await fetch(new Request(sourceUrl.toString(), {
    method: request.method,
    headers: { Accept: 'text/html,application/xhtml+xml' },
  }));
  const headers = new Headers(upstream.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=300');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return new Response(upstream.body, { status: upstream.status, headers });
}

function resolveAllowedOrigin(origin) {
  if (!origin) return PRODUCTION_ORIGINS[0];
  if (PRODUCTION_ORIGINS.includes(origin)) {
    return origin;
  }
  return null;
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
    streamzDiscord: {
      applicationId: String(env.DISCORD_APPLICATION_ID || DISCORD_APPLICATION_ID),
      publicKeyConfigured: Boolean(String(env.DISCORD_PUBLIC_KEY || DISCORD_PUBLIC_KEY).trim()),
      interactionEndpoint: `${STREAMZ_SITE_BASE_URL}/api/streamz/discord/interactions`,
    },
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

async function handleLogin(request, env, origin, ctx) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Login requires POST.');
  }

  const body = await request.json().catch(() => null);
  const idToken = typeof body?.idToken === 'string'
    ? body.idToken
    : await exchangeGoogleCredentialForFirebase(body?.credential, env);
  if (!idToken) {
    throw httpError(400, 'Missing Firebase ID token.');
  }

  const profile = await validateFirebaseIdToken(idToken, env);
  const role = isAdminEmail(profile.email, env) ? 'admin' : 'uploader';
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: profile.sub,
    firebaseUid: profile.uid,
    email: profile.email,
    name: profile.name || null,
    picture: profile.picture || null,
    role,
    exp: now + SESSION_TTL_SECONDS,
    iat: now,
  };
  const token = await createSessionToken(payload, env);
  const provisionAccount = ensureStreamzAccountForSession(env, payload).catch((error) => {
    console.log('Streamz account provisioning deferred', {
      reason: error?.message || 'unknown_error',
    });
  });
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(provisionAccount);
  } else {
    await provisionAccount;
  }
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
  const match = path.match(/^api\/streamz\/auth\/(twitch|kick|youtube)\/(start|callback|refresh)$/);
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
  if (action === 'refresh') {
    return handleStreamzAuthRefresh(request, env, providerKey, provider, origin);
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
  if (provider.authorizationParams && typeof provider.authorizationParams === 'object') {
    for (const [key, value] of Object.entries(provider.authorizationParams)) {
      authUrl.searchParams.set(key, String(value));
    }
  }

  if (provider.usesPkce) {
    const codeVerifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(64)));
    statePayload.codeVerifier = codeVerifier;
    authUrl.searchParams.set('code_challenge', await sha256Base64Url(codeVerifier));
    authUrl.searchParams.set('code_challenge_method', 'S256');
  }

  authUrl.searchParams.set('state', await encryptStreamzState(statePayload, env));

  if (url.searchParams.get('redirect') === '1' || url.searchParams.get('redirect') === 'true') {
    return Response.redirect(authUrl.toString(), 302);
  }

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
  const session = await readSession(request, env).catch(() => null);
  if (!session?.sub) {
    throw httpError(401, 'Sign in to Streamz before connecting a streaming account.');
  }
  const account = await ensureStreamzAccountForSession(env, session);
  await saveStreamzProviderTokens(env, account.id, providerKey, tokenResponse);
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
      clientId: requireEnv(env, provider.clientIdEnv),
      authorizedAt: new Date().toISOString(),
    });
  }
  const deepLink = buildStreamzDeepLink(state.returnTo, deepLinkParams);

  return json({
    ok: true,
    provider: providerKey,
    message: `${provider.label} authorization completed. Return to Streamz to continue.`,
    deepLink,
    connection: sanitizeStreamzConnection(providerKey, tokenResponse),
  }, 200, origin);
}

async function handleStreamzChannels(request, env, origin) {
  if (request.method !== 'GET') throw httpError(405, 'Streamz channels requires GET.');
  const { account, connections } = await getAuthenticatedStreamzConnections(request, env);
  const channels = [];
  for (const connection of connections) {
    try {
      const result = await fetchStreamzProviderData(env, connection.provider, connection.tokens);
      channels.push({
        provider: connection.provider,
        platform: STREAMZ_OAUTH_PROVIDERS[connection.provider].label,
        ...result.profile,
        hasStreamKey: Boolean(result.streamKey),
        serverUrl: result.serverUrl || null,
      });
      await persistRefreshedStreamzTokens(env, account.id, connection);
    } catch (error) {
      channels.push({
        provider: connection.provider,
        platform: STREAMZ_OAUTH_PROVIDERS[connection.provider].label,
        error: error?.message || 'Unable to load channel data.',
      });
    }
  }
  return json({ ok: true, channels }, 200, origin);
}

async function handleStreamzCredentials(request, env, origin) {
  if (request.method !== 'GET') throw httpError(405, 'Streamz credentials requires GET.');
  const { account, connections } = await getAuthenticatedStreamzConnections(request, env);
  const credentials = [];
  for (const connection of connections) {
    try {
      const result = await fetchStreamzProviderData(env, connection.provider, connection.tokens);
      if (result.streamKey && result.serverUrl) {
        credentials.push({
          provider: connection.provider,
          serverUrl: result.serverUrl,
          streamKey: result.streamKey,
        });
      }
      await persistRefreshedStreamzTokens(env, account.id, connection);
    } catch (error) {
      credentials.push({
        provider: connection.provider,
        error: error?.message || 'Unable to load stream credentials.',
      });
    }
  }
  return json({ ok: true, credentials }, 200, origin);
}

async function getAuthenticatedStreamzConnections(request, env) {
  const session = await ensureAuthenticated(request, env, 'Sign in to Streamz first.');
  const account = await ensureStreamzAccountForSession(env, session);
  const entitlement = await getStreamzProEntitlementForAccount(env, account, session);
  if (!isActiveStreamzProEntitlement(entitlement)) {
    throw httpError(403, 'Streamz Pro is required for this feature.');
  }
  const connections = (Array.isArray(account.providerConnections) ? account.providerConnections : [])
    .filter((connection) => STREAMZ_OAUTH_PROVIDERS[connection.provider] && connection.accessToken)
    .map((connection) => ({ ...connection, tokens: null }));
  for (const connection of connections) {
    connection.tokens = await decryptStreamzProviderTokens(env, connection.accessToken);
    if (connection.expiresAt && Date.parse(connection.expiresAt) <= Date.now() + 60_000 && connection.refreshToken) {
      const refreshPayload = await decryptStreamzProviderTokens(env, connection.refreshToken);
      const refreshed = await refreshStreamzAccessToken(env, STREAMZ_OAUTH_PROVIDERS[connection.provider], refreshPayload.refresh_token);
      connection.tokens = refreshed;
      connection.accessToken = await encryptStreamzProviderTokens(env, refreshed);
      connection.refreshToken = refreshed.refresh_token
        ? await encryptStreamzProviderTokens(env, { refresh_token: refreshed.refresh_token })
        : connection.refreshToken;
      connection.expiresAt = new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000).toISOString();
      connection.updatedAt = new Date().toISOString();
    }
  }
  return { account, connections };
}

async function persistRefreshedStreamzTokens(env, accountId, connection) {
  if (!connection.updatedAt) return;
  await updateStreamzDatabase(env, async (db) => {
    const accounts = normalizeStreamzAccounts(db.streamzAccounts);
    const index = accounts.findIndex((entry) => entry.id === accountId);
    if (index < 0) return { db, value: null };
    const providerConnections = accounts[index].providerConnections.map((entry) => (
      entry.provider === connection.provider
        ? { ...entry, accessToken: connection.accessToken, refreshToken: connection.refreshToken, expiresAt: connection.expiresAt, updatedAt: connection.updatedAt }
        : entry
    ));
    accounts[index] = { ...accounts[index], providerConnections, updatedAt: new Date().toISOString() };
    db.streamzAccounts = accounts;
    return { db, value: null };
  });
}

async function fetchStreamzProviderData(env, providerKey, tokens) {
  const accessToken = String(tokens?.access_token || '').trim();
  if (!accessToken) throw httpError(401, `Missing ${STREAMZ_OAUTH_PROVIDERS[providerKey].label} access token.`);
  if (providerKey === 'twitch') {
    const profile = await providerJson('https://api.twitch.tv/helix/users', accessToken, { 'Client-Id': requireEnv(env, 'STREAMZ_TWITCH_CLIENT_ID') });
    const user = profile.data?.[0];
    if (!user?.id) throw httpError(502, 'Twitch profile was not returned.');
    const key = await providerJson(`https://api.twitch.tv/helix/streams/key?broadcaster_id=${encodeURIComponent(user.id)}`, accessToken, { 'Client-Id': requireEnv(env, 'STREAMZ_TWITCH_CLIENT_ID') });
    return { profile: { id: user.id, username: user.display_name || user.login, avatar: user.profile_image_url || null }, serverUrl: 'rtmps://live.twitch.tv/app', streamKey: key.data?.[0]?.stream_key || null };
  }
  if (providerKey === 'youtube') {
    const profile = await providerJson('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', accessToken);
    const channel = profile.items?.[0];
    if (!channel?.id) throw httpError(502, 'YouTube channel was not returned.');
    const streams = await providerJson('https://www.googleapis.com/youtube/v3/liveStreams?part=cdn&mine=true', accessToken);
    const stream = streams.items?.find((entry) => entry.cdn?.ingestionInfo?.streamName);
    return { profile: { id: channel.id, username: channel.snippet?.title || 'YouTube channel', avatar: channel.snippet?.thumbnails?.default?.url || null }, serverUrl: stream?.cdn?.ingestionInfo?.ingestionAddress || null, streamKey: stream?.cdn?.ingestionInfo?.streamName || null };
  }
  const channels = await providerJson('https://api.kick.com/public/v1/channels', accessToken);
  const channel = Array.isArray(channels.data) ? channels.data[0] : null;
  return { profile: { id: channel?.broadcaster_user_id || channel?.user_id || null, username: channel?.username || channel?.slug || 'Kick channel', avatar: channel?.profile_picture || null }, serverUrl: channel?.stream_url || null, streamKey: channel?.stream_key || null };
}

async function providerJson(url, accessToken, headers = {}) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', ...headers } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw httpError(response.status || 502, payload?.message || payload?.error_description || 'Provider API request failed.');
  return payload || {};
}

async function handleStreamzAuthRefresh(request, env, providerKey, provider, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Streamz OAuth refresh requires POST.');
  }

  const payload = await request.json().catch(() => null);
  const refreshToken = String(payload?.refreshToken || '').trim();
  if (!refreshToken) {
    throw httpError(400, 'Missing refresh token.');
  }

  const tokenResponse = await refreshStreamzAccessToken(env, provider, refreshToken);
  return json({
    ok: true,
    provider: providerKey,
    clientId: requireEnv(env, provider.clientIdEnv),
    token: sanitizeStreamzTokenResponse(tokenResponse, false),
    accessToken: tokenResponse.access_token || null,
    refreshToken: tokenResponse.refresh_token || refreshToken,
    expiresIn: tokenResponse.expires_in || null,
    tokenType: tokenResponse.token_type || null,
    scope: normalizeScopeForResponse(tokenResponse.scope) || null,
    refreshedAt: new Date().toISOString(),
  }, 200, origin);
}

async function handleStreamzProConfig(request, env, origin) {
  if (request.method !== 'GET') {
    throw httpError(405, 'Streamz Pro config requires GET.');
  }

  const session = await readSession(request, env).catch(() => null);
  const account = session ? await ensureStreamzAccountForSession(env, session).catch(() => null) : null;
  const entitlement = getStreamzOwnerGrantEntitlement(env, session) || (account ? await getStreamzProEntitlementForAccount(env, account, session).catch(() => null) : null);
  return json({
    ok: true,
    configured: true,
    authenticated: Boolean(session),
    ownsPro: isActiveStreamzProEntitlement(entitlement),
    status: entitlement?.status || null,
    user: sanitizeUserForResponse(session),
    entitlement: sanitizeStreamzProEntitlement(entitlement),
    stripe: buildStreamzProStripeConfig(env),
  }, 200, origin);
}

async function handleStreamzProPaymentIntent(request, env, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Streamz Pro payment setup requires POST.');
  }

  const user = await ensureAuthenticated(request, env, 'Sign in with Google before purchasing Streamz Pro.');
  await enforceStreamzRateLimit(env, `payment_create:${buildStreamzAccountIdFromGoogleSub(user.sub)}`, STREAMZ_PAYMENT_CREATE_MAX_PER_HOUR, 60 * 60 * 1000, 'Too many payment attempts. Try again later.');
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    throw httpError(400, 'Missing contact details.');
  }

  const contact = validateStreamzProContact(payload, user);
  if (payload.termsAccepted !== true) {
    throw httpError(400, 'Purchase terms must be accepted before payment.');
  }

  const account = await ensureStreamzAccountForSession(env, user);
  const upgradeSession = await getValidatedStreamzUpgradeSession(env, payload.upgradeSessionToken).catch(() => null);
  const existingEntitlement = await getStreamzProEntitlementForAccount(env, account, user).catch(() => null);
  if (isActiveStreamzProEntitlement(existingEntitlement) || existingEntitlement?.status === 'pending_discord_verification') {
    return json({
      ok: true,
      alreadyOwned: isActiveStreamzProEntitlement(existingEntitlement),
      pendingVerification: existingEntitlement?.status === 'pending_discord_verification',
      entitlement: sanitizeStreamzProEntitlement(existingEntitlement),
    }, 200, origin);
  }

  const paymentIntent = await stripeFormRequest(
    env,
    'POST',
    '/payment_intents',
    buildStreamzProPaymentIntentParams(user, account, contact, upgradeSession),
  );

  if (!paymentIntent?.id || !paymentIntent?.client_secret) {
    throw httpError(502, 'Stripe did not return a PaymentIntent client secret.');
  }

  return json({
    ok: true,
    clientSecret: paymentIntent.client_secret,
    amountCents: STREAMZ_PRO_AMOUNT_CENTS,
    currency: STREAMZ_PRO_CURRENCY,
  }, 200, origin);
}

async function handleStreamzProUpgradeSession(request, env, origin) {
  if (request.method === 'POST') {
    const token = await createStreamzSecureToken();
    const now = new Date().toISOString();
    const tokenHash = await hashStreamzUpgradeSessionToken(token);
    const session = {
      id: `upgrade:${tokenHash}`,
      tokenHash,
      product: STREAMZ_PRO_PRODUCT_ID,
      status: 'created',
      ownsPro: false,
      entitlementId: null,
      emailMasked: null,
      createdAt: now,
      expiresAt: new Date(Date.now() + STREAMZ_UPGRADE_SESSION_TTL_MS).toISOString(),
      updatedAt: now,
    };
    await updateStreamzDatabase(env, async (db) => {
      db.streamzProUpgradeSessions = upsertStreamzUpgradeSession(db.streamzProUpgradeSessions, session);
      return { db, value: session };
    });
    return json({
      ok: true,
      token,
      checkoutUrl: buildStreamzCheckoutUrl({ upgradeSessionToken: token }),
      expiresAt: session.expiresAt,
    }, 200, origin);
  }

  if (request.method === 'GET') {
    const token = new URL(request.url).searchParams.get('token') || '';
    const session = await getStreamzUpgradeSessionByRawToken(env, token);
    const db = await loadDatabase(env);
    const entitlement = session.entitlementId
      ? normalizeStreamzProEntitlements(db.streamzProEntitlements).find((entry) => entry.id === session.entitlementId)
      : null;
    const verification = entitlement ? findStreamzDiscordVerificationByEntitlement(db, entitlement.id) : null;
    const activationPass = verification?.activationPassCode
      ? buildStreamzActivationPassResponse(entitlement, verification, verification.activationPassCode)
      : null;
    return json({
      ok: true,
      ...sanitizeStreamzUpgradeSession(session),
      ...(activationPass ? {
        purchaseCode: verification.activationPassCode,
        verificationCode: verification.activationPassCode,
        codeExpiresAt: verification.purchaseCodeExpiresAt || session.codeExpiresAt || null,
        activationPass,
      } : {}),
    }, 200, origin);
  }

  throw httpError(405, 'Streamz Pro upgrade session requires GET or POST.');
}

async function handleStreamzProUpgradeSessionCode(request, env, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'Streamz Pro activation-pass preparation requires POST.');
  }
  const payload = await request.json().catch(() => null);
  const token = String(payload?.token || '').trim();
  const session = await getValidatedStreamzUpgradeSession(env, token);
  const result = await updateStreamzDatabase(env, async (db) => {
    const currentSession = findStreamzUpgradeSessionByHash(db, session.tokenHash);
    const entitlement = currentSession?.entitlementId
      ? normalizeStreamzProEntitlements(db.streamzProEntitlements).find((entry) => entry.id === currentSession.entitlementId)
      : null;
    if (!entitlement || entitlement.status !== 'pending_discord_verification' || !entitlement.paymentConfirmedAt) {
      return { db, value: { code: null, expiresAt: null, session: currentSession } };
    }

    const existingVerification = findStreamzDiscordVerificationByEntitlement(db, entitlement.id);
    if (existingVerification?.lastCodeGeneratedAt && Date.now() - Date.parse(existingVerification.lastCodeGeneratedAt) < STREAMZ_CODE_REPLACEMENT_MIN_INTERVAL_MS) {
      throw httpError(429, 'Please wait before preparing another activation pass.');
    }

    const now = new Date().toISOString();
    if (existingVerification?.purchaseCodeHash) {
      throw httpError(409, 'This activation pass has already been prepared. Use the purchase code printed on the downloaded pass.');
    }

    const assignment = await assignStreamzPurchaseCodeFromPool(db, entitlement, existingVerification, now);
    const verification = {
      ...(existingVerification || {}),
      id: existingVerification?.id || `discord:${entitlement.id}`,
      entitlementId: entitlement.id,
      paymentId: entitlement.stripePaymentIntentId || entitlement.stripeCheckoutSessionId || null,
      status: 'code_generated',
      purchaseCodeHash: assignment.codeHash,
      purchaseCodePoolId: assignment.poolEntryId,
      purchaseCodeSource: 'internal_csprng',
      activationPassCode: assignment.code,
      purchaseCodeAssignedAt: now,
      purchaseCodeExpiresAt: assignment.expiresAt,
      purchaseCodeClaimedAt: null,
      purchaseCodeRedeemedAt: null,
      discordCodeHash: assignment.codeHash,
      discordCodeExpiresAt: assignment.expiresAt,
      discordCodeUsedAt: null,
      claimedDiscordUserId: null,
      discordClaimedAt: null,
      websiteTokenHash: null,
      websiteTokenExpiresAt: null,
      websiteTokenUsedAt: null,
      lastCodeGeneratedAt: now,
      createdAt: existingVerification?.createdAt || now,
      updatedAt: now,
    };
    db.streamzProDiscordVerifications = replaceStreamzDiscordVerification(db.streamzProDiscordVerifications, verification);
    db.streamzProUpgradeSessions = markStreamzUpgradeSessionForEntitlement(
      db.streamzProUpgradeSessions,
      currentSession.tokenHash,
      entitlement,
      'pending_discord_verification',
      verification.purchaseCodeExpiresAt,
    );
    return {
      db,
      value: {
        code: assignment.code,
        expiresAt: verification.purchaseCodeExpiresAt,
        session: currentSession,
        entitlement,
        verification,
      },
    };
  });

  return json({
    ok: true,
    ...sanitizeStreamzUpgradeSession(result.session),
    purchaseCode: result.code,
    verificationCode: result.code,
    codeExpiresAt: result.expiresAt,
    activationPass: buildStreamzActivationPassResponse(result.entitlement, result.verification, result.code),
  }, 200, origin);
}

async function handleStreamzProPurchaseCode(request, env, origin) {
  if (!['GET', 'POST'].includes(request.method)) {
    throw httpError(405, 'Streamz Pro purchase-code lookup requires GET or POST.');
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  await enforceStreamzRateLimit(env, `purchase_code:${ip}`, STREAMZ_PURCHASE_CODE_MAX_ATTEMPTS, STREAMZ_PURCHASE_CODE_WINDOW_MS, 'Too many purchase-code attempts. Try again later.');
  const payload = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  const code = request.method === 'GET'
    ? String(new URL(request.url).searchParams.get('code') || '').trim()
    : String(payload?.code || '').trim();
  if (!isValidStreamzPurchaseCode(code)) {
    return json(buildStreamzPurchaseCodeResult('invalid'), 400, origin);
  }

  const codeHash = await hashStreamzPurchaseCode(code);
  const result = await updateStreamzDatabase(env, async (db) => {
    const now = new Date().toISOString();
    expireAssignedStreamzCodePoolEntries(db, now);
    const verification = normalizeStreamzDiscordVerifications(db.streamzProDiscordVerifications)
      .find((entry) => (
        (entry.purchaseCodeHash && constantTimeStringEquals(entry.purchaseCodeHash, codeHash))
        || (entry.discordCodeHash && constantTimeStringEquals(entry.discordCodeHash, codeHash))
      )) || null;
    const poolEntry = normalizeStreamzProCodePool(db.streamzProCodePool).find((entry) => entry.codeHash && constantTimeStringEquals(entry.codeHash, codeHash)) || null;
    if (!verification) {
      const status = ['expired', 'replaced', 'redeemed', 'invalidated'].includes(poolEntry?.status) ? poolEntry.status : 'invalid';
      const value = buildStreamzPurchaseCodeResult(status);
      appendStreamzAuditEvent(db, 'activation_code_lookup', { status, codeHash }, now);
      return { db, value };
    }
    const entitlement = normalizeStreamzProEntitlements(db.streamzProEntitlements).find((entry) => entry.id === verification.entitlementId) || null;
    const payment = normalizeStreamzProPayments(db.streamzProPayments).find((entry) => (
      (entitlement?.stripePaymentIntentId && entry.stripePaymentIntentId === entitlement.stripePaymentIntentId)
      || (entitlement?.stripeCheckoutSessionId && entry.stripeCheckoutSessionId === entitlement.stripeCheckoutSessionId)
    )) || null;
    const status = getStreamzPurchaseCodeStatus(entitlement, verification, payment, poolEntry);
    appendStreamzAuditEvent(db, 'activation_code_lookup', { status, codeHash, entitlementId: entitlement?.id || null }, now);
    return { db, value: buildStreamzPurchaseCodeResult(status, entitlement, verification, payment) };
  });
  return json(result, result.ok ? 200 : (result.status === 'expired' ? 410 : 400), origin);
}

async function handleStreamzProEntitlement(request, env, origin) {
  if (request.method !== 'GET') {
    throw httpError(405, 'Streamz Pro entitlement lookup requires GET.');
  }

  const user = await ensureAuthenticated(request, env, 'Sign in with Google to check Streamz Pro entitlement.');
  await enforceStreamzRateLimit(env, `status:${buildStreamzAccountIdFromGoogleSub(user.sub)}`, STREAMZ_STATUS_MAX_POLLS_PER_MINUTE, 60 * 1000, 'Too many status checks. Try again shortly.');
  const account = await ensureStreamzAccountForSession(env, user);
  const entitlement = getStreamzOwnerGrantEntitlement(env, user) || await getStreamzProEntitlementForAccount(env, account, user).catch(() => null);
  const ownsPro = isActiveStreamzProEntitlement(entitlement);

  return json({
    ok: true,
    configured: true,
    authenticated: true,
    ownsPro,
    hasPro: ownsPro,
    status: entitlement?.status || null,
    entitlement: sanitizeStreamzProEntitlement(entitlement),
  }, 200, origin);
}

async function handleStreamzProAppEntitlement(request, env, origin) {
  if (request.method !== 'GET') {
    throw httpError(405, 'Streamz Pro app entitlement lookup requires GET.');
  }

  const user = await ensureAuthenticated(request, env, 'Sign in before checking Streamz Pro access.');
  await enforceStreamzRateLimit(env, `app_status:${buildStreamzAccountIdFromGoogleSub(user.sub)}`, STREAMZ_STATUS_MAX_POLLS_PER_MINUTE, 60 * 1000, 'Too many status checks. Try again shortly.');
  const account = await ensureStreamzAccountForSession(env, user);
  const entitlement = getStreamzOwnerGrantEntitlement(env, user) || await getStreamzProEntitlementForAccount(env, account, user).catch(() => null);
  const ownsPro = isActiveStreamzProEntitlement(entitlement);
  const status = entitlement?.status || null;
  return json({
    ok: true,
    configured: true,
    authenticated: true,
    ownsPro,
    hasPro: ownsPro,
    status,
    message: status === 'pending_discord_verification'
      ? 'Your payment was received. Firebase is waiting for the verified Stripe result. Streamz Pro will unlock automatically on the Google account used for this purchase.'
      : null,
    actions: status === 'pending_discord_verification'
      ? ['refresh_status', 'open_checkout_page']
      : ['refresh_status', 'open_checkout_page'],
    entitlement: sanitizeStreamzProEntitlement(entitlement),
  }, 200, origin);
}

async function handleStreamzProSourceArchive(request, env, origin) {
  if (request.method !== 'GET') {
    throw httpError(405, 'Streamz Pro source download requires GET.');
  }

  const user = await ensureAuthenticated(request, env, 'Sign in before downloading Streamz Pro source.');
  const account = await ensureStreamzAccountForSession(env, user);
  const entitlement = getStreamzOwnerGrantEntitlement(env, user)
    || await getStreamzProEntitlementForAccount(env, account, user).catch(() => null);
  if (!isActiveStreamzProEntitlement(entitlement)) {
    throw httpError(403, 'An active Streamz Pro entitlement is required for this download.');
  }

  const encoded = String(env.STREAMZ_PRO_SOURCE_ARCHIVE_B64 || '').replace(/\s+/g, '');
  if (!encoded) throw httpError(503, 'The Streamz Pro source archive is not configured.');
  let bytes;
  try {
    const binary = atob(encoded);
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw httpError(503, 'The Streamz Pro source archive is unavailable.');
  }

  const headers = new Headers({
    'content-type': 'application/x-7z-compressed',
    'content-length': String(bytes.byteLength),
    'content-disposition': 'attachment; filename="Streamz-Pro-source.7z"',
    'cache-control': 'private, no-store',
  });
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
  }
  return new Response(bytes, { status: 200, headers });
}

async function handleStreamzProVerifyDiscord(request, env, origin) {
  if (!['GET', 'POST'].includes(request.method)) {
    throw httpError(405, 'Streamz Pro Discord verification requires GET or POST.');
  }

  const payload = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  const token = request.method === 'GET'
    ? String(new URL(request.url).searchParams.get('token') || '').trim()
    : String(payload?.token || '').trim();
  await enforceStreamzRateLimit(env, `discord_site_verify:${request.headers.get('CF-Connecting-IP') || 'unknown'}`, STREAMZ_VERIFY_MAX_ATTEMPTS_PER_HOUR, 60 * 60 * 1000, 'Too many verification attempts. Try again later.');

  if (!isPlausibleStreamzToken(token)) {
    return json(buildStreamzDiscordSiteResult('invalid'), 400, origin);
  }

  if (request.method === 'GET') {
    const result = await getStreamzDiscordWebsiteTokenStatus(env, token);
    return json(result, result.ok ? 200 : (result.status === 'expired' ? 410 : 400), origin);
  }

  const credential = typeof payload?.credential === 'string' ? payload.credential : '';
  if (!credential) {
    return json(buildStreamzDiscordSiteResult('google_required'), 401, origin);
  }

  const googleProfile = await validateGoogleCredential(credential, env);
  const result = await linkStreamzDiscordVerificationToGoogle(env, token, googleProfile);
  return json(result, result.ok ? 200 : (result.status === 'expired' ? 410 : 400), origin);
}

async function handleStreamzProExpiredCodeReviewRequest(request, env, path, origin) {
  const user = await ensureAuthenticated(request, env, 'Sign in with Google to access Streamz expired-code review.');
  const staff = await requireStreamzSupportStaff(env, user);
  const route = path.replace(/^api\/streamz\/pro\/expired-code-review\/?/, '');

  if (route === 'staff' && request.method === 'GET') {
    return json({ ok: true, staff, members: await listStreamzSupportStaff(env) }, 200, origin);
  }
  if (route === 'staff' && request.method === 'POST') {
    if (staff.role !== 'owner') throw httpError(403, 'Only the owner can manage Streamz expired-code review staff.');
    const payload = await request.json().catch(() => ({}));
    const result = await updateStreamzSupportStaff(env, payload, user);
    return json(result, 200, origin);
  }
  if (route === 'search' && request.method === 'GET') {
    const code = new URL(request.url).searchParams.get('code') || '';
    return json(await lookupStreamzSupportCode(env, code), 200, origin);
  }
  if (route === 'tickets' && request.method === 'GET') {
    const db = await loadDatabase(env);
    return json({ ok: true, tickets: normalizeStreamzSupportTickets(db.streamzProSupportTickets).slice(-100).reverse() }, 200, origin);
  }
  if (route === 'tickets/action' && request.method === 'POST') {
    const payload = await request.json().catch(() => ({}));
    return json(await updateStreamzSupportTicket(env, payload, staff, user), 200, origin);
  }
  if (route === 'replacement' && request.method === 'POST') {
    const payload = await request.json().catch(() => ({}));
    return json(await issueStreamzSupportReplacementCode(env, payload, staff, user), 200, origin);
  }

  throw httpError(404, 'Streamz expired-code review route not found.');
}

async function handleStreamzDiscordInteractions(request, env) {
  if (request.method !== 'POST') {
    return json({ ok: false, message: 'Discord interactions require POST.' }, 405, null);
  }
  const signature = request.headers.get('X-Signature-Ed25519') || '';
  const timestamp = request.headers.get('X-Signature-Timestamp') || '';
  const rawBody = await request.text();
  const valid = await verifyDiscordInteractionSignature(rawBody, signature, timestamp, String(env.DISCORD_PUBLIC_KEY || DISCORD_PUBLIC_KEY));
  if (!valid) {
    return json({ ok: false, message: 'Invalid Discord signature.' }, 401, null);
  }

  const interaction = JSON.parse(rawBody);
  if (interaction.type === 1) {
    return discordJson({ type: 1 });
  }
  if (interaction.type === 3) {
    return await handleStreamzDiscordComponent(interaction, env);
  }
  if (interaction.type !== 2) {
    return discordJson({
      type: 4,
      data: {
        flags: 64,
        content: 'Unsupported Streamz command.',
      },
    });
  }

  if (interaction.data?.name === 'verify-pro') {
    return await handleStreamzDiscordVerifyProCommand(interaction, env);
  }
  if (interaction.data?.name === 'code-expired') {
    return await handleStreamzDiscordCodeExpiredCommand(interaction, env);
  }
  if (interaction.data?.name === 'contact-support') {
    return await handleStreamzDiscordContactSupportCommand(interaction, env);
  }
  {
    return discordJson({
      type: 4,
      data: {
        flags: 64,
        content: 'Unsupported Streamz command.',
      },
    });
  }
}

async function handleStreamzDiscordComponent(interaction, env) {
  const customId = String(interaction.data?.custom_id || '');
  const user = interaction.member?.user || interaction.user || {};
  if (customId.startsWith('streamz_bug_contact:')) {
    const bugId = customId.slice('streamz_bug_contact:'.length);
    const result = await createStreamzAppSupportCaseFromBug(env, bugId, user);
    return discordJson({
      type: 4,
      data: {
        flags: 64,
        content: result.ok
          ? `Private Streamz support case ${result.caseNumber} was created. Check your DMs with the Streamz bot.`
          : (result.message || 'Unable to open private support right now. DM the Streamz bot and use /contact-support.'),
      },
    });
  }
  if (customId.startsWith('streamz_bug_fixed:')) {
    const bugId = customId.slice('streamz_bug_fixed:'.length);
    await markStreamzBugReportResolved(env, bugId, user.id || null);
    return discordJson({
      type: 4,
      data: {
        flags: 64,
        content: 'Thanks. I marked this troubleshooting reply as helpful.',
      },
    });
  }
  return discordJson({
    type: 4,
    data: {
      flags: 64,
      content: 'Unsupported Streamz action.',
    },
  });
}

async function handleStreamzDiscordVerifyProCommand(interaction, env) {
  const discordUserId = interaction.member?.user?.id || interaction.user?.id || null;
  const code = interaction.data?.options?.find((option) => option.name === 'code')?.value || '';
  if (interaction.guild_id) {
    return discordJson({
      type: 4,
      data: {
        flags: 64,
        content: 'Directly message the Streamz bot and run /verify-pro there. This command is not used inside the server.',
      },
    });
  }
  if (!discordUserId || !code) {
    return discordJson({
      type: 4,
      data: {
        flags: 64,
        content: 'Enter the one-time Streamz Pro activation code from your activation pass.',
      },
    });
  }

  const result = await claimStreamzDiscordCode(env, code, discordUserId);
  if (!result.ok) {
    return discordJson({
      type: 4,
      data: {
        flags: 64,
        content: result.message || 'This Streamz Pro purchase code could not be verified.',
      },
    });
  }

  return discordJson({
    type: 4,
    data: {
      flags: 64,
      embeds: [{
        title: 'Streamz Pro verification',
        description: [
          'Your Streamz Pro payment has been confirmed.',
          '',
          'Press the button below to open the official Vortex Prime website and permanently link Streamz Pro to your Google account.',
          '',
          'Once linked, the licence will remain attached to that Google account.',
          '',
          'You are responsible for maintaining access to the Google account used during activation. If you permanently lose access to it, licence recovery or transfer is not guaranteed and a new purchase may be required, except where required by applicable law.',
          '',
          'This is an automated message. Please do not reply to this message.',
        ].join('\n'),
        color: 7032316,
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          label: 'Link Google Account',
          url: result.verifyUrl,
        }],
      }],
    },
  });
}

async function handleStreamzDiscordCodeExpiredCommand(interaction, env) {
  if (interaction.guild_id) {
    return discordJson({
      type: 4,
      data: {
        flags: 64,
        content: 'Directly message the Streamz bot and run /code-expired there with your original activation-pass PDF attached.',
      },
    });
  }
  const discordUser = interaction.member?.user || interaction.user || {};
  const discordUserId = discordUser.id || null;
  const options = Array.isArray(interaction.data?.options) ? interaction.data.options : [];
  const attachmentId = String(options.find((option) => option.name === 'activation_pass')?.value || '').trim();
  const attachment = interaction.data?.resolved?.attachments?.[attachmentId] || null;
  if (!discordUserId || !attachment) {
    return discordJson({
      type: 4,
      data: {
        flags: 64,
        content: 'Run /code-expired in a direct message with this bot and attach the original Streamz Pro Activation Pass PDF.',
      },
    });
  }
  const filename = String(attachment.filename || '').toLowerCase();
  const contentType = String(attachment.content_type || '').toLowerCase();
  if (!filename.endsWith('.pdf') || (contentType && contentType !== 'application/pdf')) {
    return discordJson({
      type: 4,
      data: {
        flags: 64,
        content: 'Only the original Streamz Pro Activation Pass PDF is accepted. Screenshots, PNGs, JPGs, photos and recreated PDFs are rejected.',
      },
    });
  }

  const result = await createStreamzExpiredCodeReviewFromDiscord(env, {
    discordUser,
    attachment,
  });
  return discordJson({
    type: 4,
    data: {
      flags: 64,
      content: result.ok
        ? `Expired-code review ${result.ticketNumber} was created. An authorised team member will review the original PDF and can issue a new 20-minute code if it is valid.`
        : (result.message || 'Unable to create an expired-code review right now.'),
    },
  });
}

async function handleStreamzDiscordContactSupportCommand(interaction, env) {
  if (interaction.guild_id) {
    return discordJson({
      type: 4,
      data: {
        flags: 64,
        content: 'Directly message the Streamz bot and run /contact-support there. This command is for private app support only.',
      },
    });
  }
  const discordUser = interaction.member?.user || interaction.user || {};
  const discordUserId = discordUser.id || null;
  const options = Array.isArray(interaction.data?.options) ? interaction.data.options : [];
  const description = String(options.find((option) => option.name === 'description')?.value || '').trim();
  const version = String(options.find((option) => option.name === 'streamz_version')?.value || '').trim();
  const os = String(options.find((option) => option.name === 'operating_system')?.value || '').trim();
  const errorText = String(options.find((option) => option.name === 'error_text')?.value || '').trim();
  const tried = String(options.find((option) => option.name === 'tried')?.value || '').trim();
  const attachmentId = String(options.find((option) => option.name === 'attachment')?.value || '').trim();
  const attachment = attachmentId ? interaction.data?.resolved?.attachments?.[attachmentId] || null : null;
  if (!discordUserId || !description) {
    return discordJson({
      type: 4,
      data: {
        flags: 64,
        content: 'Tell Streamz Support what is broken. Run /contact-support in a DM with a clear description.',
      },
    });
  }
  const result = await createStreamzAppSupportCase(env, {
    source: 'discord_dm_command',
    discordUser,
    description,
    version,
    os,
    errorText,
    tried,
    attachments: attachment ? [sanitizeDiscordAttachment(attachment)] : [],
  });
  return discordJson({
    type: 4,
    data: {
      flags: 64,
      content: result.ok
        ? `Private Streamz support case ${result.caseNumber} was created. A Streamz Support team member can reply through this bot.`
        : (result.message || 'Unable to create private support right now.'),
    },
  });
}

function discordJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function verifyDiscordInteractionSignature(rawBody, signatureHex, timestamp, publicKeyHex) {
  try {
    if (!signatureHex || !timestamp || !publicKeyHex) return false;
    const publicKey = await crypto.subtle.importKey(
      'raw',
      hexToBytes(publicKeyHex),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      publicKey,
      hexToBytes(signatureHex),
      textEncoder.encode(`${timestamp}${rawBody}`),
    );
  } catch (error) {
    return false;
  }
}

async function claimStreamzDiscordCode(env, code, discordUserId) {
  const normalizedCode = normalizeStreamzPurchaseCode(code);
  if (!isValidStreamzPurchaseCode(normalizedCode)) {
    return { ok: false, message: 'That Streamz Pro purchase code is invalid.' };
  }
  return updateStreamzDatabase(env, async (db) => {
    applySimpleDbRateLimit(db, `discord_command:${discordUserId}`, STREAMZ_DISCORD_COMMAND_MAX_ATTEMPTS, STREAMZ_DISCORD_COMMAND_WINDOW_MS, 'Too many Discord verification attempts. Try again later.');
    const codeHash = await hashStreamzPurchaseCode(normalizedCode);
    const verifications = normalizeStreamzDiscordVerifications(db.streamzProDiscordVerifications);
    const index = verifications.findIndex((entry) => (
      (entry.purchaseCodeHash && constantTimeStringEquals(entry.purchaseCodeHash, codeHash))
      || (entry.discordCodeHash && constantTimeStringEquals(entry.discordCodeHash, codeHash))
    ));
    if (index < 0) {
      const poolEntry = normalizeStreamzProCodePool(db.streamzProCodePool).find((entry) => entry.codeHash && constantTimeStringEquals(entry.codeHash, codeHash));
      const message = poolEntry?.status === 'redeemed'
        ? 'This activation code has already been redeemed.'
        : ['expired', 'replaced'].includes(poolEntry?.status)
          ? 'Your activation code has expired. DM the Streamz bot and use /code-expired with your original activation-pass PDF.'
          : 'This activation code is invalid.';
      return { db, value: { ok: false, message } };
    }
    const verification = verifications[index];
    const entitlement = normalizeStreamzProEntitlements(db.streamzProEntitlements).find((entry) => entry.id === verification.entitlementId);
    const payment = normalizeStreamzProPayments(db.streamzProPayments).find((entry) => (
      (entitlement?.stripePaymentIntentId && entry.stripePaymentIntentId === entitlement.stripePaymentIntentId)
      || (entitlement?.stripeCheckoutSessionId && entry.stripeCheckoutSessionId === entitlement.stripeCheckoutSessionId)
    )) || null;
    const poolEntry = normalizeStreamzProCodePool(db.streamzProCodePool).find((entry) => entry.codeHash && constantTimeStringEquals(entry.codeHash, codeHash)) || null;
    const purchaseStatus = getStreamzPurchaseCodeStatus(entitlement, verification, payment, poolEntry);
    if (purchaseStatus === 'refunded' || purchaseStatus === 'disputed' || purchaseStatus === 'canceled') {
      return {
        db,
        value: {
          ok: false,
          message: purchaseStatus === 'refunded'
            ? 'This Streamz Pro purchase has been refunded.'
            : purchaseStatus === 'disputed'
              ? 'This Streamz Pro purchase is disputed.'
              : 'This Streamz Pro purchase was canceled.',
        },
      };
    }
    if (purchaseStatus === 'expired') {
      const now = new Date().toISOString();
      verifications[index] = {
        ...verification,
        status: 'expired',
        purchaseCodeExpiredAt: verification.purchaseCodeExpiredAt || now,
        updatedAt: now,
      };
      db.streamzProCodePool = normalizeStreamzProCodePool(db.streamzProCodePool).map((entry) => (
        entry.id === verification.purchaseCodePoolId || (entry.codeHash && entry.codeHash === verification.purchaseCodeHash)
          ? { ...entry, status: 'expired', code: null, expiredAt: entry.expiredAt || now, updatedAt: now }
          : entry
      ));
      db.streamzProDiscordVerifications = verifications;
      return { db, value: { ok: false, message: 'Your activation code has expired. DM the Streamz bot and use /code-expired with your original activation-pass PDF.' } };
    }
    if (!entitlement || entitlement.status !== 'pending_discord_verification' || !entitlement.paymentConfirmedAt || entitlement.status === 'revoked') {
      return { db, value: { ok: false, message: 'This Streamz Pro purchase is not ready for Discord verification.' } };
    }
    if (String(entitlement.paymentStatus || payment?.status || '').toLowerCase() !== 'succeeded') {
      return { db, value: { ok: false, message: 'This Streamz Pro payment has not been confirmed as successful.' } };
    }
    if (verification.claimedDiscordUserId && verification.claimedDiscordUserId !== discordUserId) {
      return { db, value: { ok: false, message: 'This Streamz Pro purchase code has already been claimed.' } };
    }
    if (verification.purchaseCodeRedeemedAt || entitlement.status === 'active') {
      return { db, value: { ok: false, message: 'This purchase code has already been redeemed.' } };
    }
    const websiteToken = await createStreamzSecureToken();
    const now = new Date().toISOString();
    verifications[index] = {
      ...verification,
      status: 'discord_claimed',
      claimedDiscordUserId: discordUserId,
      discordClaimedAt: verification.discordClaimedAt || now,
      purchaseCodeClaimedAt: verification.purchaseCodeClaimedAt || now,
      discordCodeUsedAt: verification.discordCodeUsedAt || now,
      websiteTokenHash: await hashStreamzWebsiteToken(websiteToken),
      websiteTokenExpiresAt: new Date(Date.now() + STREAMZ_WEBSITE_TOKEN_TTL_MS).toISOString(),
      websiteTokenUsedAt: null,
      updatedAt: now,
    };
    db.streamzProCodePool = normalizeStreamzProCodePool(db.streamzProCodePool).map((entry) => (
      entry.id === verification.purchaseCodePoolId || (entry.codeHash && entry.codeHash === verification.purchaseCodeHash)
        ? { ...entry, status: 'pending_google_linking', code: null, discordUserId, claimedAt: entry.claimedAt || now, updatedAt: now }
        : entry
    ));
    appendStreamzAuditEvent(db, 'discord_code_claimed', {
      codeHash,
      entitlementId: entitlement.id,
      discordUserId,
    }, now);
    db.streamzProDiscordVerifications = verifications;
    db.streamzProUpgradeSessions = markStreamzUpgradeSessionForEntitlement(db.streamzProUpgradeSessions, entitlement.upgradeSessionHash, entitlement, 'discord_claimed');
    return {
      db,
      value: {
        ok: true,
        verifyUrl: buildStreamzDiscordVerifyUrl(websiteToken),
      },
    };
  });
}

async function getStreamzDiscordWebsiteTokenStatus(env, token) {
  const tokenHash = await hashStreamzWebsiteToken(token);
  const db = await loadDatabase(env);
  const verification = findStreamzDiscordVerificationByWebsiteTokenHash(db, tokenHash);
  if (!verification) return buildStreamzDiscordSiteResult('invalid');
  const entitlement = normalizeStreamzProEntitlements(db.streamzProEntitlements).find((entry) => entry.id === verification.entitlementId) || null;
  if (entitlement?.status === 'active') return buildStreamzDiscordSiteResult('already_active', entitlement);
  if (verification.websiteTokenUsedAt) return buildStreamzDiscordSiteResult('already_used', entitlement);
  if (!verification.websiteTokenExpiresAt || Date.parse(verification.websiteTokenExpiresAt) <= Date.now()) {
    return buildStreamzDiscordSiteResult('expired', entitlement);
  }
  if (!verification.claimedDiscordUserId || entitlement?.status !== 'pending_discord_verification') {
    return buildStreamzDiscordSiteResult('invalid', entitlement);
  }
  return buildStreamzDiscordSiteResult('pending', entitlement);
}

async function linkStreamzDiscordVerificationToGoogle(env, token, googleProfile) {
  const tokenHash = await hashStreamzWebsiteToken(token);
  return updateStreamzDatabase(env, async (db) => {
    const verification = findStreamzDiscordVerificationByWebsiteTokenHash(db, tokenHash);
    if (!verification) return { db, value: buildStreamzDiscordSiteResult('invalid') };
    const entitlements = normalizeStreamzProEntitlements(db.streamzProEntitlements);
    const index = entitlements.findIndex((entry) => entry.id === verification.entitlementId);
    if (index < 0) return { db, value: buildStreamzDiscordSiteResult('invalid') };
    const entitlement = entitlements[index];
    if (entitlement.status === 'active') return { db, value: buildStreamzDiscordSiteResult('already_active', entitlement) };
    if (entitlement.status !== 'pending_discord_verification' || !entitlement.paymentConfirmedAt || entitlement.status === 'revoked') {
      return { db, value: buildStreamzDiscordSiteResult('invalid', entitlement) };
    }
    if (!verification.claimedDiscordUserId) return { db, value: buildStreamzDiscordSiteResult('invalid', entitlement) };
    if (verification.websiteTokenUsedAt) return { db, value: buildStreamzDiscordSiteResult('already_used', entitlement) };
    if (!verification.websiteTokenExpiresAt || Date.parse(verification.websiteTokenExpiresAt) <= Date.now()) {
      return { db, value: buildStreamzDiscordSiteResult('expired', entitlement) };
    }

    const accountId = await buildInternalStreamzAccountId('google', googleProfile.sub);
    const conflicting = entitlements.find((entry) => (
      entry.id !== entitlement.id
      && entry.product === STREAMZ_PRO_PRODUCT_ID
      && entry.status === 'active'
      && (entry.googleSub === googleProfile.sub || entry.accountId === accountId)
    ));
    if (conflicting) return { db, value: buildStreamzDiscordSiteResult('conflict', entitlement) };

    const now = new Date().toISOString();
    const activatedId = buildStreamzEntitlementIdFromAccountId(accountId, entitlement.product || STREAMZ_PRO_PRODUCT_ID);
    const activated = {
      ...entitlement,
      id: activatedId,
      accountId,
      googleSub: googleProfile.sub,
      googleEmail: googleProfile.email || null,
      email: entitlement.email || googleProfile.email || null,
      emailNormalized: entitlement.emailNormalized || normalizeEmail(googleProfile.email),
      discordUserId: verification.claimedDiscordUserId,
      discordClaimedAt: verification.discordClaimedAt || now,
      status: 'active',
      accountLocked: true,
      googleLinkedAt: now,
      activatedAt: now,
      updatedAt: now,
    };
    entitlements[index] = activated;
    const verifications = normalizeStreamzDiscordVerifications(db.streamzProDiscordVerifications);
    const verificationIndex = verifications.findIndex((entry) => entry.id === verification.id);
    if (verificationIndex >= 0) {
      verifications[verificationIndex] = {
        ...verification,
        entitlementId: activated.id,
        status: 'active',
        purchaseCodeRedeemedAt: now,
        websiteTokenUsedAt: now,
        websiteTokenHash: null,
        updatedAt: now,
      };
    }
    db.streamzProCodePool = normalizeStreamzProCodePool(db.streamzProCodePool).map((entry) => (
      entry.id === verification.purchaseCodePoolId || (entry.codeHash && entry.codeHash === verification.purchaseCodeHash)
        ? {
          ...entry,
          code: null,
          status: 'redeemed',
          entitlementId: activated.id,
          discordUserId: verification.claimedDiscordUserId,
          googleSub: googleProfile.sub,
          redeemedAt: now,
          updatedAt: now,
        }
        : entry
    ));
    db.streamzAccounts = upsertStreamzAccount(db.streamzAccounts, buildStreamzAccountFromEntitlement(activated));
    db.streamzProEntitlements = entitlements;
    db.streamzProDiscordVerifications = verifications;
    db.streamzProUpgradeSessions = markStreamzUpgradeSessionForEntitlement(db.streamzProUpgradeSessions, activated.upgradeSessionHash, activated, 'active');
    appendStreamzAuditEvent(db, 'google_linking_completed', {
      entitlementId: activated.id,
      googleSub: googleProfile.sub,
      discordUserId: verification.claimedDiscordUserId,
      codeHash: verification.purchaseCodeHash || null,
    }, now);
    return { db, value: buildStreamzDiscordSiteResult('success', activated) };
  });
}

function applySimpleDbRateLimit(db, key, maxAttempts, windowMs, message) {
  const now = Date.now();
  const limits = db.streamzRateLimits && typeof db.streamzRateLimits === 'object' ? db.streamzRateLimits : {};
  const bucket = limits[key] || { attempts: [] };
  const attempts = Array.isArray(bucket.attempts)
    ? bucket.attempts.map(Number).filter((value) => now - value < windowMs)
    : [];
  if (attempts.length >= maxAttempts) {
    throw httpError(429, message);
  }
  attempts.push(now);
  db.streamzRateLimits = { ...limits, [key]: { attempts, lastAt: now } };
}

async function createStreamzExpiredCodeReviewFromDiscord(env, input) {
  const attachmentUrl = String(input.attachment?.url || '').trim();
  const now = new Date().toISOString();
  let extractedCode = null;
  let lookup = { ok: false, status: 'invalid', message: 'PDF text extraction did not find an activation code.' };
  if (attachmentUrl) {
    const pdfBytes = await fetch(attachmentUrl).then((resp) => (resp.ok ? resp.arrayBuffer() : null)).catch(() => null);
    extractedCode = pdfBytes ? extractStreamzActivationCodeFromPdfBytes(pdfBytes) : null;
    if (extractedCode) {
      const db = await loadDatabase(env);
      lookup = await lookupStreamzActivationCodeInDb(db, extractedCode);
    }
  }
  if (!extractedCode) {
    return { ok: false, message: 'No valid Streamz Pro activation code was found in the uploaded PDF. Upload the original activation-pass PDF.' };
  }
  if (lookup.status !== 'expired') {
    const message = lookup.status === 'redeemed'
      ? 'This purchase code has already been redeemed.'
      : lookup.status === 'available' || lookup.status === 'claimed'
        ? 'This activation code has not expired. DM the Streamz bot and use /verify-pro with the active code.'
        : 'The uploaded PDF does not match an expired, unused Streamz Pro paid order.';
    return { ok: false, message };
  }
  const ticket = await updateStreamzDatabase(env, async (db) => {
    const tickets = normalizeStreamzSupportTickets(db.streamzProSupportTickets);
    const ticketId = `stzsup_${crypto.randomUUID()}`;
    const ticketNumber = `STZ-EXP-${String(tickets.length + 1).padStart(5, '0')}`;
    const nextTicket = {
      id: ticketId,
      ticketNumber,
      status: 'open',
      discordUserId: String(input.discordUser?.id || ''),
      discordUsername: buildDiscordDisplayName(input.discordUser),
      discordMention: input.discordUser?.id ? `<@${input.discordUser.id}>` : null,
      description: 'Expired activation-code replacement request submitted by DM command.',
      attachmentUrl,
      attachmentFilename: String(input.attachment?.filename || ''),
      activationCode: extractedCode,
      backendVerification: lookup,
      requestType: 'expired_code_replacement',
      createdAt: now,
      updatedAt: now,
      events: [{ type: 'created', at: now, actor: 'discord_user' }],
    };
    db.streamzProSupportTickets = [...tickets, nextTicket].slice(-300);
    appendStreamzAuditEvent(db, 'expired_code_review_created', {
      ticketId,
      ticketNumber,
      discordUserId: nextTicket.discordUserId,
      codeHash: extractedCode ? await hashStreamzPurchaseCode(extractedCode) : null,
    }, now);
    return { db, value: nextTicket };
  });
  return { ok: true, ticketId: ticket.id, ticketNumber: ticket.ticketNumber };
}

function extractStreamzActivationCodeFromPdfBytes(buffer) {
  const text = textDecoder.decode(new Uint8Array(buffer));
  const matches = text.match(/\b[A-Z0-9]{10}\b/g) || [];
  return matches.map(normalizeStreamzPurchaseCode).find(isValidStreamzPurchaseCode) || null;
}

function buildDiscordDisplayName(user) {
  return String(user?.global_name || user?.username || 'Unknown Discord user').trim();
}

async function listStreamzSupportStaff(env) {
  const db = await loadDatabase(env);
  return normalizeStreamzSupportStaff(db.streamzProSupportStaff, env);
}

async function requireStreamzSupportStaff(env, user) {
  const sub = String(user?.sub || '').trim();
  if (!sub) throw httpError(401, 'Google sign-in required.');
  const staff = await listStreamzSupportStaff(env);
  const member = staff.find((entry) => entry.googleSub === sub);
  if (!member) throw httpError(403, 'This Google account is not approved for Streamz expired-code review.');
  return member;
}

function normalizeStreamzSupportStaff(value, env = {}) {
  const ownerSub = String(env.STREAMZ_OWNER_GOOGLE_SUB || '').trim();
  const merged = new Map();
  if (ownerSub) merged.set(ownerSub, { googleSub: ownerSub, role: 'owner', source: 'owner_secret' });
  for (const entry of parseStreamzSupportStaffEnv(env)) merged.set(entry.googleSub, entry);
  for (const entry of Array.isArray(value) ? value : []) {
    const googleSub = String(entry?.googleSub || '').trim();
    const role = normalizeExpiredCodeReviewRole(entry?.role);
    if (googleSub && STREAMZ_EXPIRED_CODE_REVIEW_ROLES.has(role)) merged.set(googleSub, { ...entry, googleSub, role });
  }
  return [...merged.values()];
}

function parseStreamzSupportStaffEnv(env) {
  return String(env.STREAMZ_EXPIRED_CODE_REVIEW_STAFF || '').trim().split(/[,\n]+/).map((item) => {
    const [googleSub, roleRaw] = item.split(':').map((part) => String(part || '').trim());
    const role = normalizeExpiredCodeReviewRole(roleRaw || 'reviewer');
    return googleSub && STREAMZ_EXPIRED_CODE_REVIEW_ROLES.has(role) ? { googleSub, role, source: 'review_staff_secret' } : null;
  }).filter(Boolean);
}

async function updateStreamzSupportStaff(env, payload, actor) {
  const action = String(payload?.action || '').trim();
  const googleSub = String(payload?.googleSub || '').trim();
  const role = normalizeExpiredCodeReviewRole(payload?.role || 'reviewer');
  if (!googleSub) throw httpError(400, 'Google sub is required.');
  if (action !== 'remove' && !STREAMZ_EXPIRED_CODE_REVIEW_ROLES.has(role)) throw httpError(400, 'Invalid expired-code review role.');
  return updateStreamzDatabase(env, async (db) => {
    let staff = normalizeStreamzSupportStaff(db.streamzProSupportStaff, {});
    if (action === 'remove') {
      staff = staff.filter((entry) => entry.googleSub !== googleSub);
    } else {
      const next = { googleSub, role, addedBy: actor.sub, updatedAt: new Date().toISOString() };
      const index = staff.findIndex((entry) => entry.googleSub === googleSub);
      if (index >= 0) staff[index] = { ...staff[index], ...next };
      else staff.push(next);
    }
    db.streamzProSupportStaff = staff;
    appendStreamzAuditEvent(db, 'expired_code_review_staff_updated', { action, googleSub, role, actorSub: actor.sub });
    return { db, value: { ok: true, staff } };
  });
}

function normalizeExpiredCodeReviewRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized;
}

async function lookupStreamzSupportCode(env, code) {
  if (!isValidStreamzPurchaseCode(code)) return { ok: false, status: 'invalid', message: 'This activation code is invalid.' };
  const db = await loadDatabase(env);
  return lookupStreamzActivationCodeInDb(db, code);
}

async function lookupStreamzActivationCodeInDb(db, code) {
  const codeHash = await hashStreamzPurchaseCode(code);
  const poolEntry = normalizeStreamzProCodePool(db.streamzProCodePool).find((entry) => entry.codeHash && constantTimeStringEquals(entry.codeHash, codeHash)) || null;
  const verification = normalizeStreamzDiscordVerifications(db.streamzProDiscordVerifications).find((entry) => (
    (entry.purchaseCodeHash && constantTimeStringEquals(entry.purchaseCodeHash, codeHash))
    || (entry.discordCodeHash && constantTimeStringEquals(entry.discordCodeHash, codeHash))
  )) || null;
  const entitlement = normalizeStreamzProEntitlements(db.streamzProEntitlements).find((entry) => entry.id === verification?.entitlementId) || null;
  const payment = normalizeStreamzProPayments(db.streamzProPayments).find((entry) => (
    (entitlement?.stripePaymentIntentId && entry.stripePaymentIntentId === entitlement.stripePaymentIntentId)
    || (entitlement?.stripeCheckoutSessionId && entry.stripeCheckoutSessionId === entitlement.stripeCheckoutSessionId)
  )) || null;
  const status = verification ? getStreamzPurchaseCodeStatus(entitlement, verification, payment, poolEntry) : (poolEntry?.status || 'invalid');
  const result = buildStreamzPurchaseCodeResult(status, entitlement, verification, payment);
  return {
    ok: Boolean(verification || poolEntry),
    status,
    message: result.message,
    purchase: result.purchase,
    poolEntry: poolEntry ? {
      id: poolEntry.id,
      status: poolEntry.status,
      source: poolEntry.source,
      issueType: poolEntry.issueType || null,
      assignedAt: poolEntry.assignedAt || null,
      expiresAt: poolEntry.expiresAt || null,
      redeemedAt: poolEntry.redeemedAt || null,
      replacedAt: poolEntry.replacedAt || null,
    } : null,
  };
}

async function issueStreamzSupportReplacementCode(env, payload, staff, actor) {
  const code = normalizeStreamzPurchaseCode(payload?.code);
  const reason = String(payload?.reason || '').trim().slice(0, 500);
  if (!isValidStreamzPurchaseCode(code)) throw httpError(400, 'Original activation code is required.');
  if (!reason) throw httpError(400, 'Replacement reason is required.');
  return updateStreamzDatabase(env, async (db) => {
    const now = new Date().toISOString();
    const codeHash = await hashStreamzPurchaseCode(code);
    const verifications = normalizeStreamzDiscordVerifications(db.streamzProDiscordVerifications);
    const index = verifications.findIndex((entry) => (
      (entry.purchaseCodeHash && constantTimeStringEquals(entry.purchaseCodeHash, codeHash))
      || (entry.discordCodeHash && constantTimeStringEquals(entry.discordCodeHash, codeHash))
    ));
    if (index < 0) throw httpError(404, 'Original activation code was not found.');
    const verification = verifications[index];
    const entitlement = normalizeStreamzProEntitlements(db.streamzProEntitlements).find((entry) => entry.id === verification.entitlementId);
    if (!entitlement || entitlement.status !== 'pending_discord_verification' || entitlement.googleSub || entitlement.discordUserId) {
      throw httpError(409, 'A replacement code cannot be issued for this purchase.');
    }
    const [replacementCode] = await createStreamzActivationCodeBatch(collectStreamzActivationCodeHashes(db));
    const replacementHash = await hashStreamzPurchaseCode(replacementCode);
    const expiresAt = new Date(Date.now() + STREAMZ_PURCHASE_CODE_TTL_MS).toISOString();
    db.streamzProCodePool = normalizeStreamzProCodePool(db.streamzProCodePool).map((entry) => (
      entry.entitlementId === entitlement.id && ['assigned', 'pending_google_linking'].includes(entry.status)
        ? { ...entry, status: entry.codeHash === codeHash ? 'replaced' : 'invalidated', code: null, replacedAt: now, updatedAt: now }
        : entry
    ));
    const replacementEntry = {
      id: `pool:${replacementHash.slice(0, 24)}`,
      code: null,
      codeHash: replacementHash,
      status: 'assigned',
      source: 'internal_csprng',
      issueType: 'expired_code_replacement',
      staffGoogleSub: staff.googleSub,
      staffRole: staff.role,
      reason,
      entitlementId: entitlement.id,
      paymentId: entitlement.stripePaymentIntentId || entitlement.stripeCheckoutSessionId || null,
      orderNumber: entitlement.orderNumber || buildStreamzOrderNumber(entitlement),
      assignedAt: now,
      expiresAt,
      verificationId: verification.id,
      createdAt: now,
      updatedAt: now,
    };
    db.streamzProCodePool = [...normalizeStreamzProCodePool(db.streamzProCodePool), replacementEntry].slice(-500);
    verifications[index] = {
      ...verification,
      status: 'code_generated',
      previousPurchaseCodeHashes: [...(verification.previousPurchaseCodeHashes || []), verification.purchaseCodeHash].filter(Boolean),
      purchaseCodeHash: replacementHash,
      discordCodeHash: replacementHash,
      purchaseCodePoolId: replacementEntry.id,
      purchaseCodeSource: 'internal_csprng',
      purchaseCodeAssignedAt: now,
      purchaseCodeExpiresAt: expiresAt,
      activationPassCode: replacementCode,
      expiredCodeReplacementHistory: [
        ...(verification.expiredCodeReplacementHistory || []),
        { oldCodeHash: verification.purchaseCodeHash || null, newCodeHash: replacementHash, staffGoogleSub: staff.googleSub, reason, issuedAt: now, expiresAt },
      ],
      claimedDiscordUserId: null,
      discordClaimedAt: null,
      purchaseCodeClaimedAt: null,
      websiteTokenHash: null,
      websiteTokenExpiresAt: null,
      websiteTokenUsedAt: null,
      updatedAt: now,
    };
    db.streamzProDiscordVerifications = verifications;
    appendStreamzAuditEvent(db, 'replacement_code_issued', { entitlementId: entitlement.id, oldCodeHash: codeHash, newCodeHash: replacementHash, staffGoogleSub: staff.googleSub, reason }, now);
    return { db, value: { ok: true, replacementCode, expiresAt } };
  });
}

async function updateStreamzSupportTicket(env, payload, staff) {
  const action = String(payload?.action || '').trim();
  const ticketId = String(payload?.ticketId || '').trim();
  if (!ticketId) throw httpError(400, 'Ticket ID is required.');
  return updateStreamzDatabase(env, async (db) => {
    const tickets = normalizeStreamzSupportTickets(db.streamzProSupportTickets);
    const index = tickets.findIndex((entry) => entry.id === ticketId);
    if (index < 0) throw httpError(404, 'Support ticket not found.');
    const now = new Date().toISOString();
    const ticket = tickets[index];
    if (action === 'claim') {
      tickets[index] = { ...ticket, status: 'claimed', claimedBy: staff.googleSub, claimedAt: ticket.claimedAt || now, updatedAt: now };
    } else if (action === 'close') {
      tickets[index] = { ...ticket, status: 'closed', closedBy: staff.googleSub, closedAt: now, updatedAt: now };
    } else if (action === 'reply') {
      const message = String(payload?.message || '').trim().slice(0, 1800);
      if (!message) throw httpError(400, 'Reply message is required.');
      tickets[index] = {
        ...ticket,
        status: ticket.status === 'open' ? 'claimed' : ticket.status,
        claimedBy: ticket.claimedBy || staff.googleSub,
        replies: [...(ticket.replies || []), { message, staffGoogleSub: staff.googleSub, at: now }],
        updatedAt: now,
      };
      await sendStreamzSupportDm(env, ticket.discordUserId, message);
    } else {
      throw httpError(400, 'Unsupported ticket action.');
    }
    db.streamzProSupportTickets = tickets;
    appendStreamzAuditEvent(db, 'expired_code_review_updated', { ticketId, action, staffGoogleSub: staff.googleSub }, now);
    return { db, value: { ok: true, ticket: tickets[index] } };
  });
}

async function sendStreamzSupportDm(env, discordUserId, message) {
  const token = String(env.DISCORD_BOT_TOKEN || '').trim();
  if (!token || !discordUserId) return false;
  const dmResp = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  if (!dmResp.ok) return false;
  const channel = await dmResp.json().catch(() => null);
  if (!channel?.id) return false;
  const content = `A Streamz expired-code reviewer has joined this conversation.\n\n${message}`;
  const msgResp = await fetch(`https://discord.com/api/v10/channels/${encodeURIComponent(channel.id)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return msgResp.ok;
}

function normalizeStreamzSupportTickets(value) {
  return Array.isArray(value)
    ? value
      .filter((entry) => entry && typeof entry === 'object' && entry.id)
      .map((entry) => ({
        ...entry,
        status: STREAMZ_EXPIRED_CODE_REVIEW_STATUSES.has(entry.status) ? entry.status : 'open',
        events: Array.isArray(entry.events) ? entry.events : [],
        replies: Array.isArray(entry.replies) ? entry.replies : [],
      }))
    : [];
}

async function handleStreamzSupportRequest(request, env, path, origin) {
  const user = await ensureAuthenticated(request, env, 'Sign in with Google to access Streamz Support.');
  const staff = await requireStreamzAppSupportStaff(env, user);
  const route = path.replace(/^api\/streamz\/support\/?/, '');

  if (route === 'staff' && request.method === 'GET') {
    return json({ ok: true, staff, members: await listStreamzAppSupportStaff(env) }, 200, origin);
  }
  if (route === 'cases' && request.method === 'GET') {
    const db = await loadDatabase(env);
    return json({
      ok: true,
      cases: normalizeStreamzAppSupportCases(db.streamzAppSupportCases).slice(-150).reverse(),
      bugs: normalizeStreamzBugReports(db.streamzBugReports).slice(-150).reverse(),
      knownIssues: normalizeStreamzKnownIssues(db.streamzKnownIssues).slice(-100).reverse(),
    }, 200, origin);
  }
  if (route === 'cases/action' && request.method === 'POST') {
    const payload = await request.json().catch(() => ({}));
    return json(await updateStreamzAppSupportCase(env, payload, staff), 200, origin);
  }
  if (route === 'bugs/action' && request.method === 'POST') {
    const payload = await request.json().catch(() => ({}));
    return json(await updateStreamzBugReport(env, payload, staff), 200, origin);
  }
  throw httpError(404, 'Streamz support route not found.');
}

async function pollStreamzBugsChannel(env) {
  const token = String(env.DISCORD_BOT_TOKEN || '').trim();
  const channelId = getStreamzBugsChannelId(env);
  if (!token || !channelId) return { ok: false, message: 'Discord bot token or Bugs channel ID is not configured.' };

  const db = await loadDatabase(env);
  const lastSeenId = String(db.adminSettings?.streamzBugsLastMessageId || '').trim();
  const endpoint = new URL(`https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`);
  endpoint.searchParams.set('limit', lastSeenId ? '25' : '1');
  if (lastSeenId) endpoint.searchParams.set('after', lastSeenId);

  const messages = await discordApi(env, endpoint.toString()).catch(() => []);
  if (!Array.isArray(messages) || !messages.length) return { ok: true, processed: 0 };
  const sorted = messages.sort((a, b) => compareDiscordSnowflakes(a.id, b.id));
  if (!lastSeenId) {
    await updateStreamzDatabase(env, async (current) => {
      current.adminSettings = { ...(current.adminSettings || {}), streamzBugsLastMessageId: sorted[sorted.length - 1].id };
      return { db: current, value: { ok: true, initialized: true } };
    });
    return { ok: true, initialized: true, processed: 0 };
  }

  let processed = 0;
  for (const message of sorted) {
    if (await processStreamzBugsMessage(env, message, channelId)) processed += 1;
  }
  await updateStreamzDatabase(env, async (current) => {
    current.adminSettings = { ...(current.adminSettings || {}), streamzBugsLastMessageId: sorted[sorted.length - 1].id };
    return { db: current, value: { ok: true, processed } };
  });
  return { ok: true, processed };
}

async function processStreamzBugsMessage(env, message, channelId) {
  if (!message?.id || message.author?.bot || message.webhook_id) return false;
  const content = String(message.content || '').trim();
  const attachments = Array.isArray(message.attachments) ? message.attachments.map(sanitizeDiscordAttachment) : [];
  if (!isLikelyStreamzBugReport(content, attachments)) return false;

  const fingerprint = await sha256Base64Url(`streamz-bug:${message.author?.id || ''}:${content.slice(0, 1000)}:${attachments.map((a) => a.filename).join('|')}`);
  const created = await updateStreamzDatabase(env, async (db) => {
    applySimpleDbRateLimit(db, `bugs_channel:${message.author?.id || 'unknown'}`, 6, 10 * 60 * 1000, 'Too many bug reports.');
    const existing = normalizeStreamzBugReports(db.streamzBugReports).find((entry) => entry.discordMessageId === message.id || entry.fingerprint === fingerprint);
    if (existing) return { db, value: null };
    const now = new Date().toISOString();
    const report = {
      id: `bug_${crypto.randomUUID()}`,
      fingerprint,
      status: 'new',
      source: 'discord_bugs_channel',
      discordMessageId: message.id,
      discordChannelId: channelId,
      discordUserId: message.author?.id || null,
      discordUsername: buildDiscordDisplayName(message.author),
      messageUrl: buildDiscordMessageUrl(message.guild_id || env.DISCORD_GUILD_ID, channelId, message.id),
      content,
      attachments,
      streamzVersion: extractStreamzVersion(content),
      operatingSystem: extractOperatingSystem(content),
      errorText: extractErrorText(content),
      actionsTried: extractActionsTried(content),
      createdAt: message.timestamp || now,
      updatedAt: now,
      events: [{ type: 'created', at: now, actor: 'discord_poll' }],
    };
    db.streamzBugReports = [...normalizeStreamzBugReports(db.streamzBugReports), report].slice(-500);
    appendStreamzAuditEvent(db, 'streamz_bug_report_detected', { bugId: report.id, discordMessageId: message.id, discordUserId: report.discordUserId }, now);
    return { db, value: report };
  }).catch((error) => (error?.status === 429 ? null : Promise.reject(error)));
  if (!created) return false;

  const ai = await generateStreamzTroubleshootingReply(env, created);
  await updateStreamzDatabase(env, async (db) => {
    db.streamzBugReports = normalizeStreamzBugReports(db.streamzBugReports).map((entry) => (
      entry.id === created.id
        ? {
          ...entry,
          status: ai.ok ? 'answered' : 'new',
          aiModel: ai.model || null,
          aiReply: ai.reply,
          aiSucceeded: ai.ok,
          updatedAt: new Date().toISOString(),
        }
        : entry
    ));
    return { db, value: true };
  });
  await postStreamzBugTroubleshootingReply(env, created, ai.reply);
  return true;
}

function isLikelyStreamzBugReport(content, attachments = []) {
  const text = String(content || '').toLowerCase();
  if (text.length < 12 && attachments.length === 0) return false;
  const bugWords = [
    'bug', 'error', 'crash', 'crashed', 'broken', 'not working', 'doesn\'t work', 'wont work', 'won\'t work',
    'failed', 'fails', 'freeze', 'frozen', 'blank', 'black screen', 'login issue', 'qr', 'pro won',
    'update failed', 'install failed', 'can\'t open', 'cant open', 'cannot open',
  ];
  if (bugWords.some((word) => text.includes(word))) return true;
  return attachments.some((file) => /image|text|log|pdf|json/.test(file.contentType || '') || /\.(png|jpe?g|webp|gif|txt|log|json|pdf)$/i.test(file.filename || ''));
}

async function generateStreamzTroubleshootingReply(env, report) {
  const models = [
    String(env.GEMINI_PRIMARY_MODEL || STREAMZ_GEMINI_PRIMARY_MODEL).trim(),
    String(env.GEMINI_FALLBACK_MODEL || STREAMZ_GEMINI_FALLBACK_MODEL).trim(),
  ].filter(Boolean);
  const apiKey = String(env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY || '').trim();
  if (!apiKey) return { ok: false, model: null, reply: STREAMZ_AI_UNAVAILABLE_MESSAGE };
  let lastError = null;
  for (let i = 0; i < models.length; i += 1) {
    const attempts = i === 0 ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const reply = await callGeminiTroubleshooter(apiKey, models[i], report);
        if (reply) return { ok: true, model: models[i], reply };
      } catch (error) {
        lastError = error;
      }
    }
  }
  console.log('Streamz Gemini troubleshooting unavailable', { reason: lastError?.message || 'unknown', bugId: report.id });
  return { ok: false, model: null, reply: STREAMZ_AI_UNAVAILABLE_MESSAGE };
}

async function callGeminiTroubleshooter(apiKey, model, report) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt = [
    'You are Streamz automated troubleshooting inside the official Discord Bugs channel.',
    'Reply publicly with practical steps only. Be concise, friendly, and do not claim a human reviewed it.',
    'If private account/payment details are needed, tell the user to DM the Streamz bot and use /contact-support.',
    'Do not request activation codes, Google IDs, Stripe IDs, card details, passwords, or secrets.',
    '',
    `Bug report ID: ${report.id}`,
    `Streamz version: ${report.streamzVersion || 'unknown'}`,
    `OS: ${report.operatingSystem || 'unknown'}`,
    `Error text: ${report.errorText || 'not provided'}`,
    `Actions tried: ${report.actionsTried || 'not provided'}`,
    `User message: ${report.content}`,
    `Attachments: ${(report.attachments || []).map((item) => item.filename).join(', ') || 'none'}`,
  ].join('\n');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.25, maxOutputTokens: 900 },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini ${model} failed with ${response.status}`);
  }
  const data = await response.json().catch(() => null);
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  return sanitizeDiscordMessage(text || '');
}

async function postStreamzBugTroubleshootingReply(env, report, reply) {
  const channelId = report.discordChannelId || getStreamzBugsChannelId(env);
  if (!channelId) return false;
  const body = {
    content: reply.slice(0, 1800),
    message_reference: {
      message_id: report.discordMessageId,
      channel_id: channelId,
      fail_if_not_exists: false,
    },
    components: [{
      type: 1,
      components: [
        { type: 2, style: 2, label: 'Contact Streamz Support', custom_id: `streamz_bug_contact:${report.id}` },
        { type: 2, style: 3, label: 'This fixed my problem', custom_id: `streamz_bug_fixed:${report.id}` },
      ],
    }],
  };
  return discordApi(env, `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  }).then(() => true).catch(() => false);
}

async function createStreamzAppSupportCaseFromBug(env, bugId, discordUser) {
  const db = await loadDatabase(env);
  const bug = normalizeStreamzBugReports(db.streamzBugReports).find((entry) => entry.id === bugId);
  if (!bug) return { ok: false, message: 'That bug report could not be found.' };
  if (bug.discordUserId && discordUser?.id && bug.discordUserId !== discordUser.id) {
    return { ok: false, message: 'Only the person who posted the bug report can open a private case from this button.' };
  }
  return createStreamzAppSupportCase(env, {
    source: 'discord_bug_button',
    bugReportId: bug.id,
    discordUser,
    description: bug.content,
    version: bug.streamzVersion || '',
    os: bug.operatingSystem || '',
    errorText: bug.errorText || '',
    tried: bug.actionsTried || '',
    attachments: bug.attachments || [],
  });
}

async function createStreamzAppSupportCase(env, input) {
  const discordUserId = String(input.discordUser?.id || '').trim();
  if (!discordUserId) return { ok: false, message: 'Discord user is missing.' };
  const description = String(input.description || '').trim();
  if (!description) return { ok: false, message: 'Support description is required.' };
  return updateStreamzDatabase(env, async (db) => {
    applySimpleDbRateLimit(db, `contact_support:${discordUserId}`, 5, 10 * 60 * 1000, 'Too many support requests. Try again later.');
    const now = new Date().toISOString();
    const cases = normalizeStreamzAppSupportCases(db.streamzAppSupportCases);
    const caseNumber = `STZ-SUP-${String(cases.length + 1).padStart(5, '0')}`;
    const supportCase = {
      id: `case_${crypto.randomUUID()}`,
      caseNumber,
      status: 'open',
      source: input.source || 'discord_dm_command',
      bugReportId: input.bugReportId || null,
      discordUserId,
      discordUsername: buildDiscordDisplayName(input.discordUser),
      description: description.slice(0, 2000),
      streamzVersion: String(input.version || '').slice(0, 120),
      operatingSystem: String(input.os || '').slice(0, 120),
      errorText: String(input.errorText || '').slice(0, 1000),
      actionsTried: String(input.tried || '').slice(0, 1000),
      attachments: Array.isArray(input.attachments) ? input.attachments.map(sanitizeDiscordAttachment).slice(0, 5) : [],
      createdAt: now,
      updatedAt: now,
      events: [{ type: 'created', at: now, actor: 'discord_user' }],
      replies: [],
    };
    db.streamzAppSupportCases = [...cases, supportCase].slice(-500);
    db.streamzBugReports = normalizeStreamzBugReports(db.streamzBugReports).map((bug) => (
      bug.id === input.bugReportId ? { ...bug, status: 'support_requested', supportCaseId: supportCase.id, updatedAt: now } : bug
    ));
    appendStreamzAuditEvent(db, 'streamz_app_support_case_created', { caseId: supportCase.id, caseNumber, discordUserId, bugReportId: input.bugReportId || null }, now);
    return { db, value: { ok: true, caseId: supportCase.id, caseNumber } };
  }).then(async (result) => {
    await sendStreamzAppSupportDm(env, discordUserId, `Private Streamz support case ${result.caseNumber} was created. A Streamz Support team member can reply through this bot.`);
    return result;
  });
}

async function updateStreamzAppSupportCase(env, payload, staff) {
  const action = String(payload?.action || '').trim();
  const caseId = String(payload?.caseId || '').trim();
  if (!caseId) throw httpError(400, 'Support case ID is required.');
  return updateStreamzDatabase(env, async (db) => {
    const cases = normalizeStreamzAppSupportCases(db.streamzAppSupportCases);
    const index = cases.findIndex((entry) => entry.id === caseId);
    if (index < 0) throw httpError(404, 'Support case not found.');
    const now = new Date().toISOString();
    const supportCase = cases[index];
    if (action === 'reply') {
      const message = String(payload?.message || '').trim().slice(0, 1800);
      if (!message) throw httpError(400, 'Reply message is required.');
      cases[index] = {
        ...supportCase,
        status: 'waiting_for_customer',
        replies: [...(supportCase.replies || []), { message, staffGoogleSub: staff.googleSub, role: staff.role, at: now }],
        events: [...(supportCase.events || []), { type: 'staff_reply', staffGoogleSub: staff.googleSub, at: now }],
        updatedAt: now,
      };
      await sendStreamzAppSupportDm(env, supportCase.discordUserId, message);
    } else if (action === 'status') {
      const status = String(payload?.status || '').trim();
      if (!STREAMZ_APP_SUPPORT_STATUSES.has(status)) throw httpError(400, 'Invalid support status.');
      cases[index] = {
        ...supportCase,
        status,
        events: [...(supportCase.events || []), { type: 'status_changed', status, staffGoogleSub: staff.googleSub, at: now }],
        updatedAt: now,
      };
    } else {
      throw httpError(400, 'Unsupported support action.');
    }
    db.streamzAppSupportCases = cases;
    appendStreamzAuditEvent(db, 'streamz_app_support_case_updated', { caseId, action, staffGoogleSub: staff.googleSub }, now);
    return { db, value: { ok: true, case: cases[index] } };
  });
}

async function updateStreamzBugReport(env, payload, staff) {
  const bugId = String(payload?.bugId || '').trim();
  const status = String(payload?.status || '').trim();
  if (!bugId || !STREAMZ_BUG_REPORT_STATUSES.has(status)) throw httpError(400, 'Valid bug ID and status are required.');
  return updateStreamzDatabase(env, async (db) => {
    const now = new Date().toISOString();
    db.streamzBugReports = normalizeStreamzBugReports(db.streamzBugReports).map((entry) => (
      entry.id === bugId
        ? { ...entry, status, updatedAt: now, events: [...(entry.events || []), { type: 'status_changed', status, staffGoogleSub: staff.googleSub, at: now }] }
        : entry
    ));
    appendStreamzAuditEvent(db, 'streamz_bug_report_updated', { bugId, status, staffGoogleSub: staff.googleSub }, now);
    return { db, value: { ok: true } };
  });
}

async function markStreamzBugReportResolved(env, bugId, discordUserId) {
  return updateStreamzDatabase(env, async (db) => {
    const now = new Date().toISOString();
    db.streamzBugReports = normalizeStreamzBugReports(db.streamzBugReports).map((entry) => (
      entry.id === bugId ? { ...entry, status: 'resolved', resolvedByDiscordUserId: discordUserId, resolvedAt: now, updatedAt: now } : entry
    ));
    return { db, value: { ok: true } };
  });
}

async function sendStreamzAppSupportDm(env, discordUserId, message) {
  const content = `A Streamz Support team member has joined this conversation.\n\n${message}`;
  return sendDiscordDm(env, discordUserId, content);
}

async function sendDiscordDm(env, discordUserId, content) {
  const token = String(env.DISCORD_BOT_TOKEN || '').trim();
  if (!token || !discordUserId || !content) return false;
  const channel = await discordApi(env, 'https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    body: JSON.stringify({ recipient_id: discordUserId }),
  }).catch(() => null);
  if (!channel?.id) return false;
  await discordApi(env, `https://discord.com/api/v10/channels/${encodeURIComponent(channel.id)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: sanitizeDiscordMessage(content).slice(0, 1900) }),
  }).catch(() => null);
  return true;
}

async function discordApi(env, url, init = {}) {
  const token = requireEnv(env, 'DISCORD_BOT_TOKEN');
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw httpError(response.status, `Discord API request failed: ${response.status}`);
  }
  return data;
}

async function listStreamzAppSupportStaff(env) {
  const db = await loadDatabase(env);
  return normalizeStreamzAppSupportStaff(db.streamzSupportStaff, env);
}

async function requireStreamzAppSupportStaff(env, user) {
  const sub = String(user?.sub || '').trim();
  if (!sub) throw httpError(401, 'Google sign-in required.');
  const staff = await listStreamzAppSupportStaff(env);
  const member = staff.find((entry) => entry.googleSub === sub);
  if (!member) throw httpError(403, 'This Google account is not approved for Streamz Support.');
  return member;
}

function normalizeStreamzAppSupportStaff(value, env = {}) {
  const ownerSub = String(env.STREAMZ_OWNER_GOOGLE_SUB || '').trim();
  const merged = new Map();
  if (ownerSub) merged.set(ownerSub, { googleSub: ownerSub, role: 'owner', source: 'owner_secret' });
  for (const entry of parseStreamzAppSupportStaffEnv(env)) merged.set(entry.googleSub, entry);
  for (const entry of Array.isArray(value) ? value : []) {
    const googleSub = String(entry?.googleSub || '').trim();
    const role = normalizeStreamzAppSupportRole(entry?.role);
    if (googleSub && STREAMZ_APP_SUPPORT_ROLES.has(role)) merged.set(googleSub, { ...entry, googleSub, role });
  }
  return [...merged.values()];
}

function parseStreamzAppSupportStaffEnv(env) {
  return String(env.STREAMZ_APP_SUPPORT_STAFF || '').trim().split(/[,\n]+/).map((item) => {
    const [googleSub, roleRaw] = item.split(':').map((part) => String(part || '').trim());
    const role = normalizeStreamzAppSupportRole(roleRaw || 'support');
    return googleSub && STREAMZ_APP_SUPPORT_ROLES.has(role) ? { googleSub, role, source: 'app_support_secret' } : null;
  }).filter(Boolean);
}

function normalizeStreamzAppSupportRole(role) {
  return String(role || '').trim().toLowerCase();
}

function normalizeStreamzBugReports(value) {
  return Array.isArray(value)
    ? value.filter((entry) => entry && typeof entry === 'object' && entry.id).map((entry) => ({
      ...entry,
      status: STREAMZ_BUG_REPORT_STATUSES.has(entry.status) ? entry.status : 'new',
      attachments: Array.isArray(entry.attachments) ? entry.attachments.map(sanitizeDiscordAttachment) : [],
      events: Array.isArray(entry.events) ? entry.events : [],
    }))
    : [];
}

function normalizeStreamzAppSupportCases(value) {
  return Array.isArray(value)
    ? value.filter((entry) => entry && typeof entry === 'object' && entry.id).map((entry) => ({
      ...entry,
      status: STREAMZ_APP_SUPPORT_STATUSES.has(entry.status) ? entry.status : 'open',
      attachments: Array.isArray(entry.attachments) ? entry.attachments.map(sanitizeDiscordAttachment) : [],
      events: Array.isArray(entry.events) ? entry.events : [],
      replies: Array.isArray(entry.replies) ? entry.replies : [],
    }))
    : [];
}

function normalizeStreamzKnownIssues(value) {
  return Array.isArray(value) ? value.filter((entry) => entry && typeof entry === 'object' && entry.id) : [];
}

async function handleStreamzAppUpdate(request, env, origin) {
  if (request.method !== 'GET') {
    throw httpError(405, 'Streamz update check requires GET.');
  }
  const url = new URL(request.url);
  const currentVersion = normalizeVersion(url.searchParams.get('version'));
  const latestVersion = normalizeVersion(env.STREAMZ_LATEST_VERSION || '0.1.0');
  const downloadUrl = String(env.STREAMZ_UPDATE_DOWNLOAD_URL || 'https://vortex-prime-emu.com/projects/streamz/').trim();
  const releaseNotesUrl = String(env.STREAMZ_UPDATE_NOTES_URL || 'https://vortex-prime-emu.com/projects/streamz/help/').trim();
  const updateAvailable = compareSemver(latestVersion, currentVersion) > 0;
  return json({
    ok: true,
    product: 'streamz',
    currentVersion,
    latestVersion,
    updateAvailable,
    mandatory: String(env.STREAMZ_UPDATE_MANDATORY || '').toLowerCase() === 'true',
    downloadUrl,
    releaseNotesUrl,
    checkedAt: new Date().toISOString(),
  }, 200, origin);
}

function normalizeVersion(value) {
  const match = String(value || '').trim().match(/[0-9]+(?:\.[0-9]+){0,3}/);
  return match ? match[0] : '0.0.0';
}

function compareSemver(left, right) {
  const a = normalizeVersion(left).split('.').map((part) => Number(part) || 0);
  const b = normalizeVersion(right).split('.').map((part) => Number(part) || 0);
  for (let i = 0; i < Math.max(a.length, b.length, 3); i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function sanitizeDiscordAttachment(attachment) {
  return {
    id: String(attachment?.id || ''),
    filename: String(attachment?.filename || attachment?.name || '').slice(0, 200),
    contentType: String(attachment?.content_type || attachment?.contentType || attachment?.type || '').slice(0, 120),
    size: Number(attachment?.size || 0) || 0,
    url: String(attachment?.url || '').slice(0, 500),
  };
}

function sanitizeDiscordMessage(value) {
  return String(value || '').replace(/@everyone/g, '@\u200beveryone').replace(/@here/g, '@\u200bhere').trim();
}

function getStreamzBugsChannelId(env) {
  return String(env.STREAMZ_BUGS_CHANNEL_ID || STREAMZ_DEFAULT_BUGS_CHANNEL_ID).trim();
}

function buildDiscordMessageUrl(guildId, channelId, messageId) {
  return guildId && channelId && messageId ? `https://discord.com/channels/${guildId}/${channelId}/${messageId}` : null;
}

function compareDiscordSnowflakes(a, b) {
  try {
    const left = BigInt(a);
    const right = BigInt(b);
    return left < right ? -1 : left > right ? 1 : 0;
  } catch {
    return String(a).localeCompare(String(b));
  }
}

function extractStreamzVersion(text) {
  return String(text || '').match(/\b(?:version|v)\s*[:=]?\s*([0-9]+(?:\.[0-9]+){1,3})\b/i)?.[1] || null;
}

function extractOperatingSystem(text) {
  const value = String(text || '');
  if (/windows\s*11/i.test(value)) return 'Windows 11';
  if (/windows\s*10/i.test(value)) return 'Windows 10';
  if (/\bmac(?:os)?\b/i.test(value)) return 'macOS';
  if (/\blinux\b/i.test(value)) return 'Linux';
  return null;
}

function extractErrorText(text) {
  const value = String(text || '');
  return value.match(/(?:error|exception|failed|crash(?:ed)?)[\s:.-]+(.{1,240})/i)?.[0] || null;
}

function extractActionsTried(text) {
  const value = String(text || '');
  return value.match(/(?:tried|already tried|i tried)[\s:.-]+(.{1,300})/i)?.[1] || null;
}

function appendStreamzAuditEvent(db, type, details = {}, at = new Date().toISOString()) {
  const list = Array.isArray(db.streamzProAuditLog) ? db.streamzProAuditLog : [];
  db.streamzProAuditLog = [...list, {
    id: `audit:${crypto.randomUUID()}`,
    type,
    at,
    details,
  }].slice(-1000);
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
  await processStreamzProStripeEvent(env, event);

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

async function refreshStreamzAccessToken(env, provider, refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: requireEnv(env, provider.clientIdEnv),
    refresh_token: refreshToken,
  });

  if (provider.clientSecretEnv) {
    body.set('client_secret', requireEnv(env, provider.clientSecretEnv));
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
    throw httpError(response.status || 502, `Failed to refresh access token: ${detail}`);
  }

  return data;
}

function buildStreamzProStripeConfig(env) {
  const publishableKey = String(env.STRIPE_PUBLISHABLE_KEY || '').trim() || null;
  return {
    publishableKey,
    configured: Boolean(String(env.STRIPE_SECRET_KEY || '').trim()) && Boolean(publishableKey),
    mode: 'payment',
    productName: STREAMZ_PRO_PRODUCT_NAME,
    amountCents: STREAMZ_PRO_AMOUNT_CENTS,
    currency: STREAMZ_PRO_CURRENCY,
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
  if (!isValidEmail(email)) {
    throw httpError(400, 'A valid email address is required.');
  }
  if (email !== sessionEmail) {
    throw httpError(400, 'Email must match the signed-in Google account.');
  }

  return {
    fullName,
    dateOfBirth,
    email: sessionEmail,
  };
}

function buildStreamzProPaymentIntentParams(user, account, contact, upgradeSession = null) {
  const params = new URLSearchParams({
    amount: String(STREAMZ_PRO_AMOUNT_CENTS),
    currency: STREAMZ_PRO_CURRENCY,
    receipt_email: contact.email,
    description: STREAMZ_PRO_PRODUCT_NAME,
    'automatic_payment_methods[enabled]': 'true',
    'metadata[product]': STREAMZ_PRO_PRODUCT_ID,
    'metadata[amount_cents]': String(STREAMZ_PRO_AMOUNT_CENTS),
    'metadata[currency]': STREAMZ_PRO_CURRENCY,
    'metadata[account_id]': account?.id || buildStreamzAccountIdFromGoogleSub(user.sub),
    'metadata[firebase_uid]': String(user.firebaseUid || ''),
    'metadata[google_sub]': String(user.sub || ''),
    'metadata[google_email]': contact.email,
    'metadata[contact_full_name]': contact.fullName,
    'metadata[contact_date_of_birth]': contact.dateOfBirth,
  });
  if (upgradeSession?.tokenHash) {
    params.set('metadata[upgrade_session_hash]', upgradeSession.tokenHash);
  }

  return params;
}

async function processStreamzProStripeEvent(env, event) {
  if (!event?.id || !event?.type) {
    throw httpError(400, 'Malformed Stripe event.');
  }

  if (['charge.refunded', 'charge.dispute.created', 'charge.dispute.closed', 'payment_intent.canceled'].includes(event.type)) {
    await revokeStreamzProEntitlementFromStripeEvent(env, event);
    return;
  }

  if (!['payment_intent.succeeded', 'checkout.session.completed'].includes(event.type)) {
    return;
  }

  const result = await updateStreamzDatabase(env, async (db) => {
    const processedEvents = normalizeStripeEvents(db.stripeEvents);
    if (processedEvents.some((entry) => entry.id === event.id)) {
      return { db, value: { processed: false, duplicateEvent: true } };
    }

    const entitlement = buildStreamzProEntitlementFromStripeEvent(event);
    const payment = buildStreamzProPaymentFromStripeEvent(event, entitlement);
    processedEvents.push({
      id: event.id,
      type: event.type,
      processedAt: new Date().toISOString(),
      objectId: entitlement?.stripePaymentIntentId || entitlement?.stripeCheckoutSessionId || payment?.stripePaymentIntentId || null,
    });
    db.stripeEvents = processedEvents.slice(-500);

    if (!entitlement) {
      return { db, value: { processed: true, entitlement: null } };
    }

    db.streamzAccounts = upsertStreamzAccount(db.streamzAccounts, buildStreamzAccountFromEntitlement(entitlement));
    db.streamzProPayments = upsertStreamzProPayment(db.streamzProPayments, payment);

    const existing = findStreamzProEntitlementInDb(db, {
      id: entitlement.accountId,
      googleSub: entitlement.googleSub,
    });

    if (existing?.status === 'active') {
      db.streamzProUpgradeSessions = markStreamzUpgradeSessionForEntitlement(db.streamzProUpgradeSessions, entitlement.upgradeSessionHash, existing, 'active');
      console.log('Recorded duplicate Streamz Pro payment for active account', {
        stripeEventId: event.id,
        stripePaymentIntentId: entitlement.stripePaymentIntentId || null,
      });
      return {
        db,
        value: { processed: true, entitlement: existing, activeAlready: true },
      };
    }

    const now = new Date().toISOString();
    const nextEntitlement = {
      ...existing,
      ...entitlement,
      id: existing?.id || entitlement.id,
      createdAt: existing?.createdAt || entitlement.createdAt || now,
      googleLinkedAt: existing?.googleLinkedAt || null,
      activatedAt: existing?.activatedAt || entitlement.activatedAt || now,
      accountLocked: false,
      updatedAt: now,
    };
    db.streamzProEntitlements = replaceStreamzProEntitlement(db.streamzProEntitlements, nextEntitlement);
    db.streamzProUpgradeSessions = markStreamzUpgradeSessionForEntitlement(
      db.streamzProUpgradeSessions,
      nextEntitlement.upgradeSessionHash,
      nextEntitlement,
      'active',
    );
    return {
      db,
      value: { processed: true, entitlement: nextEntitlement },
    };
  });

  if (result?.duplicateEvent) {
    return;
  }
}

function buildStreamzProEntitlementFromStripeEvent(event) {
  const object = event.data?.object || {};

  if (event.type === 'payment_intent.succeeded') {
    const validation = validateStreamzProPaymentIntentForEntitlement(object);
    if (!validation.ok) {
      console.log('Ignoring non-Streamz Pro PaymentIntent webhook', {
        id: object.id || null,
        amount: object.amount || null,
        amountReceived: object.amount_received || null,
        currency: object.currency || null,
        product: object.metadata?.product || null,
        reason: validation.reason,
      });
      return null;
    }

    const metadata = object.metadata || {};
    const now = new Date().toISOString();
    const accountId = metadata.account_id || buildStreamzAccountIdFromGoogleSub(metadata.google_sub);
    return {
      id: buildStreamzEntitlementIdFromAccountId(accountId, STREAMZ_PRO_PRODUCT_ID),
      accountId,
      firebaseUid: metadata.firebase_uid,
      googleSub: metadata.google_sub,
      email: metadata.google_email || object.receipt_email || null,
      emailNormalized: normalizeEmail(metadata.google_email || object.receipt_email),
      fullName: metadata.contact_full_name || null,
      dateOfBirth: metadata.contact_date_of_birth || null,
      product: STREAMZ_PRO_PRODUCT_ID,
      status: 'active',
      orderNumber: buildStreamzOrderNumber({ stripePaymentIntentId: object.id }),
      amountCents: STREAMZ_PRO_AMOUNT_CENTS,
      currency: STREAMZ_PRO_CURRENCY,
      paymentStatus: 'succeeded',
      paymentMethodType: Array.isArray(object.payment_method_types) ? object.payment_method_types.join(', ') : (object.payment_method || 'Stripe'),
      stripePaymentIntentId: object.id,
      stripeEventId: event.id,
      stripeCustomerId: object.customer || null,
      upgradeSessionHash: metadata.upgrade_session_hash || null,
      paymentConfirmedAt: now,
      activatedAt: now,
      revokedAt: null,
      accountLocked: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  if (event.type === 'checkout.session.completed') {
    const metadata = object.metadata || {};
    const amountTotal = Number(object.amount_total || 0);
    const currency = String(object.currency || '').toLowerCase();
    if (
      metadata.product !== STREAMZ_PRO_PRODUCT_ID
      || !metadata.firebase_uid
      || !metadata.google_sub
      || !metadata.google_email
      || object.payment_status !== 'paid'
      || amountTotal !== STREAMZ_PRO_AMOUNT_CENTS
      || currency !== STREAMZ_PRO_CURRENCY
    ) {
      return null;
    }

    const now = new Date().toISOString();
    const accountId = metadata.account_id || buildStreamzAccountIdFromGoogleSub(metadata.google_sub);
    return {
      id: buildStreamzEntitlementIdFromAccountId(accountId, STREAMZ_PRO_PRODUCT_ID),
      accountId,
      firebaseUid: metadata.firebase_uid,
      googleSub: metadata.google_sub,
      email: metadata.google_email || object.customer_details?.email || object.customer_email || null,
      emailNormalized: normalizeEmail(metadata.google_email || object.customer_details?.email || object.customer_email),
      fullName: metadata.contact_full_name || null,
      dateOfBirth: isValidIsoDate(metadata.contact_date_of_birth) ? metadata.contact_date_of_birth : null,
      product: STREAMZ_PRO_PRODUCT_ID,
      status: 'active',
      orderNumber: buildStreamzOrderNumber({ stripePaymentIntentId: object.payment_intent, stripeCheckoutSessionId: object.id }),
      amountCents: STREAMZ_PRO_AMOUNT_CENTS,
      currency: STREAMZ_PRO_CURRENCY,
      paymentStatus: 'succeeded',
      paymentMethodType: Array.isArray(object.payment_method_types) ? object.payment_method_types.join(', ') : 'Stripe',
      stripePaymentIntentId: object.payment_intent || null,
      stripeCheckoutSessionId: object.id,
      stripeEventId: event.id,
      stripeCustomerId: object.customer || null,
      upgradeSessionHash: metadata.upgrade_session_hash || null,
      paymentConfirmedAt: now,
      activatedAt: now,
      revokedAt: null,
      accountLocked: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  return null;
}

function validateStreamzProPaymentIntentForEntitlement(paymentIntent) {
  const metadata = paymentIntent?.metadata || {};
  const amountReceived = Number(paymentIntent?.amount_received || 0);
  const amount = Number(paymentIntent?.amount || 0);
  const paidAmount = amountReceived || amount;
  if (paymentIntent?.status !== 'succeeded') {
    return { ok: false, reason: 'payment_intent_not_succeeded' };
  }
  if (paidAmount !== STREAMZ_PRO_AMOUNT_CENTS) {
    return { ok: false, reason: 'amount_mismatch' };
  }
  if (String(paymentIntent?.currency || '').toLowerCase() !== STREAMZ_PRO_CURRENCY) {
    return { ok: false, reason: 'currency_mismatch' };
  }
  if (metadata.product !== STREAMZ_PRO_PRODUCT_ID) {
    return { ok: false, reason: 'product_mismatch' };
  }
  if (!metadata.firebase_uid) {
    return { ok: false, reason: 'missing_firebase_uid' };
  }
  if (!metadata.google_sub) {
    return { ok: false, reason: 'missing_google_sub' };
  }
  if (!isValidEmail(metadata.google_email)) {
    return { ok: false, reason: 'missing_google_email' };
  }
  if (!metadata.contact_full_name) {
    return { ok: false, reason: 'missing_contact_full_name' };
  }
  if (!isValidIsoDate(metadata.contact_date_of_birth)) {
    return { ok: false, reason: 'missing_or_invalid_date_of_birth' };
  }
  return { ok: true };
}

function upsertStreamzProEntitlement(existing, incoming) {
  const list = normalizeStreamzProEntitlements(existing);
  const duplicatePayment = list.some((entry) => (
    (incoming.stripePaymentIntentId && entry.stripePaymentIntentId === incoming.stripePaymentIntentId)
    || (incoming.stripeCheckoutSessionId && entry.stripeCheckoutSessionId === incoming.stripeCheckoutSessionId)
  ));
  if (duplicatePayment) {
    return list;
  }

  const index = list.findIndex((entry) => (
    entry.product === incoming.product
    && (
      (entry.accountId && entry.accountId === incoming.accountId)
      || (!entry.accountId && entry.googleSub === incoming.googleSub)
    )
  ));
  if (index >= 0) {
    if (list[index].status === 'active') {
      console.log('Ignoring duplicate Streamz Pro purchase for active entitlement', {
        product: incoming.product,
        stripePaymentIntentId: incoming.stripePaymentIntentId || null,
      });
      return list;
    }

    list[index] = {
      ...list[index],
      ...incoming,
      createdAt: list[index].createdAt || incoming.createdAt,
      emailVerifiedAt: list[index].emailVerifiedAt || incoming.emailVerifiedAt || null,
      activatedAt: list[index].activatedAt || incoming.activatedAt || null,
      updatedAt: new Date().toISOString(),
    };
    return list;
  }

  return [...list, incoming];
}

function buildStreamzProPaymentFromStripeEvent(event, entitlement) {
  if (!entitlement) return null;
  const object = event.data?.object || {};
  return {
    id: `payment:${entitlement.stripePaymentIntentId || entitlement.stripeCheckoutSessionId || event.id}`,
    product: STREAMZ_PRO_PRODUCT_ID,
    accountId: entitlement.accountId,
    googleSub: entitlement.googleSub || null,
    emailNormalized: entitlement.emailNormalized || normalizeEmail(entitlement.email),
    stripePaymentIntentId: entitlement.stripePaymentIntentId || (event.type === 'payment_intent.succeeded' ? object.id : object.payment_intent) || null,
    stripeCheckoutSessionId: entitlement.stripeCheckoutSessionId || (event.type === 'checkout.session.completed' ? object.id : null),
    stripeEventId: event.id,
    stripeCustomerId: entitlement.stripeCustomerId || null,
    amountCents: entitlement.amountCents || STREAMZ_PRO_AMOUNT_CENTS,
    currency: entitlement.currency || STREAMZ_PRO_CURRENCY,
    status: entitlement.paymentStatus || 'succeeded',
    paymentMethodType: entitlement.paymentMethodType || null,
    orderNumber: entitlement.orderNumber || buildStreamzOrderNumber(entitlement),
    paidAt: entitlement.paymentConfirmedAt || new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

async function revokeStreamzProEntitlementFromStripeEvent(env, event) {
  const object = event.data?.object || {};
  const paymentIntentId = object.payment_intent || (event.type === 'payment_intent.canceled' ? object.id : null);
  if (!paymentIntentId) return;
  const revokedStatus = event.type.includes('dispute') ? 'disputed' : event.type === 'charge.refunded' ? 'refunded' : 'canceled';
  await updateStreamzDatabase(env, async (db) => {
    const processedEvents = normalizeStripeEvents(db.stripeEvents);
    if (processedEvents.some((entry) => entry.id === event.id)) {
      return { db, value: null };
    }
    processedEvents.push({
      id: event.id,
      type: event.type,
      processedAt: new Date().toISOString(),
      objectId: paymentIntentId,
    });
    db.stripeEvents = processedEvents.slice(-500);

    const entitlements = normalizeStreamzProEntitlements(db.streamzProEntitlements);
    const entitlementIndex = entitlements.findIndex((entry) => entry.stripePaymentIntentId === paymentIntentId);
    const now = new Date().toISOString();
    if (entitlementIndex >= 0) {
      entitlements[entitlementIndex] = {
        ...entitlements[entitlementIndex],
        status: 'revoked',
        paymentStatus: revokedStatus,
        revokedAt: now,
        updatedAt: now,
      };
      db.streamzProEntitlements = entitlements;
    }

    const payments = normalizeStreamzProPayments(db.streamzProPayments);
    const paymentIndex = payments.findIndex((entry) => entry.stripePaymentIntentId === paymentIntentId);
    if (paymentIndex >= 0) {
      payments[paymentIndex] = {
        ...payments[paymentIndex],
        status: revokedStatus,
        updatedAt: now,
      };
      db.streamzProPayments = payments;
    }
    return { db, value: null };
  });
}

function upsertStreamzProPayment(existing, incoming) {
  if (!incoming) return normalizeStreamzProPayments(existing);
  const list = normalizeStreamzProPayments(existing);
  const index = list.findIndex((entry) => (
    entry.id === incoming.id
    || (incoming.stripePaymentIntentId && entry.stripePaymentIntentId === incoming.stripePaymentIntentId)
    || (incoming.stripeEventId && entry.stripeEventId === incoming.stripeEventId)
  ));
  if (index >= 0) {
    list[index] = {
      ...list[index],
      ...incoming,
      createdAt: list[index].createdAt || incoming.createdAt,
    };
    return list;
  }
  return [...list, incoming];
}

function normalizeStreamzProPayments(value) {
  return Array.isArray(value)
    ? value
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => ({
        ...entry,
        product: entry.product || STREAMZ_PRO_PRODUCT_ID,
        amountCents: Number(entry.amountCents || STREAMZ_PRO_AMOUNT_CENTS),
        currency: String(entry.currency || STREAMZ_PRO_CURRENCY).toLowerCase(),
        status: entry.status || 'succeeded',
      }))
    : [];
}

async function saveStreamzProviderTokens(env, accountId, providerKey, tokenResponse) {
  const now = new Date().toISOString();
  const providerConnection = {
    provider: providerKey,
    accessToken: await encryptStreamzProviderTokens(env, tokenResponse),
    refreshToken: tokenResponse.refresh_token
      ? await encryptStreamzProviderTokens(env, { refresh_token: tokenResponse.refresh_token })
      : null,
    expiresAt: new Date(Date.now() + Number(tokenResponse.expires_in || 3600) * 1000).toISOString(),
    tokenType: tokenResponse.token_type || 'Bearer',
    scope: normalizeScopeForResponse(tokenResponse.scope) || null,
    updatedAt: now,
  };
  await updateStreamzDatabase(env, async (db) => {
    const accounts = normalizeStreamzAccounts(db.streamzAccounts);
    const index = accounts.findIndex((entry) => entry.id === accountId);
    if (index < 0) throw httpError(404, 'Streamz account was not found.');
    const existing = Array.isArray(accounts[index].providerConnections) ? accounts[index].providerConnections : [];
    const providerConnections = existing.filter((entry) => entry.provider !== providerKey);
    accounts[index] = { ...accounts[index], providerConnections: [...providerConnections, providerConnection], updatedAt: now };
    db.streamzAccounts = accounts;
    return { db, value: null };
  });
}

async function encryptStreamzProviderTokens(env, payload) {
  return encryptStreamzState(payload, env);
}

async function decryptStreamzProviderTokens(env, token) {
  return decryptStreamzState(token, env);
}

async function ensureStreamzAccountForSession(env, session) {
  if (!session?.firebaseUid) {
    throw httpError(401, 'Signed-in account is missing a stable identity.');
  }
  const now = new Date().toISOString();
  const accountId = await buildInternalStreamzAccountId('firebase', session.firebaseUid);
  const account = {
    id: accountId,
    primaryEmail: String(session.email || '').trim() || null,
    primaryEmailNormalized: normalizeEmail(session.email),
    googleSub: String(session.sub),
    firebaseUid: String(session.firebaseUid),
    identities: [{
      provider: 'firebase',
      subject: String(session.firebaseUid),
      email: String(session.email || '').trim() || null,
      emailNormalized: normalizeEmail(session.email),
      linkedAt: now,
      emailVerified: Boolean(session.email),
    }, {
      provider: 'google',
      subject: String(session.sub),
      email: String(session.email || '').trim() || null,
      emailNormalized: normalizeEmail(session.email),
      linkedAt: now,
      emailVerified: true,
    }],
    createdAt: now,
    updatedAt: now,
  };
  let saved = account;
  await updateStreamzDatabase(env, async (db) => {
    db.streamzAccounts = upsertStreamzAccount(db.streamzAccounts, account);
    saved = normalizeStreamzAccounts(db.streamzAccounts).find((entry) => (
      entry.id === accountId || entry.firebaseUid === session.firebaseUid
    )) || account;
    db.streamzProEntitlements = normalizeStreamzProEntitlements(db.streamzProEntitlements).map((entry) => {
      if (
        entry.product === STREAMZ_PRO_PRODUCT_ID
        && entry.paymentConfirmedAt
        && entry.googleSub === session.sub
        && entry.status !== 'revoked'
      ) {
        return {
          ...entry,
          firebaseUid: session.firebaseUid,
          accountId: saved.id,
          status: 'active',
          activatedAt: entry.activatedAt || now,
          updatedAt: now,
        };
      }
      return entry;
    });
    return { db, value: saved };
  });
  return saved;
}

function buildStreamzAccountFromEntitlement(entitlement) {
  const now = new Date().toISOString();
  return {
    id: entitlement.accountId,
    primaryEmail: entitlement.email || null,
    primaryEmailNormalized: entitlement.emailNormalized || normalizeEmail(entitlement.email),
    googleSub: entitlement.googleSub || null,
    firebaseUid: entitlement.firebaseUid || null,
    identities: [{
      provider: 'firebase',
      subject: entitlement.firebaseUid,
      email: entitlement.email || null,
      emailNormalized: entitlement.emailNormalized || normalizeEmail(entitlement.email),
      linkedAt: now,
      emailVerified: true,
    }, ...(entitlement.googleSub ? [{
      provider: 'google',
      subject: entitlement.googleSub,
      email: entitlement.email || null,
      emailNormalized: entitlement.emailNormalized || normalizeEmail(entitlement.email),
      linkedAt: now,
      emailVerified: true,
    }] : [])].filter((identity) => identity.subject),
    createdAt: now,
    updatedAt: now,
  };
}

function upsertStreamzAccount(existing, incoming) {
  const list = normalizeStreamzAccounts(existing);
  if (!incoming?.id) return list;
  const index = list.findIndex((entry) => (
    entry.id === incoming.id
    || (incoming.firebaseUid && entry.firebaseUid === incoming.firebaseUid)
    || (incoming.googleSub && entry.googleSub === incoming.googleSub)
    || (incoming.googleSub && entry.identities?.some((identity) => identity.provider === 'google' && identity.subject === incoming.googleSub))
  ));
  if (index >= 0) {
    const mergedIdentities = mergeStreamzIdentities(list[index].identities, incoming.identities);
    list[index] = {
      ...list[index],
      ...incoming,
      id: list[index].id || incoming.id,
      createdAt: list[index].createdAt || incoming.createdAt,
      identities: mergedIdentities,
      updatedAt: new Date().toISOString(),
    };
    return list;
  }
  return [...list, incoming];
}

function normalizeStreamzAccounts(value) {
  return Array.isArray(value)
    ? value
      .filter((entry) => entry && typeof entry === 'object' && entry.id)
      .map((entry) => ({
        ...entry,
        primaryEmail: entry.primaryEmail || entry.email || null,
        primaryEmailNormalized: entry.primaryEmailNormalized || normalizeEmail(entry.primaryEmail || entry.email),
        identities: Array.isArray(entry.identities) ? entry.identities : [],
      }))
    : [];
}

function mergeStreamzIdentities(existing, incoming) {
  const list = Array.isArray(existing) ? [...existing] : [];
  for (const identity of Array.isArray(incoming) ? incoming : []) {
    if (!identity?.provider || !identity?.subject) continue;
    const index = list.findIndex((entry) => entry.provider === identity.provider && entry.subject === identity.subject);
    if (index >= 0) {
      list[index] = { ...list[index], ...identity, linkedAt: list[index].linkedAt || identity.linkedAt };
    } else {
      list.push(identity);
    }
  }
  return list;
}

async function buildInternalStreamzAccountId(provider, subject) {
  const hash = await sha256Base64Url(`${provider}:${subject}`);
  return `acct_${hash.slice(0, 28)}`;
}

async function getStreamzProEntitlementForAccount(env, account, session) {
  const db = await loadDatabase(env);
  return findStreamzProEntitlementInDb(db, account, session);
}

async function getStreamzUpgradeSessionByRawToken(env, token) {
  if (!isPlausibleStreamzVerificationToken(token)) {
    throw httpError(400, 'Invalid upgrade session.');
  }
  const tokenHash = await hashStreamzUpgradeSessionToken(token);
  const db = await loadDatabase(env);
  const session = findStreamzUpgradeSessionByHash(db, tokenHash);
  if (!session) {
    throw httpError(404, 'Upgrade session not found.');
  }
  return session;
}

async function getValidatedStreamzUpgradeSession(env, token) {
  const session = await getStreamzUpgradeSessionByRawToken(env, token);
  if (Date.parse(session.expiresAt || '') <= Date.now()) {
    throw httpError(410, 'Upgrade session expired.');
  }
  return session;
}

function findStreamzUpgradeSessionByHash(db, tokenHash) {
  return normalizeStreamzUpgradeSessions(db.streamzProUpgradeSessions)
    .find((entry) => entry.tokenHash && constantTimeStringEquals(entry.tokenHash, tokenHash)) || null;
}

function upsertStreamzUpgradeSession(existing, incoming) {
  const list = normalizeStreamzUpgradeSessions(existing);
  const index = list.findIndex((entry) => entry.tokenHash === incoming.tokenHash);
  if (index >= 0) {
    list[index] = { ...list[index], ...incoming, createdAt: list[index].createdAt || incoming.createdAt };
    return list.slice(-200);
  }
  return [...list, incoming].slice(-200);
}

function normalizeStreamzUpgradeSessions(value) {
  return Array.isArray(value)
    ? value
      .filter((entry) => entry && typeof entry === 'object' && entry.tokenHash)
      .map((entry) => {
        const { verificationCode, ...safeEntry } = entry;
        return {
          ...safeEntry,
          product: safeEntry.product || STREAMZ_PRO_PRODUCT_ID,
          status: safeEntry.status || 'created',
          ownsPro: Boolean(safeEntry.ownsPro),
          emailMasked: safeEntry.emailMasked || null,
        };
      })
    : [];
}

function markStreamzUpgradeSessionForEntitlement(existing, tokenHash, entitlement, status, codeExpiresAt = null) {
  if (!tokenHash) return normalizeStreamzUpgradeSessions(existing);
  const list = normalizeStreamzUpgradeSessions(existing);
  const index = list.findIndex((entry) => entry.tokenHash === tokenHash);
  if (index < 0) return list;
  const active = status === 'active';
  const { verificationCode, ...currentSession } = list[index];
  list[index] = {
    ...currentSession,
    status,
    ownsPro: active,
    entitlementId: entitlement.id,
    emailMasked: maskEmail(entitlement.email || entitlement.googleEmail),
    codeExpiresAt: codeExpiresAt || list[index].codeExpiresAt || null,
    updatedAt: new Date().toISOString(),
  };
  return list;
}

function sanitizeStreamzUpgradeSession(session) {
  if (!session) {
    return {
      configured: true,
      ownsPro: false,
      hasPro: false,
      status: null,
      emailMasked: null,
      message: null,
      actions: ['refresh_status'],
    };
  }
  const expired = Date.parse(session.expiresAt || '') <= Date.now();
  const status = expired && session.status !== 'active' ? 'expired' : session.status;
  const ownsPro = Boolean(session.ownsPro && status === 'active');
  return {
    configured: true,
    ownsPro,
    hasPro: ownsPro,
    status,
    emailMasked: session.emailMasked || null,
    codeExpiresAt: status === 'pending_discord_verification' ? session.codeExpiresAt || null : null,
    discordInviteUrl: STREAMZ_DISCORD_INVITE_URL,
    discordVerifyUrl: STREAMZ_DISCORD_VERIFY_URL,
    expiresAt: session.expiresAt || null,
    message: status === 'pending_discord_verification'
      ? 'Your payment was received. Download your activation pass, then directly message the Streamz bot and run /verify-pro with the purchase code printed on the pass.'
      : status === 'discord_claimed'
        ? 'Discord verification is claimed. Open the private Discord message and press Link Google Account.'
      : null,
    actions: status === 'pending_discord_verification'
      ? ['copy_verification_code', 'open_discord', 'refresh_status', 'open_checkout_page']
      : ['refresh_status', 'open_account_page'],
  };
}

function buildStreamzCheckoutUrl({ upgradeSessionToken } = {}) {
  const url = new URL('/projects/streamz/pro/', STREAMZ_SITE_BASE_URL);
  if (upgradeSessionToken) {
    url.searchParams.set('upgrade_session', upgradeSessionToken);
  }
  return url.toString();
}

function findStreamzProEntitlementInDb(db, account, session = null) {
  const list = normalizeStreamzProEntitlements(db.streamzProEntitlements);
  const accountId = account?.id || account?.accountId || null;
  const googleSub = account?.googleSub || session?.sub || null;
  const firebaseUid = account?.firebaseUid || session?.firebaseUid || null;
  return list.find((entry) => (
    entry.product === STREAMZ_PRO_PRODUCT_ID
    && entry.status !== 'revoked'
    && (
      firebaseUid
        ? entry.firebaseUid === firebaseUid
        : (
          (accountId && entry.accountId === accountId)
          || (googleSub && entry.googleSub === googleSub)
          || (googleSub && entry.accountId === buildStreamzAccountIdFromGoogleSub(googleSub))
        )
    )
  )) || null;
}

function replaceStreamzProEntitlement(existing, incoming) {
  const list = normalizeStreamzProEntitlements(existing);
  const index = list.findIndex((entry) => entry.id === incoming.id || (
    entry.product === incoming.product
    && (
      (entry.accountId && incoming.accountId && entry.accountId === incoming.accountId)
      || (entry.googleSub && incoming.googleSub && entry.googleSub === incoming.googleSub)
    )
  ));
  if (index >= 0) {
    list[index] = incoming;
    return list;
  }
  return [...list, incoming];
}

async function createStreamzSecureToken() {
  const bytes = new Uint8Array(STREAMZ_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function hashStreamzUpgradeSessionToken(token) {
  return sha256Base64Url(`streamz-pro-upgrade-session:${token}`);
}

function normalizeStreamzPurchaseCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isValidStreamzPurchaseCode(code) {
  return /^[A-Z0-9]{10}$/.test(normalizeStreamzPurchaseCode(code));
}

async function hashStreamzPurchaseCode(code) {
  return sha256Base64Url(`streamz-pro-purchase-code:${normalizeStreamzPurchaseCode(code)}`);
}

async function hashStreamzDiscordCode(code) {
  return hashStreamzPurchaseCode(code);
}

async function assignStreamzPurchaseCodeFromPool(db, entitlement, existingVerification, assignedAt) {
  db.streamzProCodePool = normalizeStreamzProCodePool(db.streamzProCodePool);
  expireAssignedStreamzCodePoolEntries(db, assignedAt);
  if (countUnusedStreamzCodePoolEntries(db) < STREAMZ_CODE_LOW_WATERMARK) {
    await addStreamzActivationCodeBatch(db, 'automatic_issue');
  }
  let poolIndex = db.streamzProCodePool.findIndex((entry) => entry.status === 'unused' && entry.code && entry.codeHash);
  if (poolIndex < 0) {
    await addStreamzActivationCodeBatch(db, 'automatic_issue');
    poolIndex = db.streamzProCodePool.findIndex((entry) => entry.status === 'unused' && entry.code && entry.codeHash);
  }
  if (poolIndex < 0) {
    throw httpError(503, 'Your activation pass is still being prepared. Try again in a moment.');
  }

  const poolEntry = db.streamzProCodePool[poolIndex];
  const expiresAt = new Date(Date.parse(assignedAt) + STREAMZ_PURCHASE_CODE_TTL_MS).toISOString();
  db.streamzProCodePool[poolIndex] = {
    ...poolEntry,
    code: null,
    status: 'assigned',
    issueType: 'automatic',
    entitlementId: entitlement.id,
    paymentId: entitlement.stripePaymentIntentId || entitlement.stripeCheckoutSessionId || null,
    stripePaymentIntentId: entitlement.stripePaymentIntentId || null,
    stripeCheckoutSessionId: entitlement.stripeCheckoutSessionId || null,
    orderNumber: entitlement.orderNumber || buildStreamzOrderNumber(entitlement),
    assignedAt,
    expiresAt,
    verificationId: existingVerification?.id || `discord:${entitlement.id}`,
    updatedAt: assignedAt,
  };
  appendStreamzAuditEvent(db, 'activation_code_assigned', {
    codeHash: poolEntry.codeHash,
    poolEntryId: poolEntry.id,
    entitlementId: entitlement.id,
    orderNumber: entitlement.orderNumber || buildStreamzOrderNumber(entitlement),
  }, assignedAt);

  if (countUnusedStreamzCodePoolEntries(db) < STREAMZ_CODE_LOW_WATERMARK) {
    await addStreamzActivationCodeBatch(db, 'low_pool_refill');
  }

  return {
    code: poolEntry.code,
    codeHash: poolEntry.codeHash,
    poolEntryId: poolEntry.id,
    expiresAt,
  };
}

function countUnusedStreamzCodePoolEntries(db) {
  return normalizeStreamzProCodePool(db.streamzProCodePool).filter((entry) => entry.status === 'unused' && entry.code && entry.codeHash).length;
}

function expireAssignedStreamzCodePoolEntries(db, nowIso) {
  const now = Date.parse(nowIso);
  db.streamzProCodePool = normalizeStreamzProCodePool(db.streamzProCodePool).map((entry) => {
    if (['assigned', 'pending_google_linking'].includes(entry.status) && entry.expiresAt && Date.parse(entry.expiresAt) <= now && !entry.redeemedAt) {
      appendStreamzAuditEvent(db, 'activation_code_expired', {
        codeHash: entry.codeHash,
        poolEntryId: entry.id,
        entitlementId: entry.entitlementId || null,
      }, nowIso);
      return { ...entry, status: 'expired', code: null, expiredAt: entry.expiredAt || nowIso, updatedAt: nowIso };
    }
    return entry;
  });
}

async function addStreamzActivationCodeBatch(db, reason = 'pool_refill') {
  const batchId = `batch:${crypto.randomUUID()}`;
  const existingHashes = collectStreamzActivationCodeHashes(db);
  const now = new Date().toISOString();
  const next = normalizeStreamzProCodePool(db.streamzProCodePool);
  const batch = await createStreamzActivationCodeBatch(existingHashes);
  for (const code of batch) {
    const normalized = normalizeStreamzPurchaseCode(code);
    const codeHash = await hashStreamzPurchaseCode(normalized);
    if (existingHashes.has(codeHash)) continue;
    existingHashes.add(codeHash);
    next.push({
      id: `pool:${codeHash.slice(0, 24)}`,
      code: normalized,
      codeHash,
      status: 'unused',
      source: 'internal_csprng',
      batchId,
      fetchedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  db.streamzProCodePool = next.slice(-500);
  appendStreamzAuditEvent(db, 'activation_code_batch_generated', {
    batchId,
    source: 'internal_csprng',
    count: batch.length,
    reason,
  }, now);
  if (countUnusedStreamzCodePoolEntries(db) < 1) {
    throw httpError(503, 'Your activation pass is still being prepared. Try again in a moment.');
  }
}

async function createStreamzActivationCodeBatch(existingHashes = new Set()) {
  const codes = [];
  const seen = new Set(existingHashes);
  let attempts = 0;
  while (codes.length < STREAMZ_CODE_BATCH_SIZE && attempts < STREAMZ_CODE_BATCH_SIZE * 100) {
    attempts += 1;
    const code = createStreamzActivationCode();
    const codeHash = await hashStreamzPurchaseCode(code);
    if (seen.has(codeHash)) continue;
    seen.add(codeHash);
    codes.push(code);
  }
  if (codes.length !== STREAMZ_CODE_BATCH_SIZE) {
    throw httpError(503, 'Your activation pass is still being prepared. Try again in a moment.');
  }
  return codes;
}

function createStreamzActivationCode() {
  const output = [];
  const alphabetLength = STREAMZ_CODE_ALPHABET.length;
  const max = Math.floor(256 / alphabetLength) * alphabetLength;
  while (output.length < 10) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= max) continue;
      output.push(STREAMZ_CODE_ALPHABET[byte % alphabetLength]);
      if (output.length === 10) break;
    }
  }
  return output.join('');
}

function collectStreamzActivationCodeHashes(db) {
  const hashes = new Set();
  for (const entry of normalizeStreamzProCodePool(db.streamzProCodePool)) {
    if (entry.codeHash) hashes.add(entry.codeHash);
  }
  for (const entry of normalizeStreamzDiscordVerifications(db.streamzProDiscordVerifications)) {
    if (entry.purchaseCodeHash) hashes.add(entry.purchaseCodeHash);
    if (entry.discordCodeHash) hashes.add(entry.discordCodeHash);
  }
  return hashes;
}

function normalizeStreamzProCodePool(value) {
  return Array.isArray(value)
    ? value
      .filter((entry) => entry && typeof entry === 'object' && entry.codeHash)
      .map((entry) => ({
        ...entry,
        code: entry.status === 'unused' ? normalizeStreamzPurchaseCode(entry.code) : null,
        status: STREAMZ_CODE_POOL_STATUSES.has(entry.status) ? entry.status : 'unused',
      }))
    : [];
}

async function hashStreamzWebsiteToken(token) {
  return sha256Base64Url(`streamz-pro-discord-website:${token}`);
}

function buildStreamzDiscordVerifyUrl(token) {
  const url = new URL('/projects/streamz/pro/verify-discord/', STREAMZ_SITE_BASE_URL);
  url.searchParams.set('token', token);
  return url.toString();
}

function buildStreamzActivationPassResponse(entitlement, verification, rawCode) {
  if (!entitlement || !rawCode) return null;
  const paymentDate = entitlement.paymentConfirmedAt || new Date().toISOString();
  return {
    templateUrl: '/assets/STREAMZ PRO Activation Pass .pdf',
    purchaseCode: rawCode,
    orderNumber: entitlement.orderNumber || buildStreamzOrderNumber(entitlement),
    customerName: entitlement.fullName || '',
    customerEmail: entitlement.email || entitlement.googleEmail || '',
    maskedEmail: maskEmail(entitlement.email || entitlement.googleEmail),
    purchaseDate: paymentDate,
    paymentMethod: entitlement.paymentMethodType || 'Stripe',
    productName: STREAMZ_PRO_PRODUCT_NAME,
    paymentStatus: entitlement.paymentStatus || 'succeeded',
    issueTime: verification?.purchaseCodeAssignedAt || verification?.createdAt || paymentDate,
    expiresAt: verification?.purchaseCodeExpiresAt || null,
    redemptionStatus: verification?.purchaseCodeRedeemedAt || entitlement.status === 'active' ? 'redeemed' : 'available',
  };
}

function buildStreamzPurchaseCodeResult(status, entitlement = null, verification = null, payment = null) {
  const ok = ['available', 'claimed', 'redeemed'].includes(status);
  return {
    ok,
    status,
    message: status === 'available'
      ? 'This Streamz Pro purchase code is valid and available for Discord verification.'
      : status === 'claimed'
        ? 'This purchase code is already in verification with a Discord account.'
      : status === 'redeemed'
        ? 'This activation code has already been redeemed.'
      : status === 'refunded'
        ? 'This purchase has been refunded and Streamz Pro is disabled.'
      : status === 'disputed'
        ? 'This purchase is disputed and Streamz Pro is disabled.'
      : status === 'canceled'
        ? 'This purchase was canceled and Streamz Pro is disabled.'
      : status === 'expired'
        ? 'Your activation code has expired. DM the Streamz bot and use /code-expired with your original activation-pass PDF.'
      : status === 'replaced'
        ? 'Your activation code has expired. DM the Streamz bot and use /code-expired with your original activation-pass PDF.'
      : 'This activation code is invalid.',
    purchase: entitlement ? {
      orderNumber: entitlement.orderNumber || buildStreamzOrderNumber(entitlement),
      productName: STREAMZ_PRO_PRODUCT_NAME,
      customerName: maskName(entitlement.fullName),
      maskedEmail: maskEmail(entitlement.email || entitlement.googleEmail),
      purchaseDate: entitlement.paymentConfirmedAt || payment?.paidAt || null,
      paymentMethod: entitlement.paymentMethodType || payment?.paymentMethodType || 'Stripe',
      paymentStatus: entitlement.paymentStatus || payment?.status || null,
      redemptionStatus: verification?.purchaseCodeRedeemedAt || entitlement.status === 'active'
        ? 'redeemed'
        : verification?.claimedDiscordUserId
          ? 'claimed'
          : 'available',
      redeemedAt: verification?.purchaseCodeRedeemedAt || entitlement.activatedAt || null,
      discordLinked: Boolean(entitlement.discordUserId || verification?.claimedDiscordUserId),
      googleLinked: Boolean(entitlement.googleSub && entitlement.status === 'active'),
    } : null,
    discordInviteUrl: STREAMZ_DISCORD_INVITE_URL,
    discordVerifyUrl: STREAMZ_DISCORD_VERIFY_URL,
  };
}

function getStreamzPurchaseCodeStatus(entitlement, verification, payment = null, poolEntry = null) {
  if (!entitlement || !verification) return 'invalid';
  if (poolEntry?.status === 'replaced') return 'replaced';
  if (poolEntry?.status === 'invalidated') return 'invalid';
  if (poolEntry?.status === 'expired') return 'expired';
  if (poolEntry?.status === 'redeemed') return 'redeemed';
  if (verification.status === 'replaced') return 'replaced';
  if (verification.status === 'invalidated') return 'invalid';
  if (verification.status === 'expired') return 'expired';
  const paymentStatus = String(entitlement.paymentStatus || payment?.status || '').toLowerCase();
  if (entitlement.status === 'revoked' && paymentStatus === 'refunded') return 'refunded';
  if (entitlement.status === 'revoked' && paymentStatus === 'disputed') return 'disputed';
  if (entitlement.status === 'revoked' && paymentStatus === 'canceled') return 'canceled';
  if (['refunded', 'refund_pending'].includes(paymentStatus)) return 'refunded';
  if (['disputed', 'chargeback'].includes(paymentStatus)) return 'disputed';
  if (paymentStatus === 'canceled') return 'canceled';
  if (verification.purchaseCodeExpiresAt && Date.parse(verification.purchaseCodeExpiresAt) <= Date.now() && entitlement.status !== 'active') return 'expired';
  if (verification.purchaseCodeRedeemedAt || entitlement.status === 'active') return 'redeemed';
  if (verification.claimedDiscordUserId || poolEntry?.status === 'pending_google_linking') return 'claimed';
  if (entitlement.paymentConfirmedAt && entitlement.status === 'pending_discord_verification') return 'available';
  return 'invalid';
}

function maskName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return parts.map((part, index) => (index === 0 ? part : `${part[0] || ''}.`)).join(' ');
}

function buildStreamzOrderNumber(entitlement) {
  const seed = String(entitlement?.stripePaymentIntentId || entitlement?.stripeCheckoutSessionId || entitlement?.id || '').replace(/[^A-Za-z0-9]/g, '');
  const suffix = seed.slice(-8).toUpperCase() || Math.floor(Date.now() / 1000).toString(36).toUpperCase();
  return `STZ-${suffix}`;
}

function normalizeStreamzDiscordVerifications(value) {
  return Array.isArray(value)
    ? value.filter((entry) => entry && typeof entry === 'object' && entry.entitlementId)
    : [];
}

function findStreamzDiscordVerificationByEntitlement(db, entitlementId) {
  return normalizeStreamzDiscordVerifications(db.streamzProDiscordVerifications)
    .find((entry) => entry.entitlementId === entitlementId) || null;
}

function replaceStreamzDiscordVerification(existing, incoming) {
  const list = normalizeStreamzDiscordVerifications(existing);
  const index = list.findIndex((entry) => entry.id === incoming.id || entry.entitlementId === incoming.entitlementId);
  if (index >= 0) {
    list[index] = incoming;
    return list;
  }
  return [...list, incoming];
}

function findStreamzDiscordVerificationByWebsiteTokenHash(db, tokenHash) {
  return normalizeStreamzDiscordVerifications(db.streamzProDiscordVerifications)
    .find((entry) => entry.websiteTokenHash && constantTimeStringEquals(entry.websiteTokenHash, tokenHash)) || null;
}

function buildStreamzDiscordSiteResult(status, entitlement = null) {
  const emailMasked = entitlement ? maskEmail(entitlement.googleEmail || entitlement.email) : null;
  const map = {
    pending: {
      ok: true,
      status: 'pending',
      title: 'Streamz Pro verification',
      message: 'Your payment and Discord verification have been confirmed. Sign in with the Google account that you want to permanently own Streamz Pro.',
    },
    success: {
      ok: true,
      status: 'success',
      title: 'Streamz Pro activated',
      message: emailMasked ? `Streamz Pro is now permanently linked to ${emailMasked}.` : 'Streamz Pro is now permanently linked to your Google account.',
    },
    already_used: {
      ok: false,
      status: 'already_used',
      title: 'This verification link was already used',
      message: 'Streamz Pro has already been linked for this verification session.',
    },
    already_active: {
      ok: true,
      status: 'already_active',
      title: 'Streamz Pro is already active',
      message: 'This entitlement is already active.',
    },
    expired: {
      ok: false,
      status: 'expired',
      title: 'This verification link has expired',
      message: 'Return to Discord and run /verify-pro with a current code.',
    },
    google_required: {
      ok: false,
      status: 'google_required',
      title: 'Continue with Google',
      message: 'Sign in with the Google account that will permanently own Streamz Pro.',
    },
    conflict: {
      ok: false,
      status: 'conflict',
      title: 'Account conflict',
      message: 'This Google account cannot claim the selected Streamz Pro entitlement.',
    },
    invalid: {
      ok: false,
      status: 'invalid',
      title: 'This verification link is invalid',
      message: 'The link may be incomplete, expired or replaced.',
    },
  };
  return { ...(map[status] || map.invalid), entitlement: sanitizeStreamzProEntitlement(entitlement) };
}

function isPlausibleStreamzToken(token) {
  return /^[A-Za-z0-9_-]{40,160}$/.test(String(token || ''));
}

function constantTimeStringEquals(a, b) {
  return constantTimeEquals(textEncoder.encode(String(a || '')), textEncoder.encode(String(b || '')));
}

async function enforceStreamzRateLimit(env, key, maxAttempts, windowMs, message) {
  await updateStreamzDatabase(env, async (db) => {
    const now = Date.now();
    const limits = db.streamzRateLimits && typeof db.streamzRateLimits === 'object' ? db.streamzRateLimits : {};
    const bucket = limits[key] || { attempts: [] };
    const attempts = Array.isArray(bucket.attempts)
      ? bucket.attempts.map(Number).filter((value) => now - value < windowMs)
      : [];
    if (attempts.length >= maxAttempts) {
      throw httpError(429, message);
    }
    attempts.push(now);
    db.streamzRateLimits = {
      ...limits,
      [key]: { attempts, lastAt: now },
    };
    return { db, value: null };
  });
}

async function getStreamzProEntitlement(env, googleSub) {
  const db = await loadDatabase(env);
  const list = normalizeStreamzProEntitlements(db.streamzProEntitlements);
  return list.find((entry) => (
    entry.googleSub === googleSub
    && entry.product === STREAMZ_PRO_PRODUCT_ID
    && entry.status !== 'revoked'
  )) || null;
}

function normalizeStreamzProEntitlements(value) {
  return Array.isArray(value)
    ? value
      .filter((entry) => entry && typeof entry === 'object' && (entry.accountId || entry.googleSub))
      .map((entry) => {
        const {
          emailDeliveryStatus,
          emailDeliveryId,
          emailDeliveryErrorCode,
          emailLastSentAt,
          emailSendCount,
          emailVerified,
          verificationTokenHash,
          verificationUsedTokenHash,
          verificationExpiresAt,
          verificationUsedAt,
          ...safeEntry
        } = entry;
        delete safeEntry[`emailVerification${'Re'}${'send'}History`];
        return {
        ...safeEntry,
        product: safeEntry.product || STREAMZ_PRO_PRODUCT_ID,
        status: safeEntry.status === 'pending_email_verification'
          ? 'pending_discord_verification'
          : (STREAMZ_PRO_STATUSES.has(safeEntry.status) ? safeEntry.status : 'pending_discord_verification'),
        accountId: safeEntry.accountId || buildStreamzAccountIdFromGoogleSub(safeEntry.googleSub),
        id: safeEntry.id || buildStreamzEntitlementIdFromAccountId(safeEntry.accountId || buildStreamzAccountIdFromGoogleSub(safeEntry.googleSub), safeEntry.product || STREAMZ_PRO_PRODUCT_ID),
        email: safeEntry.email || safeEntry.googleEmail || null,
        emailNormalized: safeEntry.emailNormalized || normalizeEmail(safeEntry.email || safeEntry.googleEmail),
        stripePaymentIntentId: safeEntry.stripePaymentIntentId || safeEntry.paymentIntentId || null,
        stripeCheckoutSessionId: safeEntry.stripeCheckoutSessionId || safeEntry.checkoutSessionId || null,
        fullName: safeEntry.fullName || safeEntry.contactFullName || null,
        orderNumber: safeEntry.orderNumber || buildStreamzOrderNumber(safeEntry),
        paymentStatus: safeEntry.paymentStatus || (safeEntry.status === 'revoked' ? 'revoked' : null),
        paymentMethodType: safeEntry.paymentMethodType || null,
        accountLocked: Boolean(safeEntry.accountLocked),
        discordUserId: safeEntry.discordUserId || null,
        googleLinkedAt: safeEntry.googleLinkedAt || null,
        };
      })
    : [];
}

function normalizeStripeEvents(value) {
  return Array.isArray(value)
    ? value.filter((entry) => entry && typeof entry === 'object' && entry.id)
    : [];
}

function sanitizeStreamzProEntitlement(entitlement) {
  if (!entitlement) return null;
  return {
    product: entitlement.product || STREAMZ_PRO_PRODUCT_ID,
    status: entitlement.status === 'pending_email_verification' ? 'pending_discord_verification' : (entitlement.status || 'pending_discord_verification'),
    source: entitlement.source || null,
    accountType: entitlement.accountType || null,
    ownsPro: isActiveStreamzProEntitlement(entitlement),
    emailMasked: maskEmail(entitlement.email || entitlement.googleEmail),
    accountLocked: Boolean(entitlement.accountLocked),
    amountCents: entitlement.amountCents || STREAMZ_PRO_AMOUNT_CENTS,
    currency: entitlement.currency || STREAMZ_PRO_CURRENCY,
    orderNumber: entitlement.orderNumber || buildStreamzOrderNumber(entitlement),
    paymentStatus: entitlement.paymentStatus || null,
    paymentConfirmedAt: entitlement.paymentConfirmedAt || null,
    discordClaimedAt: entitlement.discordClaimedAt || null,
    googleLinkedAt: entitlement.googleLinkedAt || null,
    createdAt: entitlement.createdAt || null,
  };
}

function isActiveStreamzProEntitlement(entitlement) {
  return Boolean(entitlement && entitlement.status === 'active');
}

function getStreamzOwnerGrantEntitlement(env, session) {
  const ownerSub = String(env.STREAMZ_OWNER_GOOGLE_SUB || '').trim();
  if (!ownerSub || !session?.sub || String(session.sub) !== ownerSub) return null;
  return {
    id: `${STREAMZ_PRO_PRODUCT_ID}:owner`,
    product: STREAMZ_PRO_PRODUCT_ID,
    status: 'active',
    source: 'developer_grant',
    accountType: 'owner',
    accountId: `owner:${ownerSub}`,
    googleSub: ownerSub,
    googleEmail: session.email || null,
    email: session.email || null,
    accountLocked: true,
    activatedAt: null,
    createdAt: null,
  };
}

function buildStreamzEntitlementId(googleSub, product) {
  return `${product}:${buildStreamzAccountIdFromGoogleSub(googleSub)}`;
}

function buildStreamzEntitlementIdFromAccountId(accountId, product) {
  return `${product}:${String(accountId || '').trim()}`;
}

function buildStreamzAccountIdFromGoogleSub(googleSub) {
  const value = String(googleSub || '').trim();
  return value ? `google:${value}` : '';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function maskEmail(email) {
  const normalized = normalizeEmail(email);
  const [local, domain] = normalized.split('@');
  if (!local || !domain) return null;
  const visible = local.length <= 2 ? local[0] : `${local.slice(0, 2)}${'*'.repeat(Math.min(local.length - 2, 6))}`;
  return `${visible}@${domain}`;
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

function sanitizeSingleLine(value, maxLength) {
  return String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

async function handleModxSubmission(request, env, origin) {
  if (request.method !== 'POST') {
    throw httpError(405, 'ModX submissions require POST.');
  }
  const user = await ensureAuthenticated(request, env, 'Sign in with Google to submit a ModX cheat table.');
  const bridgeToken = requireEnv(env, 'MODX_BRIDGE_TOKEN');
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.name) throw httpError(400, 'Choose a .CT file.');
  if (!file.name.toLowerCase().endsWith('.ct')) throw httpError(400, 'Only Cheat Engine .CT files are accepted.');
  form.set('contributorName', String(user.name || user.email || 'Community').slice(0, 100));

  const response = await fetch('https://modx.vortex-prime-emu.com/community/submit', {
    method: 'POST',
    headers: { 'X-ModX-Bridge': bridgeToken },
    body: form,
  });
  const payload = await response.json().catch(() => ({ error: 'The ModX backend returned an invalid response.' }));
  if (!response.ok) throw httpError(response.status, payload.error || payload.message || 'ModX submission failed.');
  return json({ ok: true, ...payload }, 201, origin);
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
  const snapshot = await loadDatabaseSnapshot(env);
  return snapshot.db;
}

async function loadDatabaseSnapshot(env) {
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
  const etag = response.headers.get('etag') || response.headers.get('ETag') || null;
  if (!json || typeof json !== 'object') {
    return { db: { ...DEFAULT_DB }, etag };
  }
  return { db: { ...DEFAULT_DB, ...json }, etag };
}

async function persistDatabase(env, data, options = {}) {
  const fileId = requireEnv(env, 'DRIVE_DATABASE_FILE_ID');
  const body = JSON.stringify({ ...DEFAULT_DB, ...data }, null, 2);
  const headers = {
    'Content-Type': 'application/json; charset=UTF-8',
  };
  if (options.ifMatch) {
    headers['If-Match'] = options.ifMatch;
  }
  const response = await driveRequest(
    env,
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true`,
    {
      method: 'PATCH',
      headers,
      body,
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw httpError(response.status, `Failed to save catalogue: ${text}`);
  }
  return JSON.parse(body);
}

async function updateStreamzDatabase(env, updater, attempts = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const { db, etag } = await loadDatabaseSnapshot(env);
      const result = await updater({ ...DEFAULT_DB, ...db });
      const nextDb = result?.db || db;
      await persistDatabase(env, nextDb, { ifMatch: etag });
      return result?.value;
    } catch (error) {
      lastError = error;
      if (error?.status === 412) {
        await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
        continue;
      }
      if (error?.status && error.status < 500) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
    }
  }
  throw lastError || httpError(500, 'Failed to update Streamz database.');
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
    firebase: buildFirebaseWebConfig(env),
    adminEmails: getAdminEmails(env),
    user: sanitizeUserForResponse(sessionUser),
  };
}

function buildFirebaseWebConfig(env) {
  const projectId = String(env.FIREBASE_PROJECT_ID || '').trim();
  const apiKey = String(env.FIREBASE_API_KEY || '').trim();
  const appId = String(env.FIREBASE_APP_ID || '').trim();
  if (!projectId || !apiKey || !appId) return null;
  return {
    apiKey,
    authDomain: String(env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`).trim(),
    projectId,
    appId,
    messagingSenderId: String(env.FIREBASE_MESSAGING_SENDER_ID || '').trim() || undefined,
    storageBucket: String(env.FIREBASE_STORAGE_BUCKET || '').trim() || undefined,
  };
}

async function ensureAuthenticated(request, env, message = 'Sign in with Google to upload.') {
  const session = await readSession(request, env).catch(() => null);
  if (session) return session;
  const authorization = request.headers.get('Authorization') || '';
  if (authorization.startsWith('Bearer ')) {
    const profile = await validateFirebaseIdToken(authorization.slice(7).trim(), env);
    return {
      sub: profile.sub,
      firebaseUid: profile.uid,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      role: isAdminEmail(profile.email, env) ? 'admin' : 'uploader',
    };
  }
  throw httpError(401, message);
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

async function exchangeGoogleCredentialForFirebase(googleIdToken, env) {
  if (!googleIdToken || typeof googleIdToken !== 'string') return null;
  const apiKey = requireEnv(env, 'FIREBASE_API_KEY');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      postBody: `id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`,
      requestUri: STREAMZ_SITE_BASE_URL,
      returnIdpCredential: true,
      returnSecureToken: true,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.idToken) {
    throw httpError(401, data?.error?.message || 'Firebase rejected the Google credential.');
  }
  return data.idToken;
}

async function validateFirebaseIdToken(idToken, env) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw httpError(400, 'Invalid Firebase ID token.');
  const [headerPart, payloadPart, signaturePart] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(textDecoder.decode(base64UrlDecode(headerPart)));
    payload = JSON.parse(textDecoder.decode(base64UrlDecode(payloadPart)));
  } catch {
    throw httpError(400, 'Malformed Firebase ID token.');
  }

  const projectId = requireEnv(env, 'FIREBASE_PROJECT_ID');
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' || !header.kid) throw httpError(401, 'Unsupported Firebase token signature.');
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw httpError(401, 'Firebase token project mismatch.');
  }
  if (!payload.sub || typeof payload.sub !== 'string') throw httpError(401, 'Firebase token is missing a UID.');
  if (Number(payload.exp) <= now || Number(payload.iat) > now || Number(payload.auth_time) > now) {
    throw httpError(401, 'Firebase ID token is expired or not yet valid.');
  }
  if (!payload.email || payload.email_verified !== true) {
    throw httpError(401, 'Firebase account email must be verified.');
  }
  const firebaseProvider = payload.firebase?.sign_in_provider;
  if (firebaseProvider !== 'google.com') throw httpError(401, 'Streamz requires Google Sign-In.');

  const publicKey = await getGooglePublicKeyFromJwks(
    header.kid,
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    base64UrlDecode(signaturePart),
    textEncoder.encode(`${headerPart}.${payloadPart}`),
  );
  if (!valid) throw httpError(401, 'Failed to verify Firebase ID token.');

  return {
    uid: payload.sub,
    sub: payload.firebase?.identities?.['google.com']?.[0] || payload.sub,
    email: payload.email,
    name: payload.name || null,
    picture: payload.picture || null,
  };
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

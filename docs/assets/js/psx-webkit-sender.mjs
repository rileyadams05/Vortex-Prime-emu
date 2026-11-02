export const DEFAULT_RECEIVER_PORT = 19871;
export const MAX_URL_LENGTH = 8192;
export const PROTOCOL_VERSION = 1;

export function validateDownloadUrl(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_URL_LENGTH || value.trim() !== value) {
    throw new Error("Enter a download URL of up to 8192 characters with no surrounding spaces.");
  }
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("Enter a complete HTTP or HTTPS download URL."); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Only HTTP and HTTPS download URLs are supported.");
  if (!parsed.hostname || parsed.username || parsed.password) throw new Error("The URL must have a host and cannot contain embedded login details.");
  return value;
}

export function validatePrivateIPv4(value, { allowLoopback = false } = {}) {
  if (typeof value !== "string" || value.trim() !== value) throw new Error("Enter the PlayStation's local IPv4 address.");
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some(part => !/^(0|[1-9]\d{0,2})$/.test(part) || Number(part) > 255)) {
    throw new Error("Enter a valid IPv4 address, for example 192.168.1.50.");
  }
  const [a,b,c,d] = parts.map(Number);
  if (d === 0 || d === 255 || a === 0 || a >= 224) throw new Error("Enter a unicast local IPv4 address.");
  const privateAddress = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (allowLoopback && a === 127) || (a === 169 && b === 254);
  if (!privateAddress) throw new Error("For safety, the sender only accepts private/local IPv4 addresses.");
  return value;
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Receiver port must be between 1 and 65535.");
  return port;
}

async function readJson(response) {
  let data;
  try { data = await response.json(); } catch { throw new Error("The receiver returned an unreadable response."); }
  return data;
}

export async function sendToConsole({
  ip, port = DEFAULT_RECEIVER_PORT, pairingCode, target = "ps4-goldhen", downloadUrl,
  fetchImpl = globalThis.fetch, timeoutMs = 8000, allowLoopback = false, now = () => new Date().toISOString(),
  requestId = globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(16).slice(2)}`
}) {
  validatePrivateIPv4(ip, { allowLoopback });
  const checkedPort = parsePort(port);
  const originalUrl = validateDownloadUrl(downloadUrl);
  if (target !== "ps4-goldhen" && target !== "ps5-etahen") throw new Error("Choose a supported console target.");
  if (target === "ps5-etahen") throw new Error("PS5 sending is not enabled until a compatible PSX WebKit receiver is verified.");
  if (typeof pairingCode !== "string" || pairingCode.trim().length < 6 || pairingCode.length > 128) throw new Error("Enter the pairing code shown by PSX WebKit.");
  if (typeof fetchImpl !== "function") throw new Error("This browser does not support network requests.");

  const base = `http://${ip}:${checkedPort}/api/v1`;
  const permissionName = allowLoopback ? "loopback-network" : "local-network";
  try {
    const permission = await globalThis.navigator?.permissions?.query?.({ name: permissionName });
    if (permission?.state === "denied") {
      throw new Error("Local network access is blocked for this website. Allow it in your browser's site settings, then try again.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Local network access is blocked")) throw error;
    // Older browsers do not recognize the permission name; continue from this user-initiated submit.
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const requestOptions = {
    signal: controller.signal, mode: "cors", cache: "no-store",
    targetAddressSpace: allowLoopback ? "loopback" : "local"
  };
  const jsonOptions = { ...requestOptions, method: "POST", headers: { "Content-Type": "application/json" } };
  try {
    let pairResponse;
    try {
      pairResponse = await fetchImpl(`${base}/pair`, {
        ...jsonOptions,
        body: JSON.stringify({ protocolVersion: PROTOCOL_VERSION, pairingCode, client: "Vortex Prime Web" })
      });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("The receiver did not respond before the connection timed out.");
      throw new Error("Could not reach PSX WebKit. Check the console IP, same Wi-Fi/LAN, browser local-network permission, and receiver CORS support.");
    }
    const pair = await readJson(pairResponse);
    if (pairResponse.status !== 200 || pair.protocolVersion !== PROTOCOL_VERSION || typeof pair.token !== "string" || !pair.token) {
      throw new Error(pair.message || (pairResponse.status === 401 ? "Pairing code was rejected. Check the code on your console." : "PSX WebKit rejected the pairing request."));
    }

    const request = {
      protocolVersion: PROTOCOL_VERSION,
      requestId,
      target,
      downloadUrl: originalUrl,
      fileName: null,
      requestedAt: now()
    };
    let response;
    try {
      response = await fetchImpl(`${base}/requests`, {
        ...jsonOptions,
        headers: { ...jsonOptions.headers, Authorization: `Bearer ${pair.token}` },
        body: JSON.stringify(request)
      });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("The receiver paired, but did not acknowledge the request before timeout. Check its screen before retrying.");
      throw new Error("The receiver paired, but the request could not be delivered. Check its screen before retrying.");
    }
    const acknowledgement = await readJson(response);
    if (response.status !== 202 || acknowledgement.protocolVersion !== PROTOCOL_VERSION ||
        acknowledgement.requestId !== requestId || acknowledgement.status !== "awaiting-user-confirmation") {
      throw new Error(acknowledgement.message || "The receiver did not provide a valid request acknowledgement.");
    }
    return { request, acknowledgement };
  } finally {
    clearTimeout(timer);
  }
}

export const DEFAULT_RECEIVER_PORT = 19871;
export const MAX_URL_LENGTH = 8192;
export const PROTOCOL_VERSION = 1;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  try { return await response.json(); } catch { throw new Error("The receiver returned an unreadable response."); }
}

export async function sendToConsole({
  ip, port = DEFAULT_RECEIVER_PORT, target = "ps4-goldhen", downloadUrl,
  fetchImpl = globalThis.fetch, timeoutMs = 8000, allowLoopback = false,
  now = () => new Date().toISOString(),
  requestId = globalThis.crypto?.randomUUID?.()
}) {
  validatePrivateIPv4(ip, { allowLoopback });
  const checkedPort = parsePort(port);
  const originalUrl = validateDownloadUrl(downloadUrl);
  if (target !== "ps4-goldhen" && target !== "ps5-etahen") throw new Error("Choose a supported console target.");
  if (target === "ps5-etahen") throw new Error("PS5 sending is not enabled until a compatible PlayStation receiver is verified.");
  if (typeof fetchImpl !== "function") throw new Error("This browser does not support network requests.");
  if (typeof requestId !== "string" || !UUID_PATTERN.test(requestId)) throw new Error("This browser could not create a secure request ID.");

  const permissionName = allowLoopback ? "loopback-network" : "local-network";
  try {
    const permission = await globalThis.navigator?.permissions?.query?.({ name: permissionName });
    if (permission?.state === "denied") {
      throw new Error("Local network access is blocked for this website. Allow it in your browser's site settings, then try again.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Local network access is blocked")) throw error;
    // Older browsers do not recognize this permission name; continue from the user-initiated submit.
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const base = "http://" + ip + ":" + checkedPort + "/api/v1";
  const request = {
    protocolVersion: PROTOCOL_VERSION,
    requestId,
    target,
    downloadUrl: originalUrl,
    fileName: null,
    requestedAt: now()
  };
  try {
    let response;
    try {
      response = await fetchImpl(base + "/requests", {
        signal: controller.signal,
        mode: "cors",
        cache: "no-store",
        targetAddressSpace: allowLoopback ? "loopback" : "local",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("The receiver did not respond before the connection timed out.");
      throw new Error("Could not reach the PlayStation receiver. Check the console IP, same Wi-Fi/LAN, browser local-network permission, and receiver CORS support.");
    }

    const acknowledgement = await readJson(response);
    if (response.status !== 202 || acknowledgement.protocolVersion !== PROTOCOL_VERSION ||
        acknowledgement.requestId !== requestId || acknowledgement.status !== "awaiting-user-confirmation") {
      const messages = {
        400: "The PlayStation receiver rejected the request as invalid.",
        403: "The PlayStation receiver rejected this website origin.",
        409: "This request ID conflicts with a different request.",
        429: "The PlayStation receiver is receiving requests too quickly. Wait and try again."
      };
      throw new Error(acknowledgement.message || messages[response.status] || "The receiver did not provide a valid request acknowledgement.");
    }
    return { request, acknowledgement };
  } finally {
    clearTimeout(timer);
  }
}

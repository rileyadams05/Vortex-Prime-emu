(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VortexPrimeCatalogueApi = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function createClient(fetchFunction, port) {
    const fetchImpl = fetchFunction || fetch;
    const servicePort = Number(port) || 12801;
    async function request(ip, path, options) {
      const settings = options || {};
      const headers = {
        Accept: 'application/json',
        ...(settings.body ? { 'Content-Type': 'application/json' } : {}),
        ...(settings.token ? { Authorization: `Bearer ${settings.token}` } : {}),
        ...(settings.headers || {})
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), settings.timeout || 8000);
      try {
        const response = await fetchImpl(`http://${ip}:${servicePort}/api/v1${path}`, {
          method: settings.method || 'GET', headers,
          body: settings.body ? JSON.stringify(settings.body) : undefined,
          mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal
        });
        const raw = await response.text();
        let body = {};
        try { body = raw ? JSON.parse(raw) : {}; } catch (_) { throw new Error(`The console service returned invalid JSON (HTTP ${response.status}).`); }
        if (!response.ok) {
          const error = new Error(body.message || body.error || `Console service returned HTTP ${response.status}.`);
          error.status = response.status;
          error.body = body;
          throw error;
        }
        return body;
      } catch (error) {
        if (error.name === 'AbortError') throw new Error('The console service did not respond in time. Check the IP and local network.');
        if (error instanceof TypeError) throw new Error('The browser could not reach the local PS4 service. Check that it is running, allow local-network access if prompted, and confirm its CORS settings.');
        throw error;
      } finally { clearTimeout(timer); }
    }
    return Object.freeze({ request });
  }

  return Object.freeze({ createClient });
});

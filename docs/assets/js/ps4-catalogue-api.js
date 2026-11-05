(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VortexPrimeCatalogueApi = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function createClient(fetchFunction, port, xhrFactory) {
    const fetchImpl = fetchFunction || fetch;
    const makeXhr = xhrFactory || (() => new XMLHttpRequest());
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
    function upload(ip, path, file, token, onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = makeXhr();
        xhr.open('POST', `http://${ip}:${servicePort}/api/v1${path}`, true);
        xhr.withCredentials = false;
        xhr.timeout = 0;
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('Content-Type', 'application/vnd.vortex-prime.pkg');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = event => {
          if (event.lengthComputable && typeof onProgress === 'function') onProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onerror = () => reject(new Error('The browser could not upload to the local PS4 service. Check its availability, CORS and local-network permission.'));
        xhr.ontimeout = () => reject(new Error('The PS4 upload service timed out.'));
        xhr.onload = () => {
          let body;
          try { body = xhr.responseText ? JSON.parse(xhr.responseText) : {}; }
          catch (_) { reject(new Error(`The PS4 upload service returned invalid JSON (HTTP ${xhr.status}).`)); return; }
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(body.message || body.error || `PS4 upload service returned HTTP ${xhr.status}.`));
            return;
          }
          resolve(body);
        };
        xhr.send(file);
      });
    }
    return Object.freeze({ request, upload });
  }

  return Object.freeze({ createClient });
});

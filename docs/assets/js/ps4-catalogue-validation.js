(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VortexPrimeCatalogueValidation = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const categories = Object.freeze(['games', 'updates', 'dlc', 'homebrew', 'applications']);
  const adapters = Object.freeze({
    'vortex-v1': Object.freeze({
      id: 'vortex-v1',
      label: 'Vortex PS4 Catalogue v1 (JSON)',
      schema: 'vortex-prime.ps4-catalogue/v1'
    })
  });

  function validPackageUrl(value) {
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.pathname.toLowerCase().endsWith('.pkg');
    } catch (_) { return false; }
  }

  function parseCatalogueUrl(value) {
    let url;
    try { url = new URL(String(value || '').trim()); } catch (_) { throw new Error('Enter a complete catalogue URL.'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Catalogue URLs must use HTTP or HTTPS and cannot contain credentials.');
    if (url.hash) throw new Error('Remove the URL fragment; it is not sent to the catalogue server.');
    return url.href;
  }

  function normalizeUrl(value) {
    try { const url = new URL(value); url.hash = ''; return url.href.replace(/\/$/, ''); }
    catch (_) { return String(value || '').trim(); }
  }

  function isDuplicateUrl(sources, candidate) {
    const normalized = normalizeUrl(candidate);
    return sources.some(source => normalizeUrl(source.url) === normalized);
  }

  function validateCatalogueDocument(document, adapterId) {
    const adapter = adapters[adapterId];
    if (!adapter) throw new Error('This catalogue format is not supported.');
    if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('The catalogue root must be a JSON object.');
    if (document.schema !== adapter.schema) throw new Error(`Unsupported catalogue schema. Expected "${adapter.schema}".`);
    if (typeof document.name !== 'string' || !document.name.trim()) throw new Error('The catalogue needs a non-empty "name" field.');
    if (!Array.isArray(document.items)) throw new Error('The catalogue needs an "items" array.');
    if (document.items.length > 20000) throw new Error('The catalogue has too many items to validate in the browser.');
    const ids = new Set();
    document.items.forEach((item, index) => {
      const prefix = `Item ${index + 1}`;
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${prefix} must be a JSON object.`);
      if (typeof item.id !== 'string' || !item.id.trim()) throw new Error(`${prefix} is missing its stable "id".`);
      if (ids.has(item.id)) throw new Error(`Duplicate item id "${item.id}" in catalogue.`);
      ids.add(item.id);
      if (typeof item.name !== 'string' || !item.name.trim()) throw new Error(`${prefix} is missing its "name".`);
      if (typeof item.pkg_url !== 'string' || !validPackageUrl(item.pkg_url)) throw new Error(`${prefix} needs an http(s) "pkg_url" ending in .pkg.`);
    });
    return { name: document.name.trim(), count: document.items.length, schema: adapter.schema, adapter_id: adapter.id };
  }

  function isPrivateIPv4(value) {
    const parts = String(value || '').trim().split('.');
    if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
    const [a, b] = parts.map(Number);
    return a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31 || a === 169 && b === 254;
  }

  return Object.freeze({ categories, adapters, validPackageUrl, parseCatalogueUrl, normalizeUrl, isDuplicateUrl, validateCatalogueDocument, isPrivateIPv4 });
});

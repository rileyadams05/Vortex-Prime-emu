(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VortexPrimeCatalogueState = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function queue(pending, operation) {
    let next = pending.slice();
    if (operation.op === 'add') {
      next = next.filter(item => item.source_id !== operation.source.id);
      next.push({ ...operation, source_id: operation.source.id, source: { ...operation.source } });
      return next;
    }
    const existingAdd = next.find(item => item.op === 'add' && item.source_id === operation.source_id);
    if (existingAdd) {
      if (operation.op === 'remove') return next.filter(item => item.source_id !== operation.source_id);
      if (operation.op === 'set-enabled') existingAdd.source.enabled = operation.enabled;
      else if (operation.op === 'set-category') existingAdd.source.category = operation.category;
      return next;
    }
    next = next.filter(item => !(item.source_id === operation.source_id && item.op === operation.op));
    if (operation.op === 'remove') next = next.filter(item => item.source_id !== operation.source_id);
    next.push({ ...operation });
    return next;
  }

  function applyPending(remote, pending) {
    const merged = remote.map(source => ({ ...source }));
    for (const operation of pending) {
      const index = merged.findIndex(source => source.id === operation.source_id);
      if (operation.op === 'add') {
        if (index < 0) merged.push({ ...operation.source });
      } else if (operation.op === 'remove') {
        if (index >= 0) merged.splice(index, 1);
      } else if (index >= 0 && operation.op === 'set-enabled') merged[index].enabled = operation.enabled;
      else if (index >= 0 && operation.op === 'set-category') merged[index].category = operation.category;
    }
    return merged;
  }

  function acknowledge(pending, operationIds) {
    const acknowledged = new Set(operationIds);
    return pending.filter(operation => !acknowledged.has(operation.operation_id));
  }

  function hasPending(pending, sourceId) { return pending.some(operation => operation.source_id === sourceId); }

  function read(storage, key) {
    try {
      const data = JSON.parse(storage.getItem(key) || '{}');
      return {
        sources: Array.isArray(data.sources) ? data.sources : [],
        pending: Array.isArray(data.pending) ? data.pending : [],
        revision: typeof data.revision === 'string' ? data.revision : null
      };
    } catch (_) { return { sources: [], pending: [], revision: null }; }
  }

  function write(storage, key, snapshot) {
    try { storage.setItem(key, JSON.stringify(snapshot)); return true; }
    catch (_) { return false; }
  }

  return Object.freeze({ queue, applyPending, acknowledge, hasPending, read, write });
});

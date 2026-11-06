(function () {
  'use strict';

  const API_PORT = 12801;
  const API_ID = 'vortex-prime.ps4-catalogue-service';
  const API_VERSION = 1;
  const STORE_KEY = 'vortexPrime.ps4.catalogueManager.v1';
  const IP_KEY = 'vortexPrime.consoleIp.ps4';
  const TOKEN_KEY = 'vortexPrime.ps4.catalogueManager.pairingToken';
  const validation = window.VortexPrimeCatalogueValidation;
  if (!validation) throw new Error('Catalogue validation module did not load.');
  const catalogueState = window.VortexPrimeCatalogueState;
  if (!catalogueState) throw new Error('Catalogue state module did not load.');
  const apiModule = window.VortexPrimeCatalogueApi;
  if (!apiModule) throw new Error('Catalogue API module did not load.');
  const apiClient = apiModule.createClient(window.fetch.bind(window), API_PORT);

  const el = id => document.getElementById(id);
  const ipInput = el('ps4Ip');
  const sourcesNode = el('sourceList');
  const connectionStatus = el('connectionStatus');
  const pairStatus = el('pairStatus');
  const syncStatus = el('syncStatus');
  const validateStatus = el('validationStatus');
  let sources = [];
  let pending = [];
  let remoteRevision = null;
  let remoteIds = new Set();
  let activeIp = '';
  let challengeId = '';
  let pairingToken = '';
  let connected = false;
  let syncing = false;
  let syncBlocked = false;
  let lastSyncError = '';
  let syncTimer = 0;
  let validatingCatalogue = false;

  function readStore() {
    const data = catalogueState.read(localStorage, STORE_KEY);
    sources = data.sources; pending = data.pending; remoteRevision = data.revision;
  }

  function saveStore() {
    if (!catalogueState.write(localStorage, STORE_KEY, { sources, pending, revision: remoteRevision })) {
      setStatus(syncStatus, 'Browser storage is unavailable. Changes may be lost when this tab closes.', 'error');
    }
  }

  function setStatus(node, message, kind) {
    node.textContent = message || '';
    node.dataset.kind = kind || '';
    node.hidden = !message;
  }

  const parseCatalogueUrl = validation.parseCatalogueUrl;
  const validPrivateIp = validation.isPrivateIPv4;

  function newId() {
    return globalThis.crypto && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  const apiRequest = (ip, path, options) => apiClient.request(ip, path, options);

  function setConnection(label, detail, online) {
    el('connectionLabel').textContent = label;
    el('connectionDetail').textContent = detail;
    el('connectionDot').classList.toggle('online', Boolean(online));
    el('connectionDot').classList.toggle('pending', !online && Boolean(pairingToken));
    el('syncButton').disabled = !connected || !pending.length || syncing;
    el('refreshAllButton').disabled = !connected || syncing;
  }

  function refreshLocalStatus() {
    if (lastSyncError) { setStatus(syncStatus, lastSyncError, 'error'); return; }
    if (!pending.length) setStatus(syncStatus, connected ? 'All browser changes are acknowledged by the PS4.' : 'No pending catalogue changes.', connected ? 'success' : '');
    else setStatus(syncStatus, `${pending.length} change${pending.length === 1 ? '' : 's'} waiting to sync${connected ? ' to the connected PS4' : ' when a PS4 is paired'}.`, 'pending');
  }

  function pendingFor(id) { return catalogueState.hasPending(pending, id); }

  function renderSources() {
    sourcesNode.replaceChildren();
    if (!sources.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No catalogues configured yet. Validate a JSON catalogue URL to add your first source.';
      sourcesNode.append(empty);
      refreshLocalStatus();
      return;
    }
    for (const source of sources) {
      const card = document.createElement('article');
      card.className = 'source';
      const top = document.createElement('div'); top.className = 'source-top';
      const title = document.createElement('div'); title.className = 'source-title';
      const heading = document.createElement('h3'); heading.textContent = source.name || 'Untitled catalogue';
      const url = document.createElement('a'); url.className = 'source-url'; url.textContent = source.url; url.href = source.url; url.target = '_blank'; url.rel = 'noopener noreferrer';
      title.append(heading, url);
      const badge = document.createElement('span'); badge.className = `source-status${pendingFor(source.id) ? '' : ' synced'}${source.enabled === false ? ' off' : ''}`;
      badge.textContent = source.enabled === false ? 'Disabled' : pendingFor(source.id) ? 'Pending sync' : remoteIds.has(source.id) ? 'Synced' : 'Browser only';
      top.append(title, badge);

      const meta = document.createElement('div'); meta.className = 'source-meta';
      const enabledWrap = document.createElement('div');
      const enabledLabel = document.createElement('label'); enabledLabel.textContent = 'Source status';
      const switchRow = document.createElement('label'); switchRow.className = 'switch-row';
      const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = source.enabled !== false; enabled.setAttribute('aria-label', `Enable ${source.name}`);
      enabled.addEventListener('change', () => changeEnabled(source.id, enabled.checked));
      const enabledText = document.createElement('span'); enabledText.textContent = source.enabled === false ? 'Disabled' : 'Enabled';
      enabled.addEventListener('change', () => { enabledText.textContent = enabled.checked ? 'Enabled' : 'Disabled'; });
      switchRow.append(enabled, enabledText); enabledWrap.append(enabledLabel, switchRow);
      meta.append(enabledWrap);

      const actions = document.createElement('div'); actions.className = 'source-actions';
      const refresh = document.createElement('button'); refresh.type = 'button'; refresh.className = 'button secondary'; refresh.textContent = 'Refresh now'; refresh.disabled = !connected;
      refresh.addEventListener('click', () => refreshCatalogues([source.id]));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button danger'; remove.textContent = 'Remove';
      remove.addEventListener('click', () => removeSource(source.id));
      actions.append(refresh, remove);
      card.append(top, meta, actions); sourcesNode.append(card);
    }
    refreshLocalStatus();
    el('syncButton').disabled = !connected || !pending.length || syncing;
    el('refreshAllButton').disabled = !connected || syncing;
  }

  function persistAndRender(message) {
    lastSyncError = '';
    saveStore(); renderSources();
    if (message) setStatus(syncStatus, message, 'pending');
    scheduleSync();
  }

  function enqueue(operation) {
    operation.operation_id = newId();
    pending = catalogueState.queue(pending, operation);
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    if (connected && pending.length && !syncBlocked) syncTimer = setTimeout(syncPending, 650);
  }

  function changeEnabled(id, enabled) {
    const source = sources.find(item => item.id === id); if (!source) return;
    source.enabled = enabled;
    enqueue({ op: 'set-enabled', source_id: id, enabled });
    persistAndRender('Enable state saved in this browser; syncing to the PS4.');
  }

  function removeSource(id) {
    const index = sources.findIndex(item => item.id === id); if (index < 0) return;
    sources.splice(index, 1);
    if (remoteIds.has(id)) enqueue({ op: 'remove', source_id: id });
    else pending = pending.filter(item => item.source_id !== id);
    persistAndRender('Catalogue removed from this browser; syncing the removal to the PS4.');
  }

  function applyPendingToRemote(remote) {
    return catalogueState.applyPending(remote, pending);
  }

  function applyRemoteSnapshot(snapshot) {
    if (typeof snapshot.revision !== 'string' || !Array.isArray(snapshot.sources)) throw new Error('The console returned an invalid catalogue configuration snapshot.');
    remoteRevision = snapshot.revision;
    remoteIds = new Set(snapshot.sources.map(source => source.id).filter(value => typeof value === 'string'));
    sources = applyPendingToRemote(snapshot.sources);
    saveStore(); renderSources();
  }

  async function loadRemoteConfig(ip, token) {
    const snapshot = await apiRequest(ip, '/catalogues', { token });
    applyRemoteSnapshot(snapshot);
  }

  function setPaired(ip, token, consoleName) {
    activeIp = ip; pairingToken = token; connected = true;
    try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ ip, token })); } catch (_) { /* Pairing remains for this page session. */ }
    el('pairingPanel').hidden = true;
    setConnection('Connected', `${consoleName || 'PS4'} · ${ip} · paired browser`, true);
    el('refreshAllButton').disabled = false;
    renderSources();
    scheduleSync();
  }

  async function connectToPs4(ipOverride) {
    const ip = (ipOverride || ipInput.value).trim();
    if (!validPrivateIp(ip)) { setStatus(connectionStatus, 'Enter a private PS4 IPv4 address, such as 192.168.1.50.', 'error'); return; }
    ipInput.value = ip;
    el('manualIpPanel').hidden = true;
    activeIp = ip;
    pairingToken = '';
    lastSyncError = '';
    try { localStorage.setItem(IP_KEY, ip); } catch (_) { /* IP memory is optional. */ }
    connected = false;
    setConnection('Connecting…', `Checking ${ip}:${API_PORT}`, false);
    setStatus(connectionStatus, 'Checking for the Vortex Prime catalogue service…');
    try {
      const status = await apiRequest(ip, '/status');
      if (status.service !== API_ID || status.api_version !== API_VERSION) throw new Error('A service answered, but it does not match the Vortex Prime PS4 Catalogue API v1.');
      const savedPairing = (() => { try { return JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null'); } catch (_) { return null; } })();
      if (savedPairing && savedPairing.ip === ip && typeof savedPairing.token === 'string') {
        try {
          await loadRemoteConfig(ip, savedPairing.token);
          lastSyncError = '';
          setPaired(ip, savedPairing.token, status.console_name);
          setStatus(connectionStatus, 'Paired PS4 catalogue service connected.', 'success');
          syncBlocked = false;
          scheduleSync();
          return;
        } catch (error) {
          if (error.status !== 401 && error.status !== 403) throw error;
          try { sessionStorage.removeItem(TOKEN_KEY); } catch (_) { /* Ignore storage errors. */ }
        }
      }
      const challenge = await apiRequest(ip, '/pairing/challenge', { method: 'POST', body: { client: 'Vortex Prime browser', api_version: API_VERSION, scopes: ['catalogues:read', 'catalogues:write', 'packages:install'] } });
      if (typeof challenge.challenge_id !== 'string' || !challenge.challenge_id) throw new Error('The catalogue service did not return a pairing challenge.');
      challengeId = challenge.challenge_id;
      setConnection('Pairing required', `${status.console_name || 'PS4'} · ${ip}`, false);
      el('pairingPanel').hidden = false;
      setStatus(connectionStatus, 'Compatible catalogue service found. Confirm pairing on the console, then enter its one-time code.', 'pending');
      setStatus(pairStatus, challenge.expires_at ? `Pairing code expires ${challenge.expires_at}.` : 'Pairing code requested from the PS4.', 'pending');
    } catch (error) {
      connected = false;
      setConnection('Disconnected', `${ip}:${API_PORT} is unavailable or incompatible.`, false);
      setStatus(connectionStatus, error.message, 'error');
      el('pairingPanel').hidden = true;
      renderSources();
    }
  }

  async function pairBrowser() {
    const code = el('pairingCode').value.trim();
    if (!challengeId || !code) { setStatus(pairStatus, 'Enter the one-time code displayed by the PS4.', 'error'); return; }
    el('pairButton').disabled = true;
    setStatus(pairStatus, 'Confirming pairing with the PS4…');
    try {
      const result = await apiRequest(activeIp, '/pairing/authorize', { method: 'POST', body: { challenge_id: challengeId, code } });
      if (typeof result.access_token !== 'string' || !result.access_token || !Array.isArray(result.scopes) || !result.scopes.includes('catalogues:write') || !result.scopes.includes('packages:install')) throw new Error('The PS4 did not return a paired token with catalogue and BGFT install permissions.');
      pairingToken = result.access_token;
      await loadRemoteConfig(activeIp, pairingToken);
      lastSyncError = '';
      setPaired(activeIp, pairingToken, result.console_name);
      setStatus(connectionStatus, 'This browser is paired with the PS4 catalogue service.', 'success');
      setStatus(pairStatus, '', '');
      syncBlocked = false;
      scheduleSync();
    } catch (error) { setStatus(pairStatus, error.message, 'error'); }
    finally { el('pairButton').disabled = false; }
  }

  async function validateAndAdd(event) {
    event.preventDefault();
    if (validatingCatalogue) return;
    const adapterId = 'vortex-v1';
    if (!validation.adapters[adapterId]) { setStatus(validateStatus, 'The Vortex JSON catalogue format is not supported by this page.', 'error'); return; }
    let url;
    try { url = parseCatalogueUrl(el('catalogueUrl').value); }
    catch (error) { setStatus(validateStatus, error.message, 'error'); return; }
    if (validation.isDuplicateUrl(sources, url)) { setStatus(validateStatus, 'That catalogue URL is already configured.', 'error'); return; }
    validatingCatalogue = true; setStatus(validateStatus, 'Fetching and validating the catalogue JSON…');
    try {
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
      let response;
      try { response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } }); }
      finally { clearTimeout(timeout); }
      if (!response.ok) throw new Error(`Catalogue server returned HTTP ${response.status}.`);
      const data = await response.json();
      const details = validation.validateCatalogueDocument(data, adapterId);
      const source = { id: newId(), url, name: details.name, enabled: true, schema: details.schema, adapter_id: details.adapter_id, item_count: details.count, added_at: new Date().toISOString() };
      sources.push(source); enqueue({ op: 'add', source });
      el('catalogueUrl').value = '';
      persistAndRender(`Validated ${details.count} item${details.count === 1 ? '' : 's'} from “${details.name}”. The source is saved in this browser and queued for PS4 sync.`);
      setStatus(validateStatus, 'Catalogue validated and added.', 'success');
    } catch (error) {
      const message = error.name === 'AbortError' ? 'The catalogue request timed out.' : error instanceof SyntaxError ? 'The URL did not return valid JSON.' : error.message;
      setStatus(validateStatus, `${message}${error instanceof TypeError ? ' The catalogue host must allow browser CORS requests.' : ''}`, 'error');
    } finally { validatingCatalogue = false; }
  }

  async function syncPending() {
    if (!connected || !pairingToken || !pending.length || syncing) return;
    if (!remoteRevision) { setStatus(syncStatus, 'Load the PS4 configuration before syncing changes.', 'error'); return; }
    syncing = true; syncBlocked = false;
    const batch = pending.slice();
    const batchId = newId();
    el('syncButton').disabled = true; el('refreshAllButton').disabled = true;
    setStatus(syncStatus, `Synchronising ${batch.length} change${batch.length === 1 ? '' : 's'}…`);
    try {
      const result = await apiRequest(activeIp, '/catalogues/operations', {
        method: 'POST', token: pairingToken, timeout: 15000,
        headers: { 'Idempotency-Key': batchId, 'If-Match': remoteRevision },
        body: { batch_id: batchId, base_revision: remoteRevision, operations: batch }
      });
      if (typeof result.revision !== 'string' || !Array.isArray(result.applied_operation_ids) || !Array.isArray(result.sources)) throw new Error('The PS4 did not confirm the saved catalogue revision and applied operations. Changes remain pending.');
      const acknowledged = new Set(result.applied_operation_ids);
      pending = catalogueState.acknowledge(pending, result.applied_operation_ids);
      remoteRevision = result.revision;
      remoteIds = new Set(result.sources.map(source => source.id).filter(value => typeof value === 'string'));
      sources = applyPendingToRemote(result.sources);
      saveStore(); renderSources();
      if (batch.some(operation => !acknowledged.has(operation.operation_id))) throw new Error('The PS4 acknowledged only part of this batch. Unconfirmed changes remain pending.');
      setStatus(syncStatus, `PS4 confirmed ${batch.length} change${batch.length === 1 ? '' : 's'} at revision ${remoteRevision}.`, 'success');
    } catch (error) {
      if (error.status === 409) {
        try { await loadRemoteConfig(activeIp, pairingToken); } catch (_) { /* Keep cached view and queue. */ }
        syncBlocked = true;
        lastSyncError = 'The PS4 catalogue revision changed. Its current settings were reloaded and your edits remain pending; review them, then sync again.';
        setStatus(syncStatus, lastSyncError, 'error');
      } else {
        lastSyncError = `${error.message} Your edits remain saved in this browser and pending.`;
        setStatus(syncStatus, lastSyncError, 'error');
      }
    } finally {
      syncing = false;
      el('syncButton').disabled = !connected || !pending.length;
      el('refreshAllButton').disabled = !connected;
      renderSources();
    }
  }

  async function refreshCatalogues(sourceIds) {
    if (!connected || !pairingToken) { setStatus(syncStatus, 'Pair with the PS4 to refresh its catalogues.', 'error'); return; }
    if (pending.length) await syncPending();
    if (pending.length) { setStatus(syncStatus, 'Refresh was not started because some catalogue changes are still unconfirmed.', 'error'); return; }
    setStatus(syncStatus, 'Requesting catalogue refresh from the PS4…');
    try {
      const body = sourceIds && sourceIds.length ? { source_ids: sourceIds } : {};
      const result = await apiRequest(activeIp, '/catalogues/refresh', { method: 'POST', token: pairingToken, body });
      if (typeof result.refresh_id !== 'string' || !result.refresh_id) throw new Error('The PS4 did not return a refresh task ID.');
      setStatus(syncStatus, 'Refresh request accepted by the PS4; waiting for its result…', 'pending');
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const state = await apiRequest(activeIp, `/catalogues/refresh/${encodeURIComponent(result.refresh_id)}`, { token: pairingToken });
        if (state.status === 'complete') { setStatus(syncStatus, 'The PS4 confirmed catalogue refresh completion.', 'success'); return; }
        if (state.status === 'failed') throw new Error(state.message || 'The PS4 reported that catalogue refresh failed.');
      }
      setStatus(syncStatus, 'The PS4 accepted the refresh but did not report completion yet.', 'pending');
    } catch (error) { setStatus(syncStatus, error.message, 'error'); }
  }

  function initialize() {
    readStore();
    let savedIp = '';
    try { savedIp = localStorage.getItem(IP_KEY) || ''; } catch (_) { /* Storage is optional. */ }
    const hasSavedIp = validPrivateIp(savedIp);
    ipInput.value = hasSavedIp ? savedIp : '';
    el('manualIpPanel').hidden = hasSavedIp;
    renderSources();
    el('pairButton').addEventListener('click', pairBrowser);
    el('pairingCode').addEventListener('keydown', event => { if (event.key === 'Enter') pairBrowser(); });
    el('addCatalogueForm').addEventListener('submit', validateAndAdd);
    el('catalogueUrl').addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        el('addCatalogueForm').requestSubmit();
      }
    });
    el('syncButton').addEventListener('click', () => { syncBlocked = false; lastSyncError = ''; syncPending(); });
    el('refreshAllButton').addEventListener('click', () => refreshCatalogues());
    ipInput.addEventListener('keydown', event => { if (event.key === 'Enter') connectToPs4(); });
    if (hasSavedIp) {
      setConnection('Connecting to saved PS4…', `Checking ${savedIp}:${API_PORT}`, false);
      connectToPs4(savedIp);
    }
    else {
      setConnection('No PS4 address saved', 'Add the console IP to save it in this browser.', false);
    }

  }

  initialize();
})();

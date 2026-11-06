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
  let rpiAvailable = false;
  let rpiIp = '';
  let syncing = false;
  let syncBlocked = false;
  let lastSyncError = '';
  let syncTimer = 0;

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

  async function rpiRequest(ip, path, body, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 8000);
    try {
      const response = await fetch(`http://${ip}:12800/api/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(body), mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal
      });
      const text = (await response.text()).replace(/("bits"\s*:\s*)0x([\da-f]+)/ig, '$1"0x$2"');
      let result;
      try { result = JSON.parse(text); } catch (_) { throw new Error(`Remote Package Installer returned an unreadable response (HTTP ${response.status}).`); }
      if (!response.ok || result.status === 'fail' || result.ok === false) throw new Error(result.error || result.message || `Remote Package Installer returned HTTP ${response.status}.`);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The Remote Package Installer did not respond in time.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  async function checkRemoteInstaller(ip) {
    const result = await rpiRequest(ip, 'is_exists', { title_id: 'CUSA00000' }, 6000);
    if (result.status !== 'success' || typeof result.exists === 'undefined') throw new Error('The service does not match Remote Package Installer.');
    rpiAvailable = true; rpiIp = ip;
  }

  function setConnection(label, detail, online) {
    el('connectionLabel').textContent = label;
    el('connectionDetail').textContent = detail;
    el('connectionDot').classList.toggle('online', Boolean(online));
    el('connectionDot').classList.toggle('pending', !online && Boolean(pairingToken));
    el('syncButton').disabled = !connected || !pending.length || syncing;
    el('refreshAllButton').disabled = !connected || syncing;
    updatePackageButton();
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
    activeIp = ip;
    pairingToken = '';
    lastSyncError = '';
    try { localStorage.setItem(IP_KEY, ip); } catch (_) { /* IP memory is optional. */ }
    connected = false;
    setConnection('Connecting…', `Checking ${ip}:${API_PORT}`, false);
    setStatus(connectionStatus, 'Checking for the Vortex Prime catalogue service…');
    el('connectButton').disabled = true;
    rpiAvailable = false; rpiIp = '';
    try {
      try { await checkRemoteInstaller(ip); } catch (_) { /* The catalogue service is a separate receiver. */ }
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
      setConnection(rpiAvailable ? 'Remote Package Installer ready' : 'Disconnected', rpiAvailable ? `${ip}:12800 · direct URL installs available` : `${ip}:${API_PORT} is unavailable or incompatible.`, rpiAvailable);
      setStatus(connectionStatus, rpiAvailable ? `Direct URL installs are available. Catalogue sync is unavailable: ${error.message}` : error.message, rpiAvailable ? 'pending' : 'error');
      el('pairingPanel').hidden = true;
      renderSources();
    } finally { el('connectButton').disabled = false; }
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
    const button = el('validateButton');
    const adapterId = 'vortex-v1';
    if (!validation.adapters[adapterId]) { setStatus(validateStatus, 'The Vortex JSON catalogue format is not supported by this page.', 'error'); return; }
    let url;
    try { url = parseCatalogueUrl(el('catalogueUrl').value); }
    catch (error) { setStatus(validateStatus, error.message, 'error'); return; }
    if (validation.isDuplicateUrl(sources, url)) { setStatus(validateStatus, 'That catalogue URL is already configured.', 'error'); return; }
    button.disabled = true; setStatus(validateStatus, 'Fetching and validating the catalogue JSON…');
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
    } finally { button.disabled = false; }
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

  const bgftTasks = [];
  const packageUrl = raw => {
    let url;
    try { url = new URL(raw.trim()); } catch (_) { throw new Error('Enter a complete direct PKG URL.'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Package links must use HTTP or HTTPS.');
    if (url.username || url.password) throw new Error('Package URLs must not contain embedded credentials.');
    if (!url.pathname.toLowerCase().endsWith('.pkg')) throw new Error('The direct URL must point to a .pkg file.');
    url.hash = '';
    return url.href;
  };

  function renderBgftTasks() {
    const list = el('bgftTaskList'); list.replaceChildren();
    if (!bgftTasks.length) {
      const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'No BGFT tasks submitted in this browser session.'; list.append(empty); return;
    }
    for (const task of bgftTasks) {
      const row = document.createElement('article'); row.className = 'source';
      const top = document.createElement('div'); top.className = 'source-top';
      const title = document.createElement('div'); title.className = 'source-title';
      const heading = document.createElement('h3'); heading.textContent = task.name;
      const detail = document.createElement('span'); detail.className = 'source-url'; detail.textContent = task.detail;
      title.append(heading, detail);
      const badge = document.createElement('span'); badge.className = `source-status${task.status === 'complete' ? ' synced' : ''}`; badge.textContent = task.statusLabel || task.status;
      top.append(title, badge); row.append(top);
      if (task.progress !== null && task.progress !== undefined) {
        const progress = document.createElement('progress'); progress.max = 100; progress.value = task.progress; progress.setAttribute('aria-label', `${task.name} progress`); row.append(progress);
      }
      if (task.message) { const message = document.createElement('p'); message.className = 'status'; message.textContent = task.message; row.append(message); }
      list.append(row);
    }
  }

  async function watchBgftTask(task) {
    const terminal = new Set(['complete', 'failed', 'cancelled']);
    for (let attempt = 0; attempt < 600; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 2500));
      try {
        let state;
        if (task.receiver === 'rpi') {
          if (rpiIp !== task.ip) throw new Error('Reconnect to the saved console address to check this task.');
          state = await rpiRequest(task.ip, 'get_task_progress', { task_id: Number(task.taskId) }, 10000);
          if (state.status === 'fail') throw new Error(state.error || 'The PS4 could not return task progress.');
          const total = Number(state.length_total || state.length || 0);
          const received = Number(state.transferred_total || state.transferred || 0);
          if (state.error != null && Number(state.error) !== 0) {
            task.status = 'failed'; task.statusLabel = 'PS4 task failed';
            task.message = `Remote Package Installer reported task error ${state.error}. Check PS4 notifications.`;
            renderBgftTasks(); return;
          }
          task.status = total > 0 && received >= total ? 'complete' : 'downloading';
          task.statusLabel = task.status === 'complete' ? 'Transfer finished' : 'Downloading on PS4';
          task.progress = total > 0 ? Math.max(0, Math.min(100, received / total * 100)) : null;
          task.message = task.status === 'complete' ? 'The PS4 reports transfer completion. Check console notifications for installation result.' : '';
        } else {
          if (!connected || !pairingToken) throw new Error('Reconnect and pair with the PS4 to check this BGFT task.');
          state = await apiRequest(activeIp, `/bgft/tasks/${encodeURIComponent(task.taskId)}`, { token: pairingToken, timeout: 10000 });
          if (state.task_id !== task.taskId || typeof state.status !== 'string') throw new Error('The PS4 returned an invalid BGFT task status.');
          task.status = state.status;
          task.statusLabel = ({ registered: 'Registered with BGFT', queued: 'Queued', downloading: 'Downloading on PS4', installing: 'Installing on PS4', complete: 'Complete' })[state.status] || state.status;
          task.progress = Number.isFinite(state.progress_percent) ? Math.max(0, Math.min(100, state.progress_percent)) : null;
          task.message = state.message || '';
        }
        renderBgftTasks();
        if (terminal.has(task.status) || task.receiver === 'rpi' && task.status === 'complete') return;
      } catch (error) {
        task.statusLabel = 'Status check failed'; task.message = `${error.message} The BGFT task may still be running on the PS4.`; renderBgftTasks(); return;
      }
    }
    task.statusLabel = 'Still running'; task.message = 'The PS4 has not reported a final status yet.'; renderBgftTasks();
  }

  function validateBgftReady() {
    if (!connected || !pairingToken) throw new Error('Connect and pair with a compatible PS4 catalogue/BGFT service first.');
  }

  function confirmInstall() {
    return window.confirm('Important: Completely close the application on your PS4 before continuing. Make sure no downloads are active. Continue with this installation?');
  }

  function updatePackageButton() {
    const hasFile = el('bgftPkgFile').files.length > 0;
    el('bgftUrlButton').disabled = hasFile ? !connected : !(connected || rpiAvailable);
  }

  function selectPkg(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pkg')) {
      el('bgftPkgFile').value = ''; el('selectedPkgName').textContent = '';
      setStatus(el('bgftUrlStatus'), 'Drop or select a file ending in .pkg.', 'error'); updatePackageButton(); return;
    }
    el('bgftPackageUrl').value = '';
    el('selectedPkgName').textContent = `Direct PKG selected · ${file.name} · ${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    setStatus(el('bgftUrlStatus'), 'Direct PKG selected. Press Send to transfer it to the paired PS4 service.', 'pending');
    updatePackageButton();
  }

  async function submitPackage(event) {
    event.preventDefault();
    const button = el('bgftUrlButton');
    const file = el('bgftPkgFile').files[0];
    try {
      if (file) validateBgftReady();
      else if (!rpiAvailable && !connected) throw new Error('Use the saved PS4 address or enter its IP address first.');
      const url = file ? '' : packageUrl(el('bgftPackageUrl').value);
      if (!confirmInstall()) return;
      button.disabled = true; el('bgftUploadProgress').hidden = !file; el('bgftUploadProgress').value = 0;
      if (file) {
        if (!file.name.toLowerCase().endsWith('.pkg')) throw new Error('Choose a file with the .pkg extension.');
        setStatus(el('bgftUrlStatus'), `Sending ${file.name} directly to the PS4…`, 'pending');
        const result = await apiClient.upload(activeIp, `/bgft/uploads?filename=${encodeURIComponent(file.name)}`, file, pairingToken, percent => {
          el('bgftUploadProgress').value = percent;
          setStatus(el('bgftUrlStatus'), `Sending PKG to PS4: ${percent}%`, 'pending');
        });
        if (typeof result.task_id !== 'string' || !result.task_id || result.source !== 'upload' || !['registered', 'queued'].includes(result.status)) throw new Error('The PS4 did not confirm the PKG and BGFT task registration.');
        const task = { taskId: result.task_id, receiver: 'bgft', name: file.name, detail: `${(file.size / (1024 * 1024)).toFixed(1)} MB · sent to PS4`, status: result.status, statusLabel: result.status === 'registered' ? 'Registered with BGFT' : 'Queued', progress: null };
        bgftTasks.unshift(task); el('bgftPkgFile').value = ''; el('selectedPkgName').textContent = ''; renderBgftTasks();
        setStatus(el('bgftUrlStatus'), `The PS4 confirmed BGFT task ${result.task_id}.`, 'success'); watchBgftTask(task);
      } else if (rpiAvailable && rpiIp === activeIp) {
        setStatus(el('bgftUrlStatus'), 'Sending the direct URL to Remote Package Installer…', 'pending');
        const result = await rpiRequest(rpiIp, 'install', { type: 'direct', packages: [url] }, 20000);
        const taskId = Number(result.task_id);
        if (result.status !== 'success' || !Number.isInteger(taskId) || taskId < 0) throw new Error('The PS4 did not confirm a valid installation task.');
        const task = { taskId: String(taskId), receiver: 'rpi', ip: rpiIp, name: 'Direct PKG URL', detail: url, status: 'downloading', statusLabel: 'Downloading on PS4', progress: null };
        bgftTasks.unshift(task); el('bgftPackageUrl').value = ''; renderBgftTasks();
        setStatus(el('bgftUrlStatus'), `Remote Package Installer accepted task ${taskId}.`, 'success'); watchBgftTask(task);
      } else {
        setStatus(el('bgftUrlStatus'), 'Sending the direct URL to the paired PS4 BGFT service…', 'pending');
        const result = await apiRequest(activeIp, '/bgft/tasks', { method: 'POST', token: pairingToken, timeout: 20000, body: { source: 'url', package_url: url } });
        if (typeof result.task_id !== 'string' || !result.task_id || typeof result.status !== 'string' || !['registered', 'queued'].includes(result.status)) throw new Error('The PS4 did not confirm BGFT task registration.');
        const task = { taskId: result.task_id, receiver: 'bgft', name: 'Direct URL install', detail: url, status: result.status, statusLabel: result.status === 'registered' ? 'Registered with BGFT' : 'Queued', progress: null };
        bgftTasks.unshift(task); el('bgftPackageUrl').value = ''; renderBgftTasks();
        setStatus(el('bgftUrlStatus'), `The PS4 confirmed BGFT task ${result.task_id}.`, 'success'); watchBgftTask(task);
      }
    } catch (error) { setStatus(el('bgftUrlStatus'), error.message, 'error'); }
    finally { button.disabled = !(connected || rpiAvailable); }
  }

  function initialize() {
    readStore();
    let savedIp = '';
    try { savedIp = localStorage.getItem(IP_KEY) || ''; } catch (_) { /* Storage is optional. */ }
    ipInput.value = savedIp;
    renderSources();
    el('connectButton').addEventListener('click', () => connectToPs4());
    el('pairButton').addEventListener('click', pairBrowser);
    el('bgftUrlForm').addEventListener('submit', submitPackage);
    el('bgftPackageUrl').addEventListener('input', () => {
      if (el('bgftPackageUrl').value.trim() && el('bgftPkgFile').files.length) {
        el('bgftPkgFile').value = ''; el('selectedPkgName').textContent = '';
      }
      updatePackageButton();
    });
    el('bgftPkgFile').addEventListener('change', () => selectPkg(el('bgftPkgFile').files[0]));
    const drop = el('pkgDropTarget');
    drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', event => {
      event.preventDefault(); drop.classList.remove('dragover');
      const file = event.dataTransfer.files[0];
      if (!file) return;
      try {
        const transfer = new DataTransfer(); transfer.items.add(file); el('bgftPkgFile').files = transfer.files;
        selectPkg(file);
      } catch (_) { setStatus(el('bgftUrlStatus'), 'This browser could not accept the dropped file. Use the file picker instead.', 'error'); }
    });
    el('pairingCode').addEventListener('keydown', event => { if (event.key === 'Enter') pairBrowser(); });
    el('addCatalogueForm').addEventListener('submit', validateAndAdd);
    el('syncButton').addEventListener('click', () => { syncBlocked = false; lastSyncError = ''; syncPending(); });
    el('refreshAllButton').addEventListener('click', () => refreshCatalogues());
    ipInput.addEventListener('keydown', event => { if (event.key === 'Enter') connectToPs4(); });
    updatePackageButton();
    if (savedIp && validPrivateIp(savedIp)) connectToPs4(savedIp);
    else {
      setConnection('No PS4 address saved', 'Enter the console IP here if you downloaded the PKG to USB.', false);
    }
    el('packageToggle').addEventListener('click', () => {
      const panel = el('bgftUrlForm');
      const expanded = panel.hidden;
      panel.hidden = !expanded;
      el('packageToggle').setAttribute('aria-expanded', String(expanded));
      el('packageToggle').querySelector('.package-toggle-icon').textContent = expanded ? '−' : '+';
    });
  }

  initialize();
})();

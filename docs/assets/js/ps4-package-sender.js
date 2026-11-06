(function () {
  'use strict';

  const API_PORT = 12801;
  const API_ID = 'vortex-prime.ps4-catalogue-service';
  const API_VERSION = 1;
  const IP_KEY = 'vortexPrime.consoleIp.ps4';
  const TOKEN_KEY = 'vortexPrime.ps4.catalogueManager.pairingToken';
  const bgftMode = new URLSearchParams(window.location.search).get('receiver') === 'bgft';
  const apiModule = window.VortexPrimeCatalogueApi;
  if (!apiModule) throw new Error('The PS4 communication client did not load.');
  const api = apiModule.createClient(window.fetch.bind(window), API_PORT);
  const el = id => document.getElementById(id);
  const ipInput = el('ps4Ip');
  let activeIp = '';
  let rpiReady = false;
  let bridgeReady = false;
  let pairingToken = '';
  let challengeId = '';

  function setStatus(node, message, kind) {
    node.textContent = message || '';
    node.dataset.kind = kind || '';
    node.hidden = !message;
  }

  function setConnection(label, detail, online, pending) {
    el('connectionLabel').textContent = label;
    el('connectionDetail').textContent = detail;
    el('connectionDot').classList.toggle('online', Boolean(online));
    el('connectionDot').classList.toggle('pending', Boolean(pending));
    updateSendButton();
  }

  function validPrivateIp(value) {
    const parts = String(value || '').trim().split('.');
    if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
    const [a, b] = parts.map(Number);
    return a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31 || a === 169 && b === 254;
  }

  function validatePackageUrl(value) {
    let url;
    try { url = new URL(value.trim()); } catch (_) { throw new Error('Enter a complete direct PKG URL.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.pathname.toLowerCase().endsWith('.pkg')) throw new Error('Use an HTTP or HTTPS link to a .pkg file without embedded credentials.');
    url.hash = '';
    return url.href;
  }

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
      try { result = JSON.parse(text); } catch (_) { throw new Error(`Remote Package Installer returned unreadable data (HTTP ${response.status}).`); }
      if (!response.ok || result.status === 'fail' || result.ok === false) throw new Error(result.error || result.message || `Remote Package Installer returned HTTP ${response.status}.`);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Remote Package Installer did not respond in time.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  async function connect(ipValue) {
    const ip = String(ipValue || '').trim();
    if (!validPrivateIp(ip)) { setStatus(el('connectionStatus'), 'Enter the PS4 private IPv4 address shown in its network settings.', 'error'); return; }
    ipInput.value = ip; activeIp = ip; rpiReady = false; bridgeReady = false; pairingToken = '';
    try { localStorage.setItem(IP_KEY, ip); } catch (_) { /* Saving the address is optional. */ }
    setConnection('Checking PS4…', `Testing the saved local address ${ip}.`, false, true);
    setStatus(el('connectionStatus'), 'Checking the installation receiver…', 'pending');
    el('useIpButton').disabled = true;
    if (!bgftMode) {
      try { await rpiRequest(ip, 'is_exists', { title_id: 'CUSA00000' }, 6000); rpiReady = true; } catch (_) { /* Check the separate paired bridge too. */ }
    }
    try {
      const status = await api.request(ip, '/status');
      bridgeReady = status.service === API_ID && status.api_version === API_VERSION;
    } catch (_) { bridgeReady = false; }
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null'); } catch (_) { return null; } })();
    if (bridgeReady && saved && saved.ip === ip && typeof saved.token === 'string') {
      pairingToken = saved.token;
    }
    if (bgftMode && bridgeReady && pairingToken) {
      setConnection('BGFT ready', `${ip} · paired console service`, true, false);
      setStatus(el('connectionStatus'), 'This FPKG sender is connected to the paired BGFT service.', 'success');
    } else if (bgftMode && bridgeReady) {
      setConnection('BGFT pairing needed', `${ip} · BGFT service detected`, false, true);
      setStatus(el('connectionStatus'), 'Pair this browser with the console to send FPKGs through BGFT.', 'pending');
      try { await startPairing(); } catch (error) { setStatus(el('connectionStatus'), error.message, 'error'); }
    } else if (bgftMode) {
      setConnection('BGFT service unavailable', `${ip} · paired BGFT service not detected`, false, false);
      setStatus(el('connectionStatus'), 'The BGFT service is unavailable at this address. This button will not switch to another receiver.', 'error');
    } else if (rpiReady && pairingToken) {
      setConnection('PS4 ready', `${ip} · direct URL and paired BGFT uploads available`, true, false);
      setStatus(el('connectionStatus'), 'Remote Package Installer detected; this browser is paired with the BGFT bridge.', 'success');
    } else if (rpiReady) {
      setConnection('PS4 ready', `${ip} · direct URL installs available`, true, false);
      setStatus(el('connectionStatus'), bridgeReady ? 'Remote Package Installer detected. Pair this browser to enable local PKG uploads.' : 'Remote Package Installer detected. Direct URL installs are ready; local uploads need the separate paired BGFT bridge.', 'success');
    } else if (bridgeReady && pairingToken) {
      setConnection('PS4 ready', `${ip} · paired BGFT bridge`, true, false);
      setStatus(el('connectionStatus'), 'The paired PS4 BGFT bridge is ready.', 'success');
    } else if (bridgeReady) {
      setConnection('Pairing needed', `${ip} · BGFT bridge detected`, false, true);
      setStatus(el('connectionStatus'), 'Pair this browser with the PS4 to send a package.', 'pending');
      try { await startPairing(); } catch (error) { setStatus(el('connectionStatus'), error.message, 'error'); }
    } else {
      setConnection('PS4 receiver unavailable', `${ip} · check the IP and receiver`, false, false);
      setStatus(el('connectionStatus'), 'Could not find Remote Package Installer or the paired BGFT bridge at this address.', 'error');
    }
    el('useIpButton').disabled = false;
    updateSendButton();
  }

  async function startPairing() {
    if (!bridgeReady) throw new Error('The PS4 BGFT upload bridge is unavailable at this address.');
    const result = await api.request(activeIp, '/pairing/challenge', { method: 'POST', body: { client: 'Vortex Prime package sender', api_version: API_VERSION, scopes: ['packages:install'] } });
    if (typeof result.challenge_id !== 'string' || !result.challenge_id) throw new Error('The PS4 did not return a pairing request.');
    challengeId = result.challenge_id;
    el('pairingPanel').hidden = false;
    setStatus(el('pairStatus'), 'Approve this browser on the PS4. Enter the one-time code displayed there.', 'pending');
  }

  async function pairBrowser() {
    const code = el('pairingCode').value.trim();
    if (!challengeId || !code) { setStatus(el('pairStatus'), 'Enter the one-time code displayed on the PS4.', 'error'); return; }
    el('pairButton').disabled = true;
    try {
      const result = await api.request(activeIp, '/pairing/authorize', { method: 'POST', body: { challenge_id: challengeId, code } });
      if (!result.access_token || !Array.isArray(result.scopes) || !result.scopes.includes('packages:install')) throw new Error('The PS4 did not authorize package installation for this browser.');
      pairingToken = result.access_token;
      try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ ip: activeIp, token: pairingToken })); } catch (_) { /* Pairing lasts for this page session. */ }
      el('pairingPanel').hidden = true;
      setConnection('PS4 ready', `${activeIp} · paired BGFT bridge`, true, false);
      setStatus(el('connectionStatus'), 'This browser is paired with the PS4 BGFT bridge.', 'success');
      setStatus(el('pairStatus'), '', '');
    } catch (error) { setStatus(el('pairStatus'), error.message, 'error'); }
    finally { el('pairButton').disabled = false; updateSendButton(); }
  }

  function updateSendButton() {
    const fileSelected = el('pkgFile').files.length > 0;
    el('sendButton').disabled = bgftMode
      ? !(bridgeReady && pairingToken)
      : fileSelected ? !(rpiReady || bridgeReady) : !(rpiReady || bridgeReady && pairingToken);
  }

  function renderTask(name, id, status, detail) {
    const node = el('taskStatus'); node.hidden = false; node.replaceChildren();
    const title = document.createElement('strong'); title.textContent = `${name} · ${status}`;
    const description = document.createElement('small'); description.textContent = detail || `Task ${id}`;
    node.append(title, description);
  }

  async function watchTask(task) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      try {
        if (task.receiver === 'rpi') {
          const state = await rpiRequest(task.ip, 'get_task_progress', { task_id: Number(task.id) }, 10000);
          if (state.status === 'fail' || Number(state.error || 0) !== 0) { renderTask(task.name, task.id, 'PS4 reported an error', state.error || state.message || 'Check PS4 notifications.'); return; }
          const total = Number(state.length_total || state.length || 0);
          const received = Number(state.transferred_total || state.transferred || 0);
          if (total > 0 && received >= total) { renderTask(task.name, task.id, 'Transfer finished', 'Check PS4 notifications for the installation result.'); return; }
          renderTask(task.name, task.id, 'Downloading on PS4', total > 0 ? `${(received / total * 100).toFixed(1)}% transferred` : 'Progress is not available yet.');
        } else {
          const state = await api.request(activeIp, `/bgft/tasks/${encodeURIComponent(task.id)}`, { token: pairingToken, timeout: 10000 });
          if (state.task_id !== task.id) throw new Error('The PS4 returned a different task ID.');
          renderTask(task.name, task.id, state.status, state.message || (Number.isFinite(state.progress_percent) ? `${state.progress_percent}%` : ''));
          if (['complete', 'failed', 'cancelled'].includes(state.status)) return;
        }
      } catch (error) { renderTask(task.name, task.id, 'Status unavailable', `${error.message} Check the PS4 notifications.`); return; }
    }
    renderTask(task.name, task.id, 'Still running', 'The PS4 has not reported a final status yet.');
  }

  function selectFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pkg')) {
      el('pkgFile').value = ''; el('selectedFile').textContent = '';
      setStatus(el('sendStatus'), 'Choose a file ending in .pkg.', 'error'); updateSendButton(); return;
    }
    el('packageUrl').value = '';
    el('selectedFile').textContent = `Direct PKG selected · ${file.name} · ${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    setStatus(el('sendStatus'), '', '');
    updateSendButton();
  }

  async function sendPackage(event) {
    event.preventDefault();
    const file = el('pkgFile').files[0];
    const button = el('sendButton');
    try {
      if (!activeIp) throw new Error('Use the saved console address or enter the PS4 IP first.');
      const url = file ? '' : validatePackageUrl(el('packageUrl').value);
      if ((file || bgftMode) && (!bridgeReady || !pairingToken)) {
        await startPairing();
        throw new Error('Pair the BGFT bridge with the one-time code, then press Send again.');
      }
      if (!bgftMode && !file && !rpiReady && !(bridgeReady && pairingToken)) {
        if (bridgeReady) {
          await startPairing();
          throw new Error('Pair the PS4 with the one-time code, then press Send again.');
        }
        throw new Error('No compatible PS4 installation receiver is connected.');
      }
      if (!window.confirm('Important: Completely close the application on your PS4 before continuing. Make sure no downloads are active. Continue with this installation?')) return;
      button.disabled = true;
      if (file) {
        el('uploadProgress').hidden = false; el('uploadProgress').value = 0;
        setStatus(el('sendStatus'), `Sending ${file.name} directly to the PS4…`, 'pending');
        const result = await api.upload(activeIp, `/bgft/uploads?filename=${encodeURIComponent(file.name)}`, file, pairingToken, percent => {
          el('uploadProgress').value = percent; setStatus(el('sendStatus'), `Sending PKG to PS4: ${percent}%`, 'pending');
        });
        if (!result.task_id || result.source !== 'upload' || !['registered', 'queued'].includes(result.status)) throw new Error('The PS4 did not confirm the upload and BGFT task registration.');
        setStatus(el('sendStatus'), `The PS4 registered BGFT task ${result.task_id}.`, 'success');
        renderTask(file.name, result.task_id, 'Registered with BGFT', 'The PKG was sent to the PS4 service, not stored by Vortex Prime.');
        el('pkgFile').value = ''; el('selectedFile').textContent = '';
        watchTask({ receiver: 'bgft', id: result.task_id, name: file.name });
      } else if (!bgftMode && rpiReady) {
        setStatus(el('sendStatus'), 'Sending the direct URL to Remote Package Installer…', 'pending');
        const result = await rpiRequest(activeIp, 'install', { type: 'direct', packages: [url] }, 20000);
        const id = Number(result.task_id);
        if (result.status !== 'success' || !Number.isInteger(id) || id < 0) throw new Error('The PS4 did not confirm a valid installation task.');
        setStatus(el('sendStatus'), `Remote Package Installer accepted task ${id}.`, 'success');
        renderTask('Direct PKG URL', id, 'Downloading on PS4', url);
        el('packageUrl').value = '';
        watchTask({ receiver: 'rpi', id, ip: activeIp, name: 'Direct PKG URL' });
      } else {
        setStatus(el('sendStatus'), 'Sending the direct URL to the paired PS4 BGFT service…', 'pending');
        const result = await api.request(activeIp, '/bgft/tasks', { method: 'POST', token: pairingToken, timeout: 20000, body: { source: 'url', package_url: url } });
        if (!result.task_id || !['registered', 'queued'].includes(result.status)) throw new Error('The PS4 did not confirm BGFT task registration.');
        setStatus(el('sendStatus'), `The PS4 registered BGFT task ${result.task_id}.`, 'success');
        renderTask('Direct PKG URL', result.task_id, result.status, url);
        el('packageUrl').value = '';
        watchTask({ receiver: 'bgft', id: result.task_id, name: 'Direct PKG URL' });
      }
    } catch (error) { setStatus(el('sendStatus'), error.message, 'error'); }
    finally { updateSendButton(); }
  }

  function initialize() {
    let savedIp = '';
    try { savedIp = localStorage.getItem(IP_KEY) || ''; } catch (_) { /* Storage is optional. */ }
    ipInput.value = savedIp;
    if (bgftMode) {
      el('pageTitle').textContent = 'Send FPKG via BGFT';
      el('pageLead').textContent = 'Connect to the paired PS4 BGFT service and send a direct package URL or local FPKG.';
      el('sendButton').textContent = 'Send FPKG';
      el('sendHeading').textContent = 'BGFT service connection';
      el('pageNote').textContent = 'BGFT mode sends only through the paired PS4 BGFT service. If that service is unavailable, the request stops; it never falls back to Remote Package Installer or a Vortex server.';
    }
    el('useIpButton').addEventListener('click', () => connect(ipInput.value));
    ipInput.addEventListener('keydown', event => { if (event.key === 'Enter') connect(ipInput.value); });
    el('pairButton').addEventListener('click', pairBrowser);
    el('pairingCode').addEventListener('keydown', event => { if (event.key === 'Enter') pairBrowser(); });
    el('sendPackageForm').addEventListener('submit', sendPackage);
    el('packageUrl').addEventListener('input', () => {
      if (el('packageUrl').value.trim() && el('pkgFile').files.length) { el('pkgFile').value = ''; el('selectedFile').textContent = ''; }
      updateSendButton();
    });
    el('pkgFile').addEventListener('change', () => selectFile(el('pkgFile').files[0]));
    const drop = el('pkgDropTarget');
    drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', event => {
      event.preventDefault(); drop.classList.remove('dragover');
      const file = event.dataTransfer.files[0];
      if (!file) return;
      try { const transfer = new DataTransfer(); transfer.items.add(file); el('pkgFile').files = transfer.files; selectFile(file); }
      catch (_) { setStatus(el('sendStatus'), 'This browser could not accept the dropped file. Use the file picker instead.', 'error'); }
    });
    updateSendButton();
    if (savedIp && validPrivateIp(savedIp)) connect(savedIp);
    else setConnection('No PS4 address saved', 'Enter the IP here if you downloaded the PKG to USB.', false, false);
  }

  initialize();
})();

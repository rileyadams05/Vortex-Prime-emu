(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const packageUrl = (params.get('url') || '').trim();
  const packageName = (params.get('name') || 'package').trim();
  const packageVersion = (params.get('version') || '').trim();
  const savedIpKey = 'vortexPrime.consoleIp.ps4';
  const retryButton = document.getElementById('retryButton');
  const downloadTab = document.getElementById('downloadTab');
  const browserTab = document.getElementById('browserTab');
  const downloadPanel = document.getElementById('downloadPanel');
  const browserPanel = document.getElementById('browserPanel');
  const ipInput = document.getElementById('consoleIp');
  const findStatus = document.getElementById('findStatus');
  const connectStatus = document.getElementById('connectStatus');
  const installStatus = document.getElementById('installStatus');
  const searchButton = document.getElementById('searchButton');
  const connectButton = document.getElementById('connectButton');
  const installButton = document.getElementById('installButton');
  const authorizedInput = document.getElementById('authorized');
  const progressWrap = document.getElementById('progressWrap');
  const progressEl = document.getElementById('progress');
  const progressLabel = document.getElementById('progressLabel');
  let currentStep = 1;
  let compatibleReceiver = '';
  let connectedIp = '';
  let retryAttemptsRemaining = 0;
  let connectionCheckInProgress = false;

  function safePackageUrl(value) {
    try {
      const parsed = new URL(value);
      return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password && parsed.pathname.toLowerCase().endsWith('.pkg') ? parsed.href : '';
    } catch (_) { return ''; }
  }

  function setStatus(element, message, kind) {
    element.textContent = message || '';
    element.dataset.kind = kind || '';
  }

  function validPrivateIPv4(value) {
    const parts = value.split('.');
    if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
    const [a, b] = parts.map(Number);
    return a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31 || a === 169 && b === 254;
  }

  function apiBase(ip) {
    return `http://${ip}:12800`;
  }

  function setMode(mode) {
    const isBrowser = mode === 'browser';
    const wasBrowser = !browserPanel.hidden;
    downloadPanel.hidden = isBrowser;
    browserPanel.hidden = !isBrowser;
    downloadTab.classList.toggle('active', !isBrowser);
    browserTab.classList.toggle('active', isBrowser);
    downloadTab.setAttribute('aria-selected', String(!isBrowser));
    browserTab.setAttribute('aria-selected', String(isBrowser));

    if (isBrowser && !wasBrowser) {
      let savedIp = '';
      try { savedIp = localStorage.getItem(savedIpKey) || ''; } catch (_) { /* Storage is optional. */ }
      if (savedIp && validPrivateIPv4(savedIp)) {
        ipInput.value = savedIp;
        document.getElementById('manualForm').hidden = false;
        retryAttemptsRemaining = 2;
        findConsole(savedIp);
      }
    }
  }
  function setStep(step) {
    currentStep = step;
    document.querySelectorAll('[data-step-marker]').forEach(marker => {
      const number = Number(marker.dataset.stepMarker);
      marker.classList.toggle('active', number === step);
      marker.classList.toggle('complete', number < step);
    });
    document.getElementById('findPanel').hidden = step !== 1;
    document.getElementById('connectPanel').hidden = step !== 2;
    document.getElementById('installPanel').hidden = step !== 3;
  }

  function makeJsonParseable(text) {
    // flatz writes the progress bits as a hexadecimal token, not strict JSON.
    return text.replace(/("bits"\s*:\s*)0x([\da-f]+)/ig, '$1"0x$2"');
  }

  async function postJson(url, body, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || 8000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const text = await response.text();
      let result;
      try { result = JSON.parse(makeJsonParseable(text)); }
      catch (_) { throw new Error(`The receiver returned an unreadable response (HTTP ${response.status}).`); }
      if (!response.ok || result.status === 'fail' || result.ok === false) {
        throw new Error(result.error || result.message || `The receiver rejected the request (HTTP ${response.status}).`);
      }
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function testRemoteInstaller(ip) {
    const result = await postJson(`http://${ip}:12800/api/is_exists`, { title_id: 'CUSA00000' }, 6000);
    if (result.status !== 'success' || typeof result.exists === 'undefined') {
      throw new Error('A service answered, but it did not match the Remote Package Installer API.');
    }
    compatibleReceiver = 'rpi';
  }

  function showManualForm(message) {
    document.getElementById('manualForm').hidden = false;
    setStatus(findStatus, message, '');
    ipInput.focus();
  }

  async function findConsole(ip) {
    const value = (ip || ipInput.value).trim();
    if (connectionCheckInProgress) return;
    if (!validPrivateIPv4(value)) {
      showManualForm('Enter the PS4 local IP address shown in Settings → Network → View Connection Status.');
      setStatus(findStatus, 'Enter a private IPv4 address such as 192.168.1.50.', 'error');
      return;
    }

    connectedIp = value;
    compatibleReceiver = '';
    ipInput.value = value;
    document.getElementById('manualForm').hidden = false;
    retryButton.hidden = true;
    connectButton.hidden = false;
    connectionCheckInProgress = true;
    try { localStorage.setItem(savedIpKey, value); } catch (_) { /* Storage is optional. */ }
    searchButton.disabled = true;
    connectButton.disabled = true;
    retryButton.disabled = true;
    setStatus(findStatus, 'Checking the saved PS4 address…');

    try {
      await testRemoteInstaller(value);
      retryAttemptsRemaining = 0;
      document.getElementById('connectedIp').textContent = value;
      setStatus(connectStatus, 'Remote Package Installer detected and ready.', 'success');
      setStep(2);
    } catch (error) {
      const detail = error.name === 'AbortError' ? 'The connection check timed out.' : error.message;
      if (retryAttemptsRemaining > 0) {
        retryButton.textContent = `Retry connection (${retryAttemptsRemaining} ${retryAttemptsRemaining === 1 ? 'attempt' : 'attempts'} left)`;
        retryButton.hidden = false;
        connectButton.hidden = true;
        setStatus(findStatus, `${detail} Check the network and retry the saved IP.`, 'error');
      } else {
        try { localStorage.removeItem(savedIpKey); } catch (_) { /* Storage is optional. */ }
        ipInput.value = '';
        retryButton.hidden = true;
        connectButton.hidden = false;
        document.getElementById('manualForm').hidden = true;
        setStatus(findStatus, 'Could not connect after three attempts. Search again to enter the PS4 IP address.', 'error');
      }
    } finally {
      connectionCheckInProgress = false;
      searchButton.disabled = false;
      connectButton.disabled = false;
      retryButton.disabled = false;
    }
  }
  function updateInstallButton() {
    installButton.disabled = !authorizedInput.checked || !safePackageUrl(packageUrl);
  }

  function prepareInstall() {
    document.getElementById('installSummary').textContent = `${packageName}${packageVersion ? ` · Version ${packageVersion}` : ''} · PS4 ${connectedIp} · Remote Package Installer`;
    setStep(3);
  }

  function makeJsonParseableForProgress(text) {
    return text.replace(/("bits"\s*:\s*)0x([\da-f]+)/ig, '$1"0x$2"');
  }

  async function pollProgress(base, taskId) {
    progressWrap.hidden = false;
    progressEl.removeAttribute('value');
    progressLabel.textContent = 'Task registered. Waiting for transfer progress…';
    let consecutiveErrors = 0;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      try {
        const response = await fetch(`${base}/api/get_task_progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({ task_id: taskId }),
          signal: AbortSignal.timeout ? AbortSignal.timeout(7000) : undefined
        });
        const text = await response.text();
        const result = JSON.parse(makeJsonParseableForProgress(text));
        if (!response.ok || result.status === 'fail') throw new Error(result.error || 'Progress is unavailable.');
        consecutiveErrors = 0;
        if (result.error != null && Number(result.error) !== 0) {
          setStatus(installStatus, `The PS4 reported task error ${result.error}. Check console notifications.`, 'error');
          return;
        }
        const total = Number(result.length_total || result.length || 0);
        const transferred = Number(result.transferred_total || result.transferred || 0);
        if (total > 0 && Number.isFinite(transferred)) {
          const percent = Math.min(100, Math.max(0, transferred / total * 100));
          progressEl.value = percent;
          progressLabel.textContent = `${percent.toFixed(1)}% transferred · ${formatBytes(transferred)} of ${formatBytes(total)}`;
          if (transferred >= total) {
            setStatus(installStatus, 'Package transfer finished. Check PS4 notifications for the installation result.', 'success');
            return;
          }
        } else if (Number.isFinite(Number(result.preparing_percent)) && Number(result.preparing_percent) >= 0) {
          const percent = Math.min(100, Number(result.preparing_percent));
          progressEl.value = percent;
          progressLabel.textContent = `Preparing package: ${percent}%`;
        }
      } catch (_) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= 4) {
          progressEl.removeAttribute('value');
          progressLabel.textContent = 'Progress is temporarily unavailable. Check PS4 notifications.';
        }
      }
    }
    setStatus(installStatus, 'The PS4 accepted the task, but progress polling timed out. Check the console notifications.', 'success');
  }

  function formatBytes(value) {
    if (!Number.isFinite(value) || value < 0) return '—';
    if (value < 1024) return `${value} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = value / 1024;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
    return `${size.toFixed(1)} ${units[unit]}`;
  }

  async function submitInstall() {
    if (!authorizedInput.checked || !safePackageUrl(packageUrl)) return;
    const confirmation = `Install ${packageName}${packageVersion ? ` (version ${packageVersion})` : ''} on your PS4?\n\nImportant: Completely close the application on your PS4 before continuing. Make sure no downloads are active.\n\nThis process will not uninstall an existing application.`;
    if (!window.confirm(confirmation)) return;

    installButton.disabled = true;
    setStatus(installStatus, 'Sending installation request…');
    progressWrap.hidden = true;
    const base = apiBase(connectedIp);
    try {
      const result = await postJson(`${base}/api/install`, { type: 'direct', packages: [packageUrl] }, 20000);
      const taskId = Number(result.task_id);
      if (!Number.isInteger(taskId) || taskId < 0) throw new Error('The receiver response did not include a valid task ID. Check PS4 notifications before retrying.');
      setStatus(installStatus, `Remote Package Installer accepted task ${taskId}${result.title ? ` for ${result.title}` : ''}.`, 'success');
      await pollProgress(base, taskId);
    } catch (error) {
      const detail = error.name === 'AbortError' ? 'The request timed out.' : error.message;
      setStatus(installStatus, `${detail} Check the IP, receiver, package URL availability, and browser local-network permission.`, 'error');
      installButton.disabled = false;
    }
  }

  function initializePackage() {
    document.getElementById('heroTitle').innerHTML = `Install ${escapeHtml(packageName)}<br>on your PS4.`;
    document.getElementById('heroSubtitle').textContent = packageVersion
      ? `Version ${packageVersion} · Download the .PKG or install it directly on your console.`
      : 'Download the .PKG file and install it on your console. It\'s quick and safe.';
    const validUrl = safePackageUrl(packageUrl);
    const downloadLink = document.getElementById('downloadLink');
    const downloadStatus = document.getElementById('downloadStatus');
    if (validUrl) {
      downloadLink.href = validUrl;
      downloadLink.hidden = false;
      downloadLink.classList.remove('disabled');
      downloadLink.removeAttribute('aria-disabled');
      setStatus(downloadStatus, '', '');
    } else {
      downloadLink.href = '#';
      downloadLink.classList.add('disabled');
      downloadLink.setAttribute('aria-disabled', 'true');
      setStatus(downloadStatus, 'Select a PS4 package first to enable its download.', '');
    }
    downloadLink.addEventListener('click', event => {
      if (!validUrl) {
        event.preventDefault();
        setStatus(downloadStatus, 'Select a PS4 package first to enable its download.', 'error');
      }
    });
    try {
      ipInput.value = localStorage.getItem(savedIpKey) || '';
    } catch (_) { /* Storage is optional. */ }
    searchButton.addEventListener('click', () => {
      if (!retryButton.hidden) {
        setStatus(findStatus, 'Use the retry button beneath the saved IP, or edit the IP address to try a different PS4.', '');
        return;
      }
      if (ipInput.value.trim()) {
        retryAttemptsRemaining = 2;
        findConsole(ipInput.value.trim());
      } else {
        showManualForm('Automatic network discovery is limited by browser security. Enter your PS4 IP address to check the receiver.');
      }
    });
    connectButton.addEventListener('click', () => {
      retryAttemptsRemaining = 2;
      findConsole(ipInput.value);
    });
    retryButton.addEventListener('click', () => {
      if (retryAttemptsRemaining <= 0 || connectionCheckInProgress) return;
      retryAttemptsRemaining -= 1;
      findConsole(ipInput.value);
    });
    ipInput.addEventListener('input', () => {
      if (connectionCheckInProgress) return;
      retryAttemptsRemaining = 2;
      retryButton.hidden = true;
      connectButton.hidden = false;
    });
    document.getElementById('continueInstallButton').addEventListener('click', () => {
      if (compatibleReceiver !== 'rpi') {
        setStatus(connectStatus, 'Remote Package Installer compatibility has not been confirmed.', 'error');
        return;
      }
      prepareInstall();
    });
    authorizedInput.addEventListener('change', updateInstallButton);
    installButton.addEventListener('click', submitInstall);
    downloadTab.addEventListener('click', () => setMode('download'));
    browserTab.addEventListener('click', () => setMode('browser'));
    updateInstallButton();
  }

  function escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = String(value);
    return node.innerHTML;
  }

  initializePackage();
})();











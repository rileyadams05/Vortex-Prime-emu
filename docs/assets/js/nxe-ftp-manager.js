/**
 * NXE FTP Server Remote Control - Vortex Prime
 * Handles Manual Connection (IP, Port, Username, Password), Account-backed Session Persistence,
 * Real-time Server Status & Control (Turn On, Turn Off, Restart, Reconnect, Change Details, Forget).
 */

(function initializeNxeFtp() {
    const authPanel          = document.getElementById('nxeFtpAuthPanel');
    const app                = document.getElementById('nxeFtpApp');
    const loading            = document.getElementById('nxeFtpLoading');
    const pairPanel          = document.getElementById('nxeFtpPairPanel');
    const successPanel       = document.getElementById('nxeFtpSuccessPanel');
    const continueBtn        = document.getElementById('nxeFtpContinueBtn');
    const pairMessage        = document.getElementById('nxeFtpPairMessage');
    const message            = document.getElementById('nxeFtpMessage');
    const ipInput            = document.getElementById('nxeFtpIpInput');
    const portInput          = document.getElementById('nxeFtpPortInput');
    const usernameInput      = document.getElementById('nxeFtpUsernameInput');
    const passwordInput      = document.getElementById('nxeFtpPasswordInput');
    const connectBtn         = document.getElementById('nxeFtpConnectBtn');
    
    let pair          = null;
    let pairKey       = '';
    let pairRequestId = 0;
    let relaySocket   = null;
    let relayPromise  = null;
    let relaySequence = 0;
    const relayPending = new Map();
    
    const SAVED_IP_KEY       = 'nxe-saved-ip';
    const SAVED_PORT_KEY     = 'nxe-saved-port';
    const SAVED_USER_KEY     = 'nxe-saved-username';
    const LAST_PAIR_ID_KEY   = 'nxe-last-pair-id';

    // Helper: UI Status Message
    function setMessage(value, error = false) {
        const target = pairPanel && !pairPanel.hidden ? pairMessage : message;
        if (target) {
            target.textContent = value || '';
            target.style.color = error ? '#ff8b80' : '';
        }
    }

    // Helper: Connection Status Text
    function setState(value) {
        const el = document.getElementById('nxeFtpConnection');
        if (el) el.textContent = value;
    }

    // Helper: Server Button State Controls & Unreachable Banner
    function setFtpStatusDisplay(running, transient) {
        const el = document.getElementById('nxeFtpStatus');
        if (!el) return;
        if (transient) {
            el.textContent = transient;
            el.style.color = 'var(--color-text-secondary)';
        } else {
            el.textContent = running ? 'Running' : 'Stopped';
            el.style.color  = running ? '#8fcc3e' : '#ff8b80';
        }
        const btnStart   = document.getElementById('nxeFtpBtnStart');
        const btnStop    = document.getElementById('nxeFtpBtnStop');
        const btnRestart = document.getElementById('nxeFtpBtnRestart');
        if (transient) {
            if (btnStart)   btnStart.disabled   = true;
            if (btnStop)    btnStop.disabled    = true;
            if (btnRestart) btnRestart.disabled = true;
        } else {
            if (btnStart)   { btnStart.disabled   = Boolean(running); btnStart.style.display   = running ? 'none' : ''; }
            if (btnStop)    { btnStop.disabled    = !running;          btnStop.style.display    = running ? '' : 'none'; }
            if (btnRestart) { btnRestart.disabled = !running; }
        }
    }

    // Render Auth Panel / Pair Panel / Main App
    function renderAuth(user) {
        if (loading) loading.hidden = true;
        if (authPanel) authPanel.hidden = Boolean(user);
        const inSuccess = successPanel && !successPanel.hidden;
        if (pairPanel) pairPanel.hidden = !user || Boolean(pair) || inSuccess;
        if (app) app.hidden = !user || !pair || inSuccess;
        
        if (!user) {
            pairRequestId += 1;
            pair = null; pairKey = '';
            if (pairMessage) pairMessage.textContent = '';
            if (message) message.textContent = '';
            closeRelay();
            return;
        }
        
        if (!pair) {
            const savedIp = localStorage.getItem(SAVED_IP_KEY) || '';
            const savedPort = localStorage.getItem(SAVED_PORT_KEY) || '2121';
            const savedUser = localStorage.getItem(SAVED_USER_KEY) || '';
            if (ipInput && savedIp) ipInput.value = savedIp;
            if (portInput && savedPort) portInput.value = savedPort;
            if (usernameInput && savedUser) usernameInput.value = savedUser;
            claimPair();
        }
    }

    // Render Connection Details
    function renderPair() {
        if (!pair) return;
        const ip = pair.consoleIp || 'Unknown';
        const port = pair.ftpPort || localStorage.getItem(SAVED_PORT_KEY) || '2121';
        const user = pair.username || localStorage.getItem(SAVED_USER_KEY) || '';
        
        const ipEl        = document.getElementById('nxeFtpIp');
        const portEl      = document.getElementById('nxeFtpPort');
        const authModeEl  = document.getElementById('nxeFtpAuthMode');
        const guideIpEl   = document.getElementById('nxeFtpGuideIp');
        const guidePortEl = document.getElementById('nxeFtpGuidePort');
        
        if (ipEl)        ipEl.textContent        = ip;
        if (portEl)      portEl.textContent      = port;
        if (authModeEl)  authModeEl.textContent  = user ? ('Username / Password (' + user + ')') : 'None';
        if (guideIpEl)   guideIpEl.textContent   = ip;
        if (guidePortEl) guidePortEl.textContent = port;
        
        setFtpStatusDisplay(Boolean(pair.running));
    }

    function parsePairHash() {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        return { pairId: params.get('pair') || '', key: params.get('key') || '' };
    }

    function isValidIpv4Address(value) {
        const parts = String(value || '').split('.');
        return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
    }

    function normalizeIpv4Input(value) {
        let entered = String(value || '').trim();
        entered = entered.replace(/^(?:https?|ftp):\/\//i, '');
        entered = entered.replace(/[:\/].*$/, '').trim();
        if (isValidIpv4Address(entered)) return entered;
        const missingZeroOctet = entered.match(/^192\.168\.(\d{1,3})$/);
        if (missingZeroOctet && Number(missingZeroOctet[1]) <= 255) {
            return '192.168.0.' + Number(missingZeroOctet[1]);
        }
        if (!/^192168\d{2,6}$/.test(entered)) return entered;

        const tail = entered.slice(6);
        const candidates = [];
        for (let split = 1; split < tail.length; split += 1) {
            const third = tail.slice(0, split);
            const fourth = tail.slice(split);
            if ((third === '0' || !third.startsWith('0')) &&
                (fourth === '0' || !fourth.startsWith('0')) &&
                Number(third) <= 255 && Number(fourth) <= 255) {
                candidates.push('192.168.' + Number(third) + '.' + Number(fourth));
            }
        }
        return candidates.length === 1 ? candidates[0] : entered;
    }

    function closeRelay() {
        const socket = relaySocket;
        relaySocket = null;
        relayPromise = null;
        if (socket) try { socket.close(1000, 'Page closed'); } catch (error) {}
        relayPending.forEach(pending => pending.reject(new Error('NXE cloud relay disconnected.')));
        relayPending.clear();
    }

    function ensureRelay() {
        if (!pair || !pair.pairId) return Promise.reject(new Error('No console connected.'));
        if (relaySocket && relaySocket.readyState === WebSocket.OPEN) return Promise.resolve(relaySocket);
        if (relayPromise) return relayPromise;
        relayPromise = new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            let relayUrl = protocol + '//' + window.location.host + '/api/nxe/relay/browser?pairId=' + encodeURIComponent(pair.pairId);
            if (pairKey) relayUrl += '&key=' + encodeURIComponent(pairKey);
            const socket = new WebSocket(relayUrl);
            let settled = false;
            const timeout = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    relayPromise = null;
                    try { socket.close(); } catch (error) {}
                    reject(new Error('Timed out waiting for the NXE cloud relay.'));
                }
            }, 15000);
            socket.onopen = () => {
                relaySocket = socket;
                clearTimeout(timeout);
                if (!settled) { settled = true; resolve(socket); }
            };
            socket.onmessage = (event) => {
                let data;
                try { data = JSON.parse(event.data); } catch (error) { return; }
                if (data.type === 'response' && data.id) {
                    const pending = relayPending.get(data.id);
                    if (!pending) return;
                    relayPending.delete(data.id);
                    clearTimeout(pending.timeout);
                    if (data.ok) pending.resolve(data);
                    else pending.reject(new Error(data.message || 'NXE relay request failed.'));
                } else if (data.type === 'relay-error') {
                    relayPending.forEach(pending => {
                        clearTimeout(pending.timeout);
                        pending.reject(new Error(data.message || 'NXE console is not connected.'));
                    });
                    relayPending.clear();
                } else if (data.type === 'console-state') {
                    if (data.connected) {
                        setState('Connected');
                        refreshStatus();
                    } else {
                        setState('Disconnected');
                    }
                }
            };
            socket.onerror = () => {
                relayPromise = null;
                if (!settled) { settled = true; clearTimeout(timeout); reject(new Error('Could not open the NXE cloud relay.')); }
            };
            socket.onclose = () => {
                if (relaySocket === socket) relaySocket = null;
                relayPromise = null;
                relayPending.forEach(pending => {
                    clearTimeout(pending.timeout);
                    pending.reject(new Error('NXE cloud relay disconnected.'));
                });
                relayPending.clear();
            };
        });
        return relayPromise;
    }

    async function relayRequest(payload, timeoutMs) {
        const socket = await ensureRelay();
        const id = 'relay_' + Date.now().toString(36) + '_' + (++relaySequence).toString(36);
        payload = Object.assign({ type: 'request', id: id }, payload || {});
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                relayPending.delete(id);
                reject(new Error('NXE did not answer the cloud relay request in time.'));
            }, timeoutMs || 30000);
            relayPending.set(id, { resolve: resolve, reject: reject, timeout: timeout });
            try { socket.send(JSON.stringify(payload)); }
            catch (error) { clearTimeout(timeout); relayPending.delete(id); reject(error); }
        });
    }

    // API wrapper routed through the authenticated console WebSocket.
    async function api(pathname, options) {
        options = options || {};
        if (!pair || !pairKey) throw new Error('No console connected.');
        const response = await relayRequest({
            operation: 'api',
            method: options.method || 'GET',
            path: pathname,
            body: typeof options.body === 'string' ? options.body : ''
        });
        return response.body || {};
    }

    // Manual Connection Flow
    async function connectByManual() {
        let ip = ipInput ? ipInput.value : '';
        const port = (portInput && portInput.value ? portInput.value.trim() : '') || '2121';
        const user = usernameInput ? usernameInput.value.trim() : '';
        
        ip = normalizeIpv4Input(ip);
        if (ipInput) ipInput.value = ip;
        if (!ip) { setMessage('Enter the console IP address first.', true); return false; }
        if (!isValidIpv4Address(ip)) {
            setMessage('Enter a valid console IP address including the dots, for example 192.168.0.70, and double-check every digit.', true);
            return false;
        }
        setMessage('Connecting to console...');
        if (connectBtn) { connectBtn.disabled = true; connectBtn.textContent = 'Connecting...'; }
        
        try {
            const saveResp = await fetch('/api/nxe/pair/connect', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ consoleIp: ip, ftpPort: port })
            });
            const saveData = await saveResp.json().catch(() => ({}));
            if (!saveResp.ok) throw new Error(saveData.message || 'Unable to register console with your account.');
            pair       = saveData.pair;
            pairKey    = saveData.controlToken || '';
            if (!pair || !pairKey) throw new Error('Vortex Prime could not restore this console connection.');
            
            if (user) {
                pair.username = user;
                localStorage.setItem(SAVED_USER_KEY, user);
            } else {
                localStorage.removeItem(SAVED_USER_KEY);
            }
            if (port) {
                pair.ftpPort = port;
                localStorage.setItem(SAVED_PORT_KEY, port);
            }
            
            saveConsoleSession(pair, pairKey);
            onConnected();
            return true;
        } catch (error) {
            setMessage(error.message, true);
            if (connectBtn) { connectBtn.disabled = false; connectBtn.textContent = 'Connect'; }
            return false;
        }
    }

    function saveConsoleSession(pairObj, key) {
        if (!pairObj) return;
        if (key && pairObj.pairId) localStorage.setItem('nxe-pair-key:' + pairObj.pairId, key);
        if (pairObj.consoleIp) localStorage.setItem(SAVED_IP_KEY, pairObj.consoleIp);
        if (pairObj.pairId) localStorage.setItem(LAST_PAIR_ID_KEY, pairObj.pairId);
    }

    function onConnected(isInitialPairing = true) {
        if (isInitialPairing) {
            if (pairPanel) pairPanel.hidden = true;
            if (app) app.hidden = true;
            if (successPanel) successPanel.hidden = false;
            renderPair();
            setState('Connected');
            setMessage('');
            if (connectBtn) { connectBtn.disabled = false; connectBtn.textContent = 'Connect'; }
        } else {
            enterControlPanel();
        }
    }

    function enterControlPanel() {
        if (pairPanel) pairPanel.hidden = true;
        if (successPanel) successPanel.hidden = true;
        if (app) app.hidden = false;
        renderPair();
        setState('Connected');
        setMessage('');
        if (connectBtn) { connectBtn.disabled = false; connectBtn.textContent = 'Connect'; }
        refreshStatus();
    }

    // Restore the console saved under the signed-in Vortex Prime account.
    async function claimPair() {
        if (typeof currentUser === 'undefined' || !currentUser) return;
        const user      = currentUser;
        const requestId = ++pairRequestId;
        const parsed    = parsePairHash();
        let isInitialPair = Boolean(parsed.pairId && parsed.key);
        
        try {
            if (!parsed.pairId || !parsed.key) {
                // Restore saved console session from list
                const saved     = await fetch('/api/nxe/pair/list', { credentials: 'include' });
                const savedData = await saved.json().catch(() => ({}));
                if (!saved.ok) throw new Error(savedData.message || 'Unable to load paired consoles.');
                const lastPairId = localStorage.getItem(LAST_PAIR_ID_KEY);
                const pairs = savedData.pairs || [];
                const selected = (lastPairId ? pairs.find(p => p.pairId === lastPairId) : null) || pairs[0];
                if (!selected) {
                    if (pairPanel) pairPanel.hidden = false;
                    return;
                }
                parsed.pairId = selected.pairId;
                parsed.key    = localStorage.getItem('nxe-pair-key:' + selected.pairId) || '';
                if (!parsed.key) {
                    if (pairPanel) pairPanel.hidden = false;
                    if (ipInput) ipInput.value = selected.consoleIp || '';
                    if (portInput) portInput.value = selected.ftpPort || '2121';
                    if (selected.consoleIp) await connectByManual();
                    return;
                }
                isInitialPair = false;
            }
            
            const response = await fetch('/api/nxe/pair/claim', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pairId: parsed.pairId, controlToken: parsed.key })
            });
            const data = await response.json().catch(() => ({}));
            if (typeof currentUser === 'undefined' || user !== currentUser || requestId !== pairRequestId) return;
            if (!response.ok) throw new Error(data.message || 'Unable to pair this console.');
            
            pair    = data.pair;
            pairKey = parsed.key;
            saveConsoleSession(pair, pairKey);
            
            if (window.location.hash.indexOf('pair=') >= 0) history.replaceState(null, '', window.location.pathname);
            onConnected(isInitialPair);
        } catch (error) {
            if (typeof currentUser !== 'undefined' && user === currentUser && requestId === pairRequestId && pairPanel) {
                pairPanel.hidden = false;
            }
        }
    }

    // Refresh Console Status & Reachability Check
    async function refreshStatus(retries = 2) {
        if (!pair) return;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const status = await api('/api/v1/device/status');
                pair.running = Boolean(status.ftpRunning);
                setState('Connected');
                setFtpStatusDisplay(pair.running);
                if (status.failure) setMessage(status.failure, true); else setMessage('');
                return;
            } catch (error) {
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
                    continue;
                }
                const savedIp = pair.consoleIp || localStorage.getItem(SAVED_IP_KEY) || 'console';
                setState('Disconnected');
                setFtpStatusDisplay(false);
                setMessage('NXE console not reachable at ' + savedIp + '. Double-check every IP digit. If the Xbox address changed, select Change Connection Details and enter the new address shown in NXE Settings → FTP.', true);
            }
        }
    }

    // Change Connection Details (Switch back to form with prefilled values)
    function changeConnectionDetails() {
        if (app) app.hidden = true;
        if (successPanel) successPanel.hidden = true;
        if (pairPanel) pairPanel.hidden = false;
        
        if (ipInput && pair && pair.consoleIp) ipInput.value = pair.consoleIp;
        if (portInput && pair && pair.ftpPort) portInput.value = pair.ftpPort;
        if (usernameInput) usernameInput.value = localStorage.getItem(SAVED_USER_KEY) || '';
        if (passwordInput) passwordInput.value = '';
        if (pairMessage) pairMessage.textContent = '';
        if (ipInput) ipInput.focus();
    }

    // Forget Console / Clear Local Credentials
    function forgetConsole() {
        closeRelay();
        if (pair && pair.pairId) localStorage.removeItem('nxe-pair-key:' + pair.pairId);
        localStorage.removeItem(SAVED_IP_KEY);
        localStorage.removeItem(SAVED_PORT_KEY);
        localStorage.removeItem(SAVED_USER_KEY);
        localStorage.removeItem(LAST_PAIR_ID_KEY);
        pairRequestId += 1;
        pair = null; pairKey = '';
        if (app) app.hidden = true;
        if (successPanel) successPanel.hidden = true;
        if (pairPanel) pairPanel.hidden = false;
        if (pairMessage) pairMessage.textContent = '';
        if (ipInput) ipInput.value = '';
        if (portInput) portInput.value = '2121';
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
    }

    // Send Server Command (Turn On, Turn Off, Restart)
    async function sendCommand(type) {
        if (!pair) return;
        const labels = { start: 'Starting', stop: 'Stopping', restart: 'Restarting' };
        setFtpStatusDisplay(null, labels[type] || type);
        setMessage('');
        try {
            const data = await api('/api/v1/ftp/' + type, { method: 'POST' });
            pair.running = Boolean(data.ftpRunning);
            setFtpStatusDisplay(pair.running);
            setState('Connected');
        } catch(error) { setMessage(error.message, true); refreshStatus(); }
    }

    // Event Wireup
    if (connectBtn) connectBtn.addEventListener('click', connectByManual);
    [ipInput, portInput, usernameInput, passwordInput].forEach(inp => {
        if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') connectByManual(); });
    });

    document.getElementById('nxeFtpReconnect')?.addEventListener('click', async () => {
        closeRelay();
        setMessage('Reconnecting to console...');
        await refreshStatus(2);
    });
    
    document.getElementById('nxeFtpChangeConnection')?.addEventListener('click', changeConnectionDetails);
    document.getElementById('nxeFtpChangeIp')?.addEventListener('click', changeConnectionDetails);
    document.getElementById('nxeFtpForget')?.addEventListener('click', forgetConsole);
    continueBtn?.addEventListener('click', enterControlPanel);

    document.querySelectorAll('[data-nxe-command]').forEach((btn) => {
        btn.addEventListener('click', () => sendCommand(btn.dataset.nxeCommand));
    });

    window.addEventListener('vortex-account-changed', (e) => renderAuth(e.detail.user));
    window.addEventListener('hashchange', () => {
        if (typeof currentUser === 'undefined' || !currentUser) return;
        pairRequestId += 1; pair = null;
        if (app) app.hidden = true;
        if (pairPanel) pairPanel.hidden = false;
        claimPair();
    });

    if (typeof currentUser !== 'undefined' && currentUser) renderAuth(currentUser);
}());

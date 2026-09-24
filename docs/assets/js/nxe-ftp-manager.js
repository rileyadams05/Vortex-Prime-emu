/**
 * NXE FTP Server Remote Control - Vortex Prime
 *
 * State machine: CHECKING → CONNECTED or DISCONNECTED (after retries).
 *
 * Core rule: refreshing the browser must never stop the Xbox FTP server.
 * The Xbox is the source of truth. The website only queries and displays.
 *
 * On page load / refresh:
 *   1. Read saved console details.
 *   2. Show neutral "Checking…" for all status fields.
 *   3. Contact NXE via cloud relay.
 *   4. Populate Connection / FTP Server / Authentication from the live response.
 *
 * Failed polls show "Unknown" not "Stopped" — the website cannot claim the
 * server stopped when it simply cannot reach the Xbox momentarily.
 *
 * Polling runs every 5 s while the control panel is visible.
 * Stale async responses are discarded via a monotonic statusGeneration counter.
 */

(function initializeNxeFtp() {
    // Timer shims – the Node.js VM test harness only provides a stub setTimeout;
    // guard all timer functions so the code works in both environments.
    /* eslint-disable no-var */
    var _setTimeout    = (typeof setTimeout    === 'function') ? setTimeout    : function() { return 0; };
    var _clearTimeout  = (typeof clearTimeout  === 'function') ? clearTimeout  : function() {};
    var _setInterval   = (typeof setInterval   === 'function') ? setInterval   : function() { return 0; };
    var _clearInterval = (typeof clearInterval === 'function') ? clearInterval : function() {};
    /* eslint-enable no-var */

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

    // Credentials Buttons
    const btnSetCredentials    = document.getElementById('nxeFtpBtnSetCredentials');
    const btnChangeCredentials = document.getElementById('nxeFtpBtnChangeCredentials');
    const btnViewCredentials   = document.getElementById('nxeFtpBtnViewCredentials');

    // Edit/Change Credentials Modal Elements
    const credModal          = document.getElementById('nxeFtpCredModal');
    const credModalTitle     = document.getElementById('nxeFtpCredModalTitle');
    const credUser           = document.getElementById('nxeFtpCredUser');
    const credPass           = document.getElementById('nxeFtpCredPass');
    const credConfirm        = document.getElementById('nxeFtpCredConfirm');
    const credError          = document.getElementById('nxeFtpCredError');
    const credSaveBtn        = document.getElementById('nxeFtpCredSave');
    const credRemoveBtn      = document.getElementById('nxeFtpCredRemove');
    const credCancelBtn      = document.getElementById('nxeFtpCredCancel');
    const credCloseBtn       = document.getElementById('nxeFtpCredClose');

    // View Credentials Modal Elements
    const viewCredModal      = document.getElementById('nxeFtpViewCredModal');
    const viewUserEl         = document.getElementById('nxeFtpViewUser');
    const viewPassEl         = document.getElementById('nxeFtpViewPass');
    const toggleViewPassBtn  = document.getElementById('nxeFtpToggleViewPass');
    const copyViewPassBtn    = document.getElementById('nxeFtpCopyViewPass');
    const viewToChangeBtn    = document.getElementById('nxeFtpBtnViewToChange');
    const viewCredCloseBtn   = document.getElementById('nxeFtpViewCredClose');
    const viewCredDismissBtn = document.getElementById('nxeFtpViewCredDismiss');

    let pair          = null;
    let pairKey       = '';
    let pairRequestId = 0;
    let relaySocket   = null;
    let relayPromise  = null;
    let relaySequence = 0;
    const relayPending = new Map();

    let cachedPassword  = '';
    let passwordVisible = false;

    // ── Polling ────────────────────────────────────────────────────────────────
    let pollTimer       = null;   // setInterval handle for background status polling
    let statusGeneration = 0;     // incremented on every refresh call; stale callbacks compare against it
    const POLL_INTERVAL_MS = 5000;

    // ── Relay reconnect backoff ────────────────────────────────────────────────
    let relayReconnectTimer  = null;
    let relayReconnectDelay  = 2000;  // starts at 2 s, doubles each fail up to 30 s

    // ── localStorage keys ─────────────────────────────────────────────────────
    const SAVED_IP_KEY     = 'nxe-saved-ip';
    const SAVED_PORT_KEY   = 'nxe-saved-port';
    const SAVED_USER_KEY   = 'nxe-saved-username';
    const LAST_PAIR_ID_KEY = 'nxe-last-pair-id';

    // ══════════════════════════════════════════════════════════════════════════
    //  UI helpers
    // ══════════════════════════════════════════════════════════════════════════

    function setMessage(value, error) {
        const target = pairPanel && !pairPanel.hidden ? pairMessage : message;
        if (target) {
            target.textContent = value || '';
            target.style.color = error ? '#ff8b80' : '';
        }
    }

    /** Set the Connection row text + colour. */
    function setState(value, kind) {
        // kind: 'ok' | 'err' | 'neutral' (default neutral)
        const el = document.getElementById('nxeFtpConnection');
        if (!el) return;
        el.textContent = value;
        if (kind === 'ok')      { el.style.color = '#8fcc3e'; }
        else if (kind === 'err'){ el.style.color = '#ff8b80'; }
        else                    { el.style.color = 'var(--color-text-secondary)'; }
    }

    /**
     * Set the Authentication/storage-verified row.
     * verified === true  → green ✓ Yes
     * verified === false → red No (+ optional reason)
     * verified === null  → neutral dash (unknown / checking)
     * verified === 'checking' → neutral Checking…
     */
    function setAuthStatus(verified, reason) {
        const el = document.getElementById('nxeFtpAuth');
        if (!el) return;
        if (verified === true) {
            el.innerHTML = '<span style="color:#8fcc3e;font-weight:600;">&#10003; Yes</span>';
        } else if (verified === false) {
            el.innerHTML = '<span style="color:#ff8b80;font-weight:600;">No' + (reason ? ' (' + reason + ')' : '') + '</span>';
        } else if (verified === 'checking') {
            el.innerHTML = '<span style="color:var(--color-text-secondary);">Checking&#8230;</span>';
        } else {
            el.innerHTML = '<span style="color:var(--color-text-secondary);">&#8212;</span>';
        }
    }

    function setCredentialButtons(hasCredentials) {
        if (btnSetCredentials)    btnSetCredentials.hidden    = Boolean(hasCredentials);
        if (btnChangeCredentials) btnChangeCredentials.hidden = !hasCredentials;
        if (btnViewCredentials)   btnViewCredentials.hidden   = !hasCredentials;
    }

    /**
     * Update the FTP Server row.
     * running === true  → green Running
     * running === false → red Stopped
     * running === null  → neutral transient label (e.g. "Starting…")
     * running === 'unknown' → neutral Unknown
     */
    function setFtpStatusDisplay(running, transientLabel) {
        const el = document.getElementById('nxeFtpStatus');
        if (!el) return;
        if (transientLabel) {
            el.textContent  = transientLabel;
            el.style.color  = 'var(--color-text-secondary)';
        } else if (running === true) {
            el.textContent = 'Running';
            el.style.color = '#8fcc3e';
        } else if (running === false) {
            el.textContent = 'Stopped';
            el.style.color = '#ff8b80';
        } else {
            // running === 'unknown' or null — show neutral Unknown
            el.textContent = 'Unknown';
            el.style.color = 'var(--color-text-secondary)';
        }
        const btnStart   = document.getElementById('nxeFtpBtnStart');
        const btnStop    = document.getElementById('nxeFtpBtnStop');
        const btnRestart = document.getElementById('nxeFtpBtnRestart');
        if (transientLabel || running === null || running === 'unknown') {
            if (btnStart)   btnStart.disabled   = true;
            if (btnStop)    btnStop.disabled    = true;
            if (btnRestart) btnRestart.disabled = true;
        } else {
            if (btnStart)   { btnStart.disabled   = Boolean(running); btnStart.style.display   = running ? 'none' : ''; }
            if (btnStop)    { btnStop.disabled    = !running;          btnStop.style.display    = running ? '' : 'none'; }
            if (btnRestart) { btnRestart.disabled = !running; }
        }
    }

    /** Put all three status fields into a uniform "Checking…" pending state. */
    function setCheckingState() {
        setState('Checking\u2026', 'neutral');
        setFtpStatusDisplay(null, 'Checking\u2026');
        setAuthStatus('checking');
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Panel rendering
    // ══════════════════════════════════════════════════════════════════════════

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
            stopPolling();
            closeRelay();
            return;
        }

        if (!pair) {
            const savedIp   = localStorage.getItem(SAVED_IP_KEY)   || '';
            const savedPort = localStorage.getItem(SAVED_PORT_KEY)  || '2121';
            const savedUser = localStorage.getItem(SAVED_USER_KEY)  || '';
            if (ipInput && savedIp) ipInput.value = savedIp;
            if (portInput)          portInput.value = savedPort;
            if (usernameInput)      usernameInput.value = savedUser;
            claimPair();
        }
    }

    /**
     * Populate IP / Port labels.
     * DOES NOT call setFtpStatusDisplay — status comes only from the live Xbox response.
     */
    function renderPair() {
        if (!pair) return;
        const ip   = pair.consoleIp || 'Unknown';
        const port = pair.ftpPort   || localStorage.getItem(SAVED_PORT_KEY) || '2121';

        const ipEl        = document.getElementById('nxeFtpIp');
        const portEl      = document.getElementById('nxeFtpPort');
        const guideIpEl   = document.getElementById('nxeFtpGuideIp');
        const guidePortEl = document.getElementById('nxeFtpGuidePort');

        if (ipEl)        ipEl.textContent        = ip;
        if (portEl)      portEl.textContent      = port;
        if (guideIpEl)   guideIpEl.textContent   = ip;
        if (guidePortEl) guidePortEl.textContent = port;

        // Status fields are left as "Checking…" until refreshStatus() resolves.
        // Do NOT call setFtpStatusDisplay(Boolean(pair.running)) here —
        // pair.running is stale from the cloud listing, not the live Xbox state.
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Input helpers
    // ══════════════════════════════════════════════════════════════════════════

    function parsePairHash() {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        return { pairId: params.get('pair') || '', key: params.get('key') || '' };
    }

    function isValidIpv4Address(value) {
        const parts = String(value || '').split('.');
        return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
    }

    function normalizeIpv4Input(value) {
        let entered = String(value || '').trim();
        entered = entered.replace(/^(?:https?|ftp):\/\//i, '');
        entered = entered.replace(/[:/].*$/, '').trim();
        if (isValidIpv4Address(entered)) return entered;
        const missingZeroOctet = entered.match(/^192\.168\.(\d{1,3})$/);
        if (missingZeroOctet && Number(missingZeroOctet[1]) <= 255) {
            return '192.168.0.' + Number(missingZeroOctet[1]);
        }
        if (!/^192168\d{2,6}$/.test(entered)) return entered;
        const tail = entered.slice(6);
        const candidates = [];
        for (let split = 1; split < tail.length; split += 1) {
            const third  = tail.slice(0, split);
            const fourth = tail.slice(split);
            if ((third === '0' || !third.startsWith('0')) &&
                (fourth === '0' || !fourth.startsWith('0')) &&
                Number(third) <= 255 && Number(fourth) <= 255) {
                candidates.push('192.168.' + Number(third) + '.' + Number(fourth));
            }
        }
        return candidates.length === 1 ? candidates[0] : entered;
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Cloud relay WebSocket
    // ══════════════════════════════════════════════════════════════════════════

    function closeRelay() {
        _clearTimeout(relayReconnectTimer);
        relayReconnectTimer = null;
        const socket = relaySocket;
        relaySocket  = null;
        relayPromise = null;
        if (socket) try { socket.close(1000, 'Page closed'); } catch (_) {}
        relayPending.forEach((pending) => pending.reject(new Error('NXE cloud relay disconnected.')));
        relayPending.clear();
    }

    /**
     * Schedule a relay reconnect attempt.
     * Only triggers if we still have a valid pair (i.e. user hasn't forgotten the console).
     * Uses exponential backoff capped at 30 s.
     */
    function scheduleRelayReconnect() {
        if (relayReconnectTimer || !pair) return;
        relayReconnectTimer = _setTimeout(() => {
            relayReconnectTimer = null;
            if (!pair) return;
            // Attempt to re-open by calling ensureRelay() (will create a new socket)
            ensureRelay().then(() => {
                relayReconnectDelay = 2000;   // reset on success
                // After reconnecting, immediately refresh status
                refreshStatus();
            }).catch(() => {
                relayReconnectDelay = Math.min(relayReconnectDelay * 2, 30000);
                scheduleRelayReconnect();
            });
        }, relayReconnectDelay);
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
            let settled  = false;
            const timeout = _setTimeout(() => {
                if (!settled) {
                    settled = true;
                    relayPromise = null;
                    try { socket.close(); } catch (_) {}
                    reject(new Error('Timed out waiting for the NXE cloud relay.'));
                }
            }, 15000);

            socket.onopen = () => {
                relaySocket = socket;
                _clearTimeout(timeout);
                if (!settled) { settled = true; resolve(socket); }
            };

            socket.onmessage = (event) => {
                let data;
                try { data = JSON.parse(event.data); } catch (_) { return; }

                if (data.type === 'response' && data.id) {
                    const pending = relayPending.get(data.id);
                    if (!pending) return;
                    relayPending.delete(data.id);
                    _clearTimeout(pending.timeout);
                    if (data.ok) pending.resolve(data);
                    else pending.reject(new Error(data.message || 'NXE relay request failed.'));

                } else if (data.type === 'relay-error') {
                    // The console is not connected to the relay — set status to
                    // neutral Unknown rather than a false red error, then retry.
                    relayPending.forEach((pending) => {
                        _clearTimeout(pending.timeout);
                        pending.reject(new Error(data.message || 'NXE console is not connected.'));
                    });
                    relayPending.clear();
                    // Don't immediately show Disconnected/Stopped/No.
                    // The console might just be reconnecting to the relay.
                    setState('Connecting\u2026', 'neutral');

                } else if (data.type === 'console-state') {
                    if (data.connected) {
                        // Console just (re)connected to the relay — get fresh status.
                        setState('Connected', 'ok');
                        refreshStatus();
                    } else {
                        // Console disconnected from relay — don't flip everything to red.
                        // Show neutral and schedule a retry; the Xbox FTP server is likely still running.
                        setState('Reconnecting\u2026', 'neutral');
                        setFtpStatusDisplay(null, 'Unknown');
                        setAuthStatus(null);
                        scheduleRelayReconnect();
                    }
                }
            };

            socket.onerror = () => {
                relayPromise = null;
                if (!settled) { settled = true; _clearTimeout(timeout); reject(new Error('Could not open the NXE cloud relay.')); }
            };

            socket.onclose = () => {
                if (relaySocket === socket) relaySocket = null;
                relayPromise = null;
                relayPending.forEach((pending) => {
                    _clearTimeout(pending.timeout);
                    pending.reject(new Error('NXE cloud relay disconnected.'));
                });
                relayPending.clear();
                // Auto-reconnect if we still have a valid pair
                if (pair) scheduleRelayReconnect();
            };
        });
        return relayPromise;
    }

    async function relayRequest(payload, timeoutMs) {
        const socket = await ensureRelay();
        const id     = 'relay_' + Date.now().toString(36) + '_' + (++relaySequence).toString(36);
        payload = Object.assign({ type: 'request', id: id }, payload || {});
        return new Promise((resolve, reject) => {
            const timeout = _setTimeout(() => {
                relayPending.delete(id);
                reject(new Error('NXE did not answer the cloud relay request in time.'));
            }, timeoutMs || 30000);
            relayPending.set(id, { resolve, reject, timeout });
            try { socket.send(JSON.stringify(payload)); }
            catch (error) { _clearTimeout(timeout); relayPending.delete(id); reject(error); }
        });
    }

    /** API call routed through the authenticated console WebSocket. */
    async function api(pathname, options) {
        options = options || {};
        if (!pair || !pairKey) throw new Error('No console connected.');
        const response = await relayRequest({
            operation: 'api',
            method:    options.method || 'GET',
            path:      pathname,
            body:      typeof options.body === 'string' ? options.body : ''
        });
        return response.body || {};
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Polling
    // ══════════════════════════════════════════════════════════════════════════

    function startPolling() {
        if (pollTimer) return;  // already running
        pollTimer = _setInterval(() => {
            if (pair && app && !app.hidden) refreshStatus();
        }, POLL_INTERVAL_MS);
    }

    function stopPolling() {
        if (pollTimer) { _clearInterval(pollTimer); pollTimer = null; }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Status refresh (the key function — asks the Xbox for live state)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Ask the Xbox for its current live status and update the UI.
     *
     * Strategy:
     *   - Retry up to `retries` times (default 2) with 600 ms / 1200 ms gaps.
     *   - On success: show green Connected / Running|Stopped / Yes|No.
     *   - On all retries exhausted: show Disconnected (connection row only) +
     *     Unknown for FTP Server + neutral — for Auth.
     *     DO NOT show "FTP Server: Stopped" or "Auth: No" — the website cannot
     *     know those values if it cannot reach the Xbox.
     *
     * A monotonic `statusGeneration` counter prevents stale async responses
     * from overwriting a more recent successful result.
     */
    async function refreshStatus(retries) {
        if (!pair) return;
        retries = (retries == null) ? 2 : retries;
        const generation = ++statusGeneration;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const status = await api('/api/v1/device/status');

                // Discard if a newer call already completed
                if (generation !== statusGeneration) return;

                pair.running = Boolean(status.ftpRunning);
                setState('Connected', 'ok');
                setFtpStatusDisplay(pair.running);
                setMessage('');

                const storageOk = Boolean(status.storageVerified);
                setAuthStatus(storageOk, storageOk ? '' : (status.storageMessage || 'Storage not available'));

                const hasCreds = Boolean(status.hasCredentials || (status.username && status.username.length > 0));
                setCredentialButtons(hasCreds);

                if (status.username) {
                    pair.username = status.username;
                    localStorage.setItem(SAVED_USER_KEY, status.username);
                }
                if (status.failure) setMessage(status.failure, true);
                return;

            } catch (error) {
                if (attempt < retries) {
                    await new Promise((r) => _setTimeout(r, 600 * (attempt + 1)));
                    continue;
                }
                // All retries exhausted — but discard if a newer call already resolved
                if (generation !== statusGeneration) return;

                // Show that we lost contact — but DO NOT claim FTP stopped or auth failed.
                // The Xbox server is still running; we just can't reach it right now.
                const savedIp = pair.consoleIp || localStorage.getItem(SAVED_IP_KEY) || 'console';
                setState('Disconnected', 'err');
                setFtpStatusDisplay(null, 'Unknown');   // Not "Stopped" — we don't know
                setAuthStatus(null);                    // Not "No" — we don't know
                setCredentialButtons(Boolean(localStorage.getItem(SAVED_USER_KEY)));
                setMessage(
                    'NXE console not reachable at ' + savedIp +
                    '. Double-check every IP digit. If the Xbox address changed, select Change Connection Details and enter the new address shown in NXE Settings \u2192 FTP.',
                    true
                );
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Connection flow
    // ══════════════════════════════════════════════════════════════════════════

    async function connectByManual() {
        let ip   = ipInput ? ipInput.value : '';
        const port = (portInput && portInput.value ? portInput.value.trim() : '') || '2121';
        const user = usernameInput ? usernameInput.value.trim() : '';

        ip = normalizeIpv4Input(ip);
        if (ipInput) ipInput.value = ip;
        if (!ip) { setMessage('Enter the console IP address first.', true); return false; }
        if (!isValidIpv4Address(ip)) {
            setMessage('Enter a valid console IP address including the dots, for example 192.168.0.70, and double-check every digit.', true);
            return false;
        }
        setMessage('Connecting to console\u2026');
        if (connectBtn) { connectBtn.disabled = true; connectBtn.textContent = 'Connecting\u2026'; }

        try {
            const saveResp = await fetch('/api/nxe/pair/connect', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ consoleIp: ip, ftpPort: port })
            });
            const saveData = await saveResp.json().catch(() => ({}));
            if (!saveResp.ok) throw new Error(saveData.message || 'Unable to register console with your account.');
            pair    = saveData.pair;
            pairKey = saveData.controlToken || '';
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
        if (pairObj.pairId)    localStorage.setItem(LAST_PAIR_ID_KEY, pairObj.pairId);
    }

    /**
     * Called after a successful manual connect (first-time pairing).
     * Shows the success screen; user presses Continue to enter the control panel.
     */
    function onConnected(isInitialPairing) {
        if (isInitialPairing === false) {
            enterControlPanel();
        } else {
            if (pairPanel) pairPanel.hidden = true;
            if (app) app.hidden = true;
            if (successPanel) successPanel.hidden = false;
            renderPair();
            setState('Connected', 'ok');
            setMessage('');
            if (connectBtn) { connectBtn.disabled = false; connectBtn.textContent = 'Connect'; }
        }
    }

    /**
     * Enter (or re-enter) the control panel.
     * All status fields are set to "Checking…" first; refreshStatus() then fills real values.
     */
    function enterControlPanel() {
        if (pairPanel) pairPanel.hidden = true;
        if (successPanel) successPanel.hidden = true;
        if (app) app.hidden = false;
        renderPair();
        setCheckingState();
        setMessage('');
        if (connectBtn) { connectBtn.disabled = false; connectBtn.textContent = 'Connect'; }
        startPolling();
        refreshStatus();
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Pair claim / restore on page load
    // ══════════════════════════════════════════════════════════════════════════

    async function claimPair() {
        if (typeof currentUser === 'undefined' || !currentUser) return;
        const user      = currentUser;
        const requestId = ++pairRequestId;
        const parsed    = parsePairHash();
        let isInitialPair = Boolean(parsed.pairId && parsed.key);

        try {
            if (!parsed.pairId || !parsed.key) {
                const saved     = await fetch('/api/nxe/pair/list', { credentials: 'include' });
                const savedData = await saved.json().catch(() => ({}));
                if (!saved.ok) throw new Error(savedData.message || 'Unable to load paired consoles.');
                const lastPairId = localStorage.getItem(LAST_PAIR_ID_KEY);
                const pairs      = savedData.pairs || [];
                const selected   = (lastPairId ? pairs.find((p) => p.pairId === lastPairId) : null) || pairs[0];
                if (!selected) {
                    if (pairPanel) pairPanel.hidden = false;
                    return;
                }
                parsed.pairId = selected.pairId;
                parsed.key    = localStorage.getItem('nxe-pair-key:' + selected.pairId) || '';
                if (!parsed.key) {
                    if (pairPanel) pairPanel.hidden = false;
                    if (ipInput)   ipInput.value    = selected.consoleIp || '';
                    if (portInput) portInput.value  = selected.ftpPort   || '2121';
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
            onConnected(isInitialPair ? true : false);
        } catch (_error) {
            if (typeof currentUser !== 'undefined' && user === currentUser && requestId === pairRequestId && pairPanel) {
                pairPanel.hidden = false;
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Server commands (Turn On / Turn Off / Restart)
    // ══════════════════════════════════════════════════════════════════════════

    async function sendCommand(type) {
        if (!pair) return;
        const labels = { start: 'Starting\u2026', stop: 'Stopping\u2026', restart: 'Restarting\u2026' };
        setFtpStatusDisplay(null, labels[type] || type);
        setMessage('');
        try {
            const data = await api('/api/v1/ftp/' + type, { method: 'POST' });
            pair.running = Boolean(data.ftpRunning);
            setFtpStatusDisplay(pair.running);
            setState('Connected', 'ok');
            const storageOk = Boolean(data.storageVerified);
            setAuthStatus(storageOk, storageOk ? '' : (data.storageMessage || 'Storage not available'));
            setCredentialButtons(Boolean(data.hasCredentials || (data.username && data.username.length > 0)));
        } catch (error) {
            setMessage(error.message, true);
            refreshStatus();
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Credentials modals
    // ══════════════════════════════════════════════════════════════════════════

    function openCredentialsDialog(isChange) {
        if (!credModal) return;
        const u = pair ? (pair.username || localStorage.getItem(SAVED_USER_KEY) || '') : '';
        if (credModalTitle) credModalTitle.textContent = isChange ? 'Change Username & Password' : 'Set Username & Password';
        if (credUser)    credUser.value    = u;
        if (credPass)    credPass.value    = '';
        if (credConfirm) credConfirm.value = '';
        if (credError)   credError.textContent = '';
        credModal.hidden = false;
        if (credUser) credUser.focus();
    }

    function closeCredentialsDialog() {
        if (credModal)  credModal.hidden = true;
        if (credError)  credError.textContent = '';
    }

    async function saveCredentials() {
        const user    = credUser    ? credUser.value.trim() : '';
        const pass    = credPass    ? credPass.value        : '';
        const confirm = credConfirm ? credConfirm.value     : '';

        if (pass && pass !== confirm) {
            if (credError) credError.textContent = 'Passwords do not match.';
            return;
        }
        if (credSaveBtn) { credSaveBtn.disabled = true; credSaveBtn.textContent = 'Saving\u2026'; }
        if (credError) credError.textContent = '';

        try {
            await api('/api/v1/ftp/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });
            if (pair) pair.username = user;
            if (user) localStorage.setItem(SAVED_USER_KEY, user); else localStorage.removeItem(SAVED_USER_KEY);
            cachedPassword = pass;
            closeCredentialsDialog();
            setMessage(user ? 'FTP username and password saved successfully.' : 'FTP credentials updated.');
            await refreshStatus(1);
        } catch (error) {
            if (credError) credError.textContent = error.message || 'Failed to save credentials.';
        } finally {
            if (credSaveBtn) { credSaveBtn.disabled = false; credSaveBtn.textContent = 'Save'; }
        }
    }

    async function removeCredentials() {
        if (credRemoveBtn) { credRemoveBtn.disabled = true; credRemoveBtn.textContent = 'Removing\u2026'; }
        if (credError) credError.textContent = '';

        try {
            await api('/api/v1/ftp/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: '', password: '' })
            });
            if (pair) pair.username = '';
            cachedPassword = '';
            localStorage.removeItem(SAVED_USER_KEY);
            closeCredentialsDialog();
            setMessage('FTP login credentials removed. Server is set to anonymous access.');
            await refreshStatus(1);
        } catch (error) {
            if (credError) credError.textContent = error.message || 'Failed to remove credentials.';
        } finally {
            if (credRemoveBtn) { credRemoveBtn.disabled = false; credRemoveBtn.textContent = 'Remove'; }
        }
    }

    async function openViewCredentialsDialog() {
        if (!viewCredModal) return;
        passwordVisible = false;
        if (viewUserEl) viewUserEl.textContent = 'Loading\u2026';
        if (viewPassEl) viewPassEl.textContent = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
        if (toggleViewPassBtn) toggleViewPassBtn.textContent = 'Show';
        viewCredModal.hidden = false;

        try {
            const data = await api('/api/v1/ftp/credentials', { method: 'GET' });
            const u = data.username || (pair ? pair.username : '') || localStorage.getItem(SAVED_USER_KEY) || 'None';
            cachedPassword = data.password || '';
            if (viewUserEl) viewUserEl.textContent = u;
            updatePasswordMask();
        } catch (_error) {
            const u = (pair ? pair.username : '') || localStorage.getItem(SAVED_USER_KEY) || 'Unknown';
            if (viewUserEl) viewUserEl.textContent = u;
            if (viewPassEl) viewPassEl.textContent = cachedPassword ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : '(Not retrieved)';
        }
    }

    function updatePasswordMask() {
        if (!viewPassEl) return;
        if (!cachedPassword) {
            viewPassEl.textContent = '(None configured)';
            return;
        }
        viewPassEl.textContent = passwordVisible ? cachedPassword : '\u2022'.repeat(Math.max(8, cachedPassword.length));
        if (toggleViewPassBtn) toggleViewPassBtn.textContent = passwordVisible ? 'Hide' : 'Show';
    }

    function toggleViewPassword() {
        passwordVisible = !passwordVisible;
        updatePasswordMask();
    }

    function copyViewPassword() {
        if (!cachedPassword) return;
        navigator.clipboard?.writeText(cachedPassword).then(() => {
            if (copyViewPassBtn) {
                copyViewPassBtn.textContent = 'Copied!';
                _setTimeout(() => { copyViewPassBtn.textContent = 'Copy'; }, 2000);
            }
        });
    }

    function closeViewCredentialsDialog() {
        if (viewCredModal) viewCredModal.hidden = true;
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Connection management actions
    // ══════════════════════════════════════════════════════════════════════════

    function changeConnectionDetails() {
        if (app) app.hidden = true;
        if (successPanel) successPanel.hidden = true;
        if (pairPanel) pairPanel.hidden = false;
        stopPolling();

        if (ipInput && pair && pair.consoleIp) ipInput.value = pair.consoleIp;
        if (portInput && pair && pair.ftpPort) portInput.value = pair.ftpPort;
        if (usernameInput) usernameInput.value = localStorage.getItem(SAVED_USER_KEY) || '';
        if (passwordInput) passwordInput.value = '';
        if (pairMessage) pairMessage.textContent = '';
        if (ipInput) ipInput.focus();
    }

    function forgetConsole() {
        stopPolling();
        closeRelay();
        if (pair && pair.pairId) localStorage.removeItem('nxe-pair-key:' + pair.pairId);
        localStorage.removeItem(SAVED_IP_KEY);
        localStorage.removeItem(SAVED_PORT_KEY);
        localStorage.removeItem(SAVED_USER_KEY);
        localStorage.removeItem(LAST_PAIR_ID_KEY);
        pairRequestId += 1;
        pair = null; pairKey = '';
        cachedPassword = '';
        if (app) app.hidden = true;
        if (successPanel) successPanel.hidden = true;
        if (pairPanel) pairPanel.hidden = false;
        if (pairMessage) pairMessage.textContent = '';
        if (ipInput) ipInput.value = '';
        if (portInput) portInput.value = '2121';
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        setAuthStatus(null);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Event wiring
    // ══════════════════════════════════════════════════════════════════════════

    if (connectBtn) connectBtn.addEventListener('click', connectByManual);
    [ipInput, portInput, usernameInput, passwordInput].forEach((inp) => {
        if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') connectByManual(); });
    });

    document.getElementById('nxeFtpReconnect')?.addEventListener('click', async () => {
        setCheckingState();
        setMessage('Reconnecting to console\u2026');
        closeRelay();
        await refreshStatus(3);
    });

    document.getElementById('nxeFtpChangeConnection')?.addEventListener('click', changeConnectionDetails);
    document.getElementById('nxeFtpChangeIp')?.addEventListener('click', changeConnectionDetails);
    document.getElementById('nxeFtpForget')?.addEventListener('click', forgetConsole);
    continueBtn?.addEventListener('click', enterControlPanel);

    // Modal Events: Set / Change
    btnSetCredentials?.addEventListener('click',    () => openCredentialsDialog(false));
    btnChangeCredentials?.addEventListener('click', () => openCredentialsDialog(true));
    credCloseBtn?.addEventListener('click',  closeCredentialsDialog);
    credCancelBtn?.addEventListener('click', closeCredentialsDialog);
    credSaveBtn?.addEventListener('click',   saveCredentials);
    credRemoveBtn?.addEventListener('click', removeCredentials);
    [credUser, credPass, credConfirm].forEach((inp) => {
        if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveCredentials(); });
    });

    // Modal Events: View
    btnViewCredentials?.addEventListener('click',  openViewCredentialsDialog);
    toggleViewPassBtn?.addEventListener('click',   toggleViewPassword);
    copyViewPassBtn?.addEventListener('click',     copyViewPassword);
    viewCredCloseBtn?.addEventListener('click',    closeViewCredentialsDialog);
    viewCredDismissBtn?.addEventListener('click',  closeViewCredentialsDialog);
    viewToChangeBtn?.addEventListener('click', () => {
        closeViewCredentialsDialog();
        openCredentialsDialog(true);
    });

    document.querySelectorAll('[data-nxe-command]').forEach((btn) => {
        btn.addEventListener('click', () => sendCommand(btn.dataset.nxeCommand));
    });

    window.addEventListener('vortex-account-changed', (e) => renderAuth(e.detail.user));
    window.addEventListener('hashchange', () => {
        if (typeof currentUser === 'undefined' || !currentUser) return;
        pairRequestId += 1; pair = null;
        stopPolling();
        if (app) app.hidden = true;
        if (pairPanel) pairPanel.hidden = false;
        claimPair();
    });

    // NOTE: There are intentionally NO beforeunload / pagehide / unload handlers
    // here that would send Stop commands or clear state. Closing/refreshing the
    // browser must never stop the Xbox FTP server. The server lifecycle belongs
    // entirely to NXE on the Xbox.

    if (typeof currentUser !== 'undefined' && currentUser) renderAuth(currentUser);
}());

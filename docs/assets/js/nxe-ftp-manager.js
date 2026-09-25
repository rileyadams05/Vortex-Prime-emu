/**
 * NXE FTP Server Remote Control — Vortex Prime
 *
 * ── Auth architecture note ─────────────────────────────────────────────────
 *
 * This script is loaded as a plain <script> (non-module) at the bottom of
 * index.html, which means it shares the global (window) scope with the
 * inline <script> block that owns the site's auth IIFE. However, the
 * variables in that IIFE (currentUser, authRequestId, etc.) are NOT on
 * window — they are captured in the IIFE's own closure and are completely
 * invisible to this external file.
 *
 * Therefore this script MUST NOT reference `currentUser` from the outer
 * page. Instead it listens exclusively to the custom event
 * `vortex-account-changed` (dispatched by `applyMainUser`) which passes
 * the user object in event.detail.user.
 *
 * ── Initialization order ───────────────────────────────────────────────────
 *
 *   1. Page loads — "Checking account…" spinner is visible by default.
 *   2. `vortex-account-changed` fires (may fire multiple times during
 *      Firebase + server-session restore — see race-condition guard).
 *   3. If user is null  → hide spinner, show sign-in panel.
 *   4. If user is set   → hide spinner, show "Restoring console…".
 *   5. GET /api/nxe/pair/list → pick saved console.
 *   6. If restored successfully → enter control panel directly (no success
 *      screen, no Continue button — that is first-time-only onboarding).
 *   7. If no saved console → show manual connect form.
 *   8. Manual connect succeeds → set isNewConnection=true → show success
 *      screen → user presses Continue → enter control panel.
 *   9. From that point on, every subsequent page load skips steps 7-8
 *      entirely: the saved console is restored silently in step 6.
 *
 * ── Success screen contract ────────────────────────────────────────────────
 *
 *   isNewConnection === true   ONLY when a brand-new /pair/connect just
 *                               succeeded for the first time (or QR claim).
 *   Every restore path         sets isNewConnection = false and calls
 *                               enterControlPanel() directly.
 *
 * ── Polling / stale-request safety ────────────────────────────────────────
 *
 *   statusGeneration is a monotonic counter. Every refreshStatus() call
 *   captures its value at start; any response that arrives after a newer
 *   call has already returned is silently discarded.
 *
 *   The polling interval is a singleton. startPolling() is a no-op if a
 *   timer is already running. stopPolling() tears it down cleanly.
 *
 * ── Server lifecycle ───────────────────────────────────────────────────────
 *
 *   The FTP server runs on the Xbox. Closing / refreshing / navigating the
 *   browser MUST NEVER stop the server. There are intentionally no
 *   beforeunload / pagehide handlers that send Stop commands.
 */

(function initializeNxeFtp() {
    // ── Timer shims ────────────────────────────────────────────────────────
    // The Node.js VM test harness provides only a stub setTimeout.
    /* eslint-disable no-var */
    var _setTimeout    = (typeof setTimeout    === 'function') ? setTimeout    : function () { return 0; };
    var _clearTimeout  = (typeof clearTimeout  === 'function') ? clearTimeout  : function () {};
    var _setInterval   = (typeof setInterval   === 'function') ? setInterval   : function () { return 0; };
    var _clearInterval = (typeof clearInterval === 'function') ? clearInterval : function () {};
    /* eslint-enable no-var */

    // ── DOM references ─────────────────────────────────────────────────────
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

    // Credential buttons
    const btnSetCredentials    = document.getElementById('nxeFtpBtnSetCredentials');
    const btnChangeCredentials = document.getElementById('nxeFtpBtnChangeCredentials');
    const btnViewCredentials   = document.getElementById('nxeFtpBtnViewCredentials');

    // Edit/Change Credentials modal
    const credModal      = document.getElementById('nxeFtpCredModal');
    const credModalTitle = document.getElementById('nxeFtpCredModalTitle');
    const credUser       = document.getElementById('nxeFtpCredUser');
    const credPass       = document.getElementById('nxeFtpCredPass');
    const credConfirm    = document.getElementById('nxeFtpCredConfirm');
    const credError      = document.getElementById('nxeFtpCredError');
    const credSaveBtn    = document.getElementById('nxeFtpCredSave');
    const credRemoveBtn  = document.getElementById('nxeFtpCredRemove');
    const credCancelBtn  = document.getElementById('nxeFtpCredCancel');
    const credCloseBtn   = document.getElementById('nxeFtpCredClose');

    // View Credentials modal
    const viewCredModal      = document.getElementById('nxeFtpViewCredModal');
    const viewUserEl         = document.getElementById('nxeFtpViewUser');
    const viewPassEl         = document.getElementById('nxeFtpViewPass');
    const toggleViewPassBtn  = document.getElementById('nxeFtpToggleViewPass');
    const copyViewPassBtn    = document.getElementById('nxeFtpCopyViewPass');
    const viewToChangeBtn    = document.getElementById('nxeFtpBtnViewToChange');
    const viewCredCloseBtn   = document.getElementById('nxeFtpViewCredClose');
    const viewCredDismissBtn = document.getElementById('nxeFtpViewCredDismiss');

    // ── Module state ───────────────────────────────────────────────────────

    /**
     * The currently signed-in Vortex Prime user object (from vortex-account-changed).
     * This is the FTP manager's own copy — it does NOT read the outer-IIFE currentUser.
     */
    let ftpCurrentUser = null;

    /** Active console pair object returned by the server. null when not connected. */
    let pair          = null;
    /** Control token for authenticating relay commands. */
    let pairKey       = '';
    /**
     * Monotonic counter incremented whenever the expected result owner changes
     * (new user, hashchange, forget). Any async claimPair() callback that was
     * started with an older requestId is silently discarded.
     */
    let pairRequestId = 0;

    /**
     * True ONLY while the very first manual connection (or QR claim) has
     * succeeded but the user has not yet pressed Continue.
     * False for every restore / refresh / re-open path.
     */
    let isNewConnection = false;

    /**
     * Guard against multiple concurrent renderAuth() calls starting duplicate
     * claimPair() runs. Set to true while claimPair is in flight; cleared when
     * it settles.
     */
    let claimPairInProgress = false;

    /**
     * Set to true by handleAuthChange() on its first call (even if user is null).
     * Until this is true, renderPanels() keeps the HTML loading spinner visible
     * and does not switch to any other panel (prevents flashing the sign-in panel
     * before Firebase has had a chance to restore a session).
     */
    let authResolved = false;

    let relaySocket   = null;
    let relayPromise  = null;
    let relaySequence = 0;
    const relayPending = new Map();

    let cachedPassword  = '';
    let passwordVisible = false;

    // ── Polling ────────────────────────────────────────────────────────────
    /** setInterval handle. Non-null only while one polling loop is running. */
    let pollTimer        = null;
    /**
     * Monotonic counter. Each refreshStatus() call captures this at entry.
     * A response is discarded if the counter has advanced (newer call completed first).
     */
    let statusGeneration = 0;
    const POLL_INTERVAL_MS = 5000;

    // ── Relay reconnect backoff ────────────────────────────────────────────
    let relayReconnectTimer = null;
    let relayReconnectDelay = 2000;   // doubles each failure, capped at 30 s

    // ── localStorage keys ─────────────────────────────────────────────────
    const SAVED_IP_KEY     = 'nxe-saved-ip';
    const SAVED_PORT_KEY   = 'nxe-saved-port';
    const SAVED_USER_KEY   = 'nxe-saved-username';
    const LAST_PAIR_ID_KEY = 'nxe-last-pair-id';

    // ══════════════════════════════════════════════════════════════════════
    //  UI helpers
    // ══════════════════════════════════════════════════════════════════════

    function setMessage(value, error) {
        if (!pair || (pairPanel && !pairPanel.hidden)) {
            if (pairMessage) {
                pairMessage.textContent = value || '';
                pairMessage.style.color = error ? '#ff8b80' : '';
            }
        } else {
            if (message) {
                message.textContent = value || '';
                message.style.color = error ? '#ff8b80' : '';
            }
        }
    }

    /** Set the Connection row text + colour. */
    function setState(value, kind) {
        const el = document.getElementById('nxeFtpConnection');
        if (!el) return;
        el.textContent = value;
        if (kind === 'ok')       el.style.color = '#8fcc3e';
        else if (kind === 'err') el.style.color = '#ff8b80';
        else                     el.style.color = 'var(--color-text-secondary)';
    }

    /**
     * Set the Authentication / storage-verified row.
     * verified === true     → green ✓ Yes
     * verified === false    → red No (+ optional reason)
     * verified === null     → neutral dash (unknown)
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
     * running === true      → green Running
     * running === false     → red Stopped
     * running === null      → neutral transient label (e.g. "Starting…")
     * running === 'unknown' → neutral Unknown
     */
    function setFtpStatusDisplay(running, transientLabel) {
        const el = document.getElementById('nxeFtpStatus');
        if (!el) return;
        if (transientLabel) {
            el.textContent = transientLabel;
            el.style.color = 'var(--color-text-secondary)';
        } else if (running === true) {
            el.textContent = 'Running';
            el.style.color = '#8fcc3e';
        } else if (running === false) {
            el.textContent = 'Stopped';
            el.style.color = '#ff8b80';
        } else {
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
            if (btnStart)   { btnStart.disabled   = Boolean(running);  btnStart.style.display   = running ? 'none' : ''; }
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

    // ══════════════════════════════════════════════════════════════════════
    //  Panel rendering
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Central panel switcher. Called whenever ftpCurrentUser or pair changes.
     *
     * Panel visibility rules:
     *   loading     → visible only while we are waiting for auth to resolve
     *                 for the first time (nxeFtpLoading starts visible via HTML)
     *   authPanel   → visible when no signed-in user
     *   pairPanel   → visible when signed in but no saved console AND not
     *                 currently restoring (claimPairInProgress)
     *   successPanel → visible only when isNewConnection === true (first-time pairing)
     *   app         → visible when signed in AND pair is active AND not showing
     *                 success screen
     *
     * IMPORTANT: This function must NEVER show pairPanel while claimPairInProgress
     * is true, because the console may still be restoring from the server. Showing
     * the form during that window would confuse the user and cause spurious connects.
     */
    function renderPanels() {
        const user = ftpCurrentUser;

        // Auth not yet resolved for the first time → keep spinner, hide nothing.
        // authResolved is set to true by handleAuthChange on first call.
        if (!authResolved) {
            return;
        }

        if (loading) loading.hidden = true;

        if (!user) {
            // Signed out
            if (authPanel)    authPanel.hidden    = false;
            if (pairPanel)    pairPanel.hidden    = true;
            if (successPanel) successPanel.hidden = true;
            if (app)          app.hidden          = true;
            return;
        }

        // Signed in —
        if (authPanel) authPanel.hidden = true;

        if (isNewConnection) {
            // Show success screen only for a genuine first-time pairing
            if (pairPanel)    pairPanel.hidden    = true;
            if (successPanel) successPanel.hidden = false;
            if (app)          app.hidden          = true;
            return;
        }

        if (pair) {
            // Saved console active → control panel
            if (pairPanel)    pairPanel.hidden    = true;
            if (successPanel) successPanel.hidden = true;
            if (app)          app.hidden          = false;
            return;
        }

        // No saved console yet
        if (claimPairInProgress) {
            // Restoring from server — keep the spinner visible so the user does
            // not see the connect form flash before the console is loaded.
            if (pairPanel)    pairPanel.hidden    = true;
            if (successPanel) successPanel.hidden = true;
            if (app)          app.hidden          = true;
            if (loading) {
                loading.hidden      = false;
                loading.textContent = 'Restoring console\u2026';
            }
            return;
        }

        // No console, not restoring → show connect form
        if (pairPanel) {
            pairPanel.hidden = false;
            // Pre-fill from localStorage for convenience
            const savedIp   = localStorage.getItem(SAVED_IP_KEY)  || '';
            const savedPort = localStorage.getItem(SAVED_PORT_KEY) || '2121';
            const savedUser = localStorage.getItem(SAVED_USER_KEY) || '';
            if (ipInput      && savedIp  && !ipInput.value)      ipInput.value      = savedIp;
            if (portInput    && !portInput.value)                 portInput.value    = savedPort;
            if (usernameInput && !usernameInput.value)            usernameInput.value = savedUser;
        }
        if (successPanel) successPanel.hidden = true;
        if (app)          app.hidden          = true;
    }

    /**
     * Populate IP / Port display labels from the current pair object.
     * Status fields are left in their current state — they are only updated
     * by live Xbox responses from refreshStatus().
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
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Auth event handler
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Called when the main Vortex Prime auth state changes.
     * May fire multiple times during a single page load (once from the fast
     * server-session cookie check, again when Firebase finishes restoring).
     * We guard against duplicate in-flight claimPair calls.
     */
    function handleAuthChange(user) {
        // Mark that auth has been checked at least once (even if result is signed-out).
        // renderPanels() uses this to decide when it is safe to dismiss the spinner.
        authResolved = true;

        const userChanged = (user?.uid || null) !== (ftpCurrentUser?.uid || null);
        ftpCurrentUser = user || null;

        if (!user) {
            // Signed out — reset all state
            pairRequestId += 1;
            pair          = null;
            pairKey       = '';
            isNewConnection = false;
            claimPairInProgress = false;
            if (pairMessage) pairMessage.textContent = '';
            if (message)     message.textContent     = '';
            stopPolling();
            closeRelay();
            renderPanels();
            return;
        }

        if (pair) {
            // Already have an active console — just refresh the UI
            // (handles the case where Firebase fires a second auth event
            //  after we've already entered the control panel).
            renderPanels();
            return;
        }

        if (claimPairInProgress && !userChanged) {
            // A claimPair is already running for this user — do not start another.
            return;
        }

        // Start the console restore
        claimPairInProgress = true;
        renderPanels();   // shows "Restoring console…"
        claimPair();
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Input helpers
    // ══════════════════════════════════════════════════════════════════════

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
            if ((third  === '0' || !third.startsWith('0'))  &&
                (fourth === '0' || !fourth.startsWith('0')) &&
                Number(third) <= 255 && Number(fourth) <= 255) {
                candidates.push('192.168.' + Number(third) + '.' + Number(fourth));
            }
        }
        return candidates.length === 1 ? candidates[0] : entered;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Cloud relay WebSocket
    // ══════════════════════════════════════════════════════════════════════

    function closeRelay() {
        _clearTimeout(relayReconnectTimer);
        relayReconnectTimer = null;
        const socket = relaySocket;
        relaySocket  = null;
        relayPromise = null;
        if (socket) try { socket.close(1000, 'Page closed'); } catch (_) {}
        relayPending.forEach((pending) => {
            _clearTimeout(pending.timeout);
            pending.reject(new Error('NXE cloud relay disconnected.'));
        });
        relayPending.clear();
    }

    /**
     * Schedule a relay reconnect attempt with exponential backoff.
     * Only triggers while we still have a valid pair (console is saved).
     */
    function scheduleRelayReconnect() {
        if (relayReconnectTimer || !pair) return;
        relayReconnectTimer = _setTimeout(() => {
            relayReconnectTimer = null;
            if (!pair) return;
            ensureRelay().then(() => {
                relayReconnectDelay = 2000;
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
                    settled      = true;
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

                } else if (data.type === 'relay-ready') {
                    if (data.consoleConnected) {
                        setState('Connected', 'ok');
                        refreshStatus();
                    } else {
                        setState('Connecting\u2026', 'neutral');
                    }

                } else if (data.type === 'relay-error') {
                    // Console not connected to relay — fail pending requests with neutral status
                    relayPending.forEach((p) => {
                        _clearTimeout(p.timeout);
                        p.reject(new Error(data.message || 'NXE console is not connected.'));
                    });
                    relayPending.clear();
                    setState('Connecting\u2026', 'neutral');

                } else if (data.type === 'console-state') {
                    if (data.connected) {
                        setState('Connected', 'ok');
                        refreshStatus();
                    } else {
                        // Console dropped from relay — neutral, not red
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
                relayPending.forEach((p) => {
                    _clearTimeout(p.timeout);
                    p.reject(new Error('NXE cloud relay disconnected.'));
                });
                relayPending.clear();
                if (pair) scheduleRelayReconnect();
            };
        });
        return relayPromise;
    }

    async function relayRequest(payload, timeoutMs) {
        const socket = await ensureRelay();
        const id     = 'relay_' + Date.now().toString(36) + '_' + (++relaySequence).toString(36);
        payload      = Object.assign({ type: 'request', id: id }, payload || {});
        return new Promise((resolve, reject) => {
            const timeout = _setTimeout(() => {
                relayPending.delete(id);
                reject(new Error('NXE did not answer the cloud relay request in time.'));
            }, timeoutMs || 30000);
            relayPending.set(id, { resolve, reject, timeout });
            try   { socket.send(JSON.stringify(payload)); }
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

    // ══════════════════════════════════════════════════════════════════════
    //  Polling — singleton enforcement
    // ══════════════════════════════════════════════════════════════════════

    function startPolling() {
        if (pollTimer) return;   // already running — do not stack timers
        pollTimer = _setInterval(() => {
            if (pair && app && !app.hidden) refreshStatus();
        }, POLL_INTERVAL_MS);
    }

    function stopPolling() {
        if (pollTimer) { _clearInterval(pollTimer); pollTimer = null; }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Status refresh
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Ask the Xbox for its live status and update the UI.
     *
     * Strategy:
     *   - Retry up to `retries` times (default 2) with 600 ms / 1200 ms gaps.
     *   - On success: show green Connected / Running|Stopped / Yes|No.
     *   - On all retries exhausted: show Disconnected (connection row only) +
     *     Unknown for FTP Server + neutral dash for Auth.
     *     We NEVER show "FTP Server: Stopped" or "Auth: No" when we cannot
     *     reach the Xbox — those are unknowns, not confirmed states.
     *
     * The monotonic `statusGeneration` counter prevents stale async responses
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

                // All retries exhausted
                if (generation !== statusGeneration) return;

                const savedIp = pair.consoleIp || localStorage.getItem(SAVED_IP_KEY) || 'console';
                setState('Disconnected', 'err');
                setFtpStatusDisplay(null, 'Unknown');   // NOT "Stopped" — we don't know
                setAuthStatus(null);                    // NOT "No"      — we don't know
                setCredentialButtons(Boolean(localStorage.getItem(SAVED_USER_KEY)));
                setMessage(
                    'NXE console not reachable at ' + savedIp +
                    '. Double-check every IP digit. If the Xbox address changed, select Change Connection Details and enter the new address shown in NXE Settings \u2192 FTP.',
                    true
                );
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Console connection / restore flow
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Persist key session data to localStorage.
     * This is a speed/convenience cache only. The authoritative source is
     * always the signed-in account's data from /api/nxe/pair/list.
     */
    function saveConsoleSession(pairObj, key) {
        if (!pairObj) return;
        if (key && pairObj.pairId) localStorage.setItem('nxe-pair-key:' + pairObj.pairId, key);
        if (pairObj.consoleIp)    localStorage.setItem(SAVED_IP_KEY, pairObj.consoleIp);
        if (pairObj.pairId)       localStorage.setItem(LAST_PAIR_ID_KEY, pairObj.pairId);
    }

    /**
     * Enter the control panel. Always clears success screen and pair form.
     * Sets Checking… for all status fields immediately; live values arrive
     * from refreshStatus().
     */
    function enterControlPanel() {
        isNewConnection = false;
        renderPair();
        renderPanels();   // will show app since pair && !isNewConnection
        setCheckingState();
        setMessage('');
        if (connectBtn) { connectBtn.disabled = false; connectBtn.textContent = 'Connect'; }
        startPolling();
        refreshStatus();
    }

    /**
     * Manual connect — called when the user presses Connect or Enter in the form.
     *
     * @param {boolean} [silent]  If true this is an auto-restore attempt (no UI
     *                            feedback, skips success screen on success).
     */
    async function connectByManual(silent) {
        let ip     = ipInput   ? ipInput.value   : '';
        const port = (portInput && portInput.value ? portInput.value.trim() : '') || '2121';
        const user = usernameInput ? usernameInput.value.trim() : '';

        ip = normalizeIpv4Input(ip);
        if (ipInput) ipInput.value = ip;
        if (!ip)                    { setMessage('Enter the console IP address first.', true); return false; }
        if (!isValidIpv4Address(ip)) {
            setMessage('Enter a valid console IP address including the dots, for example 192.168.0.70, and double-check every digit.', true);
            return false;
        }
        if (!silent) setMessage('Connecting to console\u2026');
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

            if (silent) {
                // Auto-restore path — skip success screen, go straight to dashboard
                isNewConnection = false;
                enterControlPanel();
            } else {
                // First-time manual connect — show success screen once
                isNewConnection = true;
                renderPair();
                renderPanels();   // will show successPanel
                setState('Connected', 'ok');
                setMessage('');
                if (connectBtn) { connectBtn.disabled = false; connectBtn.textContent = 'Connect'; }
            }
            return true;

        } catch (error) {
            renderPanels();
            setMessage(error.message, true);
            if (connectBtn) { connectBtn.disabled = false; connectBtn.textContent = 'Connect'; }
            return false;
        }
    }

    /**
     * Attempt to restore the saved console from the signed-in account.
     *
     * Path A: URL hash has a brand-new pairId+key (QR / one-time link).
     * Path B: Fetch /api/nxe/pair/list, pick the best saved pair.
     *         - If controlToken is present → go straight to control panel.
     *         - If no token but consoleIp is known → silent /pair/connect.
     *         - If nothing → show connect form.
     *
     * Uses a pairRequestId guard so that if a newer claimPair() call starts
     * (e.g. from a hashchange or user change) before this one finishes, the
     * stale result is silently discarded.
     */
    async function claimPair() {
        // Snapshot the current user and request ID at call time
        const user      = ftpCurrentUser;
        const requestId = ++pairRequestId;

        if (!user) {
            claimPairInProgress = false;
            renderPanels();
            return;
        }

        try {
            // ── Path A: URL hash contains a one-time pair token (QR code flow) ──
            const parsed = parsePairHash();
            if (parsed.pairId && parsed.key) {
                const response = await fetch('/api/nxe/pair/claim', {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pairId: parsed.pairId, controlToken: parsed.key })
                });
                const data = await response.json().catch(() => ({}));

                // Stale-result guard
                if (requestId !== pairRequestId || ftpCurrentUser !== user) {
                    claimPairInProgress = false;
                    return;
                }
                if (!response.ok) throw new Error(data.message || 'Unable to pair this console.');

                pair    = data.pair;
                pairKey = parsed.key;
                saveConsoleSession(pair, pairKey);
                if (window.location.hash.indexOf('pair=') >= 0) history.replaceState(null, '', window.location.pathname);

                // QR / one-time link: this IS a new connection → show success screen
                isNewConnection = true;
                claimPairInProgress = false;
                renderPair();
                renderPanels();
                setState('Connected', 'ok');
                return;
            }

            // ── Path B: Restore from account ─────────────────────────────────
            const listResp = await fetch('/api/nxe/pair/list', { credentials: 'include' });
            const listData = await listResp.json().catch(() => ({}));

            // Stale-result guard
            if (requestId !== pairRequestId || ftpCurrentUser !== user) {
                claimPairInProgress = false;
                return;
            }
            if (!listResp.ok) throw new Error(listData.message || 'Unable to load paired consoles.');

            const pairs      = listData.pairs || [];
            const lastPairId = localStorage.getItem(LAST_PAIR_ID_KEY);
            const selected   = (lastPairId ? pairs.find((p) => p.pairId === lastPairId) : null) || pairs[0];

            if (!selected) {
                // No console saved on this account — show connect form
                claimPairInProgress = false;
                renderPanels();
                return;
            }

            // Prefer server-returned token; fall back to localStorage cache
            const restoredKey = selected.controlToken || localStorage.getItem('nxe-pair-key:' + selected.pairId) || '';

            if (restoredKey) {
                // Full restore — go straight to control panel (no success screen)
                pair    = selected;
                pairKey = restoredKey;
                saveConsoleSession(pair, pairKey);
                isNewConnection     = false;
                claimPairInProgress = false;
                enterControlPanel();
                return;
            }

            // No token — try /pair/connect silently with the known IP
            if (selected.consoleIp) {
                if (ipInput)   ipInput.value   = selected.consoleIp;
                if (portInput) portInput.value = selected.ftpPort || '2121';
                claimPairInProgress = false;   // connectByManual manages its own state
                await connectByManual(true);   // silent = no success screen
                return;
            }

            // Nothing to work with → show connect form
            claimPairInProgress = false;
            renderPanels();

        } catch (_error) {
            // Stale-result guard before mutating UI
            if (requestId !== pairRequestId || ftpCurrentUser !== user) {
                claimPairInProgress = false;
                return;
            }
            claimPairInProgress = false;
            // Pre-fill form from localStorage for convenience
            const savedIp = localStorage.getItem(SAVED_IP_KEY);
            if (savedIp && ipInput && !ipInput.value)   ipInput.value   = savedIp;
            if (portInput && !portInput.value)           portInput.value = localStorage.getItem(SAVED_PORT_KEY) || '2121';
            renderPanels();   // shows connect form
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Server commands (Turn On / Turn Off / Restart)
    // ══════════════════════════════════════════════════════════════════════

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

    // ══════════════════════════════════════════════════════════════════════
    //  Credentials modals
    // ══════════════════════════════════════════════════════════════════════

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
        if (credModal) credModal.hidden = true;
        if (credError) credError.textContent = '';
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
        if (viewUserEl)     viewUserEl.textContent  = 'Loading\u2026';
        if (viewPassEl)     viewPassEl.textContent  = '\u2022'.repeat(8);
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
            if (viewPassEl) viewPassEl.textContent = cachedPassword ? '\u2022'.repeat(8) : '(Not retrieved)';
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

    // ══════════════════════════════════════════════════════════════════════
    //  Connection management actions
    // ══════════════════════════════════════════════════════════════════════

    function changeConnectionDetails() {
        // Capture current values before nulling pair
        const currentIp   = pair ? pair.consoleIp : '';
        const currentPort = pair ? pair.ftpPort   : '';
        pair    = null;
        pairKey = '';
        isNewConnection     = false;
        claimPairInProgress = false;
        stopPolling();
        // Pre-fill with the previous IP/port so the user just edits what changed
        if (ipInput)   ipInput.value   = currentIp   || localStorage.getItem(SAVED_IP_KEY)   || '';
        if (portInput) portInput.value = currentPort || localStorage.getItem(SAVED_PORT_KEY) || '2121';
        if (usernameInput) usernameInput.value = localStorage.getItem(SAVED_USER_KEY) || '';
        if (passwordInput) passwordInput.value = '';
        if (pairMessage)   pairMessage.textContent = '';
        renderPanels();
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
        pair            = null;
        pairKey         = '';
        isNewConnection = false;
        claimPairInProgress = false;
        cachedPassword  = '';
        if (pairMessage)   pairMessage.textContent = '';
        if (ipInput)       ipInput.value   = '';
        if (portInput)     portInput.value = '2121';
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        setAuthStatus(null);
        renderPanels();
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Event wiring
    // ══════════════════════════════════════════════════════════════════════

    if (connectBtn) connectBtn.addEventListener('click', () => connectByManual(false));
    [ipInput, portInput, usernameInput, passwordInput].forEach((inp) => {
        if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') connectByManual(false); });
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

    continueBtn?.addEventListener('click', () => {
        // User has acknowledged the first-time success screen.
        // Mark the connection as no longer "new" and enter the control panel.
        isNewConnection = false;
        enterControlPanel();
    });

    // Modal events: Set / Change
    btnSetCredentials?.addEventListener('click',    () => openCredentialsDialog(false));
    btnChangeCredentials?.addEventListener('click', () => openCredentialsDialog(true));
    credCloseBtn?.addEventListener('click',  closeCredentialsDialog);
    credCancelBtn?.addEventListener('click', closeCredentialsDialog);
    credSaveBtn?.addEventListener('click',   saveCredentials);
    credRemoveBtn?.addEventListener('click', removeCredentials);
    [credUser, credPass, credConfirm].forEach((inp) => {
        if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveCredentials(); });
    });

    // Modal events: View
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

    // ── Auth event — single source of truth ───────────────────────────────
    //
    // The main page IIFE dispatches `vortex-account-changed` every time
    // the signed-in user changes (including the initial restore on page load).
    // If currentUser is already populated at load time (or in test harnesses),
    // initialize with it immediately.
    //
    window.addEventListener('vortex-account-changed', (e) => {
        handleAuthChange(e.detail && e.detail.user);
    });

    try {
        if (typeof currentUser !== 'undefined' && currentUser) {
            handleAuthChange(currentUser);
        } else if (typeof window !== 'undefined' && window.currentUser) {
            handleAuthChange(window.currentUser);
        }
    } catch (_) {}

    // Hash-based QR / one-time-link flow
    window.addEventListener('hashchange', () => {
        if (!ftpCurrentUser) return;
        // Reset pair state and re-run claimPair to process the new hash
        pairRequestId += 1;
        pair                = null;
        pairKey             = '';
        isNewConnection     = false;
        claimPairInProgress = true;
        stopPolling();
        renderPanels();
        claimPair();
    });

    // NOTE: There are intentionally NO beforeunload / pagehide / unload handlers
    // that would send Stop commands or clear state. Closing or refreshing the
    // browser must NEVER stop the Xbox FTP server. The server lifecycle belongs
    // entirely to NXE running on the Xbox.

}());

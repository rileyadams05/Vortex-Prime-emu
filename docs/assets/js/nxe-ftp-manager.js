/**
 * NXE FTP File Manager & Connection Controller - Vortex Prime
 * Handles Manual IP Connection, Account-backed Session Persistence,
 * Unreachable State Fallback with Change IP / Retry / Forget, and Graphical File Management.
 */

(function initializeNxeFtp() {
    const authPanel        = document.getElementById('nxeFtpAuthPanel');
    const app              = document.getElementById('nxeFtpApp');
    const loading          = document.getElementById('nxeFtpLoading');
    const pairPanel        = document.getElementById('nxeFtpPairPanel');
    const successPanel     = document.getElementById('nxeFtpSuccessPanel');
    const continueBtn      = document.getElementById('nxeFtpContinueBtn');
    const pairMessage      = document.getElementById('nxeFtpPairMessage');
    const message          = document.getElementById('nxeFtpMessage');
    const filesContainer   = document.getElementById('nxeFtpFileList');
    const breadcrumb       = document.getElementById('nxeFtpBreadcrumb');
    const transfers        = document.getElementById('nxeFtpTransfers');
    const ipInput          = document.getElementById('nxeFtpIpInput');
    const connectBtn       = document.getElementById('nxeFtpConnectBtn');
    const searchInput      = document.getElementById('nxeFtpSearchInput');
    const bulkActionBar    = document.getElementById('nxeFtpBulkActions');
    const selectedCountSpan = document.getElementById('nxeFtpSelectedCount');
    
    let pair      = null;
    let pairKey   = '';
    let currentPath = '/';
    let apiBase   = '';
    let pairRequestId = 0;
    let currentDirectoryItems = [];
    let selectedItemNames = new Set();
    let uploadQueue = [];
    let isUploading = false;
    
    const NXE_WEB_PORT = '2123';
    const SAVED_IP_KEY = 'nxe-saved-ip';
    const LAST_PAIR_ID_KEY = 'nxe-last-pair-id';

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
            pair = null; pairKey = ''; apiBase = '';
            if (pairMessage) pairMessage.textContent = '';
            if (message) message.textContent = '';
            return;
        }
        
        if (!pair) {
            const savedIp = localStorage.getItem(SAVED_IP_KEY) || '';
            if (ipInput && savedIp) ipInput.value = savedIp;
            claimPair();
        }
    }

    // Render Connection Details
    function renderPair() {
        if (!pair) return;
        const ip = pair.consoleIp || 'Unknown';
        const labelEl = document.getElementById('nxeFtpPairLabel');
        const ipEl    = document.getElementById('nxeFtpIp');
        const portEl  = document.getElementById('nxeFtpPort');
        if (labelEl) labelEl.textContent = ip;
        if (ipEl)    ipEl.textContent    = ip;
        if (portEl)  portEl.textContent  = pair.ftpPort || '2121';
        apiBase = pair.consoleIp ? 'http://' + pair.consoleIp + ':' + NXE_WEB_PORT : '';
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
        const entered = String(value || '').trim();
        if (isValidIpv4Address(entered)) return entered;
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

    function localFetch(url, options) {
        return fetch(url, Object.assign({ targetAddressSpace: 'local' }, options || {}));
    }

    // API Wrapper for NXE Web Management Service (Port 2123)
    async function api(pathname, options) {
        options = options || {};
        if (!apiBase || !pairKey) throw new Error('No console connected.');
        const headers = new Headers(options.headers || {});
        headers.set('X-NXE-Control', pairKey);
        headers.set('Accept', 'application/json');
        const response = await localFetch(apiBase + pathname, Object.assign({}, options, { headers: headers, mode: 'cors' }));
        const data     = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'NXE request failed (' + response.status + ').');
        return data;
    }

    // Manual IP Connect Flow (Primary manual fallback method)
    async function connectByIp(ip) {
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
            const baseUrl  = 'http://' + ip + ':' + NXE_WEB_PORT;
            let controlKey = '';
            let ftpRunning = false;
            let ftpPort    = '2121';
            let matchedPair = null;

            // Step 1: Probe /api/v1/device/identify (no auth) to get Xbox pairId
            let consolePairId = '';
            try {
                const idResp = await localFetch(baseUrl + '/api/v1/device/identify', {
                    mode: 'cors', signal: AbortSignal.timeout(8000)
                });
                if (idResp.ok) {
                    const idData = await idResp.json().catch(() => ({}));
                    consolePairId = idData.pairId || '';
                }
            } catch(e) {
                throw new Error('Cannot reach NXE at ' + ip + ':' + NXE_WEB_PORT + '. Double-check every IP digit, confirm the address has not changed, and make sure NXE is open on your Xbox.');
            }

            // Step 2: If we got pairId, check stored key
            if (consolePairId) {
                controlKey = localStorage.getItem('nxe-pair-key:' + consolePairId) || '';
                if (controlKey) {
                    try {
                        const vResp = await localFetch(baseUrl + '/api/v1/device/status', {
                            headers: { 'X-NXE-Control': controlKey }, mode: 'cors',
                            signal: AbortSignal.timeout(8000)
                        });
                        if (vResp.ok) {
                            const vd = await vResp.json().catch(() => ({}));
                            try {
                                const lr = await fetch('/api/nxe/pair/list', { credentials: 'include' });
                                if (lr.ok) {
                                    const ld = await lr.json().catch(() => ({}));
                                    matchedPair = (ld.pairs || []).find(p => p.pairId === consolePairId);
                                }
                            } catch(e2) {}
                            pair    = Object.assign({ pairId: consolePairId, ftpPort: '2121' }, matchedPair || {}, { consoleIp: ip, ftpPort: vd.ftpPort || '2121', running: Boolean(vd.ftpRunning) });
                            pairKey = controlKey;
                            saveConsoleSession(pair, pairKey);
                            onConnected(); return true;
                        }
                    } catch(e) {}
                }
            }

            // Step 3: Check cloud pairs for this IP
            try {
                const lr = await fetch('/api/nxe/pair/list', { credentials: 'include' });
                if (lr.ok) {
                    const ld = await lr.json().catch(() => ({}));
                    matchedPair = (ld.pairs || []).find(p => p.consoleIp === ip || p.pairId === consolePairId);
                    if (matchedPair) {
                        controlKey = localStorage.getItem('nxe-pair-key:' + matchedPair.pairId) || '';
                        if (controlKey) {
                            try {
                                const sr = await localFetch(baseUrl + '/api/v1/device/status', {
                                    headers: { 'X-NXE-Control': controlKey }, mode: 'cors',
                                    signal: AbortSignal.timeout(8000)
                                });
                                if (sr.ok) {
                                    const sd = await sr.json().catch(() => ({}));
                                    pair    = Object.assign({}, matchedPair, { consoleIp: ip, ftpPort: sd.ftpPort || '2121', running: Boolean(sd.ftpRunning) });
                                    pairKey = controlKey;
                                    saveConsoleSession(pair, pairKey);
                                    onConnected(); return true;
                                }
                            } catch(e) {}
                        }
                    }
                }
            } catch(e) {}

            // Step 4: Register/update pair with Vortex account
            const saveResp = await fetch('/api/nxe/pair/connect', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ consoleIp: ip, pairId: consolePairId, ftpPort: ftpPort })
            });
            const saveData = await saveResp.json().catch(() => ({}));
            if (!saveResp.ok) throw new Error(saveData.message || 'Unable to register console with your account.');
            pair       = saveData.pair;
            controlKey = saveData.controlToken || '';
            if (!pair || !controlKey) throw new Error('Vortex Prime could not restore this console connection.');
            pairKey    = controlKey;
            const statusResp = await localFetch(baseUrl + '/api/v1/device/status', {
                headers: { 'X-NXE-Control': controlKey }, mode: 'cors',
                signal: AbortSignal.timeout(8000)
            });
            const statusData = await statusResp.json().catch(() => ({}));
            if (!statusResp.ok) throw new Error(statusData.message || 'NXE rejected the saved console connection. Restart NXE and try again.');
            pair.running = Boolean(statusData.ftpRunning);
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
            enterFileManager();
        }
    }

    function enterFileManager() {
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
                    if (selected.consoleIp) await connectByIp(selected.consoleIp);
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
    async function refreshStatus() {
        if (!pair) return;
        try {
            const status = await api('/api/v1/device/status');
            pair.running = Boolean(status.ftpRunning);
            setState('Connected');
            setFtpStatusDisplay(pair.running);
            if (status.failure) setMessage(status.failure, true); else setMessage('');
        } catch (error) {
            const savedIp = pair.consoleIp || localStorage.getItem(SAVED_IP_KEY) || 'console';
            setState('Disconnected');
            setFtpStatusDisplay(false);
            setMessage('NXE console not reachable at ' + savedIp + '. Double-check every IP digit. If the Xbox address changed, select Change IP and enter the new address shown in NXE Settings → FTP.', true);
        }
    }

    // Prompt User to Change Console IP (e.g. if DHCP address changed)
    async function changeConsoleIp() {
        const currentIp = pair ? (pair.consoleIp || '') : (localStorage.getItem(SAVED_IP_KEY) || '');
        const newIp = window.prompt('Enter new Console IP address shown in NXE Settings -> FTP:', currentIp);
        if (!newIp || newIp.trim() === '' || newIp.trim() === currentIp) return;
        
        const targetIp = newIp.trim();
        setMessage('Updating console IP to ' + targetIp + '...');
        
        if (ipInput) ipInput.value = targetIp;
        await connectByIp(targetIp);
    }

    // Forget Console / Clear Local Credentials
    function forgetConsole() {
        if (pair && pair.pairId) localStorage.removeItem('nxe-pair-key:' + pair.pairId);
        localStorage.removeItem(SAVED_IP_KEY);
        localStorage.removeItem(LAST_PAIR_ID_KEY);
        pairRequestId += 1;
        pair = null; pairKey = ''; apiBase = '';
        if (app) app.hidden = true;
        if (successPanel) successPanel.hidden = true;
        if (pairPanel) pairPanel.hidden = false;
        if (pairMessage) pairMessage.textContent = '';
        if (ipInput) ipInput.value = '';
    }

    // Breadcrumb renderer (FileGator style)
    function renderBreadcrumb() {
        if (!breadcrumb) return;
        breadcrumb.innerHTML = '';
        const parts = currentPath.split('/').filter(Boolean);
        const paths = ['/'];
        parts.forEach(p => paths.push(paths[paths.length - 1].replace(/\/$/, '') + '/' + p));
        paths.forEach((value, index) => {
            const btn = document.createElement('button');
            btn.className   = 'btn btn-secondary';
            btn.type        = 'button';
            btn.textContent = index === 0 ? 'Root' : parts[index - 1];
            btn.style.fontSize = '.82rem';
            btn.style.padding  = '.3rem .6rem';
            btn.addEventListener('click', () => { currentPath = value; refreshFiles(); });
            breadcrumb.appendChild(btn);
            if (index < paths.length - 1) {
                const sep = document.createElement('span');
                sep.textContent = ' / ';
                sep.style.cssText = 'color:var(--color-text-secondary);align-self:center;font-size:.85rem;';
                breadcrumb.appendChild(sep);
            }
        });
    }

    function itemPath(name) { return (currentPath === '/' ? '' : currentPath) + '/' + name; }

    function formatSize(bytes) {
        if (!bytes) return '0 B';
        const units = ['B','KB','MB','GB','TB'];
        let v = bytes, u = 0;
        while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
        return (u ? v.toFixed(1) : Math.round(v)) + ' ' + units[u];
    }

    function getFileIcon(name, isFolder) {
        if (isFolder) return '📁';
        const ext = name.split('.').pop().toLowerCase();
        if (['xex', 'iso', 'god', 'bin', 'elf'].includes(ext)) return '🎮';
        if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'svg'].includes(ext)) return '🖼️';
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
        if (['txt', 'json', 'xml', 'cfg', 'ini', 'log'].includes(ext)) return '⚙️';
        if (['mp3', 'wav', 'ogg', 'wma', 'mp4', 'mkv', 'avi'].includes(ext)) return '🎬';
        return '📄';
    }

    // Refresh directory listing & render table (FileGator frontend pattern)
    async function refreshFiles() {
        if (!pair || !filesContainer) return;
        selectedItemNames.clear();
        updateBulkActionBar();
        filesContainer.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--color-text-secondary);">Loading directory...</div>';
        
        try {
            const data = await api('/api/v1/files?path=' + encodeURIComponent(currentPath));
            currentDirectoryItems = (data.items || []).sort((a, b) => {
                return a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1;
            });
            renderFileList();
        } catch (error) {
            filesContainer.innerHTML = '';
            setMessage(error.message, true);
        }
    }

    function renderFileList() {
        if (!filesContainer) return;
        filesContainer.innerHTML = '';
        renderBreadcrumb();

        const filterText = (searchInput ? searchInput.value : '').toLowerCase().trim();
        const displayItems = currentDirectoryItems.filter(item => item.name.toLowerCase().includes(filterText));

        if (!displayItems.length) {
            filesContainer.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--color-text-secondary);">' + 
                (filterText ? 'No items matching "' + filterText + '"' : 'This folder is empty.') + '</div>';
            return;
        }

        // Header Row with Select All Checkbox
        const table = document.createElement('div');
        table.style.cssText = 'width:100%;border-collapse:collapse;';

        const headerRow = document.createElement('div');
        headerRow.style.cssText = 'display:flex;align-items:center;gap:.6rem;padding:.5rem .75rem;background:rgba(255,255,255,0.04);border-bottom:1px solid var(--color-border);font-size:.85rem;color:var(--color-text-secondary);font-weight:600;';

        const selectAllCb = document.createElement('input');
        selectAllCb.type = 'checkbox';
        selectAllCb.style.cursor = 'pointer';
        selectAllCb.checked = displayItems.length > 0 && displayItems.every(i => selectedItemNames.has(i.name));
        selectAllCb.addEventListener('change', () => {
            if (selectAllCb.checked) {
                displayItems.forEach(i => selectedItemNames.add(i.name));
            } else {
                displayItems.forEach(i => selectedItemNames.delete(i.name));
            }
            renderFileList();
            updateBulkActionBar();
        });

        const nameHeader = document.createElement('span');
        nameHeader.textContent = 'Name';
        nameHeader.style.flex = '1';

        const sizeHeader = document.createElement('span');
        sizeHeader.textContent = 'Size / Modified';
        sizeHeader.style.cssText = 'width:180px;text-align:right;';

        const actionsHeader = document.createElement('span');
        actionsHeader.textContent = 'Actions';
        actionsHeader.style.cssText = 'width:240px;text-align:right;';

        headerRow.append(selectAllCb, nameHeader, sizeHeader, actionsHeader);
        table.appendChild(headerRow);

        // Item Rows
        displayItems.forEach(item => {
            const isFolder = item.type === 'folder';
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:.6rem;padding:.65rem .75rem;border-bottom:1px solid var(--color-border);transition:background .15s;';
            if (selectedItemNames.has(item.name)) {
                row.style.background = 'rgba(143,204,62,0.08)';
            }

            // Checkbox
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = selectedItemNames.has(item.name);
            cb.style.cursor = 'pointer';
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                if (cb.checked) selectedItemNames.add(item.name);
                else selectedItemNames.delete(item.name);
                updateBulkActionBar();
                row.style.background = cb.checked ? 'rgba(143,204,62,0.08)' : '';
            });

            // Icon & Name
            const icon = document.createElement('span');
            icon.textContent = getFileIcon(item.name, isFolder);
            icon.style.cssText = 'font-size:1.1em;flex-shrink:0;';

            const label = document.createElement('strong');
            label.textContent = item.name;
            label.style.cssText = 'flex:1;word-break:break-all;font-weight:500;cursor:' + (isFolder ? 'pointer' : 'default') + ';';
            if (isFolder) {
                label.style.color = '#8fcc3e';
                label.addEventListener('click', () => { currentPath = itemPath(item.name); refreshFiles(); });
            }

            // Metadata
            const details = document.createElement('span');
            details.style.cssText = 'width:180px;text-align:right;color:var(--color-text-secondary);font-size:.85rem;white-space:nowrap;';
            if (isFolder) {
                details.textContent = 'Folder';
            } else {
                const mod = item.modified ? new Date(item.modified).toLocaleDateString() : '';
                details.textContent = formatSize(item.size) + (mod ? ' · ' + mod : '');
            }

            // Action Buttons
            const actions = document.createElement('div');
            actions.style.cssText = 'width:240px;display:flex;gap:.35rem;justify-content:flex-end;flex-wrap:wrap;';

            function makeBtn(lbl, fn) {
                const b = document.createElement('button');
                b.className = 'btn btn-secondary';
                b.type = 'button';
                b.textContent = lbl;
                b.style.cssText = 'font-size:.8rem;padding:.25rem .55rem;';
                b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
                actions.appendChild(b);
            }

            if (isFolder) {
                makeBtn('Open', () => { currentPath = itemPath(item.name); refreshFiles(); });
            } else {
                makeBtn('Download', () => download(item.name));
            }
            makeBtn('Rename', () => renameItem(item.name));
            makeBtn('Move',   () => moveItem(item.name));
            makeBtn('Delete', () => deleteItem(item.name));

            if (isFolder) {
                row.addEventListener('dblclick', () => { currentPath = itemPath(item.name); refreshFiles(); });
            }

            row.append(cb, icon, label, details, actions);
            table.appendChild(row);
        });

        filesContainer.appendChild(table);
    }

    function updateBulkActionBar() {
        if (!bulkActionBar) return;
        const count = selectedItemNames.size;
        if (count > 0) {
            bulkActionBar.style.display = 'flex';
            if (selectedCountSpan) selectedCountSpan.textContent = count + ' item' + (count > 1 ? 's' : '') + ' selected';
        } else {
            bulkActionBar.style.display = 'none';
        }
    }

    // Bulk Delete
    async function deleteSelected() {
        if (selectedItemNames.size === 0) return;
        const items = Array.from(selectedItemNames);
        if (!window.confirm('Are you sure you want to delete ' + items.length + ' selected item(s)?')) return;
        setMessage('Deleting selected items...');
        let errors = 0;
        for (const name of items) {
            try {
                await api('/api/v1/files', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: itemPath(name) }) });
            } catch(e) { errors++; }
        }
        if (errors) setMessage(errors + ' item(s) failed to delete.', true);
        else setMessage('');
        refreshFiles();
    }

    // Bulk Move
    async function moveSelected() {
        if (selectedItemNames.size === 0) return;
        const destination = window.prompt('Destination folder path (e.g. /covers or /Games)', currentPath);
        if (!destination) return;
        const items = Array.from(selectedItemNames);
        setMessage('Moving selected items...');
        let errors = 0;
        for (const name of items) {
            try {
                await api('/api/v1/files/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: itemPath(name), destination: destination }) });
            } catch(e) { errors++; }
        }
        if (errors) setMessage(errors + ' item(s) failed to move.', true);
        else setMessage('');
        refreshFiles();
    }

    // Single File Download
    async function download(name) {
        try {
            const response = await localFetch(apiBase + '/api/v1/files/download?path=' + encodeURIComponent(itemPath(name)), {
                headers: { 'X-NXE-Control': pairKey }
            });
            if (!response.ok) throw new Error('Download failed (' + response.status + ').');
            const blob = await response.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        } catch (error) { setMessage(error.message, true); }
    }

    // Rename Item
    async function renameItem(name) {
        const next = window.prompt('New name for ' + name, name);
        if (!next || next === name) return;
        try {
            await api('/api/v1/files/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: itemPath(name), name: next })
            });
            await refreshFiles();
        } catch (error) { setMessage(error.message, true); }
    }

    // Delete Single Item
    async function deleteItem(name) {
        if (!window.confirm('Delete "' + name + '"?')) return;
        try {
            await api('/api/v1/files', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: itemPath(name) })
            });
            await refreshFiles();
        } catch (error) { setMessage(error.message, true); }
    }

    // Move Single Item
    async function moveItem(name) {
        const destination = window.prompt('Destination folder path', currentPath);
        if (!destination) return;
        try {
            await api('/api/v1/files/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: itemPath(name), destination: destination })
            });
            await refreshFiles();
        } catch (error) { setMessage(error.message, true); }
    }

    // FileGator-style Upload Queue & Progress Manager
    function queueUploadFiles(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        
        files.forEach(file => {
            const task = {
                id: 'up_' + Math.random().toString(36).substr(2, 9),
                file: file,
                name: file.name,
                size: file.size,
                loaded: 0,
                status: 'queued', // queued, uploading, complete, failed, cancelled
                xhr: null,
                errorMsg: ''
            };
            uploadQueue.push(task);
        });

        renderUploadQueueUI();
        processUploadQueue();
    }

    function renderUploadQueueUI() {
        if (!transfers) return;
        if (!uploadQueue.length) {
            transfers.innerHTML = '';
            return;
        }

        transfers.innerHTML = '';
        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid var(--color-border);border-radius:8px;padding:1rem;background:rgba(0,0,0,0.2);margin-bottom:1rem;';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;';
        
        const title = document.createElement('strong');
        const activeCount = uploadQueue.filter(t => t.status === 'uploading' || t.status === 'queued').length;
        title.textContent = 'Upload Queue (' + activeCount + ' active / ' + uploadQueue.length + ' total)';
        
        const clearBtn = document.createElement('button');
        clearBtn.className = 'btn btn-secondary';
        clearBtn.type = 'button';
        clearBtn.textContent = 'Clear Completed';
        clearBtn.style.cssText = 'font-size:.78rem;padding:.2rem .5rem;';
        clearBtn.addEventListener('click', () => {
            uploadQueue = uploadQueue.filter(t => t.status === 'queued' || t.status === 'uploading');
            renderUploadQueueUI();
        });

        header.append(title, clearBtn);
        card.appendChild(header);

        uploadQueue.forEach(task => {
            const itemRow = document.createElement('div');
            itemRow.style.cssText = 'margin-bottom:.65rem;padding-bottom:.5rem;border-bottom:1px dashed var(--color-border);';

            const metaRow = document.createElement('div');
            metaRow.style.cssText = 'display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:.25rem;';
            
            const fileName = document.createElement('span');
            fileName.style.cssText = 'font-weight:500;word-break:break-all;';
            fileName.textContent = task.name;

            const statusText = document.createElement('span');
            statusText.style.cssText = 'font-size:.8rem;';

            if (task.status === 'queued') {
                statusText.textContent = 'Queued · ' + formatSize(task.size);
                statusText.style.color = 'var(--color-text-secondary)';
            } else if (task.status === 'uploading') {
                const pct = task.size ? Math.round((task.loaded / task.size) * 100) : 0;
                statusText.textContent = pct + '% (' + formatSize(task.loaded) + ' / ' + formatSize(task.size) + ')';
                statusText.style.color = '#8fcc3e';
            } else if (task.status === 'complete') {
                statusText.textContent = '✓ Complete (' + formatSize(task.size) + ')';
                statusText.style.color = '#8fcc3e';
            } else if (task.status === 'failed') {
                statusText.textContent = '✗ Failed: ' + (task.errorMsg || 'Error');
                statusText.style.color = '#ff8b80';
            } else if (task.status === 'cancelled') {
                statusText.textContent = 'Cancelled';
                statusText.style.color = 'var(--color-text-secondary)';
            }

            metaRow.append(fileName, statusText);
            itemRow.appendChild(metaRow);

            // Progress Bar
            const barBg = document.createElement('div');
            barBg.style.cssText = 'width:100%;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;position:relative;';
            
            const barFill = document.createElement('div');
            const pct = task.size ? Math.min(100, Math.round((task.loaded / task.size) * 100)) : 0;
            barFill.style.cssText = 'height:100%;transition:width .15s;background:' + 
                (task.status === 'complete' ? '#8fcc3e' : task.status === 'failed' ? '#ff8b80' : '#4285f4') + ';width:' + (task.status === 'complete' ? '100' : pct) + '%;';
            
            barBg.appendChild(barFill);
            itemRow.appendChild(barBg);

            card.appendChild(itemRow);
        });

        transfers.appendChild(card);
    }

    async function processUploadQueue() {
        if (isUploading) return;
        const nextTask = uploadQueue.find(t => t.status === 'queued');
        if (!nextTask) {
            isUploading = false;
            return;
        }

        isUploading = true;
        nextTask.status = 'uploading';
        renderUploadQueueUI();

        const xhr = new XMLHttpRequest();
        nextTask.xhr = xhr;
        xhr.open('POST', apiBase + '/api/v1/files/upload?path=' + encodeURIComponent(currentPath) + '&name=' + encodeURIComponent(nextTask.name));
        xhr.setRequestHeader('X-NXE-Control', pairKey);
        xhr.setRequestHeader('X-NXE-Path', currentPath);
        xhr.setRequestHeader('X-NXE-File-Name', nextTask.name);
        xhr.setRequestHeader('Content-Length', String(nextTask.size));

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                nextTask.loaded = e.loaded;
                renderUploadQueueUI();
            }
        };

        xhr.onload = async () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                nextTask.status = 'complete';
                nextTask.loaded = nextTask.size;
                await refreshFiles();
            } else {
                nextTask.status = 'failed';
                nextTask.errorMsg = 'HTTP ' + xhr.status;
            }
            renderUploadQueueUI();
            isUploading = false;
            processUploadQueue();
        };

        xhr.onerror = () => {
            nextTask.status = 'failed';
            nextTask.errorMsg = 'Network Error';
            renderUploadQueueUI();
            isUploading = false;
            processUploadQueue();
        };

        xhr.send(nextTask.file);
    }

    // Send Server Command (Turn On, Turn Off, Restart)
    async function sendCommand(type) {
        if (!pair) return;
        const labels = { start: 'Starting', stop: 'Stopping', restart: 'Restarting' };
        setFtpStatusDisplay(null, labels[type] || type);
        setMessage('');
        try {
            if (apiBase && pairKey) {
                try {
                    const resp = await localFetch(apiBase + '/api/v1/ftp/' + type, {
                        method: 'POST', headers: { 'X-NXE-Control': pairKey }, mode: 'cors',
                        signal: AbortSignal.timeout(12000)
                    });
                    if (resp.ok) {
                        const d = await resp.json().catch(() => ({}));
                        pair.running = Boolean(d.ftpRunning);
                        setFtpStatusDisplay(pair.running); setState('Connected'); return;
                    }
                } catch(e) {}
            }
            await fetch('/api/nxe/pair/command', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pairId: pair.pairId, type: type })
            });
            setMessage('Command queued — waiting for console response.');
            setTimeout(refreshStatus, 5000);
        } catch(error) { setMessage(error.message, true); refreshStatus(); }
    }

    // Event Wireup
    if (connectBtn) connectBtn.addEventListener('click', () => connectByIp(ipInput ? ipInput.value : ''));
    if (ipInput) ipInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') connectByIp(ipInput.value); });

    document.getElementById('nxeFtpRefresh')?.addEventListener('click', refreshFiles);
    document.getElementById('nxeFtpBack')?.addEventListener('click', () => {
        if (currentPath !== '/') {
            currentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
            refreshFiles();
        }
    });

    document.getElementById('nxeFtpUploadInput')?.addEventListener('change', (e) => {
        queueUploadFiles(e.target.files);
        e.target.value = '';
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => renderFileList());
    }

    document.getElementById('nxeFtpBulkDelete')?.addEventListener('click', deleteSelected);
    document.getElementById('nxeFtpBulkMove')?.addEventListener('click', moveSelected);

    const dropZone = document.getElementById('nxeFtpDropZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#8fcc3e'; dropZone.style.background = 'rgba(143,204,62,0.05)'; });
        dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; dropZone.style.background = ''; });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '';
            dropZone.style.background = '';
            queueUploadFiles(e.dataTransfer.files);
        });
    }

    document.getElementById('nxeFtpCreateFolder')?.addEventListener('click', async () => {
        const name = window.prompt('New folder name');
        if (!name) return;
        try {
            await api('/api/v1/files/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: currentPath, name: name }) });
            await refreshFiles();
        } catch(error) { setMessage(error.message, true); }
    });

    document.getElementById('nxeFtpReconnect')?.addEventListener('click', refreshStatus);
    document.getElementById('nxeFtpChangeIp')?.addEventListener('click', changeConsoleIp);
    document.getElementById('nxeFtpForget')?.addEventListener('click', forgetConsole);
    continueBtn?.addEventListener('click', enterFileManager);

    document.querySelectorAll('[data-nxe-command]').forEach((btn) => {
        btn.addEventListener('click', () => sendCommand(btn.dataset.nxeCommand));
    });

    document.querySelectorAll('.nxe-ftp-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nxe-ftp-tab').forEach(t => t.classList.toggle('active', t === btn));
            const serverTab = document.getElementById('nxeFtpServerTab');
            const filesTab  = document.getElementById('nxeFtpFilesTab');
            if (serverTab) serverTab.hidden = btn.dataset.nxeTab !== 'server';
            if (filesTab)  filesTab.hidden  = btn.dataset.nxeTab !== 'files';
            if (btn.dataset.nxeTab === 'files') refreshFiles();
        });
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

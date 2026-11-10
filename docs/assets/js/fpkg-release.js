export const RELEASE_CACHE_TTL_MS = 15 * 60 * 1000;

export function getReleaseVersion(release) {
    return String(release?.tag_name || '').replace(/^v/i, '') || 'Unknown';
}

export function selectInstallerAssets(release) {
    const assets = Array.isArray(release?.assets) ? release.assets : [];
    return {
        deb: assets.find((asset) => /-linux-x64\.deb$/i.test(asset.name || '')) || null,
        rpm: assets.find((asset) => /-linux-x64\.rpm$/i.test(asset.name || '')) || null,
        checksums: assets.find((asset) => asset.name === 'SHA256SUMS') || null,
        source: assets.find((asset) => /-source\.zip$/i.test(asset.name || '')) || null,
    };
}

export function selectModxInstallerAssets(release) {
    const assets = Array.isArray(release?.assets) ? release.assets : [];
    return assets.filter((asset) => /\.(?:msi|exe)$/i.test(asset.name || '') && asset.browser_download_url);
}

export function formatAssetSize(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return 'Size unavailable';
    if (value < 1024) return `${value} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = value / 1024;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }
    return `${size.toFixed(1)} ${units[unit]}`;
}

export function formatReleaseDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function readCache(key) {
    try {
        const cached = JSON.parse(localStorage.getItem(key) || 'null');
        if (cached?.release?.tag_name && Array.isArray(cached.release.assets)) return cached;
    } catch (_) {
        // Storage can be disabled or full. Network retrieval still works.
    }
    return null;
}

function writeCache(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* Fresh response remains usable. */ }
}

function removeCache(key) {
    try { localStorage.removeItem(key); } catch (_) { /* Ignore storage failures. */ }
}

function friendlyError(response, projectName) {
    if (response.status === 404) return { message: `No public ${projectName} release is available yet.`, noRelease: true };
    if (response.status === 403 || response.status === 429) {
        return { message: 'GitHub is temporarily limiting release requests. Please try again shortly.' };
    }
    return { message: 'The latest release could not be retrieved. Check your connection and try again.' };
}

function initializeDialog(config) {
    const dialog = document.getElementById(config.dialogId);
    const openButton = document.getElementById(config.buttonId);
    if (!dialog || !openButton) return;

    const prefix = config.prefix;
    const status = document.getElementById(`${prefix}Status`);
    const retryButton = document.getElementById(`${prefix}Retry`);
    const content = document.getElementById(`${prefix}Content`);
    const cardVersion = document.getElementById(config.cardVersionId);
    const cardInstallers = config.cardInstallersId ? document.getElementById(config.cardInstallersId) : null;
    const cacheKey = config.cacheKey || `vortex-prime:${config.repository.toLowerCase()}:latest-release:v1`;
    let lastFocus = null;
    let requestPromise = null;

    function setStatus(message, kind = 'info', showRetry = false) {
        status.textContent = message;
        status.dataset.kind = kind;
        status.hidden = !message;
        retryButton.hidden = !showRetry;
    }

    function makeDownloadLink(asset, label) {
        if (!asset?.browser_download_url) return null;
        const row = document.createElement('div');
        row.className = 'fpkg-download-row';
        const details = document.createElement('div');
        details.className = 'fpkg-download-row__details';
        const title = document.createElement('strong');
        title.textContent = label;
        const subtitle = document.createElement('span');
        subtitle.textContent = `${asset.name} · ${formatAssetSize(asset.size)}`;
        details.append(title, subtitle);
        const link = document.createElement('a');
        link.className = 'btn btn-secondary fpkg-download-button';
        link.href = asset.browser_download_url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.dataset.noGate = 'true';
        link.setAttribute('download', asset.name);
        link.setAttribute('aria-label', `Download ${asset.name} for ${label}`);
        link.textContent = 'Download';
        row.append(details, link);
        return row;
    }

    function renderRelease(release, freshness) {
        const version = getReleaseVersion(release);
        const versionNode = document.getElementById(`${prefix}Version`);
        const dateNode = document.getElementById(`${prefix}Date`);
        const downloads = document.getElementById(`${prefix}Downloads`);
        const warning = document.getElementById(`${prefix}AssetWarning`);
        const notes = document.getElementById(`${prefix}Notes`);
        const notesBody = document.getElementById(`${prefix}NotesBody`);
        versionNode.textContent = `Version ${version}`;
        const published = release.published_at || release.created_at;
        dateNode.textContent = published ? `Released ${formatReleaseDate(published)}` : 'Release date unavailable';
        downloads.replaceChildren();

        if (config.assetMode === 'fpkg') {
            const assets = selectInstallerAssets(release);
            const debRow = makeDownloadLink(assets.deb, 'Linux Mint / Ubuntu / Debian');
            const rpmRow = makeDownloadLink(assets.rpm, 'Fedora / RPM-based Linux');
            if (debRow) downloads.append(debRow);
            if (rpmRow) downloads.append(rpmRow);
            const missing = [];
            if (!assets.deb) missing.push('.deb');
            if (!assets.rpm) missing.push('.rpm');
            warning.hidden = missing.length === 0;
            warning.textContent = missing.length
                ? `This release does not include the official ${missing.join(' and ')} installer${missing.length > 1 ? 's' : ''}.`
                : '';
            cardInstallers?.replaceChildren(document.createTextNode('DEB · RPM'));
            const extras = document.getElementById(`${prefix}Extras`);
            const extraDetails = document.getElementById(`${prefix}ExtraDetails`);
            extras.replaceChildren();
            for (const [asset, label] of [[assets.checksums, 'SHA256 checksums'], [assets.source, 'Source archive']]) {
                if (!asset?.browser_download_url) continue;
                const link = document.createElement('a');
                link.href = asset.browser_download_url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.dataset.noGate = 'true';
                link.textContent = `${label} (${asset.name})`;
                extras.append(link);
            }
            extraDetails.hidden = extras.childElementCount === 0;
        } else {
            const installers = selectModxInstallerAssets(release);
            const formats = [];
            for (const asset of installers) {
                const ext = asset.name.match(/\.(msi|exe)$/i)?.[1]?.toUpperCase();
                if (ext && !formats.includes(ext)) formats.push(ext);
                const row = makeDownloadLink(asset, `Windows installer · ${ext || 'Installer'}`);
                if (row) downloads.append(row);
            }
            if (cardInstallers) cardInstallers.textContent = formats.length ? formats.join(' · ') : 'No installer attached';
            warning.hidden = installers.length > 0;
            warning.textContent = installers.length
                ? ''
                : 'This release does not include a supported Windows .msi or .exe installer. Check the ModX repository for release details.';
        }

        notesBody.textContent = release.body || 'No release notes were provided.';
        notes.hidden = !release.body;
        content.hidden = false;
        if (cardVersion) cardVersion.textContent = version;
        setStatus(freshness.retry ? freshness.message : '', freshness.retry ? 'error' : '', freshness.retry);
    }

    async function fetchLatest(force = false) {
        if (requestPromise) return requestPromise;
        const cached = readCache(cacheKey);
        const age = cached ? Date.now() - Number(cached.checkedAt || 0) : Infinity;
        if (!force && cached && age >= 0 && age < RELEASE_CACHE_TTL_MS) {
            renderRelease(cached.release, { retry: false, message: '' });
            return;
        }
        if (cached) renderRelease(cached.release, { retry: false, message: '' });
        else {
            content.hidden = true;
            setStatus(`Checking the latest ${config.projectName} release…`, 'info');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        requestPromise = (async () => {
            try {
                const headers = { Accept: 'application/vnd.github+json' };
                if (cached?.etag) headers['If-None-Match'] = cached.etag;
                const response = await fetch(`https://api.github.com/repos/${config.repository}/releases/latest`, {
                    headers, cache: 'no-store', signal: controller.signal
                });
                if (response.status === 304 && cached) {
                    const updated = { ...cached, checkedAt: Date.now() };
                    writeCache(cacheKey, updated);
                    renderRelease(updated.release, { retry: false, message: '' });
                    return;
                }
                if (!response.ok) {
                    const friendly = friendlyError(response, config.projectName);
                    const error = new Error(friendly.message);
                    error.noRelease = friendly.noRelease;
                    throw error;
                }
                const release = await response.json();
                if (!release?.tag_name || !Array.isArray(release.assets)) throw new Error('GitHub returned release information in an unexpected format.');
                const value = { release, etag: response.headers.get('ETag') || '', checkedAt: Date.now() };
                writeCache(cacheKey, value);
                renderRelease(release, { retry: false, message: '' });
            } catch (error) {
                if (error?.noRelease) {
                    removeCache(cacheKey);
                    content.hidden = true;
                    if (cardVersion) cardVersion.textContent = 'Not released yet';
                    if (cardInstallers) cardInstallers.textContent = 'Not released yet';
                    setStatus(`No public ${config.projectName} release is available yet. Check the repository or come back after the first release.`, 'info', false);
                    return;
                }
                const message = error?.name === 'AbortError'
                    ? 'GitHub did not respond in time. Please try again.'
                    : (error?.message?.startsWith('GitHub ') ? error.message : 'The latest release could not be retrieved. Check your connection and try again.');
                if (cached) {
                    renderRelease(cached.release, { retry: true, message: `${message} Showing saved release information, which may be out of date.` });
                } else {
                    content.hidden = true;
                    setStatus(message, 'error', true);
                }
            } finally {
                clearTimeout(timeout);
                requestPromise = null;
            }
        })();
        return requestPromise;
    }

    openButton.addEventListener('click', () => {
        lastFocus = openButton;
        dialog.showModal();
        fetchLatest();
    });
    dialog.querySelectorAll('[data-fpkg-release-close], [data-release-close]').forEach((button) => {
        button.addEventListener('click', () => dialog.close());
    });
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => lastFocus?.focus());
    retryButton.addEventListener('click', () => fetchLatest(true));
    fetchLatest();
}

const RELEASE_DIALOGS = [
    {
        repository: 'rileyadams05/FPKG-Builder', projectName: 'FPKG Builder', assetMode: 'fpkg', cacheKey: 'vortex-prime:fpkg-builder:latest-release:v1',
        buttonId: 'fpkgBuilderInstallButton', dialogId: 'fpkgReleaseDialog', prefix: 'fpkgRelease',
        cardVersionId: 'fpkgProjectVersion'
    },
    {
        repository: 'rileyadams05/ModX', projectName: 'ModX', assetMode: 'modx',
        buttonId: 'modxInstallButton', dialogId: 'modxReleaseDialog', prefix: 'modxRelease',
        cardVersionId: 'modxProjectVersion', cardInstallersId: 'modxProjectInstallers'
    }
];

export function initializeReleaseDialogs(configs = RELEASE_DIALOGS) {
    for (const config of configs) initializeDialog(config);
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initializeReleaseDialogs(), { once: true });
    else initializeReleaseDialogs();
}

const RELEASE_API = 'https://api.github.com/repos/rileyadams05/FPKG-Builder/releases/latest';
const CACHE_KEY = 'vortex-prime:fpkg-builder:latest-release:v1';
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

function readCache() {
    try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (cached?.release?.tag_name && Array.isArray(cached.release.assets)) return cached;
    } catch (_) {
        // Storage can be disabled or full. Network retrieval still works.
    }
    return null;
}

function writeCache(value) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(value));
    } catch (_) {
        // The current dialog can still use the freshly fetched response.
    }
}

function friendlyError(response) {
    if (response.status === 404) return 'No public FPKG Builder release is available right now.';
    if (response.status === 403 || response.status === 429) {
        return 'GitHub is temporarily limiting release requests. Please try again shortly.';
    }
    return 'The latest release could not be retrieved. Check your connection and try again.';
}

function initializeDialog() {
    const dialog = document.getElementById('fpkgReleaseDialog');
    const openButton = document.getElementById('fpkgBuilderInstallButton');
    if (!dialog || !openButton) return;

    const status = document.getElementById('fpkgReleaseStatus');
    const retryButton = document.getElementById('fpkgReleaseRetry');
    const content = document.getElementById('fpkgReleaseContent');
    const cardVersion = document.getElementById('fpkgProjectVersion');
    let lastFocus = null;
    let requestPromise = null;

    function setStatus(message, kind = 'info', showRetry = false) {
        status.textContent = message;
        status.dataset.kind = kind;
        status.hidden = !message;
        retryButton.hidden = !showRetry;
    }

    function makeDownloadLink(asset, label, description) {
        if (!asset || !asset.browser_download_url) return null;
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
        if (description) row.dataset.description = description;
        return row;
    }

    function renderRelease(release, freshness) {
        const version = getReleaseVersion(release);
        const assets = selectInstallerAssets(release);
        document.getElementById('fpkgReleaseVersion').textContent = `Version ${version}`;

        const dateNode = document.getElementById('fpkgReleaseDate');
        const published = release.published_at || release.created_at;
        dateNode.textContent = published ? `Released ${formatReleaseDate(published)}` : 'Release date unavailable';

        const list = document.getElementById('fpkgReleaseDownloads');
        list.replaceChildren();
        const debRow = makeDownloadLink(assets.deb, 'Linux Mint / Ubuntu / Debian', 'deb');
        const rpmRow = makeDownloadLink(assets.rpm, 'Fedora / RPM-based Linux', 'rpm');
        if (debRow) list.append(debRow);
        if (rpmRow) list.append(rpmRow);

        const missing = [];
        if (!assets.deb) missing.push('.deb');
        if (!assets.rpm) missing.push('.rpm');
        const warning = document.getElementById('fpkgReleaseAssetWarning');
        if (missing.length) {
            warning.hidden = false;
            warning.textContent = `This release does not include the official ${missing.join(' and ')} installer${missing.length > 1 ? 's' : ''}.`;
        } else {
            warning.hidden = true;
            warning.textContent = '';
        }

        const notes = document.getElementById('fpkgReleaseNotes');
        const notesBody = document.getElementById('fpkgReleaseNotesBody');
        notesBody.textContent = release.body || 'No release notes were provided.';
        notes.hidden = !release.body;

        const extras = document.getElementById('fpkgReleaseExtras');
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
        document.getElementById('fpkgReleaseExtraDetails').hidden = extras.childElementCount === 0;
        document.getElementById('fpkgReleaseContent').hidden = false;

        if (cardVersion) {
            cardVersion.textContent = version;
        }
        if (freshness.retry) setStatus(freshness.message, 'error', true);
        else setStatus('', '', false);
    }

    async function fetchLatest(force = false) {
        if (requestPromise) return requestPromise;
        const cached = readCache();
        const age = cached ? Date.now() - Number(cached.checkedAt || 0) : Infinity;
        if (!force && cached && age >= 0 && age < RELEASE_CACHE_TTL_MS) {
            renderRelease(cached.release, {
                cached: true,
                retry: false,
                message: ''
            });
            return;
        }

        if (cached) {
            renderRelease(cached.release, {
                cached: true,
                retry: false,
                message: ''
            });
        } else {
            content.hidden = true;
            setStatus('Checking the latest GitHub release…', 'info');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        requestPromise = (async () => {
            try {
                const headers = { Accept: 'application/vnd.github+json' };
                if (cached?.etag) headers['If-None-Match'] = cached.etag;
                const response = await fetch(RELEASE_API, {
                    headers,
                    cache: 'no-store',
                    signal: controller.signal
                });

                if (response.status === 304 && cached) {
                    const updated = { ...cached, checkedAt: Date.now() };
                    writeCache(updated);
                    renderRelease(updated.release, {
                        cached: false,
                        retry: false,
                        message: ''
                    });
                    return;
                }
                if (!response.ok) throw new Error(friendlyError(response));

                const release = await response.json();
                if (!release?.tag_name || !Array.isArray(release.assets)) {
                    throw new Error('GitHub returned release information in an unexpected format.');
                }
                const value = {
                    release,
                    etag: response.headers.get('ETag') || '',
                    checkedAt: Date.now()
                };
                writeCache(value);
                renderRelease(release, {
                    cached: false,
                    retry: false,
                    message: ''
                });
            } catch (error) {
                const message = error?.name === 'AbortError'
                    ? 'GitHub did not respond in time. Please try again.'
                    : (error?.message?.startsWith('GitHub ') || error?.message?.startsWith('No public')
                        ? error.message
                        : 'The latest release could not be retrieved. Check your connection and try again.');
                if (cached) {
                    renderRelease(cached.release, {
                        cached: true,
                        retry: true,
                        message: `${message} Showing saved release information, which may be out of date.`
                    });
                } else {
                    content.hidden = true;
                    setStatus(message, 'error', true);
                    if (cardVersion) cardVersion.textContent = 'Unavailable';
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
    dialog.querySelectorAll('[data-fpkg-release-close]').forEach((button) => {
        button.addEventListener('click', () => dialog.close());
    });
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => lastFocus?.focus());
    retryButton.addEventListener('click', () => fetchLatest(true));
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDialog, { once: true });
    } else {
        initializeDialog();
    }
}

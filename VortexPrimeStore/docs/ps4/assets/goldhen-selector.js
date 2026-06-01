import goldhenSupport from './data/goldhen-support.json' assert { type: 'json' };
import goldhenManifest from './data/vortex-goldhen-manifest.json' assert { type: 'json' };

const SORT_OPTIONS = {
  NEWEST: 'newest',
  RECOMMENDED: 'recommended'
};
const UNSUPPORTED_FIRMWARE_MESSAGE = 'The owner has not made a host for this firmware version yet. This firmware requires a different method and is not supported on this website. Please use another trusted website/source for this version.';

const state = {
  input: document.querySelector('[data-firmware-input]'),
  form: document.querySelector('[data-search-form]'),
  emptyState: document.querySelector('[data-empty-state]'),
  toolbar: document.querySelector('[data-results-toolbar]'),
  resultsTitle: document.querySelector('[data-results-title]'),
  resultsSubtitle: document.querySelector('[data-results-subtitle]'),
  resultsBody: document.querySelector('[data-results-body]'),
  sortButtons: Array.from(document.querySelectorAll('[data-sort-option]')),
  sortMode: SORT_OPTIONS.NEWEST,
  currentFirmware: '',
  lastResult: null
};

init();

function init() {
  if (!state.form || !state.input || !state.resultsBody) {
    return;
  }

  state.form.addEventListener('submit', handleSubmit);
  state.sortButtons.forEach((button) => {
    button.addEventListener('click', handleSortChange);
  });
  updateSortButtons();
  try {
    const last = localStorage.getItem('vortex:lastFirmware') || '';
    if (last && state.input) {
      state.input.placeholder = `${state.input.placeholder} (last: ${last})`;
    }
  } catch(e) {}
}

function handleSubmit(event) {
  event.preventDefault();
  if (!state.input) {
    return;
  }

  const raw = String(state.input.value || '').trim();
  const cmd = raw.toLowerCase();

  if (cmd === 'run' || cmd === 'cache' || cmd === 'clear cache') {
    const fw = state.currentFirmware || getLastFirmware();
    if (!fw) {
      renderUnsupported('Please enter your firmware first.');
      return;
    }
    if (cmd === 'run') {
      runRecommendedForFirmware(fw);
      return;
    }
    if (cmd === 'cache') {
      cacheForFirmware(fw);
      return;
    }
    if (cmd === 'clear cache') {
      clearCaches().then(() => showMessage('Cache cleared (where supported).')).catch(() => showMessage('Tried to clear cache. Some browsers may not support this.'));
      return;
    }
  }

  const normalised = normaliseFirmware(raw);
  if (!normalised) {
    state.lastResult = null;
    renderUnsupported('Enter a valid firmware version from the local Vortex Prime browser-host set, for example 5.05 or 9.00.');
    return;
  }

  state.currentFirmware = normalised;
  try { localStorage.setItem('vortex:lastFirmware', state.currentFirmware); } catch(e) {}
  state.sortMode = SORT_OPTIONS.NEWEST;
  updateSortButtons();

  const result = getGoldHENOptions(normalised);
  renderResults(result);
}

function handleSortChange(event) {
  const button = event.currentTarget;
  if (!button) {
    return;
  }

  const option = button.getAttribute('data-sort-option');
  if (!option || option === state.sortMode) {
    return;
  }

  state.sortMode = option;
  updateSortButtons();
  renderSortedResults();
}

function normaliseFirmware(value) {
  if (!value) {
    return '';
  }

  const cleaned = String(value)
    .trim()
    .replace(/[^0-9.]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');

  if (!cleaned) {
    return '';
  }

  if (/^\d{3}$/.test(cleaned)) {
    const first = cleaned.slice(0, cleaned.length - 2);
    const rest = cleaned.slice(-2);
    return `${parseInt(first, 10)}.${rest}`;
  }

  if (/^\d$/.test(cleaned)) {
    return `${cleaned}.00`;
  }

  const parts = cleaned.split('.').filter(Boolean);
  if (parts.length === 1) {
    return `${parts[0]}.00`;
  }

  if (parts.length >= 2) {
    const major = parts[0];
    const minor = parts[1].padEnd(2, '0').slice(0, 2);
    const final = `${major}.${minor}`;
    return normaliseGroupedFirmware(final);
  }

  return '';
}

function normaliseGroupedFirmware(value) {
  return value;
}

function compareGoldhenVersion(a, b) {
  if (a === b) {
    return 0;
  }

  const tokenize = (version) => version.split(/[.a-zA-Z]+/).filter(Boolean).map(Number);
  const aTokens = tokenize(a || '0');
  const bTokens = tokenize(b || '0');

  const length = Math.max(aTokens.length, bTokens.length);
  for (let index = 0; index < length; index += 1) {
    const aValue = aTokens[index] ?? 0;
    const bValue = bTokens[index] ?? 0;

    if (aValue !== bValue) {
      return aValue - bValue;
    }
  }
  return 0;
}

function getGoldHENOptions(inputFirmware) {
  const normalisedFirmware = normaliseFirmware(inputFirmware);
  const matches = goldhenSupport.filter((item) =>
    (item.supportedFirmwares || []).some((fw) => normaliseFirmware(fw) === normalisedFirmware)
  );

  if (!matches.length) {
    return {
      firmware: normalisedFirmware,
      supported: false,
      message: UNSUPPORTED_FIRMWARE_MESSAGE
    };
  }

  return {
    firmware: normalisedFirmware,
    supported: true,
    options: matches
  };
}

function renderResults(result) {
  if (!result.supported) {
    state.lastResult = result;
    renderUnsupported(result.message);
    return;
  }

  state.lastResult = result;
  if (state.emptyState) {
    state.emptyState.hidden = true;
  }

  renderSortedResults();
}

function renderSortedResults() {
  if (!state.lastResult || !state.lastResult.supported || !state.resultsBody) {
    return;
  }

  const { firmware, options } = state.lastResult;
  const sorted = sortOptions(options, state.sortMode);
  const context = buildRenderContext(options);

  if (state.resultsBody) {
    state.resultsBody.innerHTML = '';
  }

  sorted.forEach((item) => {
    const card = renderOptionCard(item, firmware, context);
    state.resultsBody.appendChild(card);
  });

  updateToolbar(firmware, sorted.length);
  injectActionsToolbar(firmware);
}

function renderOptionCard(item, firmware, context) {
  const card = document.createElement('article');
  card.className = 'option-card';

  const title = document.createElement('div');
  title.className = 'option-title';
  title.innerHTML = `
    <h3>${item.name}</h3>
    <span>Release ${item.version}</span>
  `;
  card.appendChild(title);

  const badges = buildBadges(item, context);
  if (badges.length > 0) {
    const badgeRow = document.createElement('div');
    badgeRow.className = 'badge-row';
    badges.forEach((badge) => {
      const badgeEl = document.createElement('span');
      badgeEl.className = `badge ${badge.className}`;
      badgeEl.textContent = badge.label;
      badgeRow.appendChild(badgeEl);
    });
    card.appendChild(badgeRow);
  }

  if (item.notes) {
    const notes = document.createElement('p');
    notes.className = 'option-notes';
    notes.textContent = item.notes;
    card.appendChild(notes);
  }

  const firmwareList = document.createElement('ul');
  firmwareList.className = 'firmware-list';
  (item.supportedFirmwares || []).forEach((fw) => {
    const listItem = document.createElement('li');
    const normalised = normaliseFirmware(fw);
    listItem.textContent = normalised;
    if (normalised === firmware) {
      listItem.classList.add('is-active');
    }
    firmwareList.appendChild(listItem);
  });
  card.appendChild(firmwareList);

  const meta = document.createElement('div');
  meta.className = 'meta-row';
  meta.innerHTML = `
    <span><strong>Source</strong> ${formatSource(item.source)}</span>
    <span><strong>Channel</strong> ${formatChannel(item.type)}</span>
    <span><strong>Support</strong> ${(item.supportedFirmwares || []).length} firmware${(item.supportedFirmwares || []).length === 1 ? '' : 's'}</span>
  `;
  card.appendChild(meta);

  const footer = document.createElement('div');
  footer.className = 'option-footer';

  const actions = document.createElement('div');
  actions.className = 'selector-actions';
  const runBtn = document.createElement('button');
  runBtn.type = 'button';
  runBtn.textContent = 'Run';
  runBtn.addEventListener('click', () => runRecommendedForFirmware(firmware));
  const cacheBtn = document.createElement('button');
  cacheBtn.type = 'button';
  cacheBtn.textContent = 'Cache';
  cacheBtn.addEventListener('click', () => cacheForFirmware(firmware));
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = 'Clear Cache';
  clearBtn.addEventListener('click', () => {
    clearCaches().then(() => showMessage('Cache cleared (where supported).')).catch(() => showMessage('Tried to clear cache. Some browsers may not support this.'));
  });
  actions.appendChild(runBtn);
  actions.appendChild(cacheBtn);
  actions.appendChild(clearBtn);

  footer.appendChild(actions);
  card.appendChild(footer);

  return card;
}

function buildBadges(item, context) {
  const badges = [];
  const isNewest = item.newest || item.version === context.newestVersion;
  const isRecommended = Boolean(item.recommended);
  const isBeta = isBetaRelease(item);

  if (isNewest) {
    badges.push({ label: 'NEWEST', className: 'badge-newest' });
  }

  if (isRecommended) {
    badges.push({ label: 'RECOMMENDED', className: 'badge-recommended' });
  }

  if (isBeta) {
    badges.push({ label: 'BETA / PRERELEASE', className: 'badge-beta' });
  } else if (item.type === 'stable') {
    badges.push({ label: 'STABLE', className: 'badge-stable' });
  }

  const shouldMarkOld = !isNewest && !isRecommended;
  if (shouldMarkOld) {
    badges.push({ label: 'OLD', className: 'badge-old' });
  }

  return badges;
}

function isBetaRelease(item) {
  if (!item) {
    return false;
  }

  if (item.type === 'beta') {
    return true;
  }

  if (item.type === 'stable') {
    return false;
  }

  return /b/i.test(item.version || '');
}

function getPayloadForFirmware(item, firmware) {
  if (!item || !Array.isArray(item.payloads)) {
    return null;
  }

  const normalised = normaliseFirmware(firmware);
  return item.payloads.find((payload) => normaliseFirmware(payload.firmware) === normalised) || null;
}

function handleRunClick({ firmware, payload, item }) {
  if (!payload || !payload.path) {
    return;
  }

  const hostUrl = new URL('index.html', window.location.href);
  hostUrl.searchParams.set('firmware', firmware);
  if (payload.label) {
    hostUrl.searchParams.set('payloadLabel', payload.label);
  }
  hostUrl.searchParams.set('payloadPath', payload.path);
  hostUrl.searchParams.set('payloadVersion', item.version || payload.label || 'GoldHEN');
  hostUrl.searchParams.set('autoRun', '1');

  window.location.href = hostUrl.toString();
}

function sortOptions(options, mode) {
  const newestSorted = [...options].sort((a, b) => {
    const difference = compareGoldhenVersion(b.version || '0', a.version || '0');
    if (difference !== 0) {
      return difference;
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  if (mode !== SORT_OPTIONS.RECOMMENDED) {
    return newestSorted;
  }

  const recommended = newestSorted.filter((item) => item.recommended);
  const rest = newestSorted.filter((item) => !item.recommended);
  return recommended.concat(rest);
}

function buildRenderContext(options) {
  const newest = options.reduce((acc, item) => {
    if (!item || !item.version) {
      return acc;
    }
    if (!acc) {
      return item.version;
    }
    return compareGoldhenVersion(item.version, acc) > 0 ? item.version : acc;
  }, null);

  return {
    newestVersion: newest
  };
}

function updateToolbar(firmware, count) {
  if (!state.toolbar || !state.resultsTitle || !state.resultsSubtitle) {
    return;
  }

  state.toolbar.hidden = false;
  state.resultsTitle.textContent = `Firmware ${firmware}`;
  const sortDescription = state.sortMode === SORT_OPTIONS.RECOMMENDED ? 'recommended releases first' : 'newest to oldest';
  state.resultsSubtitle.textContent = `Showing ${count} compatible GoldHEN release${count === 1 ? '' : 's'}, sorted ${sortDescription}.`;
}

function renderUnsupported(message) {
  if (!state.resultsBody) {
    return;
  }

  if (state.emptyState) {
    state.emptyState.hidden = true;
  }

  if (state.toolbar) {
    state.toolbar.hidden = true;
  }

  state.resultsBody.innerHTML = '';

  const alert = document.createElement('p');
  alert.className = 'alert';
  alert.textContent = message;

  state.resultsBody.appendChild(alert);
}

function updateSortButtons() {
  state.sortButtons.forEach((button) => {
    if (!button) {
      return;
    }
    const option = button.getAttribute('data-sort-option');
    if (option === state.sortMode) {
      button.classList.add('is-active');
    } else {
      button.classList.remove('is-active');
    }
  });
}

function formatSource(source) {
  switch (source) {
    case 'github':
      return 'Official GitHub';
    case 'ko-fi':
      return 'Ko-fi beta';
    case 'older-release':
      return 'Archive build';
    case 'vortex-local':
      return 'Local Vortex Prime files';
    default:
      return source || 'Community';
  }
}

function formatChannel(type) {
  switch (type) {
    case 'stable':
      return 'Stable';
    case 'beta':
      return 'Beta / prerelease';
    case 'vortex-local':
      return 'Vortex Prime local';
    default:
      return type || 'Unknown';
  }
}

function getLastFirmware() {
  try { return localStorage.getItem('vortex:lastFirmware') || state.currentFirmware || ''; } catch(e) { return state.currentFirmware || ''; }
}

function injectActionsToolbar(firmware) {
  if (!state.toolbar) return;
  const existing = state.toolbar.querySelector('.cmd-actions');
  if (existing) existing.remove();
  const group = document.createElement('div');
  group.className = 'cmd-actions';
  const run = document.createElement('button');
  run.type = 'button';
  run.textContent = 'Run';
  run.addEventListener('click', () => runRecommendedForFirmware(firmware));
  const cache = document.createElement('button');
  cache.type = 'button';
  cache.textContent = 'Cache';
  cache.addEventListener('click', () => cacheForFirmware(firmware));
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.textContent = 'Clear Cache';
  clear.addEventListener('click', () => {
    clearCaches().then(() => showMessage('Cache cleared (where supported).')).catch(() => showMessage('Tried to clear cache. Some browsers may not support this.'));
  });
  group.appendChild(run);
  group.appendChild(cache);
  group.appendChild(clear);
  state.toolbar.appendChild(group);
}

function runRecommendedForFirmware(firmware) {
  const payload = pickBestPayload(firmware);
  if (!payload) {
    showMessage('No local payload found for this firmware.');
    return;
  }
  navigateToEngine(firmware, payload);
}

function cacheForFirmware(firmware) {
  try { sessionStorage.setItem('vortexCacheChoice', 'yes'); } catch(e) {}
  const payload = pickBestPayload(firmware);
  if (!payload) { showMessage('No local payload found to cache for this firmware.'); return; }
  navigateToEngine(firmware, payload);
}

function pickBestPayload(firmware) {
  const fw = normaliseFirmware(firmware);
  const fwEntry = (goldhenManifest && goldhenManifest.firmwares && goldhenManifest.firmwares[fw]) || null;
  if (!fwEntry || !Array.isArray(fwEntry.payloads) || !fwEntry.payloads.length) {
    return null;
  }
  const ranked = [...fwEntry.payloads].sort((a, b) => compareGoldhenVersion(labelVersion(b.label), labelVersion(a.label)));
  const best = ranked[0];
  return {
    engine: fwEntry.engine,
    cache: fwEntry.cache,
    ...best
  };
}

function labelVersion(label) {
  if (!label) return '0';
  const m = String(label).match(/v(\d+(?:\.\d+)*(?:[a-z]\d+(?:\.\d+)*)?)/i);
  return m ? m[1] : '0';
}

function buildEngineUrl(firmware, payload) {
  const base = new URL('.', window.location.origin + '/ps4/');
  const engine = new URL(payload.engine || '', base);
  const params = engine.searchParams;
  const mode = payload.mode || 'poc-b';
  params.set('vortexMode', mode);
  if (payload.when) params.set('vortexWhen', payload.when);
  if (payload.loaded) params.set('vortexLoaded', payload.loaded);
  if (payload.payload) params.set('vortexPayload', payload.payload);
  if (payload.file) params.set('vortexFile', payload.file);
  if (payload.fw) params.set('vortexFw', payload.fw);
  return engine.toString();
}

function navigateToEngine(firmware, payload) {
  const url = buildEngineUrl(firmware, payload);
  window.location.href = url;
}

function clearCaches() {
  const tasks = [];
  if ('serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker.getRegistrations().then((regs) => {
        return Promise.all(regs.map((r) => {
          if (r && r.scope && r.scope.indexOf('/ps4/') !== -1) {
            return r.unregister();
          }
        }));
      })
    );
  }
  if (window.caches && caches.keys) {
    tasks.push(
      caches.keys().then((keys) => Promise.all(keys.map((k) => /vortex-goldhen-cache-v/.test(k) ? caches.delete(k) : Promise.resolve())))
    );
  }
  try { localStorage.removeItem('cachedB'); } catch(e) {}
  try { sessionStorage.removeItem('vortexCacheChoice'); } catch(e) {}
  return Promise.all(tasks);
}

function showMessage(text) {
  if (!state.resultsBody) return;
  const p = document.createElement('p');
  p.className = 'alert';
  p.textContent = text;
  state.resultsBody.prepend(p);
}

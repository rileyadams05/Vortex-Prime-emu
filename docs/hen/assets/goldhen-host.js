(function () {
  'use strict';

  var state = {
    manifest: null,
    statusMessage: null,
    detectionMessage: null,
    firmwareInput: null,
    nextButton: null,
    cacheButton: null,
    versionPanel: null,
    versionList: null,
    visiblePayloads: [],
    currentFirmware: '',
    selectedFirmware: null,
    selectedPayload: null
  };
  var unsupportedFirmwareMessage = 'The owner has not made a host for this firmware version yet. This firmware requires a different method and is not supported on this website. Please use another trusted website/source for this version.';

  function init() {
    bindDom();
    bindControls();
    loadManifest();
  }

  function bindDom() {
    state.statusMessage = document.querySelector('[data-status-message]');
    state.detectionMessage = document.querySelector('[data-detection-message]');
    state.firmwareInput = document.querySelector('[data-firmware-input]');
    state.nextButton = document.querySelector('[data-next-goldhen]');
    state.cacheButton = document.querySelector('[data-cache-host]');
    state.versionPanel = document.querySelector('[data-version-panel]');
    state.versionList = document.querySelector('[data-version-list]');
  }

  function bindControls() {
    if (state.firmwareInput) {
      state.firmwareInput.addEventListener('input', function () {
        state.currentFirmware = normaliseFirmware(state.firmwareInput.value);
        resetVersionSelection();
      }, false);
    }

    if (state.nextButton) {
      state.nextButton.addEventListener('click', handleNextStep, false);
    }

    if (state.cacheButton) {
      state.cacheButton.addEventListener('click', handleCacheHost, false);
    }
  }

  function loadManifest() {
    updateDetection('Loading Karo payload map...', 'loading');

    requestJson('assets/data/karo-goldhen-manifest.json', function (manifest) {
      state.manifest = manifest;
      detectFirmware();
      clearStatus();
    }, function (message) {
      updateDetection('Could not load the local Karo payload map.', 'error');
      updateStatus('Manifest load failed: ' + message, 'error');
    });
  }

  function requestJson(url, onSuccess, onError) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) {
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            onSuccess(JSON.parse(xhr.responseText));
          } catch (error) {
            onError('Invalid JSON');
          }
        } else {
          onError('HTTP ' + xhr.status);
        }
      };
      xhr.onerror = function () {
        onError('Network error');
      };
      xhr.send();
    } catch (error) {
      onError(error && error.message ? error.message : 'Unknown error');
    }
  }

  function detectFirmware() {
    if (!state.manifest || !state.firmwareInput) {
      return;
    }

    var userAgent = window.navigator && window.navigator.userAgent ? String(window.navigator.userAgent) : '';
    var match = userAgent.match(/playstation 4 ([0-9]+\.[0-9]+)/i) ||
      userAgent.match(/firmware\/?\s*([0-9]+\.[0-9]+)/i) ||
      userAgent.match(/\(([0-9]+\.[0-9]+)\)/);
    var detected = match && match[1] ? normaliseFirmware(match[1]) : '';

    if (detected && state.manifest.firmwares[detected]) {
      state.currentFirmware = detected;
      state.firmwareInput.value = detected;
      updateDetection('Detected firmware: ' + detected, 'success');
      return;
    }

    updateDetection('Could not detect firmware. Enter it manually, for example 5.05, 6.72, 7.02, 7.55, or 9.00.', 'warning');
  }

  function normaliseFirmware(value) {
    var cleaned = String(value || '')
      .trim()
      .replace(/[^0-9.]/g, '')
      .replace(/\.+/g, '.')
      .replace(/^\./, '')
      .replace(/\.$/, '');

    if (!cleaned) {
      return '';
    }

    if (/^\d{3}$/.test(cleaned)) {
      return parseInt(cleaned.charAt(0), 10) + '.' + cleaned.slice(1);
    }

    if (/^\d{4}$/.test(cleaned)) {
      return parseInt(cleaned.slice(0, 2), 10) + '.' + cleaned.slice(2);
    }

    var parts = cleaned.split('.');
    var major = parts[0] || '';
    var minor = parts.length > 1 ? parts[1] : '00';
    if (!major) {
      return '';
    }

    minor = (minor + '00').slice(0, 2);
    return major + '.' + minor;
  }

  function handleNextStep() {
    if (!state.manifest) {
      updateStatus('Karo payload map is still loading.', 'loading');
      return;
    }

    var firmware = normaliseFirmware(state.firmwareInput ? state.firmwareInput.value : '');
    var firmwareConfig = state.manifest.firmwares[firmware];

    if (!firmware) {
      updateStatus('Enter your PS4 firmware first.', 'warning');
      resetVersionSelection();
      return;
    }

    if (!firmwareConfig || !firmwareConfig.payloads || !firmwareConfig.payloads.length) {
      resetVersionSelection();
      updateStatus(unsupportedFirmwareMessage, 'error');
      return;
    }

    state.currentFirmware = firmware;
    state.selectedFirmware = firmwareConfig;
    state.visiblePayloads = sortPayloads(firmware, firmwareConfig.payloads.slice());
    populateVersionOptions();
    revealVersionPanel();

    if (firmwareConfig.usbFlow) {
      updateStatus('9.00 selected. Karo will show the USB prompt during the exploit at the original timing.', 'ready');
    } else {
      updateStatus('Select the GoldHEN version for firmware ' + firmware + '.', 'ready');
    }
  }

  function populateVersionOptions() {
    if (!state.versionList) {
      return;
    }

    state.versionList.innerHTML = '';
    state.visiblePayloads.forEach(function (payload, index) {
      state.versionList.appendChild(createPayloadCard(payload, index));
    });
  }

  function revealVersionPanel() {
    if (state.versionPanel) {
      state.versionPanel.removeAttribute('hidden');
    }
  }

  function resetVersionSelection() {
    state.visiblePayloads = [];
    state.selectedFirmware = null;
    state.selectedPayload = null;

    if (state.versionPanel) {
      state.versionPanel.setAttribute('hidden', 'hidden');
    }
    if (state.versionList) {
      state.versionList.innerHTML = '';
    }
  }

  function handleRunGoldHen(payload) {
    if (!state.selectedFirmware || !payload) {
      updateStatus('Select a firmware and GoldHEN payload first.', 'warning');
      return;
    }

    state.selectedPayload = payload;
    window.location.href = buildEngineUrl(state.currentFirmware, state.selectedFirmware, payload);
  }

  function createPayloadCard(payload, index) {
    var meta = getPayloadMeta(state.currentFirmware, payload, index);
    var card = document.createElement('article');
    card.className = 'version-card';

    var badgeRow = document.createElement('div');
    badgeRow.className = 'version-badges';
    meta.badges.forEach(function (badge) {
      var badgeEl = document.createElement('span');
      badgeEl.className = 'version-badge version-badge-' + badge.toLowerCase();
      badgeEl.textContent = badge;
      badgeRow.appendChild(badgeEl);
    });

    var title = document.createElement('h3');
    title.textContent = payload.label;

    var filename = document.createElement('p');
    filename.className = 'version-file';
    filename.textContent = payload.file;

    var note = document.createElement('p');
    note.className = 'version-note';
    note.textContent = meta.note;

    var runButton = document.createElement('button');
    runButton.type = 'button';
    runButton.className = 'primary-button version-run-button';
    runButton.textContent = 'Run ' + payload.label;
    runButton.addEventListener('click', function () {
      handleRunGoldHen(payload);
    }, false);

    card.appendChild(badgeRow);
    card.appendChild(title);
    card.appendChild(filename);
    card.appendChild(note);
    card.appendChild(runButton);
    return card;
  }

  function sortPayloads(firmware, payloads) {
    return payloads.sort(function (a, b) {
      var aMeta = getPayloadMeta(firmware, a, 0);
      var bMeta = getPayloadMeta(firmware, b, 0);
      if (aMeta.rank !== bMeta.rank) {
        return aMeta.rank - bMeta.rank;
      }
      return compareVersions(bMeta.version, aMeta.version);
    });
  }

  function getPayloadMeta(firmware, payload) {
    var version = getPayloadVersion(payload);
    var isBeta = /b/i.test(version);
    var recommended = version === getRecommendedVersion(firmware);
    var newer = isBeta && compareVersions(version, getRecommendedVersion(firmware)) > 0;
    var legacy = compareVersions(version, '2.1') < 0;
    var rank = recommended ? 0 : newer ? 1 : legacy ? 3 : 2;
    var badges = [];

    if (recommended) {
      badges.push('RECOMMENDED');
    } else if (newer) {
      badges.push('NEWER');
    } else if (legacy) {
      badges.push('LEGACY');
    } else {
      badges.push('OLD');
    }

    badges.push(isBeta ? 'BETA' : 'STABLE');

    return {
      version: version,
      rank: rank,
      badges: badges,
      note: getPayloadNote(firmware, version, recommended, newer, legacy, isBeta)
    };
  }

  function getPayloadNote(firmware, version, recommended, newer, legacy, isBeta) {
    if (recommended) {
      return 'Best normal recommended stable option for ' + firmware + '.';
    }
    if (newer) {
      return 'Newer beta/prerelease build. Not the main recommended stable option.';
    }
    if (legacy) {
      return isBeta ? 'Very old beta release.' : 'Very old stable release.';
    }
    return 'Older stable release.';
  }

  function getRecommendedVersion(firmware) {
    if (firmware === '9.00') {
      return '2.3';
    }
    return '2.3';
  }

  function getPayloadVersion(payload) {
    var match = String(payload && payload.label ? payload.label : '').match(/v([0-9][0-9A-Za-z.]*[0-9A-Za-z])/);
    return match && match[1] ? match[1] : '0';
  }

  function compareVersions(a, b) {
    var aParts = tokenizeVersion(a);
    var bParts = tokenizeVersion(b);
    var length = Math.max(aParts.length, bParts.length);
    for (var i = 0; i < length; i += 1) {
      var av = aParts[i] || 0;
      var bv = bParts[i] || 0;
      if (av !== bv) {
        return av - bv;
      }
    }
    return 0;
  }

  function tokenizeVersion(value) {
    var tokens = String(value || '0').match(/[0-9]+|[A-Za-z]+/g) || ['0'];
    return tokens.map(function (token) {
      if (/^[0-9]+$/.test(token)) {
        return parseInt(token, 10);
      }
      return token.toLowerCase().charCodeAt(0) - 96;
    });
  }

  function buildEngineUrl(firmware, firmwareConfig, payload) {
    var engine = payload.engine || firmwareConfig.engine;
    var mode = payload.mode || '';
    var query = [];

    if (mode) {
      query.push(['vortexMode', mode]);
      query.push(['vortexFile', payload.file]);
      query.push(['vortexPayload', payload.payload || '']);
      query.push(['vortexFw', payload.fw || '']);
      query.push(['vortexLoaded', payload.loaded || payload.label + ' Loaded']);
      if (payload.when) {
        query.push(['vortexWhen', payload.when]);
      }
      query.push(['firmware', firmware]);
    }

    if (!query.length) {
      return engine;
    }

    return engine + '?' + query.map(function (item) {
      return encodeURIComponent(item[0]) + '=' + encodeURIComponent(item[1]);
    }).join('&');
  }

  function handleCacheHost() {
    if (state.selectedFirmware && state.selectedFirmware.engine) {
      window.location.href = state.selectedFirmware.engine;
      return;
    }

    updateStatus('Select a firmware from the local Karo browser-host list first.', 'warning');
  }

  function clearStatus() {
    if (state.statusMessage) {
      state.statusMessage.textContent = '';
      state.statusMessage.removeAttribute('data-tone');
    }
  }

  function updateStatus(message, tone) {
    if (state.statusMessage) {
      state.statusMessage.setAttribute('data-tone', tone || 'ready');
      state.statusMessage.textContent = message;
    }
  }

  function updateDetection(message, tone) {
    if (state.detectionMessage) {
      state.detectionMessage.setAttribute('data-tone', tone || 'ready');
      state.detectionMessage.textContent = message;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, false);
  } else {
    init();
  }
})();

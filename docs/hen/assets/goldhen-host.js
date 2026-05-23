(function () {
  'use strict';

  var state = {
    manifest: null,
    statusMessage: null,
    detectionMessage: null,
    firmwareInput: null,
    nextButton: null,
    runButton: null,
    cacheButton: null,
    versionPanel: null,
    versionSelect: null,
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
    state.runButton = document.querySelector('[data-run-goldhen]');
    state.cacheButton = document.querySelector('[data-cache-host]');
    state.versionPanel = document.querySelector('[data-version-panel]');
    state.versionSelect = document.querySelector('[data-version-select]');
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

    if (state.versionSelect) {
      state.versionSelect.addEventListener('change', handleVersionChange, false);
    }

    if (state.runButton) {
      state.runButton.addEventListener('click', handleRunGoldHen, false);
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
    state.visiblePayloads = firmwareConfig.payloads.slice();
    populateVersionOptions();
    revealVersionPanel();

    if (firmwareConfig.usbFlow) {
      updateStatus('9.00 selected. Karo will show the USB prompt during the exploit at the original timing.', 'ready');
    } else {
      updateStatus('Select the GoldHEN version for firmware ' + firmware + '.', 'ready');
    }
  }

  function populateVersionOptions() {
    if (!state.versionSelect) {
      return;
    }

    state.versionSelect.innerHTML = '';
    state.visiblePayloads.forEach(function (payload, index) {
      var option = document.createElement('option');
      option.value = String(index);
      option.textContent = payload.label + ' - ' + payload.file;
      state.versionSelect.appendChild(option);
    });

    state.versionSelect.selectedIndex = 0;
    handleVersionChange();
  }

  function revealVersionPanel() {
    if (state.versionPanel) {
      state.versionPanel.removeAttribute('hidden');
    }
  }

  function handleVersionChange() {
    var index = state.versionSelect ? parseInt(state.versionSelect.value, 10) : -1;
    state.selectedPayload = !isNaN(index) ? state.visiblePayloads[index] : null;

    if (state.runButton) {
      if (state.selectedPayload) {
        state.runButton.removeAttribute('disabled');
      } else {
        state.runButton.setAttribute('disabled', 'disabled');
      }
    }
  }

  function resetVersionSelection() {
    state.visiblePayloads = [];
    state.selectedFirmware = null;
    state.selectedPayload = null;

    if (state.versionPanel) {
      state.versionPanel.setAttribute('hidden', 'hidden');
    }
    if (state.versionSelect) {
      state.versionSelect.innerHTML = '';
    }
    if (state.runButton) {
      state.runButton.setAttribute('disabled', 'disabled');
    }
  }

  function handleRunGoldHen() {
    if (!state.selectedFirmware || !state.selectedPayload) {
      updateStatus('Select a firmware and GoldHEN payload first.', 'warning');
      return;
    }

    window.location.href = buildEngineUrl(state.currentFirmware, state.selectedFirmware, state.selectedPayload);
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

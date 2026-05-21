(function () {
  'use strict';

  var state = {
    statusMessage: null,
    detectionMessage: null,
    firmwareInput: null,
    nextButton: null,
    runButton: null,
    cacheButton: null,
    versionPanel: null,
    versionSelect: null,
    payloadMap: {},
    payloadCache: {},
    visiblePayloads: [],
    isBusy: false,
    currentFirmware: '',
    selectedPayload: null
  };

  var cacheState = {
    initialized: false,
    registration: null
  };

  function init() {
    bindDom();

    if (!state.statusMessage || !state.firmwareInput || !state.runButton) {
      return;
    }

    registerPayloads();
    detectFirmware();
    bindControls();
    clearStatus();
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

  function registerPayloads() {
    var base = getPayloadBasePath();
    state.payloadMap = {
      '5.05': [
        createPayload('GoldHEN 2.3', base + 'goldhen_2.3_505.bin')
      ],
      '6.72': [
        createPayload('GoldHEN 2.3', base + 'goldhen_2.3_672.bin')
      ],
      '9.00': [
        createPayload('GoldHEN 2.3', base + 'goldhen_2.3_900.bin')
      ]
    };

    if (state.detectionMessage) {
      state.detectionMessage.setAttribute('data-tone', 'loading');
      state.detectionMessage.textContent = 'Detecting firmware...';
    }
  }

  function createPayload(label, url) {
    return {
      id: label,
      label: label,
      url: url
    };
  }

  function getPayloadBasePath() {
    var path = window.location && window.location.pathname ? window.location.pathname.toLowerCase() : '';

    if (path.indexOf('/docs/hen/') !== -1) {
      return 'payloads/';
    }

    if (path.indexOf('goldhen%20ps4') !== -1 || path.indexOf('goldhen ps4') !== -1) {
      return '../docs/hen/payloads/';
    }

    return './payloads/';
  }

  function detectFirmware() {
    if (!state.firmwareInput || !state.detectionMessage) {
      return;
    }

    var userAgent = window.navigator && window.navigator.userAgent ? String(window.navigator.userAgent) : '';
    var detected = '';

    var match = userAgent.match(/playstation 4 ([0-9]+\.[0-9]+)/i);
    if (!match) {
      match = userAgent.match(/firmware\/?\s*([0-9]+\.[0-9]+)/i);
    }
    if (!match) {
      match = userAgent.match(/\(([0-9]+\.[0-9]+)\)/);
    }

    if (match && match[1]) {
      detected = normaliseFirmware(match[1]);
    }

    if (detected && state.payloadMap[detected]) {
      state.currentFirmware = detected;
      state.firmwareInput.value = detected;
      state.detectionMessage.setAttribute('data-tone', 'success');
      state.detectionMessage.textContent = 'Detected firmware: ' + detected;
    } else {
      state.detectionMessage.setAttribute('data-tone', 'warning');
      state.detectionMessage.textContent = 'Could not detect firmware. Enter it manually (5.05, 6.72, or 9.00).';
    }
  }

  function normaliseFirmware(value) {
    return value ? value.replace(/[^0-9.]/g, '').substring(0, 5) : '';
  }

  function bindControls() {
    if (state.firmwareInput) {
      state.firmwareInput.addEventListener('input', handleFirmwareChange, false);
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

  function handleFirmwareChange(event) {
    state.currentFirmware = normaliseFirmware(event && event.target ? event.target.value : '');
    resetVersionSelection();
  }

  function handleNextStep() {
    if (state.isBusy) {
      return;
    }

    var firmware = normaliseFirmware(state.firmwareInput ? state.firmwareInput.value : '');

    if (!firmware) {
      updateStatus('Enter your firmware version (e.g. 5.05, 6.72, 9.00).', 'warning');
      resetVersionSelection();
      return;
    }

    if (!state.payloadMap[firmware] || state.payloadMap[firmware].length === 0) {
      updateStatus('No GoldHEN payloads are available for firmware ' + firmware + '.', 'error');
      resetVersionSelection();
      return;
    }

    state.currentFirmware = firmware;
    state.visiblePayloads = state.payloadMap[firmware].slice();
    populateVersionOptions();
    revealVersionPanel();
    updateStatus('Select the GoldHEN version for firmware ' + firmware + '.', 'ready');
  }

  function populateVersionOptions() {
    if (!state.versionSelect) {
      return;
    }

    state.versionSelect.innerHTML = '';

    state.visiblePayloads.forEach(function (payload, index) {
      var option = document.createElement('option');
      option.value = String(index);
      option.textContent = payload.label;
      state.versionSelect.appendChild(option);
    });

    if (state.visiblePayloads.length > 0) {
      state.versionSelect.selectedIndex = 0;
      handleVersionChange();
    } else {
      state.selectedPayload = null;
      if (state.runButton) {
        state.runButton.setAttribute('disabled', 'disabled');
      }
    }
  }

  function revealVersionPanel() {
    if (state.versionPanel) {
      state.versionPanel.removeAttribute('hidden');
    }
  }

  function handleVersionChange(event) {
    var select = event && event.target ? event.target : state.versionSelect;

    if (!select) {
      return;
    }

    var index = parseInt(select.value, 10);

    if (isNaN(index) || !state.visiblePayloads[index]) {
      state.selectedPayload = null;
      if (state.runButton) {
        state.runButton.setAttribute('disabled', 'disabled');
      }
      return;
    }

    state.selectedPayload = state.visiblePayloads[index];
    if (state.runButton) {
      state.runButton.removeAttribute('disabled');
    }
  }

  function resetVersionSelection() {
    state.visiblePayloads = [];
    state.selectedPayload = null;

    if (state.versionSelect) {
      state.versionSelect.innerHTML = '';
    }

    if (state.versionPanel && !state.versionPanel.hasAttribute('hidden')) {
      state.versionPanel.setAttribute('hidden', 'hidden');
    }

    if (state.runButton) {
      state.runButton.setAttribute('disabled', 'disabled');
    }
  }

  function handleRunGoldHen() {
    if (state.isBusy) {
      return;
    }

    var firmware = state.currentFirmware || normaliseFirmware(state.firmwareInput ? state.firmwareInput.value : '');

    if (!firmware) {
      updateStatus('Enter your firmware version (e.g. 5.05, 6.72, 9.00).', 'warning');
      return;
    }

    if (!state.selectedPayload || !state.selectedPayload.url) {
      updateStatus('Select a GoldHEN version to continue.', 'warning');
      return;
    }

    var payload = state.selectedPayload;

    state.currentFirmware = firmware;
    setBusy(true);
    updateStatus('Preparing ' + payload.label + ' for firmware ' + firmware + '...', 'loading');

    ensureBinLoaderReady()
      .then(function () {
        updateStatus('Loading ' + payload.label + '...', 'loading');
        return fetchPayloadBuffer(payload);
      })
      .then(function (buffer) {
        return sendPayload(buffer);
      })
      .then(function () {
        updateStatus(payload.label + ' loaded successfully for firmware ' + firmware + '.', 'success');
        setBusy(false);
      })
      .catch(function (error) {
        updateStatus(error && error.message ? error.message : String(error || 'Failed to load payload.'), 'error');
        setBusy(false);
      });
  }

  function setBusy(value) {
    state.isBusy = value;
    if (state.runButton) {
      if (value) {
        state.runButton.setAttribute('disabled', 'disabled');
      } else {
        if (state.selectedPayload) {
          state.runButton.removeAttribute('disabled');
        } else {
          state.runButton.setAttribute('disabled', 'disabled');
        }
      }
    }
  }

  function ensureBinLoaderReady() {
    return new Promise(function (resolve, reject) {
      updateStatus('Preparing BinLoader...', 'loading');

      if (typeof window.sendPayload === 'function') {
        updateStatus('BinLoader ready.', 'success');
        resolve();
        return;
      }

      var starter = null;
      if (typeof window.startBinLoader === 'function') {
        starter = window.startBinLoader;
      } else if (window.binLoader && typeof window.binLoader.start === 'function') {
        starter = function () {
          return window.binLoader.start();
        };
      }

      if (!starter) {
        resolve();
        return;
      }

      try {
        var result = starter();
        if (result && typeof result.then === 'function') {
          result.then(function () {
            updateStatus('BinLoader ready.', 'success');
            resolve();
          }).catch(function (error) {
            reject(new Error('BinLoader failed: ' + (error && error.message ? error.message : error)));
          });
        } else {
          updateStatus('BinLoader ready.', 'success');
          resolve();
        }
      } catch (error) {
        reject(new Error('BinLoader error: ' + (error && error.message ? error.message : error)));
      }
    });
  }

  function fetchPayloadBuffer(firmware) {
    return new Promise(function (resolve, reject) {
      if (!firmware || !firmware.url) {
        reject(new Error('Unsupported firmware or missing payload.'));
        return;
      }

      if (state.payloadCache[firmware.url]) {
        resolve(state.payloadCache[firmware.url]);
        return;
      }

      requestArrayBuffer(firmware.url, function (buffer) {
        state.payloadCache[firmware.url] = buffer;
        resolve(buffer);
      }, function (message) {
        reject(new Error('Failed to load payload: ' + message));
      });
    });
  }

  function requestArrayBuffer(url, onSuccess, onError) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.timeout = 15000;

      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) {
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
          onSuccess(xhr.response);
        } else {
          onError('HTTP ' + xhr.status);
        }
      };

      xhr.onerror = function () {
        onError('Network error');
      };

      xhr.ontimeout = function () {
        onError('Timeout');
      };

      xhr.send();
    } catch (error) {
      onError(error && error.message ? error.message : 'Unknown error');
    }
  }

  function sendPayload(buffer) {
    return new Promise(function (resolve, reject) {
      var sender = findPayloadSender();

      if (!sender) {
        reject(new Error('Automatic payload sender is unavailable. Ensure your exploit host is active and retry.'));
        return;
      }

      try {
        var data = new Uint8Array(buffer);
        var result = sender.length > 1 ? sender(data, data.length) : sender(data);

        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          resolve();
        }
      } catch (error) {
        try {
          var fallback = sender(buffer);
          if (fallback && typeof fallback.then === 'function') {
            fallback.then(resolve).catch(reject);
          } else {
            resolve();
          }
        } catch (inner) {
          reject(inner);
        }
      }
    });
  }

  function findPayloadSender() {
    if (typeof window.sendPayload === 'function') {
      return window.sendPayload;
    }

    if (window.payload && typeof window.payload.sendPayload === 'function') {
      return function (data, len) {
        return window.payload.sendPayload(data, len);
      };
    }

    if (window.binLoader && typeof window.binLoader.send === 'function') {
      return function (data, len) {
        return window.binLoader.send(data, len);
      };
    }

    return null;
  }

  function handleCacheHost() {
    if (cacheState.initialized) {
      updateStatus('Host already cached. You can revisit offline.', 'success');
      return;
    }

    updateStatus('Caching host offline...', 'loading');

    registerServiceWorker()
      .then(function () {
        updateStatus('Host cached successfully. Offline mode ready.', 'success');
      })
      .catch(function (error) {
        updateStatus('Failed to cache host: ' + (error && error.message ? error.message : error), 'error');
      });
  }

  function registerServiceWorker() {
    return new Promise(function (resolve, reject) {
      if (!('serviceWorker' in window.navigator)) {
        reject(new Error('Offline caching not supported in this browser.'));
        return;
      }

      var scriptPath = resolveServiceWorkerPath();
      var scope = scriptPath.indexOf('../') === 0 ? '../docs/hen/' : './';

      window.navigator.serviceWorker.register(scriptPath, { scope: scope })
        .then(function (registration) {
          cacheState.initialized = true;
          cacheState.registration = registration;
          resolve();
        })
        .catch(reject);
    });
  }

  function resolveServiceWorkerPath() {
    var path = window.location && window.location.pathname ? window.location.pathname.toLowerCase() : '';

    if (!path || path === '/' || path === '/index.html') {
      return 'goldhen-host-sw.js';
    }

    if (path.indexOf('/ps4/') === 0) {
      return 'goldhen-host-sw.js';
    }

    if (path.indexOf('/docs/hen/') !== -1) {
      return 'goldhen-host-sw.js';
    }

    if (path.indexOf('vortex-ps4-goldhen') !== -1) {
      return 'goldhen-host-sw.js';
    }

    return '../docs/hen/goldhen-host-sw.js';
  }

  function clearStatus() {
    if (!state.statusMessage) {
      return;
    }

    state.statusMessage.textContent = '';
    state.statusMessage.removeAttribute('data-tone');
  }

  function updateStatus(message, tone) {
    if (!state.statusMessage) {
      return;
    }

    state.statusMessage.setAttribute('data-tone', tone || 'ready');
    state.statusMessage.textContent = message;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, false);
  } else {
    init();
  }
})();

(function () {
  'use strict';

  var state = {
    statusMessage: null,
    statusTone: null,
    buttonGrid: null,
    buttons: []
  };

  function init() {
    state.statusMessage = document.querySelector('[data-status-message]');
    state.buttonGrid = document.querySelector('[data-button-grid]');

    if (!state.statusMessage || !state.buttonGrid) {
      return;
    }

    renderButtons();
    bindEvents();
    updateStatus('Ready. Choose a payload to send.', 'ready');
  }

  function renderButtons() {
    var payloadDefinitions = getPayloadDefinitions();
    var fragment = document.createDocumentFragment();

    for (var i = 0; i < payloadDefinitions.length; i++) {
      var entry = payloadDefinitions[i];
      var button = document.createElement('button');
      button.className = 'host-button';
      button.setAttribute('type', 'button');
      button.setAttribute('data-kind', entry.kind);
      if (entry.file) {
        button.setAttribute('data-file', entry.file);
      }
      button.setAttribute('data-label', entry.label);

      var span = document.createElement('span');
      span.textContent = entry.overline;

      var strong = document.createElement('strong');
      strong.textContent = entry.title;

      button.appendChild(span);
      button.appendChild(strong);

      fragment.appendChild(button);
    }

    state.buttonGrid.appendChild(fragment);
    state.buttons = state.buttonGrid.querySelectorAll('.host-button');
  }

  function bindEvents() {
    for (var i = 0; i < state.buttons.length; i++) {
      state.buttons[i].addEventListener('click', handleButtonClick, false);
    }
  }

  function handleButtonClick(event) {
    var button = event.currentTarget;
    var kind = button.getAttribute('data-kind');

    if (kind === 'binloader') {
      triggerBinLoader(button);
      return;
    }

    var file = button.getAttribute('data-file');
    var label = button.getAttribute('data-label');

    if (!file) {
      updateStatus('No payload file specified for this button.', 'error');
      return;
    }

    loadPayload(file, label);
  }

  function getPayloadDefinitions() {
    return [
      {
        kind: 'payload',
        label: 'GoldHEN 2.3 for FW 5.05',
        overline: 'GoldHEN',
        title: '2.3 · Firmware 5.05',
        file: 'goldhen_2.3_505.bin'
      },
      {
        kind: 'payload',
        label: 'GoldHEN 2.3 for FW 6.72',
        overline: 'GoldHEN',
        title: '2.3 · Firmware 6.72',
        file: 'goldhen_2.3_672.bin'
      },
      {
        kind: 'payload',
        label: 'GoldHEN 2.3 for FW 9.00',
        overline: 'GoldHEN',
        title: '2.3 · Firmware 9.00',
        file: 'goldhen_2.3_900.bin'
      },
      {
        kind: 'binloader',
        label: 'BinLoader utility',
        overline: 'Utility',
        title: 'BinLoader'
      }
    ];
  }

  function computeBasePaths() {
    var path = (window.location && window.location.pathname ? window.location.pathname : '').toLowerCase();
    var bases = [];

    function pushUnique(value) {
      if (bases.indexOf(value) === -1) {
        bases.push(value);
      }
    }

    if (path.indexOf('/docs/') !== -1 || path.indexOf('/hen/') !== -1) {
      pushUnique('payloads/');
      pushUnique('./payloads/');
    }

    if (path.indexOf('goldhen%20ps4') !== -1 || path.indexOf('goldhen ps4') !== -1) {
      pushUnique('GoldHEN/');
      pushUnique('./GoldHEN/');
      pushUnique('../GoldHEN/');
      pushUnique('../docs/hen/payloads/');
    } else {
      pushUnique('../docs/hen/payloads/');
      pushUnique('GoldHEN/');
      pushUnique('./GoldHEN/');
    }

    pushUnique('../../docs/hen/payloads/');
    pushUnique('../GoldHEN%20PS4/GoldHEN/');
    pushUnique('../../GoldHEN%20PS4/GoldHEN/');

    return bases;
  }

  function loadPayload(file, label) {
    updateStatus('Loading ' + label + ' …', 'loading');

    fetchPayload(file, function handleSuccess(result) {
      dispatchPayload(result.buffer).then(function () {
        updateStatus('Payload sent · ' + label, 'success');
      }).catch(function (error) {
        updateStatus('Payload ready. Unable to auto-send: ' + error.message, 'warning');
        offerDownload(result.buffer, file);
      });
    }, function handleFailure(errorMessage) {
      updateStatus('Failed to load ' + label + ': ' + errorMessage, 'error');
    });
  }

  function fetchPayload(file, resolve, reject) {
    var bases = computeBasePaths();
    var index = 0;
    var errors = [];

    function attemptNext() {
      if (index >= bases.length) {
        reject(errors.join('\n'));
        return;
      }

      var url = bases[index] + file;
      index += 1;
      requestArrayBuffer(url, function (buffer) {
        resolve({ buffer: buffer, url: url });
      }, function (error) {
        errors.push(error + ' [' + url + ']');
        attemptNext();
      });
    }

    attemptNext();
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

  function dispatchPayload(buffer) {
    return new Promise(function (resolve, reject) {
      var sender = findPayloadSender();

      if (!sender) {
        reject(new Error('No payload sender available. Launch BinLoader or exploit first.'));
        return;
      }

      try {
        var uint8 = new Uint8Array(buffer);
        var result = sender.length > 1 ? sender(uint8, uint8.length) : sender(uint8);

        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          resolve();
        }
      } catch (error) {
        try {
          var fallbackResult = sender(buffer);
          if (fallbackResult && typeof fallbackResult.then === 'function') {
            fallbackResult.then(resolve).catch(reject);
          } else {
            resolve();
          }
        } catch (innerError) {
          reject(innerError);
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

  function offerDownload(buffer, fileName) {
    if (!window.URL || !window.Blob) {
      return;
    }

    try {
      var blob = new Blob([buffer], { type: 'application/octet-stream' });
      var link = document.createElement('a');
      var url = URL.createObjectURL(blob);
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1500);
    } catch (error) {
      // Ignore download fallback errors silently.
    }
  }

  function triggerBinLoader() {
    updateStatus('Loading BinLoader …', 'loading');

    var handler = null;

    if (typeof window.startBinLoader === 'function') {
      handler = window.startBinLoader;
    } else if (window.binLoader && typeof window.binLoader.start === 'function') {
      handler = function () {
        return window.binLoader.start();
      };
    }

    if (!handler) {
      updateStatus('BinLoader entry point not available. Run your exploit first or use an external sender.', 'warning');
      return;
    }

    try {
      var result = handler();
      if (result && typeof result.then === 'function') {
        result.then(function () {
          updateStatus('BinLoader ready. Send your payload from a sender on port 9020.', 'success');
        }).catch(function (error) {
          updateStatus('BinLoader failed: ' + (error && error.message ? error.message : error), 'error');
        });
      } else {
        updateStatus('BinLoader ready. Send your payload from a sender on port 9020.', 'success');
      }
    } catch (error) {
      updateStatus('BinLoader error: ' + (error && error.message ? error.message : error), 'error');
    }
  }

  function updateStatus(message, tone) {
    if (!state.statusMessage) {
      return;
    }

    var appliedTone = tone || 'ready';
    state.statusMessage.setAttribute('data-tone', appliedTone);
    state.statusMessage.textContent = message;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, false);
  } else {
    init();
  }
})();

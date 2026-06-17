(function () {
  'use strict';

  function params() {
    var out = {};
    var query = window.location.search ? window.location.search.substring(1).split('&') : [];
    for (var i = 0; i < query.length; i += 1) {
      var pair = query[i].split('=');
      if (pair[0]) {
        out[decodeURIComponent(pair[0])] = decodeURIComponent(pair.slice(1).join('=') || '');
      }
    }
    return out;
  }

  function runSelected(settings) {
    if (!settings.vortexMode) {
      return;
    }

    if (settings.vortexFile) {
      window.PLfile = settings.vortexFile;
    }
    if (settings.vortexLoaded) {
      window.LoadedMSG = settings.vortexLoaded;
      window.vortexSelectedLoaded = settings.vortexLoaded;
    }

    if (settings.vortexMode === 'load-hen' && typeof window.load_hen === 'function') {
      window.load_hen(settings.vortexFile);
      return;
    }

    if (settings.vortexMode === 'toggle' && typeof window.toggle_payload === 'function') {
      if (settings.vortexFw) {
        window.fw = settings.vortexFw;
      }
      window.toggle_payload(settings.vortexPayload);
      return;
    }

    if (settings.vortexMode === 'function' && settings.vortexPayload && typeof window[settings.vortexPayload] === 'function') {
      window[settings.vortexPayload]();
      return;
    }

    if (settings.vortexMode === 'poc' && typeof window.load_poc === 'function') {
      window.load_poc();
      return;
    }

    if (settings.vortexMode === 'poc-b' && typeof window.load_pocB === 'function') {
      window.load_pocB();
    }
  }

  function afterJailbreak(settings) {
    var original = window.jbdone;
    if (typeof original !== 'function') {
      return false;
    }

    window.jbdone = function () {
      var result = original.apply(this, arguments);
      setTimeout(function () {
        runSelected(settings);
      }, 250);
      return result;
    };
    return true;
  }

  function init() {
    var settings = params();
    if (!settings.vortexMode) {
      return;
    }

    if (settings.vortexWhen === 'after-jb') {
      if (!afterJailbreak(settings)) {
        setTimeout(function () {
          afterJailbreak(settings);
        }, 50);
      }
      return;
    }

    setTimeout(function () {
      runSelected(settings);
    }, 350);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, false);
  } else {
    init();
  }
})();

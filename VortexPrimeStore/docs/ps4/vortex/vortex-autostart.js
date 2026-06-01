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

(function () {
  'use strict';
  var p = (window.location && window.location.pathname) || '';
  var is900 = (p.indexOf('/ps4/vortex/900C/') !== -1) || (document && document.title === 'Vortex Prime GoldHEN Host - 9.00');
  if (!is900) { return; }
  try {
    if (typeof window.poc === 'function') {
      var __origPoc = window.poc;
      window.poc = function(){ if (window.__vortexPocFired) { return; } window.__vortexPocFired = true; return __origPoc.apply(this, arguments); };
    }
  } catch(e) {}
  function progressEl(){ return document.getElementById('progress'); }
  var allow = false;
  try {
    var choice = sessionStorage.getItem('vortexCacheChoice');
    if (!choice) {
      var ok = true;
      try { ok = window.confirm('Cache exploit files for offline use?'); } catch(e) { ok = true; }
      sessionStorage.setItem('vortexCacheChoice', ok ? 'yes' : 'no');
      allow = ok;
    } else {
      allow = (choice === 'yes');
    }
  } catch(e) {}
  try {
    var appCache = window.applicationCache;
    if (appCache) {
      appCache.onchecking = function(){ if (!allow) { try { appCache.abort(); } catch(e) {} } };
      appCache.ondownloading = function(){ if (allow) { var el = progressEl(); if (el) el.textContent = 'Page Caching Started!!'; } };
      appCache.onprogress = function(a){ if (allow) { var el = progressEl(); if (el && a && a.total) el.textContent = (Math.round(100*(a.loaded/a.total))) + '%'; } };
      appCache.oncached = function(){ if (allow) { var el = progressEl(); if (el) el.textContent = 'Host cached successfully.'; try { localStorage.cachedB = 'yes'; } catch(e) {} } };
      appCache.onupdateready = function(){ if (allow) { try { appCache.swapCache(); } catch(e) {} try { localStorage.cachedB = 'yes'; } catch(e) {} } };
      appCache.onnoupdate = function(){ if (allow) { try { localStorage.cachedB = 'yes'; } catch(e) {} } };
      appCache.onerror = function(){};
      if (allow) { try { appCache.update(); } catch(e) {} }
      if (!allow) { try { appCache.abort(); } catch(e) {} }
    }
  } catch(e) {}
  function ensurePocSoon() {
    if (window.__vortexPocFired) { return; }
    if (typeof window.poc === 'function') {
      try { setTimeout(window.poc, 50); } catch(e) {}
      return;
    }
    setTimeout(ensurePocSoon, 50);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensurePocSoon, false);
  } else {
    ensurePocSoon();
  }
})();

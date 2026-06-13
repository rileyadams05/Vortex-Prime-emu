var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// node_modules/@transloadit/prettier-bytes/dist/prettierBytes.js
var require_prettierBytes = __commonJS({
  "node_modules/@transloadit/prettier-bytes/dist/prettierBytes.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.prettierBytes = prettierBytes2;
    var units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    function prettierBytes2(input, unit) {
      if (typeof input !== "number" || Number.isNaN(input)) {
        throw new TypeError(`Expected a number, got ${typeof input}`);
      }
      const neg = input < 0;
      let num = Math.abs(input);
      if (neg) {
        num = -num;
      }
      if (num === 0) {
        return "0 B";
      }
      const exponent = unit ? units.indexOf(unit) : Math.min(Math.floor(Math.log(num) / Math.log(1024)), units.length - 1);
      const value = Number(num / 1024 ** exponent);
      const displayUnit = units[exponent];
      if (exponent >= 3) {
        return value % 1 === 0 ? `${Math.round(value)} ${displayUnit}` : `${value.toFixed(2)} ${displayUnit}`;
      }
      return `${value >= 10 || value % 1 === 0 ? Math.round(value) : value.toFixed(1)} ${displayUnit}`;
    }
  }
});

// node_modules/wildcard/index.js
var require_wildcard = __commonJS({
  "node_modules/wildcard/index.js"(exports, module) {
    "use strict";
    function WildcardMatcher(text, separator) {
      this.text = text = text || "";
      this.hasWild = ~text.indexOf("*");
      this.separator = separator;
      this.parts = text.split(separator);
    }
    WildcardMatcher.prototype.match = function(input) {
      var matches = true;
      var parts = this.parts;
      var ii;
      var partsCount = parts.length;
      var testParts;
      if (typeof input == "string" || input instanceof String) {
        if (!this.hasWild && this.text != input) {
          matches = false;
        } else {
          testParts = (input || "").split(this.separator);
          for (ii = 0; matches && ii < partsCount; ii++) {
            if (parts[ii] === "*") {
              continue;
            } else if (ii < testParts.length) {
              matches = parts[ii] === testParts[ii];
            } else {
              matches = false;
            }
          }
          matches = matches && testParts;
        }
      } else if (typeof input.splice == "function") {
        matches = [];
        for (ii = input.length; ii--; ) {
          if (this.match(input[ii])) {
            matches[matches.length] = input[ii];
          }
        }
      } else if (typeof input == "object") {
        matches = {};
        for (var key in input) {
          if (this.match(key)) {
            matches[key] = input[key];
          }
        }
      }
      return matches;
    };
    module.exports = function(text, test, separator) {
      var matcher = new WildcardMatcher(text, separator || /[\/\.]/);
      if (typeof test != "undefined") {
        return matcher.match(test);
      }
      return matcher;
    };
  }
});

// node_modules/mime-match/index.js
var require_mime_match = __commonJS({
  "node_modules/mime-match/index.js"(exports, module) {
    var wildcard = require_wildcard();
    var reMimePartSplit = /[\/\+\.]/;
    module.exports = function(target, pattern) {
      function test(pattern2) {
        var result = wildcard(pattern2, target, reMimePartSplit);
        return result && result.length >= 2;
      }
      return pattern ? test(pattern.split(";")[0]) : test;
    };
  }
});

// node_modules/lodash/isObject.js
var require_isObject = __commonJS({
  "node_modules/lodash/isObject.js"(exports, module) {
    function isObject(value) {
      var type = typeof value;
      return value != null && (type == "object" || type == "function");
    }
    module.exports = isObject;
  }
});

// node_modules/lodash/_freeGlobal.js
var require_freeGlobal = __commonJS({
  "node_modules/lodash/_freeGlobal.js"(exports, module) {
    var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
    module.exports = freeGlobal;
  }
});

// node_modules/lodash/_root.js
var require_root = __commonJS({
  "node_modules/lodash/_root.js"(exports, module) {
    var freeGlobal = require_freeGlobal();
    var freeSelf = typeof self == "object" && self && self.Object === Object && self;
    var root = freeGlobal || freeSelf || Function("return this")();
    module.exports = root;
  }
});

// node_modules/lodash/now.js
var require_now = __commonJS({
  "node_modules/lodash/now.js"(exports, module) {
    var root = require_root();
    var now = function() {
      return root.Date.now();
    };
    module.exports = now;
  }
});

// node_modules/lodash/_trimmedEndIndex.js
var require_trimmedEndIndex = __commonJS({
  "node_modules/lodash/_trimmedEndIndex.js"(exports, module) {
    var reWhitespace = /\s/;
    function trimmedEndIndex(string) {
      var index = string.length;
      while (index-- && reWhitespace.test(string.charAt(index))) {
      }
      return index;
    }
    module.exports = trimmedEndIndex;
  }
});

// node_modules/lodash/_baseTrim.js
var require_baseTrim = __commonJS({
  "node_modules/lodash/_baseTrim.js"(exports, module) {
    var trimmedEndIndex = require_trimmedEndIndex();
    var reTrimStart = /^\s+/;
    function baseTrim(string) {
      return string ? string.slice(0, trimmedEndIndex(string) + 1).replace(reTrimStart, "") : string;
    }
    module.exports = baseTrim;
  }
});

// node_modules/lodash/_Symbol.js
var require_Symbol = __commonJS({
  "node_modules/lodash/_Symbol.js"(exports, module) {
    var root = require_root();
    var Symbol2 = root.Symbol;
    module.exports = Symbol2;
  }
});

// node_modules/lodash/_getRawTag.js
var require_getRawTag = __commonJS({
  "node_modules/lodash/_getRawTag.js"(exports, module) {
    var Symbol2 = require_Symbol();
    var objectProto = Object.prototype;
    var hasOwnProperty = objectProto.hasOwnProperty;
    var nativeObjectToString = objectProto.toString;
    var symToStringTag = Symbol2 ? Symbol2.toStringTag : void 0;
    function getRawTag(value) {
      var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
      try {
        value[symToStringTag] = void 0;
        var unmasked = true;
      } catch (e) {
      }
      var result = nativeObjectToString.call(value);
      if (unmasked) {
        if (isOwn) {
          value[symToStringTag] = tag;
        } else {
          delete value[symToStringTag];
        }
      }
      return result;
    }
    module.exports = getRawTag;
  }
});

// node_modules/lodash/_objectToString.js
var require_objectToString = __commonJS({
  "node_modules/lodash/_objectToString.js"(exports, module) {
    var objectProto = Object.prototype;
    var nativeObjectToString = objectProto.toString;
    function objectToString(value) {
      return nativeObjectToString.call(value);
    }
    module.exports = objectToString;
  }
});

// node_modules/lodash/_baseGetTag.js
var require_baseGetTag = __commonJS({
  "node_modules/lodash/_baseGetTag.js"(exports, module) {
    var Symbol2 = require_Symbol();
    var getRawTag = require_getRawTag();
    var objectToString = require_objectToString();
    var nullTag = "[object Null]";
    var undefinedTag = "[object Undefined]";
    var symToStringTag = Symbol2 ? Symbol2.toStringTag : void 0;
    function baseGetTag(value) {
      if (value == null) {
        return value === void 0 ? undefinedTag : nullTag;
      }
      return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
    }
    module.exports = baseGetTag;
  }
});

// node_modules/lodash/isObjectLike.js
var require_isObjectLike = __commonJS({
  "node_modules/lodash/isObjectLike.js"(exports, module) {
    function isObjectLike(value) {
      return value != null && typeof value == "object";
    }
    module.exports = isObjectLike;
  }
});

// node_modules/lodash/isSymbol.js
var require_isSymbol = __commonJS({
  "node_modules/lodash/isSymbol.js"(exports, module) {
    var baseGetTag = require_baseGetTag();
    var isObjectLike = require_isObjectLike();
    var symbolTag = "[object Symbol]";
    function isSymbol(value) {
      return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
    }
    module.exports = isSymbol;
  }
});

// node_modules/lodash/toNumber.js
var require_toNumber = __commonJS({
  "node_modules/lodash/toNumber.js"(exports, module) {
    var baseTrim = require_baseTrim();
    var isObject = require_isObject();
    var isSymbol = require_isSymbol();
    var NAN = 0 / 0;
    var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
    var reIsBinary = /^0b[01]+$/i;
    var reIsOctal = /^0o[0-7]+$/i;
    var freeParseInt = parseInt;
    function toNumber(value) {
      if (typeof value == "number") {
        return value;
      }
      if (isSymbol(value)) {
        return NAN;
      }
      if (isObject(value)) {
        var other = typeof value.valueOf == "function" ? value.valueOf() : value;
        value = isObject(other) ? other + "" : other;
      }
      if (typeof value != "string") {
        return value === 0 ? value : +value;
      }
      value = baseTrim(value);
      var isBinary = reIsBinary.test(value);
      return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
    }
    module.exports = toNumber;
  }
});

// node_modules/lodash/debounce.js
var require_debounce = __commonJS({
  "node_modules/lodash/debounce.js"(exports, module) {
    var isObject = require_isObject();
    var now = require_now();
    var toNumber = require_toNumber();
    var FUNC_ERROR_TEXT = "Expected a function";
    var nativeMax = Math.max;
    var nativeMin = Math.min;
    function debounce(func, wait, options) {
      var lastArgs, lastThis, maxWait, result, timerId, lastCallTime, lastInvokeTime = 0, leading = false, maxing = false, trailing = true;
      if (typeof func != "function") {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      wait = toNumber(wait) || 0;
      if (isObject(options)) {
        leading = !!options.leading;
        maxing = "maxWait" in options;
        maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
        trailing = "trailing" in options ? !!options.trailing : trailing;
      }
      function invokeFunc(time) {
        var args = lastArgs, thisArg = lastThis;
        lastArgs = lastThis = void 0;
        lastInvokeTime = time;
        result = func.apply(thisArg, args);
        return result;
      }
      function leadingEdge(time) {
        lastInvokeTime = time;
        timerId = setTimeout(timerExpired, wait);
        return leading ? invokeFunc(time) : result;
      }
      function remainingWait(time) {
        var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime, timeWaiting = wait - timeSinceLastCall;
        return maxing ? nativeMin(timeWaiting, maxWait - timeSinceLastInvoke) : timeWaiting;
      }
      function shouldInvoke(time) {
        var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime;
        return lastCallTime === void 0 || timeSinceLastCall >= wait || timeSinceLastCall < 0 || maxing && timeSinceLastInvoke >= maxWait;
      }
      function timerExpired() {
        var time = now();
        if (shouldInvoke(time)) {
          return trailingEdge(time);
        }
        timerId = setTimeout(timerExpired, remainingWait(time));
      }
      function trailingEdge(time) {
        timerId = void 0;
        if (trailing && lastArgs) {
          return invokeFunc(time);
        }
        lastArgs = lastThis = void 0;
        return result;
      }
      function cancel() {
        if (timerId !== void 0) {
          clearTimeout(timerId);
        }
        lastInvokeTime = 0;
        lastArgs = lastCallTime = lastThis = timerId = void 0;
      }
      function flush() {
        return timerId === void 0 ? result : trailingEdge(now());
      }
      function debounced() {
        var time = now(), isInvoking = shouldInvoke(time);
        lastArgs = arguments;
        lastThis = this;
        lastCallTime = time;
        if (isInvoking) {
          if (timerId === void 0) {
            return leadingEdge(lastCallTime);
          }
          if (maxing) {
            clearTimeout(timerId);
            timerId = setTimeout(timerExpired, wait);
            return invokeFunc(lastCallTime);
          }
        }
        if (timerId === void 0) {
          timerId = setTimeout(timerExpired, wait);
        }
        return result;
      }
      debounced.cancel = cancel;
      debounced.flush = flush;
      return debounced;
    }
    module.exports = debounce;
  }
});

// node_modules/lodash/throttle.js
var require_throttle = __commonJS({
  "node_modules/lodash/throttle.js"(exports, module) {
    var debounce = require_debounce();
    var isObject = require_isObject();
    var FUNC_ERROR_TEXT = "Expected a function";
    function throttle2(func, wait, options) {
      var leading = true, trailing = true;
      if (typeof func != "function") {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      if (isObject(options)) {
        leading = "leading" in options ? !!options.leading : leading;
        trailing = "trailing" in options ? !!options.trailing : trailing;
      }
      return debounce(func, wait, {
        "leading": leading,
        "maxWait": wait,
        "trailing": trailing
      });
    }
    module.exports = throttle2;
  }
});

// node_modules/namespace-emitter/index.js
var require_namespace_emitter = __commonJS({
  "node_modules/namespace-emitter/index.js"(exports, module) {
    module.exports = function createNamespaceEmitter() {
      var emitter = {};
      var _fns = emitter._fns = {};
      emitter.emit = function emit(event, arg1, arg2, arg3, arg4, arg5, arg6) {
        var toEmit = getListeners(event);
        if (toEmit.length) {
          emitAll(event, toEmit, [arg1, arg2, arg3, arg4, arg5, arg6]);
        }
      };
      emitter.on = function on(event, fn) {
        if (!_fns[event]) {
          _fns[event] = [];
        }
        _fns[event].push(fn);
      };
      emitter.once = function once(event, fn) {
        function one() {
          fn.apply(this, arguments);
          emitter.off(event, one);
        }
        this.on(event, one);
      };
      emitter.off = function off(event, fn) {
        var keep = [];
        if (event && fn) {
          var fns = this._fns[event];
          var i = 0;
          var l = fns ? fns.length : 0;
          for (i; i < l; i++) {
            if (fns[i] !== fn) {
              keep.push(fns[i]);
            }
          }
        }
        keep.length ? this._fns[event] = keep : delete this._fns[event];
      };
      function getListeners(e) {
        var out = _fns[e] ? _fns[e] : [];
        var idx = e.indexOf(":");
        var args = idx === -1 ? [e] : [e.substring(0, idx), e.substring(idx + 1)];
        var keys = Object.keys(_fns);
        var i = 0;
        var l = keys.length;
        for (i; i < l; i++) {
          var key = keys[i];
          if (key === "*") {
            out = out.concat(_fns[key]);
          }
          if (args.length === 2 && args[0] === key) {
            out = out.concat(_fns[key]);
            break;
          }
        }
        return out;
      }
      function emitAll(e, fns, args) {
        var i = 0;
        var l = fns.length;
        for (i; i < l; i++) {
          if (!fns[i]) break;
          fns[i].event = e;
          fns[i].apply(fns[i], args);
        }
      }
      return emitter;
    };
  }
});

// src/backend/config.js
var DEFAULT_LOCAL_PORT = 4100;
var PRODUCTION_BASE_URL = "https://vortex-prime-emu.com";
function readGlobal(name) {
  if (typeof globalThis !== "undefined" && globalThis[name]) {
    return String(globalThis[name]);
  }
  return null;
}
function readMeta(name) {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(`meta[name="${name}"]`);
  return (el == null ? void 0 : el.content) ? el.content.trim() : null;
}
function readEnv(name) {
  if (typeof process !== "undefined" && process.env && process.env[name]) {
    return String(process.env[name]);
  }
  return null;
}
function readStored() {
  var _a;
  try {
    if (typeof window === "undefined") return null;
    return ((_a = window.localStorage) == null ? void 0 : _a.getItem("vortex-companion-base-url")) || null;
  } catch (error) {
    return null;
  }
}
function resolveDefaultBase() {
  if (typeof window === "undefined" || !(window == null ? void 0 : window.location)) {
    return PRODUCTION_BASE_URL;
  }
  const { protocol, hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${hostname}:${DEFAULT_LOCAL_PORT}`;
  }
  return PRODUCTION_BASE_URL;
}
function getCompanionBaseUrl() {
  const fromGlobal = readGlobal("__VORTEX_COMPANION_BASE_URL__");
  const fromMeta = readMeta("vortex-companion-base-url");
  const fromEnv = readEnv("VORTEX_COMPANION_BASE_URL");
  const fromStored = readStored();
  const value = fromGlobal || fromMeta || fromStored || fromEnv;
  if (value) {
    return value.replace(/\/$/, "");
  }
  return resolveDefaultBase();
}
function buildApiUrl(path) {
  const base = getCompanionBaseUrl();
  if (!path.startsWith("/")) {
    return `${base}/${path}`;
  }
  return `${base}${path}`;
}
async function fetchJson(path, options = {}) {
  const url = buildApiUrl(path);
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers || {}
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (error2) {
      payload = null;
    }
    const message = (payload == null ? void 0 : payload.message) || (payload == null ? void 0 : payload.error) || text || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.url = url;
    if (payload) error.payload = payload;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

// src/admin/upload-adapter.js
var NOT_CONFIGURED_MESSAGE = "Upload backend is not configured yet.";
var backendStatus = {
  configured: false,
  googleAuthorized: false,
  message: NOT_CONFIGURED_MESSAGE
};
var statusPromise = null;
function makeNotConfiguredError(action = "perform this operation") {
  const error = new Error(`${backendStatus.message || NOT_CONFIGURED_MESSAGE} Unable to ${action}.`);
  error.code = "BACKEND_NOT_CONFIGURED";
  return error;
}
function normalizeMode(mode) {
  return mode === "mods" ? "mods" : "store";
}
function isBlob(file) {
  return typeof File !== "undefined" && file instanceof File ? true : typeof Blob !== "undefined" && file instanceof Blob;
}
async function refreshBackendStatus(force = false) {
  if (statusPromise && !force) {
    return statusPromise;
  }
  statusPromise = (async () => {
    try {
      const status = await fetchJson("/api/status");
      backendStatus = {
        configured: Boolean(status == null ? void 0 : status.configured),
        googleAuthorized: Boolean(status == null ? void 0 : status.googleAuthorized),
        message: (status == null ? void 0 : status.message) || ((status == null ? void 0 : status.configured) ? "Upload backend ready." : NOT_CONFIGURED_MESSAGE),
        folders: (status == null ? void 0 : status.folders) || null,
        storeDbFileId: status == null ? void 0 : status.storeDbFileId
      };
    } catch (error) {
      backendStatus = {
        configured: false,
        googleAuthorized: false,
        message: (error == null ? void 0 : error.message) || NOT_CONFIGURED_MESSAGE,
        error
      };
    }
    return backendStatus;
  })();
  try {
    return await statusPromise;
  } finally {
    statusPromise = null;
  }
}
async function ensureBackendConfigured() {
  if (!backendStatus.configured) {
    await refreshBackendStatus();
  }
  if (!backendStatus.configured) {
    throw makeNotConfiguredError();
  }
}
function safeParseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}
function safeReadResponseText(xhr) {
  try {
    return xhr.responseText;
  } catch (error) {
    return null;
  }
}
function uploadFileWithProgress(url, file, { metadata, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.withCredentials = true;
    xhr.responseType = "json";
    if (typeof onProgress === "function") {
      xhr.upload.onprogress = (event) => {
        try {
          const total = event.total || (file == null ? void 0 : file.size) || 0;
          const loaded = event.loaded || 0;
          const progress = total > 0 ? Math.round(loaded / total * 100) : 0;
          onProgress({ loaded, total, progress });
        } catch (err) {
          console.warn("Upload progress handler failed", err);
        }
      };
    }
    xhr.onerror = () => {
      reject(new Error("Upload failed due to a network error."));
    };
    xhr.onload = () => {
      var _a, _b, _c, _d;
      let body = null;
      if (xhr.responseType === "json") {
        body = (_a = xhr.response) != null ? _a : null;
      } else if (!xhr.responseType || xhr.responseType === "text") {
        body = (_b = safeParseJson(xhr.responseText)) != null ? _b : xhr.responseText;
      } else {
        const fallbackText = safeReadResponseText(xhr);
        body = (_d = (_c = xhr.response) != null ? _c : safeParseJson(fallbackText)) != null ? _d : fallbackText;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
      } else {
        const fallbackText = typeof body === "string" ? body : safeReadResponseText(xhr);
        const message = (body == null ? void 0 : body.error) || (body == null ? void 0 : body.message) || fallbackText || (xhr.status === 401 ? "Sign in with Google to upload." : `Upload failed with status ${xhr.status}.`);
        const error = new Error(message);
        error.status = xhr.status;
        error.payload = body;
        if (!error.payload && fallbackText) {
          error.payload = safeParseJson(fallbackText) || { raw: fallbackText };
        }
        reject(error);
      }
    };
    const formData = new FormData();
    const fileName = (file == null ? void 0 : file.name) || "upload.bin";
    formData.append("file", file, fileName);
    if (metadata && Object.keys(metadata).length) {
      formData.append("metadata", JSON.stringify(metadata));
    }
    xhr.send(formData);
  });
}
async function uploadBinary(type, file, { metadata = {}, replaceFileId, makePublic = true, onProgress } = {}) {
  await ensureBackendConfigured();
  if (!file) {
    throw new Error("No file provided for upload.");
  }
  if (!isBlob(file)) {
    throw new Error("Uploads require a File or Blob object.");
  }
  const bodyMetadata = { ...metadata };
  if (makePublic === false) bodyMetadata.makePublic = false;
  if (replaceFileId) bodyMetadata.replaceFileId = replaceFileId;
  const url = buildApiUrl(`/api/uploads/${type}`);
  try {
    return await uploadFileWithProgress(url, file, { metadata: bodyMetadata, onProgress });
  } catch (error) {
    await refreshBackendStatus(true).catch(() => {
    });
    if (error && typeof error === "object") {
      if (error.status === 401) {
        error.message = "Sign in with Google to upload.";
      } else if (error.status === 403 && (String(error.message).includes("storageQuotaExceeded") || String(error.message).toLowerCase().includes("storage quota"))) {
        error.message = "Google Drive upload failed because the backend is using a service account with no storage quota. Configure Drive OAuth refresh-token storage.";
      }
    }
    throw error;
  }
}
function cloneItem(pkg) {
  const clone = {
    ...pkg,
    tags: Array.isArray(pkg == null ? void 0 : pkg.tags) ? [...pkg.tags] : [],
    youtubeVideos: Array.isArray(pkg == null ? void 0 : pkg.youtubeVideos) ? [...pkg.youtubeVideos] : [],
    media: Array.isArray(pkg == null ? void 0 : pkg.media) ? [...pkg.media] : [],
    installInstructions: {
      ...(pkg == null ? void 0 : pkg.installInstructions) || {}
    },
    consoleInstall: {
      ...(pkg == null ? void 0 : pkg.consoleInstall) || {}
    }
  };
  if ((pkg == null ? void 0 : pkg.readme) && typeof pkg.readme === "object") {
    clone.readme = { ...pkg.readme };
  }
  clone.driveFiles = { ...(pkg == null ? void 0 : pkg.driveFiles) || {} };
  return clone;
}
async function saveStoreItem(mode, pkg, _currentUser) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
  if (!pkg || typeof pkg !== "object") {
    throw new Error("Item payload is required.");
  }
  await ensureBackendConfigured();
  const normalizedMode = normalizeMode(mode);
  const item = cloneItem(pkg);
  const driveFiles = item.driveFiles;
  if (pkg.zip_file_file && isBlob(pkg.zip_file_file)) {
    const uploadType = normalizedMode === "mods" ? "mod" : "package";
    const info = await uploadBinary(uploadType, pkg.zip_file_file, {
      replaceFileId: (_a = driveFiles.package) == null ? void 0 : _a.id,
      makePublic: true
    });
    driveFiles.package = info;
    item.zip_file = info.name;
    item.download_url = info.downloadUrl;
    item.download = {
      enabled: true,
      url: info.downloadUrl,
      type: item.fileType || (normalizedMode === "mods" ? "archive" : "pkg")
    };
  } else {
    if (!item.zip_file && ((_b = driveFiles.package) == null ? void 0 : _b.name)) {
      item.zip_file = driveFiles.package.name;
    }
    if (!item.download_url && ((_c = driveFiles.package) == null ? void 0 : _c.downloadUrl)) {
      item.download_url = driveFiles.package.downloadUrl;
    }
  }
  delete item.zip_file_file;
  if (pkg.icon_file && isBlob(pkg.icon_file)) {
    const info = await uploadBinary("image", pkg.icon_file, {
      replaceFileId: (_d = driveFiles.icon) == null ? void 0 : _d.id,
      makePublic: true
    });
    driveFiles.icon = info;
    item.icon = info.downloadUrl;
  } else if ((_e = driveFiles.icon) == null ? void 0 : _e.downloadUrl) {
    item.icon = item.icon || driveFiles.icon.downloadUrl;
  }
  delete item.icon_file;
  if (pkg.preview_file && isBlob(pkg.preview_file)) {
    const info = await uploadBinary("preview", pkg.preview_file, {
      replaceFileId: (_f = driveFiles.preview) == null ? void 0 : _f.id,
      makePublic: true
    });
    driveFiles.preview = info;
    item.preview = info.downloadUrl;
  } else if ((_g = driveFiles.preview) == null ? void 0 : _g.downloadUrl) {
    item.preview = item.preview || driveFiles.preview.downloadUrl;
  }
  delete item.preview_file;
  if (pkg.readme_file_file && isBlob(pkg.readme_file_file)) {
    const info = await uploadBinary("readme", pkg.readme_file_file, {
      replaceFileId: (_h = driveFiles.readme) == null ? void 0 : _h.id,
      makePublic: true
    });
    driveFiles.readme = info;
    const existing = item.readme && typeof item.readme === "object" ? { ...item.readme } : {};
    item.readme = {
      ...existing,
      filename: info.name,
      downloadUrl: info.downloadUrl,
      driveFile: info,
      content: (_k = (_j = existing.content) != null ? _j : (_i = pkg.readme) == null ? void 0 : _i.content) != null ? _k : ""
    };
    if (!item.readme.format) {
      item.readme.format = ((_l = info.name) == null ? void 0 : _l.toLowerCase().endsWith(".txt")) ? "text" : "markdown";
    }
  } else if (item.readme && ((_m = driveFiles.readme) == null ? void 0 : _m.downloadUrl)) {
    item.readme = {
      ...item.readme,
      filename: item.readme.filename || driveFiles.readme.name,
      downloadUrl: driveFiles.readme.downloadUrl,
      driveFile: driveFiles.readme
    };
  }
  delete item.readme_file_file;
  item.driveFiles = driveFiles;
  const payload = JSON.parse(JSON.stringify(item));
  const saved = await fetchJson(`/api/catalogue/${normalizedMode}`, {
    method: "POST",
    body: JSON.stringify({ item: payload })
  });
  const mergedDriveFiles = {
    ...driveFiles,
    ...(saved == null ? void 0 : saved.driveFiles) || {}
  };
  return {
    ...item,
    ...saved,
    driveFiles: mergedDriveFiles
  };
}
async function deleteStoreItem(mode, item) {
  await ensureBackendConfigured();
  const id = (item == null ? void 0 : item.id) || item;
  if (!id) {
    throw new Error("An item id is required to delete an entry.");
  }
  await fetchJson(`/api/catalogue/${normalizeMode(mode)}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}
async function loadCatalogue(mode) {
  await ensureBackendConfigured();
  let list;
  try {
    list = await fetchJson(`/api/catalogue/${normalizeMode(mode)}`);
  } catch (error) {
    const status = await refreshBackendStatus(true).catch(() => null);
    if ((status == null ? void 0 : status.message) && error && typeof error === "object") {
      error.message = status.message;
    }
    throw error;
  }
  if (!Array.isArray(list)) return [];
  return list.map((entry) => ({
    ...entry,
    driveFiles: entry.driveFiles || {}
  }));
}
async function loadStoreItems() {
  return loadCatalogue("store");
}
async function loadStoreMods() {
  return loadCatalogue("mods");
}
function getBackendStatus() {
  return { ...backendStatus };
}
function uploadPackage(file, metadata = {}, { onProgress } = {}) {
  return uploadBinary("package", file, {
    replaceFileId: metadata == null ? void 0 : metadata.replaceFileId,
    makePublic: (metadata == null ? void 0 : metadata.makePublic) !== false,
    onProgress
  });
}
function uploadMod(file, metadata = {}, { onProgress } = {}) {
  return uploadBinary("mod", file, {
    replaceFileId: metadata == null ? void 0 : metadata.replaceFileId,
    makePublic: (metadata == null ? void 0 : metadata.makePublic) !== false,
    onProgress
  });
}
function uploadImage(file, metadata = {}, { onProgress } = {}) {
  const type = (metadata == null ? void 0 : metadata.variant) === "preview" ? "preview" : "image";
  return uploadBinary(type, file, {
    replaceFileId: metadata == null ? void 0 : metadata.replaceFileId,
    makePublic: (metadata == null ? void 0 : metadata.makePublic) !== false,
    onProgress
  });
}
function uploadReadme(file, metadata = {}, { onProgress } = {}) {
  return uploadBinary("readme", file, {
    replaceFileId: metadata == null ? void 0 : metadata.replaceFileId,
    makePublic: (metadata == null ? void 0 : metadata.makePublic) !== false,
    onProgress
  });
}

// src/admin/portal.js
var NOT_CONFIGURED_MESSAGE2 = "Upload backend is not configured yet.";
var readyCallbacks = /* @__PURE__ */ new Set();
var authCallbacks = /* @__PURE__ */ new Set();
var readyResolved = false;
var initialisePromise = null;
var authStatePromise = null;
var authState = {
  user: null,
  isAdmin: false,
  status: "initialising",
  message: "Checking backend and authentication\u2026",
  googleClientId: null
};
function invokeSafely(callback, payload) {
  if (typeof callback !== "function") return;
  try {
    callback(payload);
  } catch (error) {
    console.error("Admin backend callback failed", error);
  }
}
function buildAuthState() {
  const status = getBackendStatus();
  const configured = Boolean(status == null ? void 0 : status.configured);
  if (!configured) {
    return {
      ...authState,
      user: null,
      isAdmin: false,
      status: "backend_not_configured",
      message: (status == null ? void 0 : status.message) || NOT_CONFIGURED_MESSAGE2
    };
  }
  return {
    ...authState,
    status: authState.user ? "ready" : "requires_auth",
    message: authState.message || (authState.user ? "Upload backend ready." : "Sign in with Google to continue.")
  };
}
function notifyReady() {
  readyResolved = true;
  readyCallbacks.forEach((callback) => {
    queueMicrotask(() => invokeSafely(callback, AdminBackend));
  });
  readyCallbacks.clear();
}
function notifyAuth() {
  const payload = buildAuthState();
  authCallbacks.forEach((callback) => {
    queueMicrotask(() => invokeSafely(callback, payload));
  });
}
async function initialise(force = false) {
  if (initialisePromise && !force) {
    return initialisePromise;
  }
  initialisePromise = (async () => {
    await refreshBackendStatus(force);
    await refreshAuthState(force);
    const status = getBackendStatus();
    AdminBackend.isConfigured = Boolean(status.configured);
    const authInfo = buildAuthState();
    AdminBackend.status = authInfo.status;
    AdminBackend.message = authInfo.message;
    notifyAuth();
    notifyReady();
    return AdminBackend;
  })().finally(() => {
    initialisePromise = null;
  });
  return initialisePromise;
}
var AdminBackend = {
  isConfigured: false,
  status: "initialising",
  message: "Checking backend status\u2026",
  googleClientId: null,
  async refresh() {
    return initialise(true);
  },
  onReady(callback) {
    if (typeof callback !== "function") return;
    if (readyResolved) {
      queueMicrotask(() => invokeSafely(callback, AdminBackend));
      return;
    }
    readyCallbacks.add(callback);
    initialise().catch((error) => {
      console.error("Admin backend initialisation failed", error);
    });
  },
  onAuthChanged(callback) {
    if (typeof callback !== "function") return () => {
    };
    authCallbacks.add(callback);
    queueMicrotask(() => invokeSafely(callback, buildAuthState()));
    initialise().catch((error) => {
      console.error("Admin backend initialisation failed", error);
    });
    return () => authCallbacks.delete(callback);
  },
  getGoogleClientId() {
    return authState.googleClientId;
  },
  getAuthState() {
    return { ...buildAuthState() };
  },
  async loginWithCredential(credential) {
    if (!credential) {
      throw new Error("Google credential is required.");
    }
    const response = await fetch(buildApiUrl("/api/auth/login"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ credential })
    });
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText || "Login failed");
      throw new Error(text || "Google sign-in failed.");
    }
    await refreshAuthState(true);
    notifyAuth();
    return buildAuthState();
  },
  async logout() {
    await fetch(buildApiUrl("/api/auth/logout"), {
      method: "POST",
      credentials: "include"
    }).catch(() => {
    });
    await refreshAuthState(true);
    notifyAuth();
  },
  async signInWithGoogle() {
    throw new Error("Google sign-in is handled by the page script.");
  },
  async signOut() {
    await AdminBackend.logout();
  },
  async fetchItems(mode) {
    await initialise();
    await ensureBackendConfigured();
    if (!authState.user) {
      throw new Error("Sign in with Google to view catalogue items.");
    }
    if (!authState.isAdmin) {
      throw new Error("Admin access required to manage catalogue entries.");
    }
    return mode === "mods" ? loadStoreMods() : loadStoreItems();
  },
  async saveItem(mode, item, currentUser) {
    await initialise();
    await ensureBackendConfigured();
    if (!authState.user) {
      throw new Error("Sign in with Google to upload content.");
    }
    if (!authState.isAdmin) {
      throw new Error("Admin privileges required to update catalogue entries.");
    }
    const saved = await saveStoreItem(mode, item, currentUser);
    await refreshBackendStatus().catch(() => {
    });
    AdminBackend.isConfigured = true;
    AdminBackend.status = "ready";
    notifyAuth();
    return saved;
  },
  async deleteItem(mode, item) {
    await initialise();
    await ensureBackendConfigured();
    if (!authState.user) {
      throw new Error("Sign in with Google to manage catalogue content.");
    }
    if (!authState.isAdmin) {
      throw new Error("Admin privileges required to delete catalogue entries.");
    }
    await deleteStoreItem(mode, item);
  },
  isAdminEmail(email) {
    var _a;
    if (!email) return false;
    return Boolean((authState == null ? void 0 : authState.isAdmin) && ((_a = authState.user) == null ? void 0 : _a.email) === email);
  },
  getStatus() {
    return getBackendStatus();
  }
};
if (typeof window !== "undefined") {
  window.AdminBackend = AdminBackend;
}
async function refreshAuthState(force = false) {
  if (authStatePromise && !force) {
    return authStatePromise;
  }
  authStatePromise = (async () => {
    try {
      const data = await fetchJson("/api/auth/config", { credentials: "include" });
      const user = (data == null ? void 0 : data.user) || null;
      authState = {
        user,
        isAdmin: Boolean((user == null ? void 0 : user.role) === "admin"),
        status: user ? "ready" : "requires_auth",
        message: user ? "Signed in with Google." : "Google sign-in required to upload.",
        googleClientId: (data == null ? void 0 : data.googleClientId) || null
      };
      AdminBackend.googleClientId = authState.googleClientId;
    } catch (error) {
      console.warn("Failed to refresh auth state", error);
      authState = {
        user: null,
        isAdmin: false,
        status: "auth_error",
        message: (error == null ? void 0 : error.message) || "Unable to check Google sign-in status.",
        googleClientId: authState.googleClientId || null
      };
    }
    return authState;
  })().finally(() => {
    authStatePromise = null;
  });
  return authStatePromise;
}
initialise().catch((error) => {
  console.error("Failed to initialise admin backend", error);
});
var portal_default = AdminBackend;

// uppy--uppy-companion-6.2.2/packages/@uppy/utils/src/getFileNameAndExtension.ts
function getFileNameAndExtension(fullFileName) {
  const lastDot = fullFileName.lastIndexOf(".");
  if (lastDot === -1 || lastDot === fullFileName.length - 1) {
    return {
      name: fullFileName,
      extension: void 0
    };
  }
  return {
    name: fullFileName.slice(0, lastDot),
    extension: fullFileName.slice(lastDot + 1)
  };
}

// uppy--uppy-companion-6.2.2/packages/@uppy/utils/src/mimeTypes.ts
var mimeTypes_default = {
  __proto__: null,
  md: "text/markdown",
  markdown: "text/markdown",
  mp4: "video/mp4",
  mp3: "audio/mp3",
  svg: "image/svg+xml",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  yaml: "text/yaml",
  yml: "text/yaml",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  tab: "text/tab-separated-values",
  avi: "video/x-msvideo",
  mks: "video/x-matroska",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  dicom: "application/dicom",
  doc: "application/msword",
  msg: "application/vnd.ms-outlook",
  docm: "application/vnd.ms-word.document.macroenabled.12",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  dot: "application/msword",
  dotm: "application/vnd.ms-word.template.macroenabled.12",
  dotx: "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  xla: "application/vnd.ms-excel",
  xlam: "application/vnd.ms-excel.addin.macroenabled.12",
  xlc: "application/vnd.ms-excel",
  xlf: "application/x-xliff+xml",
  xlm: "application/vnd.ms-excel",
  xls: "application/vnd.ms-excel",
  xlsb: "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  xlsm: "application/vnd.ms-excel.sheet.macroenabled.12",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlt: "application/vnd.ms-excel",
  xltm: "application/vnd.ms-excel.template.macroenabled.12",
  xltx: "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
  xlw: "application/vnd.ms-excel",
  txt: "text/plain",
  text: "text/plain",
  conf: "text/plain",
  log: "text/plain",
  pdf: "application/pdf",
  zip: "application/zip",
  "7z": "application/x-7z-compressed",
  rar: "application/x-rar-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
  dmg: "application/x-apple-diskimage"
};

// uppy--uppy-companion-6.2.2/packages/@uppy/utils/src/getFileType.ts
function getFileType(file) {
  var _a;
  if (file.type) return file.type;
  const fileExtension = file.name ? (_a = getFileNameAndExtension(file.name).extension) == null ? void 0 : _a.toLowerCase() : null;
  if (fileExtension && fileExtension in mimeTypes_default) {
    return mimeTypes_default[fileExtension];
  }
  return "application/octet-stream";
}

// uppy--uppy-companion-6.2.2/packages/@uppy/utils/src/generateFileID.ts
function encodeCharacter(character) {
  return character.charCodeAt(0).toString(32);
}
function encodeFilename(name) {
  let suffix = "";
  return name.replace(/[^A-Z0-9]/gi, (character) => {
    suffix += `-${encodeCharacter(character)}`;
    return "/";
  }) + suffix;
}
function generateFileID(file, instanceId) {
  var _a;
  let id = instanceId || "uppy";
  if (typeof file.name === "string") {
    id += `-${encodeFilename(file.name.toLowerCase())}`;
  }
  if (file.type !== void 0) {
    id += `-${file.type}`;
  }
  if (file.meta && typeof file.meta.relativePath === "string") {
    id += `-${encodeFilename(file.meta.relativePath.toLowerCase())}`;
  }
  if (((_a = file.data) == null ? void 0 : _a.size) !== void 0) {
    id += `-${file.data.size}`;
  }
  if (file.data.lastModified !== void 0) {
    id += `-${file.data.lastModified}`;
  }
  return id;
}
function hasFileStableId(file) {
  if (!file.isRemote || !file.remote) return false;
  const stableIdProviders = /* @__PURE__ */ new Set([
    "box",
    "dropbox",
    "drive",
    "facebook",
    "unsplash"
  ]);
  return stableIdProviders.has(file.remote.provider);
}
function getSafeFileId(file, instanceId) {
  if (hasFileStableId(file)) return file.id;
  const fileType = getFileType(file);
  return generateFileID(
    {
      ...file,
      type: fileType
    },
    instanceId
  );
}

// uppy--uppy-companion-6.2.2/packages/@uppy/utils/src/toArray.ts
var toArray_default = Array.from;

// uppy--uppy-companion-6.2.2/packages/@uppy/utils/src/getDroppedFiles/utils/fallbackApi.ts
function fallbackApi(dataTransfer) {
  const files = toArray_default(dataTransfer.files);
  return Promise.resolve(files);
}

// uppy--uppy-companion-6.2.2/packages/@uppy/utils/src/getDroppedFiles/utils/webkitGetAsEntryApi/getFilesAndDirectoriesFromDirectory.ts
function getFilesAndDirectoriesFromDirectory(directoryReader, oldEntries, logDropError, { onSuccess }) {
  directoryReader.readEntries(
    (entries) => {
      const newEntries = [...oldEntries, ...entries];
      if (entries.length) {
        queueMicrotask(() => {
          getFilesAndDirectoriesFromDirectory(
            directoryReader,
            newEntries,
            logDropError,
            { onSuccess }
          );
        });
      } else {
        onSuccess(newEntries);
      }
    },
    // Make sure we resolve on error anyway, it's fine if only one directory couldn't be parsed!
    (error) => {
      logDropError(error);
      onSuccess(oldEntries);
    }
  );
}

// uppy--uppy-companion-6.2.2/packages/@uppy/utils/src/getDroppedFiles/utils/webkitGetAsEntryApi/index.ts
function getAsFileSystemHandleFromEntry(entry, logDropError) {
  if (entry == null) return entry;
  return {
    kind: entry.isFile ? "file" : entry.isDirectory ? "directory" : void 0,
    name: entry.name,
    getFile() {
      return new Promise(
        (resolve, reject) => entry.file(resolve, reject)
      );
    },
    async *values() {
      const directoryReader = entry.createReader();
      const entries = await new Promise((resolve) => {
        getFilesAndDirectoriesFromDirectory(directoryReader, [], logDropError, {
          onSuccess: (dirEntries) => resolve(
            dirEntries.map(
              (file) => getAsFileSystemHandleFromEntry(file, logDropError)
            )
          )
        });
      });
      yield* entries;
    },
    isSameEntry: void 0
  };
}
async function* createPromiseToAddFileOrParseDirectory(entry, relativePath, lastResortFile = void 0) {
  const getNextRelativePath = () => `${relativePath}/${entry.name}`;
  if (entry.kind === "file") {
    const file = await entry.getFile();
    if (file != null) {
      ;
      file.relativePath = relativePath ? getNextRelativePath() : null;
      yield file;
    } else if (lastResortFile != null) yield lastResortFile;
  } else if (entry.kind === "directory") {
    for await (const handle of entry.values()) {
      yield* createPromiseToAddFileOrParseDirectory(
        handle,
        relativePath ? getNextRelativePath() : entry.name
      );
    }
  } else if (lastResortFile != null) yield lastResortFile;
}
async function* getFilesFromDataTransfer(dataTransfer, logDropError) {
  const fileSystemHandles = await Promise.all(
    Array.from(dataTransfer.items, async (item) => {
      let fileSystemHandle;
      const getAsEntry = () => typeof item.getAsEntry === "function" ? item.getAsEntry() : item.webkitGetAsEntry();
      fileSystemHandle != null ? fileSystemHandle : fileSystemHandle = getAsFileSystemHandleFromEntry(
        getAsEntry(),
        logDropError
      );
      return {
        fileSystemHandle,
        lastResortFile: item.getAsFile()
        // can be used as a fallback in case other methods fail
      };
    })
  );
  for (const { lastResortFile, fileSystemHandle } of fileSystemHandles) {
    if (fileSystemHandle != null) {
      try {
        yield* createPromiseToAddFileOrParseDirectory(
          fileSystemHandle,
          "",
          lastResortFile
        );
      } catch (err) {
        if (lastResortFile != null) {
          yield lastResortFile;
        } else {
          logDropError(err);
        }
      }
    } else if (lastResortFile != null) yield lastResortFile;
  }
}

// uppy--uppy-companion-6.2.2/packages/@uppy/utils/src/getDroppedFiles/index.ts
async function getDroppedFiles(dataTransfer, options) {
  var _a;
  const logDropError = (_a = options == null ? void 0 : options.logDropError) != null ? _a : Function.prototype;
  try {
    const accumulator = [];
    for await (const file of getFilesFromDataTransfer(dataTransfer, logDropError)) {
      accumulator.push(file);
    }
    return accumulator;
  } catch {
    return fallbackApi(dataTransfer);
  }
}

// uppy--uppy-companion-6.2.2/packages/@uppy/utils/src/getTimeStamp.ts
function pad(number) {
  return number < 10 ? `0${number}` : number.toString();
}
function getTimeStamp() {
  const date = /* @__PURE__ */ new Date();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${hours}:${minutes}:${seconds}`;
}

// uppy--uppy-companion-6.2.2/packages/@uppy/utils/src/Translator.ts
function insertReplacement(source, rx, replacement) {
  const newParts = [];
  source.forEach((chunk) => {
    if (typeof chunk !== "string") {
      return newParts.push(chunk);
    }
    return rx[Symbol.split](chunk).forEach((raw, i, list) => {
      if (raw !== "") {
        newParts.push(raw);
      }
      if (i < list.length - 1) {
        newParts.push(replacement);
      }
    });
  });
  return newParts;
}
function interpolate(phrase, options) {
  const dollarRegex = /\$/g;
  const dollarBillsYall = "$$$$";
  let interpolated = [phrase];
  if (options == null) return interpolated;
  for (const arg of Object.keys(options)) {
    if (arg !== "_") {
      let replacement = options[arg];
      if (typeof replacement === "string") {
        replacement = dollarRegex[Symbol.replace](replacement, dollarBillsYall);
      }
      interpolated = insertReplacement(
        interpolated,
        new RegExp(`%\\{${arg}\\}`, "g"),
        replacement
      );
    }
  }
  return interpolated;
}
var defaultOnMissingKey = (key) => {
  throw new Error(`missing string: ${key}`);
};
var _onMissingKey, _Translator_instances, apply_fn;
var Translator = class {
  constructor(locales, { onMissingKey = defaultOnMissingKey } = {}) {
    __privateAdd(this, _Translator_instances);
    __publicField(this, "locale");
    __privateAdd(this, _onMissingKey);
    this.locale = {
      strings: {},
      pluralize(n) {
        if (n === 1) {
          return 0;
        }
        return 1;
      }
    };
    if (Array.isArray(locales)) {
      locales.forEach(__privateMethod(this, _Translator_instances, apply_fn), this);
    } else {
      __privateMethod(this, _Translator_instances, apply_fn).call(this, locales);
    }
    __privateSet(this, _onMissingKey, onMissingKey);
  }
  /**
   * Public translate method
   *
   * @param key
   * @param options with values that will be used later to replace placeholders in string
   * @returns string translated (and interpolated)
   */
  translate(key, options) {
    return this.translateArray(key, options).join("");
  }
  /**
   * Get a translation and return the translated and interpolated parts as an array.
   *
   * @returns The translated and interpolated parts, in order.
   */
  translateArray(key, options) {
    let string = this.locale.strings[key];
    if (string == null) {
      __privateGet(this, _onMissingKey).call(this, key);
      string = key;
    }
    const hasPluralForms = typeof string === "object";
    if (hasPluralForms) {
      if (options && typeof options.smart_count !== "undefined") {
        const plural = this.locale.pluralize(options.smart_count);
        return interpolate(string[plural], options);
      }
      throw new Error(
        "Attempted to use a string with plural forms, but no value was given for %{smart_count}"
      );
    }
    if (typeof string !== "string") {
      throw new Error(`string was not a string`);
    }
    return interpolate(string, options);
  }
};
_onMissingKey = new WeakMap();
_Translator_instances = new WeakSet();
apply_fn = function(locale) {
  if (!(locale == null ? void 0 : locale.strings)) {
    return;
  }
  const prevLocale = this.locale;
  Object.assign(this.locale, {
    strings: { ...prevLocale.strings, ...locale.strings },
    pluralize: locale.pluralize || prevLocale.pluralize
  });
};

// uppy--uppy-companion-6.2.2/packages/@uppy/core/src/BasePlugin.ts
var BasePlugin = class {
  constructor(uppy, opts) {
    __publicField(this, "uppy");
    __publicField(this, "opts");
    __publicField(this, "id");
    __publicField(this, "defaultLocale");
    __publicField(this, "i18n");
    __publicField(this, "i18nArray");
    __publicField(this, "type");
    __publicField(this, "VERSION");
    this.uppy = uppy;
    this.opts = opts != null ? opts : {};
  }
  getPluginState() {
    const { plugins } = this.uppy.getState();
    return (plugins == null ? void 0 : plugins[this.id]) || {};
  }
  setPluginState(update) {
    const { plugins } = this.uppy.getState();
    this.uppy.setState({
      plugins: {
        ...plugins,
        [this.id]: {
          ...plugins[this.id],
          ...update
        }
      }
    });
  }
  setOptions(newOpts) {
    this.opts = { ...this.opts, ...newOpts };
    this.setPluginState(void 0);
    this.i18nInit();
  }
  i18nInit() {
    const translator = new Translator([
      this.defaultLocale,
      this.uppy.locale,
      this.opts.locale
    ]);
    this.i18n = translator.translate.bind(translator);
    this.i18nArray = translator.translateArray.bind(translator);
    this.setPluginState(void 0);
  }
  /**
   * Extendable methods
   * ==================
   * These methods are here to serve as an overview of the extendable methods as well as
   * making them not conditional in use, such as `if (this.afterUpdate)`.
   */
  addTarget(plugin) {
    throw new Error(
      "Extend the addTarget method to add your plugin to another plugin's target"
    );
  }
  install() {
  }
  uninstall() {
  }
  update(state) {
  }
  // Called after every state update, after everything's mounted. Debounced.
  afterUpdate() {
  }
};

// uppy--uppy-companion-6.2.2/packages/@uppy/core/src/loggers.ts
var justErrorsLogger = {
  debug: () => {
  },
  warn: () => {
  },
  error: (...args) => console.error(`[Uppy] [${getTimeStamp()}]`, ...args)
};
var debugLogger = {
  debug: (...args) => console.debug(`[Uppy] [${getTimeStamp()}]`, ...args),
  warn: (...args) => console.warn(`[Uppy] [${getTimeStamp()}]`, ...args),
  error: (...args) => console.error(`[Uppy] [${getTimeStamp()}]`, ...args)
};

// uppy--uppy-companion-6.2.2/packages/@uppy/core/src/Restricter.ts
var import_prettier_bytes = __toESM(require_prettierBytes(), 1);
var import_mime_match = __toESM(require_mime_match(), 1);
var defaultOptions = {
  maxFileSize: null,
  minFileSize: null,
  maxTotalFileSize: null,
  maxNumberOfFiles: null,
  minNumberOfFiles: null,
  allowedFileTypes: null,
  requiredMetaFields: []
};
var RestrictionError = class extends Error {
  constructor(message, opts) {
    var _a;
    super(message);
    __publicField(this, "isUserFacing");
    __publicField(this, "file");
    __publicField(this, "isRestriction", true);
    this.isUserFacing = (_a = opts == null ? void 0 : opts.isUserFacing) != null ? _a : true;
    if (opts == null ? void 0 : opts.file) {
      this.file = opts.file;
    }
  }
};
var Restricter = class {
  constructor(getOpts, getI18n) {
    __publicField(this, "getI18n");
    __publicField(this, "getOpts");
    this.getI18n = getI18n;
    this.getOpts = () => {
      var _a;
      const opts = getOpts();
      if (((_a = opts.restrictions) == null ? void 0 : _a.allowedFileTypes) != null && !Array.isArray(opts.restrictions.allowedFileTypes)) {
        throw new TypeError("`restrictions.allowedFileTypes` must be an array");
      }
      return opts;
    };
  }
  // Because these operations are slow, we cannot run them for every file (if we are adding multiple files)
  validateAggregateRestrictions(existingFiles, addingFiles) {
    const { maxTotalFileSize, maxNumberOfFiles } = this.getOpts().restrictions;
    if (maxNumberOfFiles) {
      const nonGhostFiles = existingFiles.filter((f) => !f.isGhost);
      if (nonGhostFiles.length + addingFiles.length > maxNumberOfFiles) {
        throw new RestrictionError(
          `${this.getI18n()("youCanOnlyUploadX", {
            smart_count: maxNumberOfFiles
          })}`
        );
      }
    }
    if (maxTotalFileSize) {
      const totalFilesSize = [...existingFiles, ...addingFiles].reduce(
        (total, f) => {
          var _a;
          return total + ((_a = f.size) != null ? _a : 0);
        },
        0
      );
      if (totalFilesSize > maxTotalFileSize) {
        throw new RestrictionError(
          this.getI18n()("aggregateExceedsSize", {
            sizeAllowed: (0, import_prettier_bytes.default)(maxTotalFileSize),
            size: (0, import_prettier_bytes.default)(totalFilesSize)
          })
        );
      }
    }
  }
  validateSingleFile(file) {
    var _a;
    const { maxFileSize, minFileSize, allowedFileTypes } = this.getOpts().restrictions;
    if (allowedFileTypes) {
      const isCorrectFileType = allowedFileTypes.some((type) => {
        if (type.includes("/")) {
          if (!file.type) return false;
          return (0, import_mime_match.default)(file.type.replace(/;.*?$/, ""), type);
        }
        if (type[0] === "." && file.extension) {
          return file.extension.toLowerCase() === type.slice(1).toLowerCase();
        }
        return false;
      });
      if (!isCorrectFileType) {
        const allowedFileTypesString = allowedFileTypes.join(", ");
        throw new RestrictionError(
          this.getI18n()("youCanOnlyUploadFileTypes", {
            types: allowedFileTypesString
          }),
          { file }
        );
      }
    }
    if (maxFileSize && file.size != null && file.size > maxFileSize) {
      throw new RestrictionError(
        this.getI18n()("exceedsSize", {
          size: (0, import_prettier_bytes.default)(maxFileSize),
          file: (_a = file.name) != null ? _a : this.getI18n()("unnamed")
        }),
        { file }
      );
    }
    if (minFileSize && file.size != null && file.size < minFileSize) {
      throw new RestrictionError(
        this.getI18n()("inferiorSize", {
          size: (0, import_prettier_bytes.default)(minFileSize)
        }),
        { file }
      );
    }
  }
  validate(existingFiles, addingFiles) {
    addingFiles.forEach((addingFile) => {
      this.validateSingleFile(addingFile);
    });
    this.validateAggregateRestrictions(existingFiles, addingFiles);
  }
  validateMinNumberOfFiles(files) {
    const { minNumberOfFiles } = this.getOpts().restrictions;
    if (minNumberOfFiles && Object.keys(files).length < minNumberOfFiles) {
      throw new RestrictionError(
        this.getI18n()("youHaveToAtLeastSelectX", {
          smart_count: minNumberOfFiles
        })
      );
    }
  }
  getMissingRequiredMetaFields(file) {
    var _a;
    const error = new RestrictionError(
      this.getI18n()("missingRequiredMetaFieldOnFile", {
        fileName: (_a = file.name) != null ? _a : this.getI18n()("unnamed")
      })
    );
    const { requiredMetaFields } = this.getOpts().restrictions;
    const missingFields = [];
    for (const field of requiredMetaFields) {
      if (!Object.hasOwn(file.meta, field) || file.meta[field] === "") {
        missingFields.push(field);
      }
    }
    return { missingFields, error };
  }
};

// uppy--uppy-companion-6.2.2/packages/@uppy/store-default/package.json
var package_default = {
  name: "@uppy/store-default",
  description: "The default simple object-based store for Uppy.",
  version: "5.0.0",
  license: "MIT",
  main: "lib/index.js",
  type: "module",
  sideEffects: false,
  scripts: {
    build: "tsc --build tsconfig.build.json",
    typecheck: "tsc --build",
    test: "vitest run --environment=jsdom --silent='passed-only'"
  },
  keywords: [
    "file uploader",
    "uppy",
    "uppy-store"
  ],
  homepage: "https://uppy.io",
  bugs: {
    url: "https://github.com/transloadit/uppy/issues"
  },
  devDependencies: {
    jsdom: "^26.1.0",
    typescript: "^5.8.3",
    vitest: "^3.2.4"
  },
  repository: {
    type: "git",
    url: "git+https://github.com/transloadit/uppy.git"
  },
  exports: {
    ".": "./lib/index.js",
    "./package.json": "./package.json"
  },
  files: [
    "src",
    "lib",
    "dist",
    "CHANGELOG.md"
  ]
};

// uppy--uppy-companion-6.2.2/packages/@uppy/store-default/src/index.ts
var _callbacks, _DefaultStore_instances, publish_fn;
var DefaultStore = class {
  constructor() {
    __privateAdd(this, _DefaultStore_instances);
    __publicField(this, "state", {});
    __privateAdd(this, _callbacks, /* @__PURE__ */ new Set());
  }
  getState() {
    return this.state;
  }
  setState(patch) {
    const prevState = { ...this.state };
    const nextState = { ...this.state, ...patch };
    this.state = nextState;
    __privateMethod(this, _DefaultStore_instances, publish_fn).call(this, prevState, nextState, patch);
  }
  subscribe(listener) {
    __privateGet(this, _callbacks).add(listener);
    return () => {
      __privateGet(this, _callbacks).delete(listener);
    };
  }
};
_callbacks = new WeakMap();
_DefaultStore_instances = new WeakSet();
publish_fn = function(...args) {
  __privateGet(this, _callbacks).forEach((listener) => {
    listener(...args);
  });
};
__publicField(DefaultStore, "VERSION", package_default.version);
var src_default = DefaultStore;

// uppy--uppy-companion-6.2.2/packages/@uppy/core/src/Uppy.ts
var import_throttle = __toESM(require_throttle(), 1);
var import_namespace_emitter = __toESM(require_namespace_emitter(), 1);

// node_modules/nanoid/non-secure/index.js
var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
var nanoid = (size = 21) => {
  let id = "";
  let i = size | 0;
  while (i--) {
    id += urlAlphabet[Math.random() * 64 | 0];
  }
  return id;
};

// uppy--uppy-companion-6.2.2/packages/@uppy/core/package.json
var package_default2 = {
  name: "@uppy/core",
  description: "Core module for the extensible JavaScript file upload widget with support for drag&drop, resumable uploads, previews, restrictions, file processing/encoding, remote providers like Instagram, Dropbox, Google Drive, S3 and more :dog:",
  version: "5.2.0",
  license: "MIT",
  style: "dist/style.min.css",
  type: "module",
  sideEffects: [
    "*.css"
  ],
  scripts: {
    build: "tsc --build tsconfig.build.json",
    "build:css": "sass --load-path=../../ src/style.scss dist/style.css && postcss dist/style.css -u cssnano -o dist/style.min.css",
    typecheck: "tsc --build",
    test: "vitest run --environment=jsdom --silent='passed-only'"
  },
  keywords: [
    "file uploader",
    "uppy",
    "uppy-plugin"
  ],
  homepage: "https://uppy.io",
  bugs: {
    url: "https://github.com/transloadit/uppy/issues"
  },
  repository: {
    type: "git",
    url: "git+https://github.com/transloadit/uppy.git"
  },
  files: [
    "src",
    "lib",
    "dist",
    "CHANGELOG.md"
  ],
  exports: {
    ".": "./lib/index.js",
    "./css/style.min.css": "./dist/style.min.css",
    "./css/style.css": "./dist/style.css",
    "./css/style.scss": "./src/style.scss",
    "./package.json": "./package.json"
  },
  dependencies: {
    "@transloadit/prettier-bytes": "^0.3.4",
    "@uppy/store-default": "workspace:^",
    "@uppy/utils": "workspace:^",
    lodash: "^4.17.23",
    "mime-match": "^1.0.2",
    "namespace-emitter": "^2.0.1",
    nanoid: "^5.0.9",
    preact: "^10.26.10"
  },
  devDependencies: {
    "@types/deep-freeze": "^0",
    cssnano: "^7.0.7",
    "deep-freeze": "^0.0.1",
    jsdom: "^26.1.0",
    postcss: "^8.5.6",
    "postcss-cli": "^11.0.1",
    sass: "^1.89.2",
    typescript: "^5.8.3",
    vitest: "^3.2.4"
  }
};

// uppy--uppy-companion-6.2.2/packages/@uppy/core/src/getFileName.ts
function getFileName(fileType, fileDescriptor) {
  if (fileDescriptor.name) {
    return fileDescriptor.name;
  }
  if (fileType.split("/")[0] === "image") {
    return `${fileType.split("/")[0]}.${fileType.split("/")[1]}`;
  }
  return "noname";
}

// uppy--uppy-companion-6.2.2/packages/@uppy/core/src/locale.ts
var locale_default = {
  strings: {
    addBulkFilesFailed: {
      0: "Failed to add %{smart_count} file due to an internal error",
      1: "Failed to add %{smart_count} files due to internal errors"
    },
    youCanOnlyUploadX: {
      0: "You can only upload %{smart_count} file",
      1: "You can only upload %{smart_count} files"
    },
    youHaveToAtLeastSelectX: {
      0: "You have to select at least %{smart_count} file",
      1: "You have to select at least %{smart_count} files"
    },
    aggregateExceedsSize: "You selected %{size} of files, but maximum allowed size is %{sizeAllowed}",
    exceedsSize: "%{file} exceeds maximum allowed size of %{size}",
    missingRequiredMetaField: "Missing required meta fields",
    missingRequiredMetaFieldOnFile: "Missing required meta fields in %{fileName}",
    inferiorSize: "This file is smaller than the allowed size of %{size}",
    youCanOnlyUploadFileTypes: "You can only upload: %{types}",
    noMoreFilesAllowed: "Cannot add more files",
    noDuplicates: "Cannot add the duplicate file '%{fileName}', it already exists",
    companionError: "Connection with Companion failed",
    authAborted: "Authentication aborted",
    companionUnauthorizeHint: "To unauthorize to your %{provider} account, please go to %{url}",
    failedToUpload: "Failed to upload %{file}",
    noInternetConnection: "No Internet connection",
    connectedToInternet: "Connected to the Internet",
    // Strings for remote providers
    noFilesFound: "You have no files or folders here",
    noSearchResults: "Unfortunately, there are no results for this search",
    selectX: {
      0: "Select %{smart_count}",
      1: "Select %{smart_count}"
    },
    allFilesFromFolderNamed: "All files from folder %{name}",
    openFolderNamed: "Open folder %{name}",
    cancel: "Cancel",
    logOut: "Log out",
    logIn: "Log in",
    pickFiles: "Pick files",
    pickPhotos: "Pick photos",
    filter: "Filter",
    resetFilter: "Reset filter",
    loading: "Loading...",
    loadedXFiles: "Loaded %{numFiles} files",
    authenticateWithTitle: "Please authenticate with %{pluginName} to select files",
    authenticateWith: "Connect to %{pluginName}",
    signInWithGoogle: "Sign in with Google",
    searchImages: "Search for images",
    enterTextToSearch: "Enter text to search for images",
    search: "Search",
    resetSearch: "Reset search",
    emptyFolderAdded: "No files were added from empty folder",
    addedNumFiles: "Added %{numFiles} file(s)",
    folderAlreadyAdded: 'The folder "%{folder}" was already added',
    folderAdded: {
      0: "Added %{smart_count} file from %{folder}",
      1: "Added %{smart_count} files from %{folder}"
    },
    additionalRestrictionsFailed: "%{count} additional restrictions were not fulfilled",
    unnamed: "Unnamed",
    pleaseWait: "Please wait"
  }
};

// uppy--uppy-companion-6.2.2/packages/@uppy/core/src/supportsUploadProgress.ts
function supportsUploadProgress(userAgent) {
  if (userAgent == null && typeof navigator !== "undefined") {
    userAgent = navigator.userAgent;
  }
  if (!userAgent) return true;
  const m = /Edge\/(\d+\.\d+)/.exec(userAgent);
  if (!m) return true;
  const edgeVersion = m[1];
  const version = edgeVersion.split(".", 2);
  const major = parseInt(version[0], 10);
  const minor = parseInt(version[1], 10);
  if (major < 15 || major === 15 && minor < 15063) {
    return true;
  }
  if (major > 18 || major === 18 && minor >= 18218) {
    return true;
  }
  return false;
}

// uppy--uppy-companion-6.2.2/packages/@uppy/core/src/Uppy.ts
var defaultUploadState = {
  totalProgress: 0,
  allowNewUpload: true,
  error: null,
  recoveredState: null
};
var _plugins, _restricter, _storeUnsubscribe, _emitter, _preProcessors, _uploaders, _postProcessors, _Uppy_instances, informAndEmit_fn, checkRequiredMetaFieldsOnFile_fn, checkRequiredMetaFields_fn, assertNewUploadAllowed_fn, transformFile_fn, startIfAutoProceed_fn, checkAndUpdateFileState_fn, getFilesToRetry_fn, doRetryAll_fn, _handleUploadProgress, updateTotalProgress_fn, _updateTotalProgressThrottled, calculateTotalProgress_fn, addListeners_fn, _updateOnlineStatus, _requestClientById, createUpload_fn, getUpload_fn, removeUpload_fn, runUpload_fn;
var _Uppy = class _Uppy {
  /**
   * Instantiate Uppy
   */
  constructor(opts) {
    __privateAdd(this, _Uppy_instances);
    __privateAdd(this, _plugins, /* @__PURE__ */ Object.create(null));
    __privateAdd(this, _restricter);
    __privateAdd(this, _storeUnsubscribe);
    __privateAdd(this, _emitter, (0, import_namespace_emitter.default)());
    __privateAdd(this, _preProcessors, /* @__PURE__ */ new Set());
    __privateAdd(this, _uploaders, /* @__PURE__ */ new Set());
    __privateAdd(this, _postProcessors, /* @__PURE__ */ new Set());
    __publicField(this, "defaultLocale");
    __publicField(this, "locale");
    // The user optionally passes in options, but we set defaults for missing options.
    // We consider all options present after the contructor has run.
    __publicField(this, "opts");
    __publicField(this, "store");
    // Warning: do not use this from a plugin, as it will cause the plugins' translations to be missing
    __publicField(this, "i18n");
    __publicField(this, "i18nArray");
    __publicField(this, "scheduledAutoProceed", null);
    __publicField(this, "wasOffline", false);
    __privateAdd(this, _handleUploadProgress, (file, progress) => {
      const fileInState = file ? this.getFile(file.id) : void 0;
      if (file == null || !fileInState) {
        this.log(
          `Not setting progress for a file that has been removed: ${file == null ? void 0 : file.id}`
        );
        return;
      }
      if (fileInState.progress.percentage === 100) {
        this.log(
          `Not setting progress for a file that has been already uploaded: ${file.id}`
        );
        return;
      }
      const newProgress = {
        bytesTotal: progress.bytesTotal,
        // bytesTotal may be null or zero; in that case we can't divide by it
        percentage: progress.bytesTotal != null && Number.isFinite(progress.bytesTotal) && progress.bytesTotal > 0 ? Math.round(progress.bytesUploaded / progress.bytesTotal * 100) : void 0
      };
      if (fileInState.progress.uploadStarted != null) {
        this.setFileState(file.id, {
          progress: {
            ...fileInState.progress,
            ...newProgress,
            bytesUploaded: progress.bytesUploaded
          }
        });
      } else {
        this.setFileState(file.id, {
          progress: {
            ...fileInState.progress,
            ...newProgress
          }
        });
      }
      __privateGet(this, _updateTotalProgressThrottled).call(this);
    });
    // ___Why throttle at 500ms?
    //    - We must throttle at >250ms for superfocus in Dashboard to work well
    //    (because animation takes 0.25s, and we want to wait for all animations to be over before refocusing).
    //    [Practical Check]: if thottle is at 100ms, then if you are uploading a file,
    //    and click 'ADD MORE FILES', - focus won't activate in Firefox.
    //    - We must throttle at around >500ms to avoid performance lags.
    //    [Practical Check] Firefox, try to upload a big file for a prolonged period of time. Laptop will start to heat up.
    __privateAdd(this, _updateTotalProgressThrottled, (0, import_throttle.default)(
      () => __privateMethod(this, _Uppy_instances, updateTotalProgress_fn).call(this),
      500,
      { leading: true, trailing: true }
    ));
    __privateAdd(this, _updateOnlineStatus, this.updateOnlineStatus.bind(this));
    // We need to store request clients by a unique ID, so we can share RequestClient instances across files
    // this allows us to do rate limiting and synchronous operations like refreshing provider tokens
    // example: refreshing tokens: if each file has their own requestclient,
    // we don't have any way to synchronize all requests in order to
    // - block all requests
    // - refresh the token
    // - unblock all requests and allow them to run with a the new access token
    // back when we had a requestclient per file, once an access token expired,
    // all 6 files would go ahead and refresh the token at the same time
    // (calling /refresh-token up to 6 times), which will probably fail for some providers
    __privateAdd(this, _requestClientById, /* @__PURE__ */ new Map());
    this.defaultLocale = locale_default;
    const defaultOptions2 = {
      id: "uppy",
      autoProceed: false,
      allowMultipleUploadBatches: true,
      debug: false,
      restrictions: defaultOptions,
      meta: {},
      onBeforeFileAdded: (file, files) => !Object.hasOwn(files, file.id),
      onBeforeUpload: (files) => files,
      store: new src_default(),
      logger: justErrorsLogger,
      infoTimeout: 5e3
    };
    const merged = { ...defaultOptions2, ...opts };
    this.opts = {
      ...merged,
      restrictions: {
        ...defaultOptions2.restrictions,
        ...opts == null ? void 0 : opts.restrictions
      }
    };
    if ((opts == null ? void 0 : opts.logger) && opts.debug) {
      this.log(
        "You are using a custom `logger`, but also set `debug: true`, which uses built-in logger to output logs to console. Ignoring `debug: true` and using your custom `logger`.",
        "warning"
      );
    } else if (opts == null ? void 0 : opts.debug) {
      this.opts.logger = debugLogger;
    }
    this.log(`Using Core v${_Uppy.VERSION}`);
    this.i18nInit();
    this.store = this.opts.store;
    this.setState({
      ...defaultUploadState,
      plugins: {},
      files: {},
      currentUploads: {},
      capabilities: {
        uploadProgress: supportsUploadProgress(),
        individualCancellation: true,
        resumableUploads: false
      },
      meta: { ...this.opts.meta },
      info: []
    });
    __privateSet(this, _restricter, new Restricter(
      () => this.opts,
      () => this.i18n
    ));
    __privateSet(this, _storeUnsubscribe, this.store.subscribe(
      (prevState, nextState, patch) => {
        this.emit("state-update", prevState, nextState, patch);
        this.updateAll(nextState);
      }
    ));
    if (this.opts.debug && typeof window !== "undefined") {
      window[this.opts.id] = this;
    }
    __privateMethod(this, _Uppy_instances, addListeners_fn).call(this);
  }
  emit(event, ...args) {
    __privateGet(this, _emitter).emit(event, ...args);
  }
  on(event, callback) {
    __privateGet(this, _emitter).on(event, callback);
    return this;
  }
  once(event, callback) {
    __privateGet(this, _emitter).once(event, callback);
    return this;
  }
  off(event, callback) {
    __privateGet(this, _emitter).off(event, callback);
    return this;
  }
  /**
   * Iterate on all plugins and run `update` on them.
   * Called each time state changes.
   *
   */
  updateAll(state) {
    this.iteratePlugins((plugin) => {
      plugin.update(state);
    });
  }
  /**
   * Updates state with a patch
   */
  setState(patch) {
    this.store.setState(patch);
  }
  /**
   * Returns current state.
   */
  getState() {
    return this.store.getState();
  }
  patchFilesState(filesWithNewState) {
    const existingFilesState = this.getState().files;
    this.setState({
      files: {
        ...existingFilesState,
        ...Object.fromEntries(
          Object.entries(filesWithNewState).map(([fileID, newFileState]) => [
            fileID,
            {
              ...existingFilesState[fileID],
              ...newFileState
            }
          ])
        )
      }
    });
  }
  /**
   * Shorthand to set state for a specific file.
   */
  setFileState(fileID, state) {
    if (!this.getState().files[fileID]) {
      throw new Error(
        `Can\u2019t set state for ${fileID} (the file could have been removed)`
      );
    }
    this.patchFilesState({ [fileID]: state });
  }
  i18nInit() {
    const onMissingKey = (key) => this.log(`Missing i18n string: ${key}`, "error");
    const translator = new Translator([this.defaultLocale, this.opts.locale], {
      onMissingKey
    });
    this.i18n = translator.translate.bind(translator);
    this.i18nArray = translator.translateArray.bind(translator);
    this.locale = translator.locale;
  }
  setOptions(newOpts) {
    this.opts = {
      ...this.opts,
      ...newOpts,
      restrictions: {
        ...this.opts.restrictions,
        ...newOpts == null ? void 0 : newOpts.restrictions
      }
    };
    if (newOpts.meta) {
      this.setMeta(newOpts.meta);
    }
    this.i18nInit();
    if (newOpts.locale) {
      this.iteratePlugins((plugin) => {
        plugin.setOptions(newOpts);
      });
    }
    this.setState(void 0);
  }
  resetProgress() {
    const defaultProgress = {
      percentage: 0,
      bytesUploaded: false,
      uploadComplete: false,
      uploadStarted: null
    };
    const files = { ...this.getState().files };
    const updatedFiles = /* @__PURE__ */ Object.create(null);
    Object.keys(files).forEach((fileID) => {
      updatedFiles[fileID] = {
        ...files[fileID],
        progress: {
          ...files[fileID].progress,
          ...defaultProgress
        },
        // @ts-expect-error these typed are inserted
        // into the namespace in their respective packages
        // but core isn't ware of those
        tus: void 0,
        transloadit: void 0
      };
    });
    this.setState({ files: updatedFiles, ...defaultUploadState });
  }
  clear() {
    const { capabilities, currentUploads } = this.getState();
    if (Object.keys(currentUploads).length > 0 && !capabilities.individualCancellation) {
      throw new Error(
        "The installed uploader plugin does not allow removing files during an upload."
      );
    }
    this.setState({ ...defaultUploadState, files: {} });
  }
  addPreProcessor(fn) {
    __privateGet(this, _preProcessors).add(fn);
  }
  removePreProcessor(fn) {
    return __privateGet(this, _preProcessors).delete(fn);
  }
  addPostProcessor(fn) {
    __privateGet(this, _postProcessors).add(fn);
  }
  removePostProcessor(fn) {
    return __privateGet(this, _postProcessors).delete(fn);
  }
  addUploader(fn) {
    __privateGet(this, _uploaders).add(fn);
  }
  removeUploader(fn) {
    return __privateGet(this, _uploaders).delete(fn);
  }
  setMeta(data) {
    const updatedMeta = { ...this.getState().meta, ...data };
    const updatedFiles = { ...this.getState().files };
    Object.keys(updatedFiles).forEach((fileID) => {
      updatedFiles[fileID] = {
        ...updatedFiles[fileID],
        meta: { ...updatedFiles[fileID].meta, ...data }
      };
    });
    this.log("Adding metadata:");
    this.log(data);
    this.setState({
      meta: updatedMeta,
      files: updatedFiles
    });
  }
  setFileMeta(fileID, data) {
    const updatedFiles = { ...this.getState().files };
    if (!updatedFiles[fileID]) {
      this.log(
        `Was trying to set metadata for a file that has been removed: ${fileID}`
      );
      return;
    }
    const newMeta = { ...updatedFiles[fileID].meta, ...data };
    updatedFiles[fileID] = { ...updatedFiles[fileID], meta: newMeta };
    this.setState({ files: updatedFiles });
  }
  /**
   * Get a file object.
   */
  getFile(fileID) {
    return this.getState().files[fileID];
  }
  /**
   * Get all files in an array.
   */
  getFiles() {
    const { files } = this.getState();
    return Object.values(files);
  }
  getFilesByIds(ids) {
    return ids.map((id) => this.getFile(id));
  }
  getObjectOfFilesPerState() {
    const { files: filesObject, totalProgress, error } = this.getState();
    const files = Object.values(filesObject);
    const inProgressFiles = [];
    const newFiles = [];
    const startedFiles = [];
    const uploadStartedFiles = [];
    const pausedFiles = [];
    const completeFiles = [];
    const erroredFiles = [];
    const inProgressNotPausedFiles = [];
    const processingFiles = [];
    for (const file of files) {
      const { progress } = file;
      if (!progress.uploadComplete && progress.uploadStarted) {
        inProgressFiles.push(file);
        if (!file.isPaused) {
          inProgressNotPausedFiles.push(file);
        }
      }
      if (!progress.uploadStarted) {
        newFiles.push(file);
      }
      if (progress.uploadStarted || progress.preprocess || progress.postprocess) {
        startedFiles.push(file);
      }
      if (progress.uploadStarted) {
        uploadStartedFiles.push(file);
      }
      if (file.isPaused) {
        pausedFiles.push(file);
      }
      if (progress.uploadComplete) {
        completeFiles.push(file);
      }
      if (file.error) {
        erroredFiles.push(file);
      }
      if (progress.preprocess || progress.postprocess) {
        processingFiles.push(file);
      }
    }
    return {
      newFiles,
      startedFiles,
      uploadStartedFiles,
      pausedFiles,
      completeFiles,
      erroredFiles,
      inProgressFiles,
      inProgressNotPausedFiles,
      processingFiles,
      isUploadStarted: uploadStartedFiles.length > 0,
      isAllComplete: totalProgress === 100 && completeFiles.length === files.length && processingFiles.length === 0,
      isAllErrored: !!error && erroredFiles.length === files.length,
      isAllPaused: inProgressFiles.length !== 0 && pausedFiles.length === inProgressFiles.length,
      isUploadInProgress: inProgressFiles.length > 0,
      isSomeGhost: files.some((file) => file.isGhost)
    };
  }
  validateRestrictions(file, files = this.getFiles()) {
    try {
      __privateGet(this, _restricter).validate(files, [file]);
    } catch (err) {
      return err;
    }
    return null;
  }
  validateSingleFile(file) {
    try {
      __privateGet(this, _restricter).validateSingleFile(file);
    } catch (err) {
      return err.message;
    }
    return null;
  }
  validateAggregateRestrictions(files) {
    const existingFiles = this.getFiles();
    try {
      __privateGet(this, _restricter).validateAggregateRestrictions(existingFiles, files);
    } catch (err) {
      return err.message;
    }
    return null;
  }
  checkIfFileAlreadyExists(fileID) {
    const { files } = this.getState();
    if (files[fileID] && !files[fileID].isGhost) {
      return true;
    }
    return false;
  }
  /**
   * Add a new file to `state.files`. This will run `onBeforeFileAdded`,
   * try to guess file type in a clever way, check file against restrictions,
   * and start an upload if `autoProceed === true`.
   */
  addFile(file) {
    const { nextFilesState, validFilesToAdd, errors } = __privateMethod(this, _Uppy_instances, checkAndUpdateFileState_fn).call(this, [file]);
    const restrictionErrors = errors.filter((error) => error.isRestriction);
    __privateMethod(this, _Uppy_instances, informAndEmit_fn).call(this, restrictionErrors);
    if (errors.length > 0) throw errors[0];
    this.setState({ files: nextFilesState });
    const [firstValidFileToAdd] = validFilesToAdd;
    this.emit("file-added", firstValidFileToAdd);
    this.emit("files-added", validFilesToAdd);
    this.log(
      `Added file: ${firstValidFileToAdd.name}, ${firstValidFileToAdd.id}, mime type: ${firstValidFileToAdd.type}`
    );
    __privateMethod(this, _Uppy_instances, startIfAutoProceed_fn).call(this);
    return firstValidFileToAdd.id;
  }
  /**
   * Add multiple files to `state.files`. See the `addFile()` documentation.
   *
   * If an error occurs while adding a file, it is logged and the user is notified.
   * This is good for UI plugins, but not for programmatic use.
   * Programmatic users should usually still use `addFile()` on individual files.
   */
  addFiles(fileDescriptors) {
    const { nextFilesState, validFilesToAdd, errors } = __privateMethod(this, _Uppy_instances, checkAndUpdateFileState_fn).call(this, fileDescriptors);
    const restrictionErrors = errors.filter((error) => error.isRestriction);
    __privateMethod(this, _Uppy_instances, informAndEmit_fn).call(this, restrictionErrors);
    const nonRestrictionErrors = errors.filter((error) => !error.isRestriction);
    if (nonRestrictionErrors.length > 0) {
      let message = "Multiple errors occurred while adding files:\n";
      nonRestrictionErrors.forEach((subError) => {
        message += `
 * ${subError.message}`;
      });
      this.info(
        {
          message: this.i18n("addBulkFilesFailed", {
            smart_count: nonRestrictionErrors.length
          }),
          details: message
        },
        "error",
        this.opts.infoTimeout
      );
      if (typeof AggregateError === "function") {
        throw new AggregateError(nonRestrictionErrors, message);
      } else {
        const err = new Error(message);
        err.errors = nonRestrictionErrors;
        throw err;
      }
    }
    this.setState({ files: nextFilesState });
    validFilesToAdd.forEach((file) => {
      this.emit("file-added", file);
    });
    this.emit("files-added", validFilesToAdd);
    if (validFilesToAdd.length > 5) {
      this.log(`Added batch of ${validFilesToAdd.length} files`);
    } else {
      Object.values(validFilesToAdd).forEach((file) => {
        this.log(
          `Added file: ${file.name}
 id: ${file.id}
 type: ${file.type}`
        );
      });
    }
    if (validFilesToAdd.length > 0) {
      __privateMethod(this, _Uppy_instances, startIfAutoProceed_fn).call(this);
    }
  }
  removeFiles(fileIDs) {
    const { files, currentUploads } = this.getState();
    const updatedFiles = { ...files };
    const updatedUploads = { ...currentUploads };
    const removedFiles = /* @__PURE__ */ Object.create(null);
    fileIDs.forEach((fileID) => {
      if (files[fileID]) {
        removedFiles[fileID] = files[fileID];
        delete updatedFiles[fileID];
      }
    });
    function fileIsNotRemoved(uploadFileID) {
      return removedFiles[uploadFileID] === void 0;
    }
    Object.keys(updatedUploads).forEach((uploadID) => {
      const newFileIDs = currentUploads[uploadID].fileIDs.filter(fileIsNotRemoved);
      if (newFileIDs.length === 0) {
        delete updatedUploads[uploadID];
        return;
      }
      const { capabilities } = this.getState();
      if (newFileIDs.length !== currentUploads[uploadID].fileIDs.length && !capabilities.individualCancellation) {
        throw new Error(
          "The installed uploader plugin does not allow removing files during an upload."
        );
      }
      updatedUploads[uploadID] = {
        ...currentUploads[uploadID],
        fileIDs: newFileIDs
      };
    });
    const stateUpdate = {
      currentUploads: updatedUploads,
      files: updatedFiles
    };
    if (Object.keys(updatedFiles).length === 0) {
      stateUpdate.allowNewUpload = true;
      stateUpdate.error = null;
      stateUpdate.recoveredState = null;
    }
    this.setState(stateUpdate);
    __privateGet(this, _updateTotalProgressThrottled).call(this);
    const removedFileIDs = Object.keys(removedFiles);
    removedFileIDs.forEach((fileID) => {
      this.emit("file-removed", removedFiles[fileID]);
    });
    if (removedFileIDs.length > 5) {
      this.log(`Removed ${removedFileIDs.length} files`);
    } else {
      this.log(`Removed files: ${removedFileIDs.join(", ")}`);
    }
  }
  removeFile(fileID) {
    this.removeFiles([fileID]);
  }
  pauseResume(fileID) {
    if (!this.getState().capabilities.resumableUploads || this.getFile(fileID).progress.uploadComplete) {
      return void 0;
    }
    const file = this.getFile(fileID);
    const wasPaused = file.isPaused || false;
    const isPaused = !wasPaused;
    this.setFileState(fileID, {
      isPaused
    });
    this.emit("upload-pause", file, isPaused);
    return isPaused;
  }
  pauseAll() {
    const updatedFiles = { ...this.getState().files };
    const inProgressUpdatedFiles = Object.keys(updatedFiles).filter((file) => {
      return !updatedFiles[file].progress.uploadComplete && updatedFiles[file].progress.uploadStarted;
    });
    inProgressUpdatedFiles.forEach((file) => {
      const updatedFile = { ...updatedFiles[file], isPaused: true };
      updatedFiles[file] = updatedFile;
    });
    this.setState({ files: updatedFiles });
    this.emit("pause-all");
  }
  resumeAll() {
    const updatedFiles = { ...this.getState().files };
    const inProgressUpdatedFiles = Object.keys(updatedFiles).filter((file) => {
      return !updatedFiles[file].progress.uploadComplete && updatedFiles[file].progress.uploadStarted;
    });
    inProgressUpdatedFiles.forEach((file) => {
      const updatedFile = {
        ...updatedFiles[file],
        isPaused: false,
        error: null
      };
      updatedFiles[file] = updatedFile;
    });
    this.setState({ files: updatedFiles });
    this.emit("resume-all");
  }
  async retryAll() {
    const result = await __privateMethod(this, _Uppy_instances, doRetryAll_fn).call(this);
    this.emit("complete", result);
    return result;
  }
  cancelAll() {
    this.emit("cancel-all");
    const { files } = this.getState();
    const fileIDs = Object.keys(files);
    if (fileIDs.length) {
      this.removeFiles(fileIDs);
    }
    this.setState(defaultUploadState);
  }
  /**
   * Retry a specific file that has errored.
   */
  retryUpload(fileID) {
    this.setFileState(fileID, {
      error: null,
      isPaused: false
    });
    this.emit("upload-retry", this.getFile(fileID));
    const uploadID = __privateMethod(this, _Uppy_instances, createUpload_fn).call(this, [fileID], {
      forceAllowNewUpload: true
      // create new upload even if allowNewUpload: false
    });
    return __privateMethod(this, _Uppy_instances, runUpload_fn).call(this, uploadID);
  }
  logout() {
    this.iteratePlugins((plugin) => {
      var _a, _b;
      ;
      (_b = (_a = plugin.provider) == null ? void 0 : _a.logout) == null ? void 0 : _b.call(_a);
    });
  }
  [/* @__PURE__ */ Symbol.for("uppy test: updateTotalProgress")]() {
    return __privateMethod(this, _Uppy_instances, updateTotalProgress_fn).call(this);
  }
  updateOnlineStatus() {
    var _a;
    const online = (_a = window.navigator.onLine) != null ? _a : true;
    if (!online) {
      this.emit("is-offline");
      this.info(this.i18n("noInternetConnection"), "error", 0);
      this.wasOffline = true;
    } else {
      this.emit("is-online");
      if (this.wasOffline) {
        this.emit("back-online");
        this.info(this.i18n("connectedToInternet"), "success", 3e3);
        this.wasOffline = false;
      }
    }
  }
  getID() {
    return this.opts.id;
  }
  /**
   * Registers a plugin with Core.
   */
  use(Plugin, ...args) {
    if (typeof Plugin !== "function") {
      const msg = `Expected a plugin class, but got ${Plugin === null ? "null" : typeof Plugin}. Please verify that the plugin was imported and spelled correctly.`;
      throw new TypeError(msg);
    }
    const plugin = new Plugin(this, ...args);
    const pluginId = plugin.id;
    if (!pluginId) {
      throw new Error("Your plugin must have an id");
    }
    if (!plugin.type) {
      throw new Error("Your plugin must have a type");
    }
    const existsPluginAlready = this.getPlugin(pluginId);
    if (existsPluginAlready) {
      const msg = `Already found a plugin named '${existsPluginAlready.id}'. Tried to use: '${pluginId}'.
Uppy plugins must have unique \`id\` options.`;
      throw new Error(msg);
    }
    if (Plugin.VERSION) {
      this.log(`Using ${pluginId} v${Plugin.VERSION}`);
    }
    if (plugin.type in __privateGet(this, _plugins)) {
      __privateGet(this, _plugins)[plugin.type].push(plugin);
    } else {
      __privateGet(this, _plugins)[plugin.type] = [plugin];
    }
    plugin.install();
    this.emit("plugin-added", plugin);
    return this;
  }
  getPlugin(id) {
    for (const plugins of Object.values(__privateGet(this, _plugins))) {
      const foundPlugin = plugins.find((plugin) => plugin.id === id);
      if (foundPlugin != null) {
        return foundPlugin;
      }
    }
    return void 0;
  }
  [/* @__PURE__ */ Symbol.for("uppy test: getPlugins")](type) {
    return __privateGet(this, _plugins)[type];
  }
  /**
   * Iterate through all `use`d plugins.
   *
   */
  iteratePlugins(method) {
    Object.values(__privateGet(this, _plugins)).flat(1).forEach(method);
  }
  /**
   * Uninstall and remove a plugin.
   *
   * @param {object} instance The plugin instance to remove.
   */
  removePlugin(instance) {
    this.log(`Removing plugin ${instance.id}`);
    this.emit("plugin-remove", instance);
    if (instance.uninstall) {
      instance.uninstall();
    }
    const list = __privateGet(this, _plugins)[instance.type];
    const index = list.findIndex((item) => item.id === instance.id);
    if (index !== -1) {
      list.splice(index, 1);
    }
    const state = this.getState();
    const updatedState = {
      plugins: {
        ...state.plugins,
        [instance.id]: void 0
      }
    };
    this.setState(updatedState);
  }
  /**
   * Uninstall all plugins and close down this Uppy instance.
   */
  destroy() {
    this.log(
      `Closing Uppy instance ${this.opts.id}: removing all files and uninstalling plugins`
    );
    this.cancelAll();
    __privateGet(this, _storeUnsubscribe).call(this);
    this.iteratePlugins((plugin) => {
      this.removePlugin(plugin);
    });
    if (typeof window !== "undefined" && window.removeEventListener) {
      window.removeEventListener("online", __privateGet(this, _updateOnlineStatus));
      window.removeEventListener("offline", __privateGet(this, _updateOnlineStatus));
    }
  }
  hideInfo() {
    const { info } = this.getState();
    this.setState({ info: info.slice(1) });
    this.emit("info-hidden");
  }
  /**
   * Set info message in `state.info`, so that UI plugins like `Informer`
   * can display the message.
   */
  info(message, type = "info", duration = 3e3) {
    const isComplexMessage = typeof message === "object";
    this.setState({
      info: [
        ...this.getState().info,
        {
          type,
          message: isComplexMessage ? message.message : message,
          details: isComplexMessage ? message.details : null
        }
      ]
    });
    setTimeout(() => this.hideInfo(), duration);
    this.emit("info-visible");
  }
  /**
   * Passes messages to a function, provided in `opts.logger`.
   * If `opts.logger: Uppy.debugLogger` or `opts.debug: true`, logs to the browser console.
   */
  log(message, type) {
    const { logger } = this.opts;
    switch (type) {
      case "error":
        logger.error(message);
        break;
      case "warning":
        logger.warn(message);
        break;
      default:
        logger.debug(message);
        break;
    }
  }
  registerRequestClient(id, client) {
    __privateGet(this, _requestClientById).set(id, client);
  }
  /** @protected */
  getRequestClientForFile(file) {
    if (!("remote" in file && file.remote))
      throw new Error(
        `Tried to get RequestClient for a non-remote file ${file.id}`
      );
    const requestClient = __privateGet(this, _requestClientById).get(
      file.remote.requestClientId
    );
    if (requestClient == null)
      throw new Error(
        `requestClientId "${file.remote.requestClientId}" not registered for file "${file.id}"`
      );
    return requestClient;
  }
  /**
   * Restore an upload by its ID.
   */
  async restore(uploadID) {
    this.log(`Core: Running restored upload "${uploadID}"`);
    const result = await __privateMethod(this, _Uppy_instances, runUpload_fn).call(this, uploadID);
    this.emit("complete", result);
    return result;
  }
  [/* @__PURE__ */ Symbol.for("uppy test: createUpload")](...args) {
    return __privateMethod(this, _Uppy_instances, createUpload_fn).call(this, ...args);
  }
  /**
   * Add data to an upload's result object.
   */
  addResultData(uploadID, data) {
    if (!__privateMethod(this, _Uppy_instances, getUpload_fn).call(this, uploadID)) {
      this.log(
        `Not setting result for an upload that has been removed: ${uploadID}`
      );
      return;
    }
    const { currentUploads } = this.getState();
    const currentUpload = {
      ...currentUploads[uploadID],
      result: { ...currentUploads[uploadID].result, ...data }
    };
    this.setState({
      currentUploads: { ...currentUploads, [uploadID]: currentUpload }
    });
  }
  /**
   * Start an upload for all the files that are not currently being uploaded.
   */
  async upload() {
    var _a;
    if (!((_a = __privateGet(this, _plugins).uploader) == null ? void 0 : _a.length)) {
      this.log("No uploader type plugins are used", "warning");
    }
    let { files } = this.getState();
    const filesToRetry = __privateMethod(this, _Uppy_instances, getFilesToRetry_fn).call(this);
    if (filesToRetry.length > 0) {
      const retryResult = await __privateMethod(this, _Uppy_instances, doRetryAll_fn).call(this);
      const hasNewFiles = this.getFiles().filter((file) => file.progress.uploadStarted == null).length > 0;
      if (!hasNewFiles) {
        this.emit("complete", retryResult);
        return retryResult;
      }
      ;
      ({ files } = this.getState());
    }
    const onBeforeUploadResult = this.opts.onBeforeUpload(files);
    if (onBeforeUploadResult === false) {
      throw new Error(
        "Not starting the upload because onBeforeUpload returned false"
      );
    }
    if (onBeforeUploadResult && typeof onBeforeUploadResult === "object") {
      files = onBeforeUploadResult;
      this.setState({
        files
      });
    }
    try {
      __privateGet(this, _restricter).validateMinNumberOfFiles(files);
      if (!__privateMethod(this, _Uppy_instances, checkRequiredMetaFields_fn).call(this, files)) {
        throw new RestrictionError(this.i18n("missingRequiredMetaField"));
      }
      const { currentUploads } = this.getState();
      const currentlyUploadingFiles = Object.values(currentUploads).flatMap(
        (curr) => curr.fileIDs
      );
      const waitingFileIDs = Object.keys(files).filter((fileID) => {
        const file = this.getFile(fileID);
        return file && !file.progress.uploadStarted && !currentlyUploadingFiles.includes(fileID);
      });
      const uploadID = __privateMethod(this, _Uppy_instances, createUpload_fn).call(this, waitingFileIDs);
      const result = await __privateMethod(this, _Uppy_instances, runUpload_fn).call(this, uploadID);
      this.emit("complete", result);
      return result;
    } catch (err) {
      __privateMethod(this, _Uppy_instances, informAndEmit_fn).call(this, [err]);
      throw err;
    }
  }
};
_plugins = new WeakMap();
_restricter = new WeakMap();
_storeUnsubscribe = new WeakMap();
_emitter = new WeakMap();
_preProcessors = new WeakMap();
_uploaders = new WeakMap();
_postProcessors = new WeakMap();
_Uppy_instances = new WeakSet();
informAndEmit_fn = function(errors) {
  for (const error of errors) {
    if (error.isRestriction) {
      this.emit(
        "restriction-failed",
        error.file,
        error
      );
    } else {
      this.emit("error", error, error.file);
    }
    this.log(error, "warning");
  }
  const userFacingErrors = errors.filter((error) => error.isUserFacing);
  const maxNumToShow = 4;
  const firstErrors = userFacingErrors.slice(0, maxNumToShow);
  const additionalErrors = userFacingErrors.slice(maxNumToShow);
  firstErrors.forEach(({ message, details = "" }) => {
    this.info({ message, details }, "error", this.opts.infoTimeout);
  });
  if (additionalErrors.length > 0) {
    this.info({
      message: this.i18n("additionalRestrictionsFailed", {
        count: additionalErrors.length
      })
    });
  }
};
checkRequiredMetaFieldsOnFile_fn = function(file) {
  const { missingFields, error } = __privateGet(this, _restricter).getMissingRequiredMetaFields(file);
  if (missingFields.length > 0) {
    this.setFileState(file.id, {
      missingRequiredMetaFields: missingFields,
      error: error.message
    });
    this.log(error.message);
    this.emit("restriction-failed", file, error);
    return false;
  }
  if (missingFields.length === 0 && file.missingRequiredMetaFields) {
    this.setFileState(file.id, {
      missingRequiredMetaFields: []
    });
  }
  return true;
};
checkRequiredMetaFields_fn = function(files) {
  let success = true;
  for (const file of Object.values(files)) {
    if (!__privateMethod(this, _Uppy_instances, checkRequiredMetaFieldsOnFile_fn).call(this, file)) {
      success = false;
    }
  }
  return success;
};
assertNewUploadAllowed_fn = function(file) {
  const { allowNewUpload } = this.getState();
  if (allowNewUpload === false) {
    const error = new RestrictionError(
      this.i18n("noMoreFilesAllowed"),
      {
        file
      }
    );
    __privateMethod(this, _Uppy_instances, informAndEmit_fn).call(this, [error]);
    throw error;
  }
};
/**
 * Create a file state object based on user-provided `addFile()` options.
 */
transformFile_fn = function(fileDescriptorOrFile) {
  const file = fileDescriptorOrFile instanceof File ? {
    name: fileDescriptorOrFile.name,
    type: fileDescriptorOrFile.type,
    size: fileDescriptorOrFile.size,
    data: fileDescriptorOrFile,
    meta: {},
    isRemote: false,
    source: void 0,
    preview: void 0
  } : fileDescriptorOrFile;
  const fileType = getFileType(file);
  const fileName = getFileName(fileType, file);
  const fileExtension = getFileNameAndExtension(fileName).extension;
  const id = getSafeFileId(file, this.getID());
  const meta = {
    ...file.meta,
    name: fileName,
    type: fileType
  };
  const size = Number.isFinite(file.data.size) ? file.data.size : null;
  return {
    source: file.source || "",
    id,
    name: fileName,
    extension: fileExtension || "",
    meta: {
      ...this.getState().meta,
      ...meta
    },
    type: fileType,
    progress: {
      percentage: 0,
      bytesUploaded: false,
      bytesTotal: size,
      uploadComplete: false,
      uploadStarted: null
    },
    size,
    isGhost: false,
    ...file.isRemote ? {
      isRemote: true,
      remote: file.remote,
      data: file.data
    } : {
      isRemote: false,
      data: file.data
    },
    preview: file.preview
  };
};
// Schedule an upload if `autoProceed` is enabled.
startIfAutoProceed_fn = function() {
  if (this.opts.autoProceed && !this.scheduledAutoProceed) {
    this.scheduledAutoProceed = setTimeout(() => {
      this.scheduledAutoProceed = null;
      this.upload().catch((err) => {
        if (!err.isRestriction) {
          this.log(err.stack || err.message || err);
        }
      });
    }, 4);
  }
};
checkAndUpdateFileState_fn = function(filesToAdd) {
  var _a;
  let { files: existingFiles } = this.getState();
  let nextFilesState = { ...existingFiles };
  const validFilesToAdd = [];
  const errors = [];
  for (const fileToAdd of filesToAdd) {
    try {
      let newFile = __privateMethod(this, _Uppy_instances, transformFile_fn).call(this, fileToAdd);
      __privateMethod(this, _Uppy_instances, assertNewUploadAllowed_fn).call(this, newFile);
      const existingFile = existingFiles[newFile.id];
      const isGhost = existingFile == null ? void 0 : existingFile.isGhost;
      if (isGhost && !newFile.isRemote) {
        if (newFile.data == null) throw new Error("File data is missing");
        newFile = {
          ...existingFile,
          isGhost: false,
          data: newFile.data
        };
        this.log(
          `Replaced the blob in the restored ghost file: ${newFile.name}, ${newFile.id}`
        );
      }
      const onBeforeFileAddedResult = this.opts.onBeforeFileAdded(
        newFile,
        nextFilesState
      );
      existingFiles = this.getState().files;
      nextFilesState = { ...existingFiles, ...nextFilesState };
      if (!onBeforeFileAddedResult && this.checkIfFileAlreadyExists(newFile.id)) {
        throw new RestrictionError(
          this.i18n("noDuplicates", {
            fileName: (_a = newFile.name) != null ? _a : this.i18n("unnamed")
          }),
          { file: newFile }
        );
      }
      if (onBeforeFileAddedResult === false && !isGhost) {
        throw new RestrictionError(
          "Cannot add the file because onBeforeFileAdded returned false.",
          { isUserFacing: false, file: newFile }
        );
      } else if (typeof onBeforeFileAddedResult === "object" && onBeforeFileAddedResult !== null) {
        newFile = onBeforeFileAddedResult;
      }
      __privateGet(this, _restricter).validateSingleFile(newFile);
      nextFilesState[newFile.id] = newFile;
      validFilesToAdd.push(newFile);
    } catch (err) {
      errors.push(err);
    }
  }
  try {
    __privateGet(this, _restricter).validateAggregateRestrictions(
      Object.values(existingFiles),
      validFilesToAdd
    );
  } catch (err) {
    errors.push(err);
    return {
      nextFilesState: existingFiles,
      validFilesToAdd: [],
      errors
    };
  }
  return {
    nextFilesState,
    validFilesToAdd,
    errors
  };
};
getFilesToRetry_fn = function() {
  const { files } = this.getState();
  return Object.keys(files).filter((fileId) => {
    const file = files[fileId];
    return file.error && (!file.missingRequiredMetaFields || file.missingRequiredMetaFields.length === 0);
  });
};
doRetryAll_fn = async function() {
  const filesToRetry = __privateMethod(this, _Uppy_instances, getFilesToRetry_fn).call(this);
  const updatedFiles = { ...this.getState().files };
  filesToRetry.forEach((fileID) => {
    updatedFiles[fileID] = {
      ...updatedFiles[fileID],
      isPaused: false,
      error: null
    };
  });
  this.setState({
    files: updatedFiles,
    error: null
  });
  this.emit("retry-all", this.getFilesByIds(filesToRetry));
  if (filesToRetry.length === 0) {
    return {
      successful: [],
      failed: []
    };
  }
  const uploadID = __privateMethod(this, _Uppy_instances, createUpload_fn).call(this, filesToRetry, {
    forceAllowNewUpload: true
    // create new upload even if allowNewUpload: false
  });
  return __privateMethod(this, _Uppy_instances, runUpload_fn).call(this, uploadID);
};
_handleUploadProgress = new WeakMap();
updateTotalProgress_fn = function() {
  const totalProgress = __privateMethod(this, _Uppy_instances, calculateTotalProgress_fn).call(this);
  let totalProgressPercent = null;
  if (totalProgress != null) {
    totalProgressPercent = Math.round(totalProgress * 100);
    if (totalProgressPercent > 100) totalProgressPercent = 100;
    else if (totalProgressPercent < 0) totalProgressPercent = 0;
  }
  this.emit("progress", totalProgressPercent != null ? totalProgressPercent : 0);
  this.setState({
    totalProgress: totalProgressPercent != null ? totalProgressPercent : 0
  });
};
_updateTotalProgressThrottled = new WeakMap();
calculateTotalProgress_fn = function() {
  const files = this.getFiles();
  const filesInProgress = files.filter((file) => {
    return file.progress.uploadStarted || file.progress.preprocess || file.progress.postprocess;
  });
  if (filesInProgress.length === 0) {
    return 0;
  }
  if (filesInProgress.every((file) => file.progress.uploadComplete)) {
    return 1;
  }
  const isSizedFile = (file) => file.progress.bytesTotal != null && file.progress.bytesTotal !== 0;
  const sizedFilesInProgress = filesInProgress.filter(isSizedFile);
  const unsizedFilesInProgress = filesInProgress.filter(
    (file) => !isSizedFile(file)
  );
  if (sizedFilesInProgress.every((file) => file.progress.uploadComplete) && unsizedFilesInProgress.length > 0 && !unsizedFilesInProgress.every((file) => file.progress.uploadComplete)) {
    return null;
  }
  const totalFilesSize = sizedFilesInProgress.reduce(
    (acc, file) => {
      var _a;
      return acc + ((_a = file.progress.bytesTotal) != null ? _a : 0);
    },
    0
  );
  const totalUploadedSize = sizedFilesInProgress.reduce(
    (acc, file) => acc + (file.progress.bytesUploaded || 0),
    0
  );
  return totalFilesSize === 0 ? 0 : totalUploadedSize / totalFilesSize;
};
/**
 * Registers listeners for all global actions, like:
 * `error`, `file-removed`, `upload-progress`
 */
addListeners_fn = function() {
  const errorHandler = (error, file, response) => {
    let errorMsg = error.message || "Unknown error";
    if (error.details) {
      errorMsg += ` ${error.details}`;
    }
    this.setState({ error: errorMsg });
    if (file != null && file.id in this.getState().files) {
      this.setFileState(file.id, {
        error: errorMsg,
        response
      });
    }
  };
  this.on("error", errorHandler);
  this.on("upload-error", (file, error, response) => {
    var _a;
    errorHandler(error, file, response);
    if (typeof error === "object" && error.message) {
      this.log(error.message, "error");
      const newError = new Error(
        this.i18n("failedToUpload", { file: (_a = file == null ? void 0 : file.name) != null ? _a : "" })
      );
      newError.isUserFacing = true;
      newError.details = error.message;
      if (error.details) {
        newError.details += ` ${error.details}`;
      }
      __privateMethod(this, _Uppy_instances, informAndEmit_fn).call(this, [newError]);
    } else {
      __privateMethod(this, _Uppy_instances, informAndEmit_fn).call(this, [error]);
    }
  });
  let uploadStalledWarningRecentlyEmitted = null;
  this.on("upload-stalled", (error, files) => {
    const { message } = error;
    const details = files.map((file) => file.meta.name).join(", ");
    if (!uploadStalledWarningRecentlyEmitted) {
      this.info({ message, details }, "warning", this.opts.infoTimeout);
      uploadStalledWarningRecentlyEmitted = setTimeout(() => {
        uploadStalledWarningRecentlyEmitted = null;
      }, this.opts.infoTimeout);
    }
    this.log(`${message} ${details}`.trim(), "warning");
  });
  this.on("upload", () => {
    this.setState({ error: null });
  });
  const onUploadStarted = (files) => {
    const filesFiltered = files.filter((file) => {
      const exists = file != null && this.getFile(file.id);
      if (!exists)
        this.log(
          `Not setting progress for a file that has been removed: ${file == null ? void 0 : file.id}`
        );
      return exists;
    });
    const filesState = Object.fromEntries(
      filesFiltered.map((file) => [
        file.id,
        {
          progress: {
            uploadStarted: Date.now(),
            uploadComplete: false,
            bytesUploaded: 0,
            bytesTotal: file.size
          }
        }
      ])
    );
    this.patchFilesState(filesState);
  };
  this.on("upload-start", onUploadStarted);
  this.on("upload-progress", __privateGet(this, _handleUploadProgress));
  this.on("upload-success", (file, uploadResp) => {
    if (file == null || !this.getFile(file.id)) {
      this.log(
        `Not setting progress for a file that has been removed: ${file == null ? void 0 : file.id}`
      );
      return;
    }
    const currentProgress = this.getFile(file.id).progress;
    const needsPostProcessing = __privateGet(this, _postProcessors).size > 0;
    this.setFileState(file.id, {
      progress: {
        ...currentProgress,
        postprocess: needsPostProcessing ? {
          mode: "indeterminate"
        } : void 0,
        uploadComplete: true,
        ...!needsPostProcessing && { complete: true },
        percentage: 100,
        bytesUploaded: currentProgress.bytesTotal
      },
      response: uploadResp,
      uploadURL: uploadResp.uploadURL,
      isPaused: false
    });
    if (file.size == null) {
      this.setFileState(file.id, {
        size: uploadResp.bytesUploaded || currentProgress.bytesTotal
      });
    }
    __privateGet(this, _updateTotalProgressThrottled).call(this);
  });
  this.on("preprocess-progress", (file, progress) => {
    if (file == null || !this.getFile(file.id)) {
      this.log(
        `Not setting progress for a file that has been removed: ${file == null ? void 0 : file.id}`
      );
      return;
    }
    this.setFileState(file.id, {
      progress: { ...this.getFile(file.id).progress, preprocess: progress }
    });
  });
  this.on("preprocess-complete", (file) => {
    if (file == null || !this.getFile(file.id)) {
      this.log(
        `Not setting progress for a file that has been removed: ${file == null ? void 0 : file.id}`
      );
      return;
    }
    const files = { ...this.getState().files };
    files[file.id] = {
      ...files[file.id],
      progress: { ...files[file.id].progress }
    };
    delete files[file.id].progress.preprocess;
    this.setState({ files });
  });
  this.on("postprocess-progress", (file, progress) => {
    if (file == null || !this.getFile(file.id)) {
      this.log(
        `Not setting progress for a file that has been removed: ${file == null ? void 0 : file.id}`
      );
      return;
    }
    this.setFileState(file.id, {
      progress: {
        ...this.getState().files[file.id].progress,
        postprocess: progress
      }
    });
  });
  this.on("postprocess-complete", (fileIn) => {
    const file = fileIn && this.getFile(fileIn.id);
    if (file == null) {
      this.log(
        `Not setting progress for a file that has been removed: ${fileIn == null ? void 0 : fileIn.id}`
      );
      return;
    }
    const { postprocess: _deleted, ...newProgress } = file.progress;
    this.patchFilesState({
      [file.id]: {
        progress: {
          ...newProgress,
          complete: true
        }
      }
    });
  });
  this.on("restored", () => {
    __privateGet(this, _updateTotalProgressThrottled).call(this);
  });
  this.on("dashboard:file-edit-complete", (file) => {
    if (file) {
      __privateMethod(this, _Uppy_instances, checkRequiredMetaFieldsOnFile_fn).call(this, file);
    }
  });
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("online", __privateGet(this, _updateOnlineStatus));
    window.addEventListener("offline", __privateGet(this, _updateOnlineStatus));
    setTimeout(__privateGet(this, _updateOnlineStatus), 3e3);
  }
};
_updateOnlineStatus = new WeakMap();
_requestClientById = new WeakMap();
/**
 * Create an upload for a bunch of files.
 *
 */
createUpload_fn = function(fileIDs, opts = {}) {
  const { forceAllowNewUpload = false } = opts;
  const { allowNewUpload, currentUploads } = this.getState();
  if (!allowNewUpload && !forceAllowNewUpload) {
    throw new Error("Cannot create a new upload: already uploading.");
  }
  const uploadID = nanoid();
  this.emit("upload", uploadID, this.getFilesByIds(fileIDs));
  this.setState({
    allowNewUpload: this.opts.allowMultipleUploadBatches !== false && this.opts.allowMultipleUploads !== false,
    currentUploads: {
      ...currentUploads,
      [uploadID]: {
        fileIDs,
        step: 0,
        result: {}
      }
    }
  });
  return uploadID;
};
getUpload_fn = function(uploadID) {
  const { currentUploads } = this.getState();
  return currentUploads[uploadID];
};
/**
 * Remove an upload, eg. if it has been canceled or completed.
 *
 */
removeUpload_fn = function(uploadID) {
  const { [uploadID]: _deleted, ...currentUploads } = this.getState().currentUploads;
  this.setState({
    currentUploads
  });
};
runUpload_fn = async function(uploadID) {
  const getCurrentUpload = () => {
    const { currentUploads } = this.getState();
    return currentUploads[uploadID];
  };
  let currentUpload = getCurrentUpload();
  if (!currentUpload) {
    throw new Error("Nonexistent upload");
  }
  const steps = [
    ...__privateGet(this, _preProcessors),
    ...__privateGet(this, _uploaders),
    ...__privateGet(this, _postProcessors)
  ];
  try {
    for (let step = currentUpload.step || 0; step < steps.length; step++) {
      const fn = steps[step];
      this.setState({
        currentUploads: {
          ...this.getState().currentUploads,
          [uploadID]: {
            ...currentUpload,
            step
          }
        }
      });
      const { fileIDs } = currentUpload;
      await fn(fileIDs, uploadID);
      currentUpload = getCurrentUpload();
      if (!currentUpload) {
        break;
      }
    }
  } catch (err) {
    __privateMethod(this, _Uppy_instances, removeUpload_fn).call(this, uploadID);
    throw err;
  }
  if (currentUpload) {
    currentUpload.fileIDs.forEach((fileID) => {
      const file = this.getFile(fileID);
      if (file == null ? void 0 : file.progress.postprocess) {
        this.emit("postprocess-complete", file);
      }
    });
    const files = currentUpload.fileIDs.map((fileID) => this.getFile(fileID));
    const successful = files.filter((file) => !file.error);
    const failed = files.filter((file) => file.error);
    this.addResultData(uploadID, { successful, failed, uploadID });
    currentUpload = getCurrentUpload();
  }
  let result;
  if (currentUpload) {
    result = currentUpload.result;
    __privateMethod(this, _Uppy_instances, removeUpload_fn).call(this, uploadID);
  }
  if (result == null) {
    this.log(
      `Not setting result for an upload that has been removed: ${uploadID}`
    );
    result = {
      successful: [],
      failed: [],
      uploadID
    };
  }
  return result;
};
__publicField(_Uppy, "VERSION", package_default2.version);
var Uppy = _Uppy;
var Uppy_default = Uppy;

// uppy--uppy-companion-6.2.2/packages/@uppy/drop-target/package.json
var package_default3 = {
  name: "@uppy/drop-target",
  description: "Lets your users drag and drop files on a DOM element",
  version: "4.1.0",
  license: "MIT",
  type: "module",
  sideEffects: [
    "*.css"
  ],
  scripts: {
    build: "tsc --build tsconfig.build.json",
    "build:css": "sass --load-path=../../ src/style.scss dist/style.css && postcss dist/style.css -u cssnano -o dist/style.min.css",
    typecheck: "tsc --build"
  },
  keywords: [
    "file uploader",
    "uppy",
    "uppy-plugin",
    "drag-drop",
    "drag",
    "drop",
    "dropzone",
    "upload"
  ],
  homepage: "https://uppy.io",
  bugs: {
    url: "https://github.com/transloadit/uppy/issues"
  },
  repository: {
    type: "git",
    url: "git+https://github.com/transloadit/uppy.git"
  },
  files: [
    "src",
    "lib",
    "dist",
    "CHANGELOG.md"
  ],
  exports: {
    ".": "./lib/index.js",
    "./css/style.css": "./dist/style.css",
    "./css/style.min.css": "./dist/style.min.css",
    "./css/style.scss": "./src/style.scss",
    "./package.json": "./package.json"
  },
  dependencies: {
    "@uppy/utils": "workspace:^"
  },
  peerDependencies: {
    "@uppy/core": "workspace:^"
  },
  publishConfig: {
    access: "public"
  },
  devDependencies: {
    cssnano: "^7.0.7",
    postcss: "^8.5.6",
    "postcss-cli": "^11.0.1",
    sass: "^1.89.2",
    typescript: "^5.8.3"
  }
};

// uppy--uppy-companion-6.2.2/packages/@uppy/drop-target/src/index.ts
var defaultOpts = {
  target: null
};
function isFileTransfer(event) {
  var _a, _b, _c;
  return (_c = (_b = (_a = event.dataTransfer) == null ? void 0 : _a.types) == null ? void 0 : _b.some((type) => type === "Files")) != null ? _c : false;
}
var DropTarget = class extends BasePlugin {
  constructor(uppy, opts) {
    super(uppy, { ...defaultOpts, ...opts });
    __publicField(this, "nodes");
    __publicField(this, "addFiles", (files) => {
      const descriptors = files.map((file) => ({
        source: this.id,
        name: file.name,
        type: file.type,
        data: file,
        meta: {
          // path of the file relative to the ancestor directory the user selected.
          // e.g. 'docs/Old Prague/airbnb.pdf'
          relativePath: file.relativePath || null
        }
      }));
      try {
        this.uppy.addFiles(descriptors);
      } catch (err) {
        this.uppy.log(err);
      }
    });
    __publicField(this, "handleDrop", async (event) => {
      var _a, _b, _c;
      if (!isFileTransfer(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      (_a = event.currentTarget) == null ? void 0 : _a.classList.remove("uppy-is-drag-over");
      this.setPluginState({ isDraggingOver: false });
      this.uppy.iteratePlugins((plugin) => {
        var _a2;
        if (plugin.type === "acquirer") {
          (_a2 = plugin.handleRootDrop) == null ? void 0 : _a2.call(plugin, event);
        }
      });
      let executedDropErrorOnce = false;
      const logDropError = (error) => {
        this.uppy.log(error, "error");
        if (!executedDropErrorOnce) {
          this.uppy.info(error.message, "error");
          executedDropErrorOnce = true;
        }
      };
      const files = await getDroppedFiles(event.dataTransfer, { logDropError });
      if (files.length > 0) {
        this.uppy.log("[DropTarget] Files were dropped");
        this.addFiles(files);
      }
      (_c = (_b = this.opts).onDrop) == null ? void 0 : _c.call(_b, event);
    });
    __publicField(this, "handleDragOver", (event) => {
      var _a, _b;
      if (!isFileTransfer(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
      event.currentTarget.classList.add("uppy-is-drag-over");
      this.setPluginState({ isDraggingOver: true });
      (_b = (_a = this.opts).onDragOver) == null ? void 0 : _b.call(_a, event);
    });
    __publicField(this, "handleDragLeave", (event) => {
      var _a, _b, _c;
      if (!isFileTransfer(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.setPluginState({ isDraggingOver: false });
      (_a = event.currentTarget) == null ? void 0 : _a.classList.remove("uppy-is-drag-over");
      (_c = (_b = this.opts).onDragLeave) == null ? void 0 : _c.call(_b, event);
    });
    __publicField(this, "addListeners", () => {
      const { target } = this.opts;
      if (target instanceof Element) {
        this.nodes = [target];
      } else if (typeof target === "string") {
        this.nodes = toArray_default(document.querySelectorAll(target));
      }
      if (!this.nodes || this.nodes.length === 0) {
        throw new Error(`"${target}" does not match any HTML elements`);
      }
      this.nodes.forEach((node) => {
        node.addEventListener("dragover", this.handleDragOver, false);
        node.addEventListener("dragleave", this.handleDragLeave, false);
        node.addEventListener("drop", this.handleDrop, false);
      });
    });
    __publicField(this, "removeListeners", () => {
      if (this.nodes) {
        this.nodes.forEach((node) => {
          node.removeEventListener("dragover", this.handleDragOver, false);
          node.removeEventListener("dragleave", this.handleDragLeave, false);
          node.removeEventListener("drop", this.handleDrop, false);
        });
      }
    });
    this.type = "acquirer";
    this.id = this.opts.id || "DropTarget";
  }
  install() {
    this.setPluginState({ isDraggingOver: false });
    this.addListeners();
  }
  uninstall() {
    this.removeListeners();
  }
};
__publicField(DropTarget, "VERSION", package_default3.version);

// src/admin/upload-manager.js
function toPercentage(bytesUploaded, bytesTotal) {
  if (!bytesTotal || bytesTotal <= 0) return 0;
  return Math.min(100, Math.round(bytesUploaded / bytesTotal * 100));
}
function createUploadFieldManager({ toast } = {}) {
  const instances = /* @__PURE__ */ new Map();
  function mountField(options) {
    var _a;
    const {
      id,
      target,
      input,
      progressEl,
      restrictions = {},
      onFileAdded,
      onFileRemoved,
      onValidationError
    } = options;
    if (!id || !target || !input) return null;
    if (instances.has(id)) {
      const previous = instances.get(id);
      try {
        if (previous == null ? void 0 : previous.uppy) {
          if (typeof previous.uppy.close === "function") {
            previous.uppy.close({ reason: "unmount" });
          } else if (typeof previous.uppy.destroy === "function") {
            previous.uppy.destroy();
          }
        }
      } catch (error) {
        console.warn("Failed to close previous Uppy instance", error);
      }
      instances.delete(id);
    }
    const uppy = new Uppy_default({
      autoProceed: false,
      allowMultipleUploads: false,
      restrictions: {
        maxNumberOfFiles: 1,
        allowedFileTypes: restrictions.allowedFileTypes || null,
        maxFileSize: (_a = restrictions.maxFileSize) != null ? _a : null
      }
    });
    const instance = {
      uppy,
      target,
      input,
      progressEl,
      barEl: (progressEl == null ? void 0 : progressEl.querySelector(".upload-progress__bar")) || null,
      labelEl: (progressEl == null ? void 0 : progressEl.querySelector(".upload-progress__label")) || null,
      currentFileId: null,
      bytesTotal: 0
    };
    instances.set(id, instance);
    const clearDragClass = () => target.classList.remove("dragover");
    uppy.use(DropTarget, {
      target,
      onDragOver: () => target.classList.add("dragover"),
      onDragLeave: clearDragClass,
      onDrop: clearDragClass
    });
    target.addEventListener("click", () => {
      if (!input.disabled) {
        input.click();
      }
    });
    input.addEventListener("change", (event) => {
      const files = Array.from(event.target.files || []);
      files.forEach((file) => {
        try {
          uppy.addFile({
            source: "vortex-prime-input",
            name: file.name,
            type: file.type,
            data: file
          });
        } catch (error) {
          console.error("Unable to add file to Uppy", error);
          toast == null ? void 0 : toast("Unable to add that file. Please try another file.", "error");
        }
      });
      input.value = "";
    });
    uppy.on("file-added", (file) => {
      var _a2, _b;
      instance.currentFileId = file.id;
      instance.bytesTotal = (_b = (_a2 = file.data) == null ? void 0 : _a2.size) != null ? _b : 0;
      resetProgress(id);
      onFileAdded == null ? void 0 : onFileAdded(file);
    });
    uppy.on("file-removed", (file) => {
      if (instance.currentFileId === file.id) {
        instance.currentFileId = null;
        instance.bytesTotal = 0;
      }
      resetProgress(id);
      onFileRemoved == null ? void 0 : onFileRemoved(file);
    });
    uppy.on("restriction-failed", (file, error) => {
      const message = (error == null ? void 0 : error.message) || "That file does not meet the upload rules.";
      toast == null ? void 0 : toast(message, "error");
      onValidationError == null ? void 0 : onValidationError(file, error);
    });
    return instance;
  }
  function getInstance(id) {
    return instances.get(id) || null;
  }
  function setUploading(id, uploading) {
    const instance = getInstance(id);
    if (!instance) return;
    instance.target.classList.toggle("upload-disabled", Boolean(uploading));
    instance.input.disabled = Boolean(uploading);
  }
  function resetProgress(id) {
    const instance = getInstance(id);
    if (!instance || !instance.progressEl) return;
    instance.progressEl.classList.remove("is-active");
    instance.progressEl.dataset.state = "";
    if (instance.barEl) instance.barEl.style.width = "0%";
    if (instance.labelEl) instance.labelEl.textContent = "Ready";
  }
  function updateProgress(id, { bytesUploaded, bytesTotal, message }) {
    const instance = getInstance(id);
    if (!instance || !instance.progressEl) return;
    if (bytesTotal && bytesTotal > 0) {
      instance.bytesTotal = bytesTotal;
    }
    const total = instance.bytesTotal || bytesTotal || 0;
    const uploaded = bytesUploaded != null ? bytesUploaded : 0;
    const percentage = toPercentage(uploaded, total);
    instance.progressEl.classList.add("is-active");
    instance.progressEl.dataset.state = "progress";
    if (instance.barEl) {
      instance.barEl.style.width = `${percentage}%`;
    }
    if (instance.labelEl) {
      instance.labelEl.textContent = message || `Uploading\u2026 ${percentage}%`;
    }
    if (instance.currentFileId) {
      const file = instance.uppy.getFile(instance.currentFileId);
      if (file) {
        instance.uppy.setFileState(instance.currentFileId, {
          progress: {
            uploadStarted: true,
            uploadComplete: percentage >= 100,
            percentage,
            bytesUploaded: uploaded,
            bytesTotal: total
          }
        });
        instance.uppy.emit("upload-progress", file, {
          bytesUploaded: uploaded,
          bytesTotal: total
        });
      }
    }
  }
  function markComplete(id, { message, bytesUploaded, bytesTotal } = {}) {
    var _a;
    const instance = getInstance(id);
    if (!instance || !instance.progressEl) return;
    instance.progressEl.classList.add("is-active");
    instance.progressEl.dataset.state = "complete";
    if (instance.barEl) instance.barEl.style.width = "100%";
    if (instance.labelEl) instance.labelEl.textContent = message || "Upload complete";
    if (instance.currentFileId) {
      const file = instance.uppy.getFile(instance.currentFileId);
      if (file) {
        const total = bytesTotal || instance.bytesTotal || ((_a = file.data) == null ? void 0 : _a.size) || 0;
        const uploaded = bytesUploaded || total;
        instance.uppy.setFileState(instance.currentFileId, {
          progress: {
            uploadStarted: true,
            uploadComplete: true,
            percentage: 100,
            bytesUploaded: uploaded,
            bytesTotal: total
          }
        });
        instance.uppy.emit("upload-success", file, { status: "ok" });
      }
    }
  }
  function markError(id, message) {
    const instance = getInstance(id);
    if (!instance || !instance.progressEl) return;
    instance.progressEl.classList.add("is-active");
    instance.progressEl.dataset.state = "error";
    if (instance.barEl) instance.barEl.style.width = "100%";
    if (instance.labelEl) instance.labelEl.textContent = message || "Upload failed";
    if (instance.currentFileId) {
      const file = instance.uppy.getFile(instance.currentFileId);
      if (file) {
        instance.uppy.emit("upload-error", file, new Error(message || "Upload failed"));
      }
    }
  }
  function destroyAll() {
    instances.forEach((instance) => {
      var _a, _b;
      try {
        if (typeof ((_a = instance.uppy) == null ? void 0 : _a.close) === "function") {
          instance.uppy.close({ reason: "destroy" });
        } else if (typeof ((_b = instance.uppy) == null ? void 0 : _b.destroy) === "function") {
          instance.uppy.destroy();
        }
      } catch (error) {
        console.warn("Failed to close Uppy instance", error);
      }
    });
    instances.clear();
  }
  return {
    mountField,
    setUploading,
    resetProgress,
    updateProgress,
    markComplete,
    markError,
    destroyAll,
    getInstance
  };
}

// src/admin/index.js
var VortexUploadAdapter = {
  uploadPackage,
  uploadMod,
  uploadImage,
  uploadReadme,
  saveStoreItem,
  deleteStoreItem,
  loadStoreItems,
  loadStoreMods,
  getBackendStatus
};
if (typeof window !== "undefined") {
  window.AdminBackend = portal_default;
  window.VortexUploadManager = { createUploadFieldManager };
  window.VortexUploadAdapter = VortexUploadAdapter;
  window.dispatchEvent(new CustomEvent("vortex-admin-portal-loaded"));
}
var AdminUploadAdapter = VortexUploadAdapter;
var index_default = portal_default;
export {
  AdminUploadAdapter,
  createUploadFieldManager,
  index_default as default,
  deleteStoreItem,
  getBackendStatus,
  loadStoreItems,
  loadStoreMods,
  saveStoreItem,
  uploadImage,
  uploadMod,
  uploadPackage,
  uploadReadme
};
/**
 * Takes a string with placeholder variables like `%{smart_count} file selected`
 * and replaces it with values from options `{smart_count: 5}`
 *
 * @license https://github.com/airbnb/polyglot.js/blob/master/LICENSE
 * taken from https://github.com/airbnb/polyglot.js/blob/master/lib/polyglot.js#L299
 *
 * @param phrase that needs interpolation, with placeholders
 * @param options with values that will be used to replace placeholders
 */
//# sourceMappingURL=admin-portal.js.map

import { decodeQuery, isAllowedHost, safeWindowOpen } from "../shared/security-utils.js";

const allowedHosts = new Set([
  "github.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  "archive.org",
  "reddit.com",
  "www.reddit.com",
]);

const params = new URLSearchParams(window.location.search);
const targetParam = params.get("to");

const card = document.getElementById("security-card");
const destinationHost = document.getElementById("destination-host");
const destinationUrl = document.getElementById("destination-url");
const continueBtn = document.getElementById("continue-btn");
const cancelBtn = document.getElementById("cancel-btn");
const errorTemplate = /** @type {HTMLTemplateElement} */ (document.getElementById("error-template"));

const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById("captcha-canvas"));
const input = /** @type {HTMLInputElement | null} */ (document.getElementById("challenge-input"));
const confirmBtn = document.getElementById("confirm-btn");
const refreshBtn = document.getElementById("refresh-btn");
const feedback = document.getElementById("challenge-feedback");

const methodCodeEl = document.getElementById("method-code");
const methodPictureEl = document.getElementById("method-picture");
const toggleMethodBtn = document.getElementById("toggle-method-btn");
const audioBtn = document.getElementById("audio-btn");

let resolvedTarget = null;
let activeCode = "";
let solved = false;
let currentMethod = "code";
let recaptchaWidgetId = null;

function renderError(message) {
  const fragment = errorTemplate.content.cloneNode(true);
  const errorCard = fragment.querySelector(".error-card");
  const messageEl = fragment.getElementById("error-message");
  const backBtn = fragment.getElementById("error-back");

  if (messageEl) messageEl.textContent = message;
  if (backBtn) backBtn.addEventListener("click", () => window.history.length > 1 ? window.history.back() : window.location.assign("/"));

  card?.replaceWith(errorCard);
}

function prepareDestination() {
  if (!targetParam) {
    renderError("Missing destination parameter.");
    return;
  }

  try {
    const decoded = decodeQuery(targetParam);
    const url = new URL(decoded);

    if (!isAllowedHost(url.hostname, allowedHosts)) {
      renderError("This destination hasn't been approved yet. Contact Vortex Prime maintainers to review the link.");
      return;
    }

    destinationHost.textContent = url.hostname;
    destinationUrl.textContent = url.href;
    resolvedTarget = url;
  } catch (error) {
    console.error("Failed to parse destination", error);
    renderError("The external link appears malformed. Please try again or contact support.");
  }
}

function resetVerification() {
  solved = false;
  if (continueBtn) continueBtn.disabled = true;

  if (feedback) {
    feedback.classList.remove("error", "success");
    if (currentMethod === "code") {
      feedback.textContent = "Enter the code shown above to continue.";
    } else {
      feedback.textContent = "Solve the reCAPTCHA challenge below to continue.";
    }
  }

  if (input) {
    input.value = "";
    input.disabled = false;
  }

  // Reset reCAPTCHA if rendered
  if (currentMethod === "picture" && window.grecaptcha && recaptchaWidgetId !== null) {
    try {
      window.grecaptcha.reset(recaptchaWidgetId);
    } catch (err) {
      console.error("Error resetting reCAPTCHA", err);
    }
  }

  if (confirmBtn) confirmBtn.disabled = false;
}

function loadRecaptchaScript(callback) {
  if (window.grecaptcha) {
    callback();
    return;
  }
  let script = document.querySelector('script[src*="recaptcha/api.js"]');
  if (!script) {
    script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.grecaptcha && window.grecaptcha.ready) {
        window.grecaptcha.ready(callback);
      } else {
        const interval = setInterval(() => {
          if (window.grecaptcha && window.grecaptcha.render) {
            clearInterval(interval);
            callback();
          }
        }, 100);
      }
    };
    script.onerror = () => {
      console.error("Failed to load Google reCAPTCHA.");
      if (feedback) {
        feedback.textContent = "Could not load Google reCAPTCHA. Check your ad blocker or connection.";
        feedback.classList.add("error");
      }
    };
    document.head.appendChild(script);
  } else {
    callback();
  }
}

function renderRecaptcha() {
  loadRecaptchaScript(() => {
    try {
      const widgetContainer = document.getElementById("recaptcha-widget");
      if (!widgetContainer) return;
      
      if (recaptchaWidgetId !== null) {
        window.grecaptcha.reset(recaptchaWidgetId);
        return;
      }

      recaptchaWidgetId = window.grecaptcha.render("recaptcha-widget", {
        sitekey: "6LfVJR0tAAAAAEl9GICb3-2sMXX0zmBWXtMegy8t",
        theme: "dark",
        callback: (response) => {
          solved = true;
          if (continueBtn) continueBtn.disabled = !resolvedTarget;
          if (feedback) {
            feedback.textContent = "Verification successful! You can now continue.";
            feedback.classList.remove("error");
            feedback.classList.add("success");
          }
          continueBtn?.focus({ preventScroll: true });
        },
        "expired-callback": () => {
          solved = false;
          if (continueBtn) continueBtn.disabled = true;
          if (feedback) {
            feedback.textContent = "Verification expired. Please solve the challenge again.";
            feedback.classList.remove("success");
            feedback.classList.add("error");
          }
        },
        "error-callback": () => {
          solved = false;
          if (continueBtn) continueBtn.disabled = true;
          if (feedback) {
            feedback.textContent = "An error occurred with reCAPTCHA. Please reload or switch methods.";
            feedback.classList.remove("success");
            feedback.classList.add("error");
          }
        }
      });
    } catch (err) {
      console.error("Error rendering reCAPTCHA", err);
    }
  });
}

function switchMethod(method) {
  if (currentMethod === method) return;
  currentMethod = method;

  if (method === "code") {
    if (methodCodeEl) methodCodeEl.style.display = "block";
    if (methodPictureEl) methodPictureEl.style.display = "none";
    if (toggleMethodBtn) toggleMethodBtn.textContent = "Prefer pictures? Use picture challenge";
    resetVerification();
    generateCode();
  } else {
    if (methodCodeEl) methodCodeEl.style.display = "none";
    if (methodPictureEl) methodPictureEl.style.display = "block";
    if (toggleMethodBtn) toggleMethodBtn.textContent = "Prefer code? Use code challenge";
    resetVerification();
    renderRecaptcha();
  }
}

function generateCode() {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const length = 5;
  let code = "";
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i += 1) {
      code += charset[bytes[i] % charset.length];
    }
  } else {
    for (let i = 0; i < length; i += 1) {
      const value = Math.floor(Math.random() * charset.length);
      code += charset[value];
    }
  }
  activeCode = code;
  solved = false;
  if (continueBtn) continueBtn.disabled = true;

  drawCaptcha(code);

  if (feedback) {
    feedback.textContent = "Enter the code shown above to continue.";
    feedback.classList.remove("error", "success");
  }
  if (input) {
    input.value = "";
    input.disabled = false;
    input.focus({ preventScroll: true });
  }
  if (confirmBtn) confirmBtn.disabled = false;
}

/**
 * Draws the CAPTCHA text on the canvas with a high-contrast black/white BotDetect style.
 * @param {string} code 
 */
function drawCaptcha(code) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // 1. Pure black background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  // 2. Draw white/grey background noise dots - 100 dots
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  for (let i = 0; i < 100; i += 1) {
    ctx.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5);
  }

  // 3. Draw background curves/arcs (BotDetect style curved lines)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.bezierCurveTo(
      Math.random() * width, Math.random() * height,
      Math.random() * width, Math.random() * height,
      Math.random() * width, Math.random() * height
    );
    ctx.stroke();
  }

  // 4. Draw large white warped characters
  ctx.textBaseline = "middle";
  const fonts = [
    "bold 40px Georgia, serif",
    "bold 42px 'Times New Roman', serif",
    "bold 38px Garamond, serif",
    "bold 40px 'Courier New', monospace"
  ];
  
  for (let i = 0; i < code.length; i += 1) {
    const char = code[i];
    const font = fonts[Math.floor(Math.random() * fonts.length)];
    ctx.font = font;

    // Distribute 5 characters across the 280px canvas (each character block is ~48px)
    const charX = 20 + i * 48 + (Math.random() * 8 - 4);
    const charY = height / 2 + (Math.random() * 10 - 5);

    // Subtle rotation (between -18 and 18 degrees) to keep it readable
    const angle = (Math.random() * 36 - 18) * Math.PI / 180;
    // Skewing
    const skewX = (Math.random() * 20 - 10) * Math.PI / 180;

    ctx.save();
    ctx.translate(charX, charY);
    ctx.rotate(angle);
    ctx.transform(1, 0, Math.tan(skewX), 1, 0, 0);

    // Pure white characters with a distinct dark shadow for a 3D embossed look
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Compressing characters horizontally to look stretched (max width 35px)
    ctx.fillText(char, 0, 0, 35);
    ctx.restore();
  }

  // 5. Draw foreground curves overlapping the text - 3 lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.bezierCurveTo(
      Math.random() * width, Math.random() * height,
      Math.random() * width, Math.random() * height,
      Math.random() * width, Math.random() * height
    );
    ctx.stroke();
  }

  // 6. Draw foreground noise dots - 40 dots
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  for (let i = 0; i < 40; i += 1) {
    ctx.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5);
  }
}

function speakCaptchaCode() {
  if (!activeCode) return;
  try {
    if (!('speechSynthesis' in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    
    const spelledOut = activeCode.split("").map(char => char.toUpperCase()).join(", ");
    const utterance = new SpeechSynthesisUtterance("Verification code: " + spelledOut);
    utterance.rate = 0.75;
    utterance.pitch = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(voice => voice.lang.toLowerCase().startsWith("en"));
    if (enVoice) {
      utterance.voice = enVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error("Audio spelling failed", err);
  }
}

function attachChallengeHandlers() {
  confirmBtn?.addEventListener("click", () => {
    if (!input) return;
    const guess = input.value.trim();
    if (!guess) {
      if (feedback) {
        feedback.textContent = "Please enter the code shown above.";
        feedback.classList.remove("success");
        feedback.classList.add("error");
      }
      return;
    }

    if (guess.toLowerCase() === activeCode.toLowerCase()) {
      solved = true;
      if (continueBtn) continueBtn.disabled = !resolvedTarget;
      if (feedback) {
        feedback.textContent = "Verification successful! You can now continue.";
        feedback.classList.remove("error");
        feedback.classList.add("success");
      }
      if (input) input.disabled = true;
      if (confirmBtn) confirmBtn.disabled = true;
      continueBtn?.focus({ preventScroll: true });
    } else {
      solved = false;
      if (continueBtn) continueBtn.disabled = true;
      if (feedback) {
        feedback.textContent = "Incorrect code. Please try again.";
        feedback.classList.remove("success");
        feedback.classList.add("error");
      }
      
      const wrapper = document.querySelector(".canvas-wrapper");
      if (wrapper) {
        wrapper.style.animation = "none";
        void wrapper.offsetWidth;
        wrapper.style.animation = "recaptcha-shake 0.35s ease-in-out";
      }

      generateCode();
    }
  });

  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      confirmBtn?.click();
    }
  });

  refreshBtn?.addEventListener("click", () => {
    generateCode();
  });

  audioBtn?.addEventListener("click", () => {
    speakCaptchaCode();
  });

  toggleMethodBtn?.addEventListener("click", () => {
    if (currentMethod === "code") {
      switchMethod("picture");
    } else {
      switchMethod("code");
    }
  });
}

function attachActions() {
  continueBtn?.addEventListener("click", () => {
    if (!resolvedTarget || !solved) return;
    safeWindowOpen(resolvedTarget);
    window.location.assign(resolvedTarget.href);
  });

  cancelBtn?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.assign("/");
    }
  });
}

prepareDestination();
generateCode();
attachChallengeHandlers();
attachActions();

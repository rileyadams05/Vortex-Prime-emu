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

let resolvedTarget = null;
let activeCode = "";
let solved = false;

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

function generateCode() {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const length = 6;
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
 * Draws the CAPTCHA text on the canvas with security noise lines and warping.
 * @param {string} code 
 */
function drawCaptcha(code) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // 1. Draw background gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "#050914");
  grad.addColorStop(1, "#11162b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 2. Draw noise dots (in background)
  for (let i = 0; i < 35; i += 1) {
    ctx.fillStyle = `rgba(85, 150, 255, ${0.1 + Math.random() * 0.25})`;
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 1 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Draw text characters with random font, size, rotation, and color
  ctx.textBaseline = "middle";
  const fonts = ["bold 26px Space Grotesk", "bold 28px JetBrains Mono", "bold 26px Georgia", "bold 30px Impact", "bold 28px Courier New", "bold 28px Arial Black"];
  
  for (let i = 0; i < code.length; i += 1) {
    const char = code[i];
    const font = fonts[Math.floor(Math.random() * fonts.length)];
    ctx.font = font;

    // Center each character in its block (each char gets approx 40px of width)
    const charX = 25 + i * 40 + (Math.random() * 8 - 4);
    const charY = height / 2 + (Math.random() * 14 - 7);

    // Random rotation between -20 and 20 degrees
    const angle = (Math.random() * 40 - 20) * Math.PI / 180;
    // Random skew
    const skewX = (Math.random() * 20 - 10) * Math.PI / 180;

    // Save context state, apply transforms, draw text, restore
    ctx.save();
    ctx.translate(charX, charY);
    ctx.rotate(angle);
    ctx.transform(1, 0, Math.tan(skewX), 1, 0, 0);

    // Dynamic blue/silver color match
    const light = 55 + Math.floor(Math.random() * 30); // 55% - 85%
    ctx.fillStyle = `hsl(215, 85%, ${light}%)`;
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 4;

    ctx.fillText(char, 0, 0);
    ctx.restore();
  }

  // 4. Draw noise lines (in foreground overlapping the text)
  for (let i = 0; i < 5; i += 1) {
    ctx.strokeStyle = `rgba(85, 150, 255, ${0.2 + Math.random() * 0.35})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.lineTo(Math.random() * width, Math.random() * height);
    ctx.stroke();
  }

  // 5. Draw overlay grids
  ctx.strokeStyle = "rgba(85, 150, 255, 0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 20; x < width; x += 25) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 15; y < height; y += 20) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
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

    if (guess === activeCode) {
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
      
      // Animate shake on card to signify error
      const wrapper = document.querySelector(".canvas-wrapper");
      if (wrapper) {
        wrapper.style.animation = "none";
        void wrapper.offsetWidth; // Trigger reflow
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

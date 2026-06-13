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
const confirmPicBtn = document.getElementById("confirm-pic-btn");
const refreshPicBtn = document.getElementById("refresh-pic-btn");
const pictureGrid = document.getElementById("picture-grid");
const audioBtn = document.getElementById("audio-btn");

let resolvedTarget = null;
let activeCode = "";
let solved = false;
let currentMethod = "code";
let targetIndices = [];
let selectedIndices = new Set();
let lockIconSrc = "/assets/locked.png";

// Resolve lock icon source dynamically from the badge lock icon
const badgeImg = document.querySelector(".badge img");
if (badgeImg) {
  const src = badgeImg.getAttribute("src");
  if (src) lockIconSrc = src;
}

// Decoy SVGs
const decoySvgs = [
  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>`, // key
  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>`, // shield
  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>`, // bell
  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`, // star
  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>`, // cloud
  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>` // heart
];

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
      feedback.textContent = "Select all squares with Lock Icons to continue.";
    }
  }

  if (input) {
    input.value = "";
    input.disabled = false;
  }

  // Clear selections in picture grid
  selectedIndices.clear();
  const tiles = document.querySelectorAll(".picture-tile");
  tiles.forEach(tile => tile.classList.remove("selected"));

  // Ensure confirm buttons are enabled
  if (confirmBtn) confirmBtn.disabled = false;
  if (confirmPicBtn) confirmPicBtn.disabled = false;
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
    generatePictureChallenge();
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
    // Stop any ongoing speech
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

function generatePictureChallenge() {
  selectedIndices.clear();
  solved = false;
  if (continueBtn) continueBtn.disabled = true;

  if (feedback) {
    feedback.textContent = "Select all squares with Lock Icons to continue.";
    feedback.classList.remove("error", "success");
  }

  if (pictureGrid) {
    pictureGrid.innerHTML = "";
    
    // Choose 2 to 4 random target indexes (out of 9)
    const numTargets = Math.floor(Math.random() * 3) + 2; // 2, 3, or 4
    targetIndices = [];
    while (targetIndices.length < numTargets) {
      const idx = Math.floor(Math.random() * 9);
      if (!targetIndices.includes(idx)) {
        targetIndices.push(idx);
      }
    }

    for (let i = 0; i < 9; i++) {
      const tile = document.createElement("div");
      tile.className = "picture-tile";
      tile.dataset.index = i;

      if (targetIndices.includes(i)) {
        const img = document.createElement("img");
        img.src = lockIconSrc;
        img.alt = "Lock Icon";
        img.onerror = () => {
          img.style.display = "none";
          tile.innerHTML += `<svg viewBox="0 0 24 24" fill="currentColor" style="color: var(--accent);"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`;
        };
        tile.appendChild(img);
      } else {
        const randomDecoy = decoySvgs[Math.floor(Math.random() * decoySvgs.length)];
        tile.innerHTML = randomDecoy;
        const svg = tile.querySelector("svg");
        if (svg) {
          svg.style.color = "var(--text-muted)";
          svg.style.opacity = "0.65";
        }
      }

      tile.addEventListener("click", () => {
        if (solved) return;
        const idx = parseInt(tile.dataset.index, 10);
        if (selectedIndices.has(idx)) {
          selectedIndices.delete(idx);
          tile.classList.remove("selected");
        } else {
          selectedIndices.add(idx);
          tile.classList.add("selected");
        }
      });

      pictureGrid.appendChild(tile);
    }
  }
}

function verifyPictureChallenge() {
  if (solved) return;

  let isCorrect = true;
  if (selectedIndices.size !== targetIndices.length) {
    isCorrect = false;
  } else {
    for (const idx of targetIndices) {
      if (!selectedIndices.has(idx)) {
        isCorrect = false;
        break;
      }
    }
  }

  if (isCorrect) {
    solved = true;
    if (continueBtn) continueBtn.disabled = !resolvedTarget;
    if (feedback) {
      feedback.textContent = "Verification successful! You can now continue.";
      feedback.classList.remove("error");
      feedback.classList.add("success");
    }
    if (confirmPicBtn) confirmPicBtn.disabled = true;
    continueBtn?.focus({ preventScroll: true });
  } else {
    solved = false;
    if (continueBtn) continueBtn.disabled = true;
    if (feedback) {
      feedback.textContent = "Incorrect selection. Please try again.";
      feedback.classList.remove("success");
      feedback.classList.add("error");
    }

    if (pictureGrid) {
      pictureGrid.style.animation = "none";
      void pictureGrid.offsetWidth;
      pictureGrid.style.animation = "recaptcha-shake 0.35s ease-in-out";
    }

    const tiles = document.querySelectorAll(".picture-tile");
    tiles.forEach(tile => tile.style.pointerEvents = "none");

    setTimeout(() => {
      generatePictureChallenge();
    }, 1000);
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

  confirmPicBtn?.addEventListener("click", () => {
    verifyPictureChallenge();
  });

  refreshPicBtn?.addEventListener("click", () => {
    generatePictureChallenge();
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

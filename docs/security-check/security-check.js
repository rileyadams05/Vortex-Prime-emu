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

const codeOutput = document.getElementById("challenge-code");
const input = /** @type {HTMLInputElement | null} */ (document.getElementById("challenge-input"));
const confirmBtn = document.getElementById("confirm-btn");
const feedback = document.getElementById("challenge-feedback");
const refreshBtn = document.getElementById("refresh-btn");

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
  // Mixed-case alphanumeric characters excluding ambiguous ones (O, 0, I, l, 1)
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
  continueBtn.disabled = true;
  
  if (codeOutput) {
    codeOutput.innerHTML = "";
    for (let i = 0; i < code.length; i += 1) {
      const span = document.createElement("span");
      span.textContent = code[i];
      
      // Random rotation between -22 and 22 degrees
      const rot = Math.floor(Math.random() * 44) - 22;
      // Random vertical translation between -7px and 7px
      const transY = Math.floor(Math.random() * 14) - 7;
      // Random skew X between -12 and 12 degrees
      const skewX = Math.floor(Math.random() * 24) - 12;
      // Random scale between 0.85 and 1.25
      const scale = 0.85 + Math.random() * 0.4;
      
      const fonts = ["Space Grotesk", "JetBrains Mono", "Courier New", "Georgia", "Impact", "Arial Black"];
      const randomFont = fonts[Math.floor(Math.random() * fonts.length)];
      
      span.style.transform = `translateY(${transY}px) rotate(${rot}deg) skewX(${skewX}deg) scale(${scale})`;
      span.style.fontFamily = randomFont;
      
      // Randomized color brightness matching the theme
      const light = 60 + Math.floor(Math.random() * 25);
      span.style.color = `hsl(142, 85%, ${light}%)`;
      
      codeOutput.appendChild(span);
    }
  }

  // Draw random noise lines and circles in SVG overlay
  const svg = document.querySelector(".captcha-noise-lines");
  if (svg) {
    svg.innerHTML = "";
    // Draw random line paths across the text
    const lineCount = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < lineCount; i += 1) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", `${Math.random() * 100}%`);
      line.setAttribute("y1", `${Math.random() * 100}%`);
      line.setAttribute("x2", `${Math.random() * 100}%`);
      line.setAttribute("y2", `${Math.random() * 100}%`);
      line.setAttribute("stroke", `rgba(60, 232, 130, ${0.22 + Math.random() * 0.35})`);
      line.setAttribute("stroke-width", `${1.2 + Math.random() * 2}`);
      svg.appendChild(line);
    }
    // Draw dots
    const dotCount = 25 + Math.floor(Math.random() * 20);
    for (let i = 0; i < dotCount; i += 1) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", `${Math.random() * 100}%`);
      circle.setAttribute("cy", `${Math.random() * 100}%`);
      circle.setAttribute("r", `${1 + Math.random() * 2}`);
      circle.setAttribute("fill", `rgba(60, 232, 130, ${0.12 + Math.random() * 0.3})`);
      svg.appendChild(circle);
    }
  }

  if (feedback) {
    feedback.textContent = "Enter the code shown above to continue.";
    feedback.classList.remove("error", "success");
  }
  if (input) {
    input.value = "";
    input.placeholder = "Enter captcha (case-sensitive)";
    input.focus({ preventScroll: true });
  }
}

function attachChallengeHandlers() {
  confirmBtn?.addEventListener("click", () => {
    if (!input) return;
    const guess = input.value.trim();
    if (!guess) {
      feedback?.classList.remove("success");
      feedback?.classList.add("error");
      if (feedback) feedback.textContent = "Please enter the code shown above.";
      return;
    }

    if (guess === activeCode) {
      solved = true;
      continueBtn.disabled = !resolvedTarget;
      feedback?.classList.remove("error");
      feedback?.classList.add("success");
      if (feedback) feedback.textContent = "Code accepted! You can continue.";
      continueBtn.focus({ preventScroll: true });
    } else {
      solved = false;
      continueBtn.disabled = true;
      feedback?.classList.remove("success");
      feedback?.classList.add("error");
      if (feedback) feedback.textContent = "Incorrect code. Try again.";
      input.select();
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
  continueBtn.addEventListener("click", () => {
    if (!resolvedTarget || !solved) return;
    safeWindowOpen(resolvedTarget);
    window.location.assign(resolvedTarget.href);
  });

  cancelBtn.addEventListener("click", () => {
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

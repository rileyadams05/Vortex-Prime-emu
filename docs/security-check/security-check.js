import { decodeQuery, isAllowedHost, safeWindowOpen } from "../shared/security-utils.js";

const allowedHosts = new Set([
  "github.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  "archive.org",
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
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const length = 5;
  let code = "";
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(new Uint8Array(length)).forEach((value) => {
      code += charset[value % charset.length];
    });
  } else {
    for (let i = 0; i < length; i += 1) {
      const value = Math.floor(Math.random() * charset.length);
      code += charset[value];
    }
  }
  activeCode = code;
  solved = false;
  continueBtn.disabled = true;
  if (codeOutput) codeOutput.textContent = code;
  if (feedback) {
    feedback.textContent = "Enter the code shown above to continue.";
    feedback.classList.remove("error", "success");
  }
  if (input) {
    input.value = "";
    input.focus({ preventScroll: true });
  }
}

function attachChallengeHandlers() {
  confirmBtn?.addEventListener("click", () => {
    if (!input) return;
    const guess = input.value.trim().toUpperCase();
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

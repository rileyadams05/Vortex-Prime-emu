const allowedHosts = new Set([
  "github.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  "archive.org",
  "reddit.com",
  "www.reddit.com",
]);

const hostLabel = document.getElementById("destination-host");
const continueButton = document.getElementById("continue-btn");
const cancelButton = document.getElementById("cancel-btn");
const feedback = document.getElementById("error");
let target = null;

try {
  const candidate = new URL(new URLSearchParams(window.location.search).get("to") || "");
  if (candidate.protocol !== "https:" || !allowedHosts.has(candidate.hostname.toLowerCase())) {
    throw new Error("This destination is not on the approved external-link list.");
  }
  target = candidate;
  hostLabel.textContent = candidate.hostname;
  continueButton.disabled = false;
  continueButton.addEventListener("click", () => {
    if (target) window.location.assign(target.href);
  });
} catch (error) {
  hostLabel.textContent = "Link unavailable";
  if (feedback) {
    feedback.textContent = error.message || "The destination link is invalid.";
    feedback.hidden = false;
  }
}

cancelButton.addEventListener("click", () => {
  if (window.history.length > 1) window.history.back();
  else window.location.assign("/");
});

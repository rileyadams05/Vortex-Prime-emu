const INSTALLER_VERSION = '0.7.0';
const BGFT_URL = '/bgft/';

const installButton = document.getElementById('bgftInstallButton');
const installer = document.getElementById('bgftPwaInstall');
const choiceDialog = document.getElementById('bgftInstallChoice');
const choiceHeading = document.getElementById('bgftInstallChoiceHeading');
const choiceDescription = choiceDialog?.querySelector('.fpkg-release-dialog__header p');
const appChoice = document.getElementById('bgftOpenInstalledApp');
const browserChoice = document.getElementById('bgftOpenInBrowser');

if (installButton && installer && choiceDialog) {
  installButton.disabled = true;
  installButton.setAttribute('aria-busy', 'true');

  const showChoice = ({ installed, failed = false } = {}) => {
    if (installed) {
      choiceHeading.textContent = 'BGFT is installed';
      choiceDescription.textContent = 'Choose how you want to continue.';
      appChoice.hidden = false;
      browserChoice.hidden = false;
    } else if (failed) {
      choiceHeading.textContent = 'BGFT could not be installed';
      choiceDescription.textContent = 'You can still open BGFT in your browser.';
      appChoice.hidden = true;
      browserChoice.hidden = false;
      browserChoice.textContent = 'Continue in Browser';
    } else {
      choiceHeading.textContent = 'Continue with BGFT';
      choiceDescription.textContent = 'You can use BGFT in your browser without installing it.';
      appChoice.hidden = true;
      browserChoice.hidden = false;
      browserChoice.textContent = 'Open BGFT in Browser';
    }

    if (!choiceDialog.open) choiceDialog.showModal();
  };

  const onInstallReady = () => {
    clearTimeout(componentReadinessTimer);
    installButton.disabled = false;
    installButton.removeAttribute('aria-busy');
    delete installButton.dataset.installFallback;
    installer.styles = { '--tint-color': '#20d9a0' };
  };

  const enableBrowserFallback = () => {
    if (customElements.get('pwa-install')) return;
    installButton.disabled = false;
    installButton.removeAttribute('aria-busy');
    installButton.dataset.installFallback = 'true';
  };

  const componentReadinessTimer = setTimeout(enableBrowserFallback, 4000);
  customElements.whenDefined('pwa-install').then(onInstallReady);

  const componentScript = document.querySelector('script[src="/assets/vendor/pwa-install-0.7.0.es.js"]');
  componentScript?.addEventListener('error', enableBrowserFallback, { once: true });

  installButton.addEventListener('click', () => {
    if (installButton.dataset.installFallback === 'true' || typeof installer.install !== 'function') {
      window.location.assign(`${BGFT_URL}?install=1`);
      return;
    }

    if (installer.isRelatedAppsInstalled === true) {
      showChoice({ installed: true });
      return;
    }

    // A legacy beforeinstallprompt belongs to the Vortex Prime root manifest.
    // Only the newer Web Install API can install BGFT's separate manifest from
    // this page. Other browsers must continue at BGFT's own in-scope URL.
    if (installer.isWebInstallSupported !== true) {
      window.location.assign(`${BGFT_URL}?install=1`);
      return;
    }

    // Call synchronously from the click so browser user activation is retained.
    try {
      const installAttempt = installer.install();
      if (installAttempt && typeof installAttempt.catch === 'function') {
        installAttempt.catch(() => showChoice({ failed: true }));
      }
    } catch {
      showChoice({ failed: true });
    }
  });

  installer.addEventListener('pwa-install-success-event', () => showChoice({ installed: true }));
  installer.addEventListener('pwa-install-fail-event', () => showChoice({ failed: true }));
  installer.addEventListener('pwa-user-choice-result-event', event => {
    const result = event.detail?.userChoiceResult ?? installer.userChoiceResult;
    if (result === 'dismissed') showChoice();
  });

  choiceDialog.querySelectorAll('[data-bgft-choice-close]').forEach(button => {
    button.addEventListener('click', () => choiceDialog.close());
  });

  choiceDialog.addEventListener('click', event => {
    if (event.target === choiceDialog) choiceDialog.close();
  });
}

// Keep the pinned version visible to diagnostics and regression checks.
document.documentElement.dataset.bgftPwaInstaller = INSTALLER_VERSION;


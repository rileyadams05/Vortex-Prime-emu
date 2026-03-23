const { app, BrowserWindow, shell, globalShortcut } = require('electron');
const path = require('path');

let mainWindow;

const DASHBOARD_URL = process.env.VORTEX_DASHBOARD_URL || 'https://vortex-prime-emu.com/dashboard/';
const ENABLE_REACT_CONSOLE = process.env.ENABLE_REACT_CONSOLE !== '0';

const IN_APP_URL_PREFIXES = [
  'https://vortex-prime-emu.com/dashboard',
  'http://localhost:3000',
  'http://localhost:3005',
  'http://localhost:8000'
];

const OAUTH_URL_PREFIXES = [
  'https://discord.com/oauth2/',
  'https://discordapp.com/oauth2/'
];

const isInAppUrl = (url = '') => IN_APP_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
const isOAuthUrl = (url = '') => OAUTH_URL_PREFIXES.some((prefix) => url.startsWith(prefix));

const buildDashboardUrl = () => {
  const url = new URL(DASHBOARD_URL);
  url.searchParams.set('desktop_app', '1');
  url.searchParams.set('v', String(Date.now()));
  return url.toString();
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    autoHideMenuBar: true,
    title: 'Vortex Prime - Multi-Emulator Dashboard'
  });

  const targetUrl = buildDashboardUrl();
  mainWindow.webContents.session.clearCache()
    .catch(() => {})
    .finally(() => {
      mainWindow.loadURL(targetUrl);
    });

  if (ENABLE_REACT_CONSOLE) {
    mainWindow.webContents.openDevTools({ mode: 'right' });
  }

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelMap = ['log', 'warning', 'error', 'info', 'debug'];
    const label = levelMap[level] || 'log';
    console.log(`[renderer:${label}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isInAppUrl(url) || isOAuthUrl(url)) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    const key = (input.key || '').toUpperCase();
    if (key === 'F12' || ((input.control || input.meta) && input.shift && key === 'I')) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // Handle navigation - keep users in the app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isInAppUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.on('ready', () => {
  createWindow();

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  globalShortcut.register('F12', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Handle app errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

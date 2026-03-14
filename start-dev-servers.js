const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Suppress all console output except critical errors
const originalConsoleLog = console.log;
console.log = () => {};

function waitForServer(port, maxAttempts = 30) {
  return new Promise((resolve) => {
    let attempts = 0;
    const checkServer = () => {
      attempts++;
      const req = http.get(`http://localhost:${port}`, () => {
        resolve(true);
      });
      req.on('error', () => {
        if (attempts < maxAttempts) {
          setTimeout(checkServer, 1000);
        } else {
          resolve(false);
        }
      });
      req.end();
    };
    checkServer();
  });
}

async function startServers() {
  // Verify backend directory exists
  const backendPath = path.join(__dirname, 'backend');
  const frontendPath = path.join(__dirname, 'frontend');

  if (!fs.existsSync(backendPath)) {
    originalConsoleLog('ERROR: backend directory not found');
    process.exit(1);
  }

  if (!fs.existsSync(frontendPath)) {
    originalConsoleLog('ERROR: frontend directory not found');
    process.exit(1);
  }

  // Start backend server completely hidden
  const backendProcess = spawn('python', ['-m', 'uvicorn', 'server:app', '--host', '0.0.0.0', '--port', '8000', '--log-level', 'error'], {
    cwd: backendPath,
    shell: true,
    stdio: 'ignore',
    windowsHide: true
  });

  backendProcess.on('error', (err) => {
    originalConsoleLog('ERROR: Failed to start backend:', err.message);
    process.exit(1);
  });

  // Wait for backend to be ready
  const backendReady = await waitForServer(8000);
  if (!backendReady) {
    originalConsoleLog('ERROR: Backend failed to start on port 8000');
    backendProcess.kill();
    process.exit(1);
  }

  originalConsoleLog('✅ Backend server started on http://localhost:8000');
  originalConsoleLog('📝 API Configuration: /api/config/external-apis');

  // Start frontend server (explicitly use npm.cmd on Windows to avoid .ps1 file association issues)
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  const frontendProcess = spawn(npmCmd, ['start'], {
    cwd: frontendPath,
    shell: isWindows,
    stdio: 'inherit',
    env: { 
      ...process.env, 
      BROWSER: 'none',
      SKIP_PREFLIGHT_CHECK: 'true',
      REACT_APP_BROWSER: 'none'
    }
  });

  frontendProcess.on('error', (err) => {
    originalConsoleLog('ERROR: Failed to start frontend:', err.message);
    backendProcess.kill();
    process.exit(1);
  });

  // Handle cleanup on exit
  const cleanup = () => {
    try {
      if (!backendProcess.killed) backendProcess.kill('SIGTERM');
      if (!frontendProcess.killed) frontendProcess.kill('SIGTERM');
    } catch (e) {
      // Ignore cleanup errors
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);
  process.on('uncaughtException', cleanup);
}

startServers().catch((err) => {
  originalConsoleLog('ERROR: Server startup failed:', err.message);
  process.exit(1);
});

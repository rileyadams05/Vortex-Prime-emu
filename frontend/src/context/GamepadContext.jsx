import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

/*
 * GamepadProvider - Professional React Context for Xbox Controller Input
 * 
 * Uses the W3C Gamepad API (MDN standard) with requestAnimationFrame polling.
 * Provides real-time button/axis state to any consuming component via useGamepad().
 *
 * Standard Gamepad Button Layout (Xbox):
 *  0: A     1: B     2: X     3: Y
 *  4: LB    5: RB    6: LT    7: RT
 *  8: Back  9: Start 10: LS   11: RS
 * 12: Up   13: Down  14: Left 15: Right
 * 16: Guide/Home
 *
 * Axes: 0: LX  1: LY  2: RX  3: RY
 */

const GamepadContext = createContext(null);

// Deadzone for analog sticks
const DEADZONE = 0.4;

// Button name mapping for readability
const BUTTON_NAMES = {
  0: 'a', 1: 'b', 2: 'x', 3: 'y',
  4: 'lb', 5: 'rb', 6: 'lt', 7: 'rt',
  8: 'back', 9: 'start', 10: 'ls', 11: 'rs',
  12: 'dpadUp', 13: 'dpadDown', 14: 'dpadLeft', 15: 'dpadRight',
  16: 'guide',
};

export function GamepadProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [controllerName, setControllerName] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState('connected');
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugState, setDebugState] = useState(null);

  // Refs for polling state (avoid re-renders during polling)
  const rafRef = useRef(null);
  const buttonsRef = useRef({});
  const axesRef = useRef({ lx: 0, ly: 0, rx: 0, ry: 0 });
  const prevButtonsRef = useRef({});
  const listenersRef = useRef(new Map());
  const listenerIdRef = useRef(0);
  const notifTimerRef = useRef(null);
  const connectedRef = useRef(false);

  const showNotif = useCallback((msg, type) => {
    setNotifMessage(msg);
    setNotifType(type);
    setShowNotification(true);
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => setShowNotification(false), 4000);
  }, []);

  // Register a button listener. Returns an unsubscribe function.
  const subscribe = useCallback((callback) => {
    const id = listenerIdRef.current++;
    listenersRef.current.set(id, callback);
    return () => listenersRef.current.delete(id);
  }, []);

  // Notify all subscribers of a button event
  const notifyListeners = useCallback((event) => {
    listenersRef.current.forEach((cb) => {
      try { cb(event); } catch (e) { /* silent */ }
    });
  }, []);

  // Main polling loop
  useEffect(() => {
    const onConnected = (e) => {
      const name = e.gamepad.id.split('(')[0].trim() || 'Controller';
      setConnected(true);
      setControllerName(name);
      connectedRef.current = true;
      showNotif(`${name} connected`, 'connected');
      console.log('[Gamepad] Connected:', e.gamepad.id, 'index:', e.gamepad.index);
    };

    const onDisconnected = (e) => {
      const name = e.gamepad.id.split('(')[0].trim() || 'Controller';
      setConnected(false);
      connectedRef.current = false;
      showNotif(`${name} disconnected`, 'disconnected');
      console.log('[Gamepad] Disconnected:', e.gamepad.id);
    };

    window.addEventListener('gamepadconnected', onConnected);
    window.addEventListener('gamepaddisconnected', onDisconnected);

    // Check if already connected on mount
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) {
          const name = pads[i].id.split('(')[0].trim() || 'Controller';
          setConnected(true);
          setControllerName(name);
          connectedRef.current = true;
          break;
        }
      }
    } catch (e) { /* Gamepad API not available */ }

    const poll = () => {
      let gp = null;
      try {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < 4; i++) {
          if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
        }
      } catch (e) {
        rafRef.current = requestAnimationFrame(poll);
        return;
      }

      if (gp) {
        if (!connectedRef.current) {
          connectedRef.current = true;
          const name = gp.id.split('(')[0].trim() || 'Controller';
          setConnected(true);
          setControllerName(name);
        }

        // Read all buttons
        const newButtons = {};
        for (let i = 0; i < gp.buttons.length && i <= 16; i++) {
          const name = BUTTON_NAMES[i] || `btn${i}`;
          newButtons[name] = gp.buttons[i]?.pressed || false;
        }

        // Left stick as virtual D-pad
        const lx = gp.axes[0] || 0;
        const ly = gp.axes[1] || 0;
        const rx = gp.axes[2] || 0;
        const ry = gp.axes[3] || 0;

        newButtons['stickUp'] = ly < -DEADZONE;
        newButtons['stickDown'] = ly > DEADZONE;
        newButtons['stickLeft'] = lx < -DEADZONE;
        newButtons['stickRight'] = lx > DEADZONE;

        axesRef.current = { lx, ly, rx, ry };

        // Edge detection: fire events on press (not hold)
        const prev = prevButtonsRef.current;
        Object.keys(newButtons).forEach((name) => {
          if (newButtons[name] && !prev[name]) {
            // Button just pressed
            notifyListeners({ type: 'press', button: name });
          }
          if (!newButtons[name] && prev[name]) {
            // Button just released
            notifyListeners({ type: 'release', button: name });
          }
        });

        buttonsRef.current = newButtons;
        prevButtonsRef.current = { ...newButtons };

        // Update debug state periodically (throttled)
        if (debugVisible) {
          setDebugState({
            buttons: { ...newButtons },
            axes: { lx: lx.toFixed(2), ly: ly.toFixed(2), rx: rx.toFixed(2), ry: ry.toFixed(2) },
          });
        }
      }

      rafRef.current = requestAnimationFrame(poll);
    };

    rafRef.current = requestAnimationFrame(poll);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('gamepadconnected', onConnected);
      window.removeEventListener('gamepaddisconnected', onDisconnected);
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    };
  }, [showNotif, notifyListeners, debugVisible]);

  const value = {
    connected,
    controllerName,
    subscribe,
    buttons: buttonsRef,
    axes: axesRef,
    debugVisible,
    setDebugVisible,
  };

  return (
    <GamepadContext.Provider value={value}>
      {children}

      {/* Controller connection notification */}
      {showNotification && (
        <div
          data-testid="controller-notification"
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 24px',
            borderRadius: 8,
            fontFamily: "'MC360', 'Segoe UI', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            background: notifType === 'connected'
              ? 'linear-gradient(135deg, #2d7a2d, #1a5c1a)'
              : 'linear-gradient(135deg, #7a2d2d, #5c1a1a)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            animation: 'notifSlideUp 0.3s ease-out',
          }}
        >
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: notifType === 'connected' ? '#5eff5e' : '#ff5e5e',
            boxShadow: notifType === 'connected' ? '0 0 8px #5eff5e' : '0 0 8px #ff5e5e',
          }} />
          {notifMessage}
        </div>
      )}

      {/* Debug overlay (toggle with F12 or programmatically) */}
      {debugVisible && debugState && (
        <div
          data-testid="gamepad-debug"
          style={{
            position: 'fixed',
            top: 10,
            left: 10,
            zIndex: 99999,
            padding: 12,
            background: 'rgba(0,0,0,0.9)',
            color: '#0f0',
            fontFamily: 'monospace',
            fontSize: 11,
            borderRadius: 6,
            maxWidth: 300,
            lineHeight: 1.6,
          }}
        >
          <div style={{ color: '#ff0', marginBottom: 4 }}>GAMEPAD DEBUG</div>
          <div>Connected: {connected ? 'YES' : 'NO'}</div>
          <div>Name: {controllerName || 'None'}</div>
          <div style={{ marginTop: 4, color: '#0ff' }}>Buttons:</div>
          {debugState.buttons && Object.entries(debugState.buttons).map(([k, v]) => (
            v ? <span key={k} style={{ color: '#0f0', marginRight: 6 }}>[{k}]</span> : null
          ))}
          <div style={{ marginTop: 4, color: '#0ff' }}>Axes:</div>
          <div>LX:{debugState.axes.lx} LY:{debugState.axes.ly} RX:{debugState.axes.rx} RY:{debugState.axes.ry}</div>
        </div>
      )}

      <style>{`
        @keyframes notifSlideUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </GamepadContext.Provider>
  );
}

/*
 * useGamepad() - Hook for consuming gamepad input in any component.
 * 
 * Usage:
 *   const { connected, onPress } = useGamepad();
 *   
 *   useEffect(() => {
 *     return onPress((event) => {
 *       if (event.button === 'a') doSomething();
 *       if (event.button === 'dpadUp') navigateUp();
 *     });
 *   }, [onPress]);
 */
export function useGamepad() {
  const ctx = useContext(GamepadContext);
  if (!ctx) {
    // Return a no-op if not wrapped in provider
    return {
      connected: false,
      controllerName: '',
      onPress: () => () => {},
      buttons: { current: {} },
      axes: { current: { lx: 0, ly: 0, rx: 0, ry: 0 } },
    };
  }

  return {
    connected: ctx.connected,
    controllerName: ctx.controllerName,
    onPress: ctx.subscribe,
    buttons: ctx.buttons,
    axes: ctx.axes,
    setDebugVisible: ctx.setDebugVisible,
  };
}

export default GamepadProvider;

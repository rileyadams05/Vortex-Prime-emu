import React, { useState, useEffect, useRef, useCallback } from 'react';

/*
 * GamepadDiagnostic - Visible overlay to diagnose controller issues.
 * Shows real-time Gamepad API status, detected controllers, and button presses.
 * Press F9 or click the controller icon to toggle.
 */
const GamepadDiagnostic = () => {
  const [visible, setVisible] = useState(true); // Start visible so user sees it
  const [apiAvailable, setApiAvailable] = useState(false);
  const [secureContext, setSecureContext] = useState(false);
  const [gamepads, setGamepads] = useState([]);
  const [lastEvent, setLastEvent] = useState('None');
  const [pressedButtons, setPressedButtons] = useState([]);
  const [pollCount, setPollCount] = useState(0);
  const rafRef = useRef(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    // Check API availability
    setApiAvailable(typeof navigator.getGamepads === 'function');
    setSecureContext(window.isSecureContext === true);

    // Listen for connection events
    const onConnect = (e) => {
      setLastEvent(`CONNECTED: ${e.gamepad.id} (index ${e.gamepad.index})`);
      console.log('[Gamepad Diagnostic] Connected:', e.gamepad);
    };
    const onDisconnect = (e) => {
      setLastEvent(`DISCONNECTED: ${e.gamepad.id}`);
      console.log('[Gamepad Diagnostic] Disconnected:', e.gamepad);
    };

    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);

    // Polling loop
    const poll = () => {
      pollCountRef.current++;
      
      try {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const detected = [];
        const pressed = [];

        for (let i = 0; i < 4; i++) {
          const gp = pads[i];
          if (gp && gp.connected) {
            detected.push({
              index: gp.index,
              id: gp.id,
              mapping: gp.mapping,
              buttons: gp.buttons.length,
              axes: gp.axes.length,
              timestamp: gp.timestamp,
            });

            // Check pressed buttons
            for (let b = 0; b < gp.buttons.length; b++) {
              if (gp.buttons[b].pressed) {
                pressed.push(`Pad${i}:Btn${b}`);
              }
            }
            // Check axes
            for (let a = 0; a < gp.axes.length; a++) {
              if (Math.abs(gp.axes[a]) > 0.3) {
                pressed.push(`Pad${i}:Axis${a}=${gp.axes[a].toFixed(2)}`);
              }
            }
          }
        }

        // Only update state every 10 frames to reduce renders
        if (pollCountRef.current % 10 === 0) {
          setGamepads(detected);
          setPressedButtons(pressed);
          setPollCount(pollCountRef.current);
        }
      } catch (e) {
        if (pollCountRef.current % 60 === 0) {
          setLastEvent(`ERROR: ${e.message}`);
        }
      }

      rafRef.current = requestAnimationFrame(poll);
    };

    rafRef.current = requestAnimationFrame(poll);

    // F9 to toggle
    const onKey = (e) => {
      if (e.key === 'F9') setVisible(v => !v);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const manualCheck = useCallback(() => {
    try {
      const pads = navigator.getGamepads();
      const results = [];
      for (let i = 0; i < 4; i++) {
        if (pads[i]) {
          results.push(`[${i}] ${pads[i].id} connected=${pads[i].connected}`);
        } else {
          results.push(`[${i}] null`);
        }
      }
      setLastEvent(`Manual check:\n${results.join('\n')}`);
      console.log('[Gamepad Diagnostic] Manual check:', pads);
    } catch (e) {
      setLastEvent(`Manual check ERROR: ${e.message}`);
    }
  }, []);

  if (!visible) {
    return (
      <div
        onClick={() => setVisible(true)}
        data-testid="gamepad-diag-toggle"
        style={{
          position: 'fixed', top: 10, right: 10, zIndex: 99999,
          width: 36, height: 36, borderRadius: '50%',
          background: gamepads.length > 0 ? '#2d7a2d' : '#555',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff', fontSize: 18,
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          fontFamily: 'sans-serif',
        }}
        title="Controller Diagnostic (F9)"
      >
        🎮
      </div>
    );
  }

  return (
    <div
      data-testid="gamepad-diagnostic"
      style={{
        position: 'fixed', top: 10, right: 10, zIndex: 99999,
        width: 360, padding: 16,
        background: 'rgba(0,0,0,0.92)', color: '#ddd',
        fontFamily: "'MC360', monospace", fontSize: 12,
        borderRadius: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
        border: '1px solid rgba(255,255,255,0.1)',
        lineHeight: 1.7,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: '#90c31d', fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>CONTROLLER DIAGNOSTIC</span>
        <span onClick={() => setVisible(false)} style={{ cursor: 'pointer', color: '#888', fontSize: 16 }}>X</span>
      </div>

      <div style={{ marginBottom: 6 }}>
        <span style={{ color: '#888' }}>Gamepad API: </span>
        <span style={{ color: apiAvailable ? '#5eff5e' : '#ff5e5e' }}>{apiAvailable ? 'Available' : 'NOT AVAILABLE'}</span>
      </div>

      <div style={{ marginBottom: 6 }}>
        <span style={{ color: '#888' }}>Secure Context (HTTPS): </span>
        <span style={{ color: secureContext ? '#5eff5e' : '#ff5e5e' }}>{secureContext ? 'Yes' : 'No'}</span>
      </div>

      <div style={{ marginBottom: 6 }}>
        <span style={{ color: '#888' }}>Poll Count: </span>
        <span style={{ color: '#aaa' }}>{pollCount}</span>
      </div>

      <div style={{ marginBottom: 6 }}>
        <span style={{ color: '#888' }}>Last Event: </span>
        <span style={{ color: '#ff0', whiteSpace: 'pre-wrap', fontSize: 11 }}>{lastEvent}</span>
      </div>

      <div style={{ margin: '10px 0', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
        <span style={{ color: '#0ff', fontWeight: 600 }}>Detected Controllers: {gamepads.length}</span>
      </div>

      {gamepads.length === 0 ? (
        <div style={{ color: '#f90', padding: '8px 0', fontSize: 11, lineHeight: 1.5 }}>
          No controller detected.<br/>
          <br/>
          Try these steps:<br/>
          1. Make sure controller is ON and connected (USB or Bluetooth)<br/>
          2. Click anywhere on this page first<br/>
          3. Press any button on the controller<br/>
          4. Check Windows settings → Devices → verify controller shows up<br/>
          5. Try chrome://flags → search "gamepad" → ensure not disabled
        </div>
      ) : (
        gamepads.map(gp => (
          <div key={gp.index} style={{ background: 'rgba(45,122,45,0.2)', padding: 8, borderRadius: 6, marginBottom: 6 }}>
            <div style={{ color: '#5eff5e', fontWeight: 600 }}>Controller #{gp.index}</div>
            <div style={{ fontSize: 11, color: '#aaa' }}>{gp.id}</div>
            <div style={{ fontSize: 11 }}>Mapping: {gp.mapping || 'none'} | Buttons: {gp.buttons} | Axes: {gp.axes}</div>
          </div>
        ))
      )}

      {pressedButtons.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span style={{ color: '#0f0' }}>Pressed: </span>
          <span style={{ color: '#ff0' }}>{pressedButtons.join(', ')}</span>
        </div>
      )}

      <button
        onClick={manualCheck}
        data-testid="gamepad-manual-check"
        style={{
          marginTop: 10, width: '100%', padding: '8px 0',
          background: '#2d5a2d', border: 'none', color: '#fff',
          borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 12, fontWeight: 600,
        }}
      >
        Manual Check (click then press controller button)
      </button>

      <div style={{ marginTop: 8, fontSize: 10, color: '#666', textAlign: 'center' }}>
        Press F9 to hide this panel
      </div>
    </div>
  );
};

export default GamepadDiagnostic;

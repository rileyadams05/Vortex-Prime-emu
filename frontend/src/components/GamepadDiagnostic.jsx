import React, { useState, useEffect, useRef, useCallback } from 'react';

const GamepadDiagnostic = () => {
  const [visible, setVisible] = useState(true);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [hidAvailable, setHidAvailable] = useState(false);
  const [gamepads, setGamepads] = useState([]);
  const [lastEvent, setLastEvent] = useState('Waiting...');
  const [pressedButtons, setPressedButtons] = useState([]);
  const [pollCount, setPollCount] = useState(0);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [hidDevice, setHidDevice] = useState(null);
  const [hidStatus, setHidStatus] = useState('');
  const rafRef = useRef(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    const hasGamepad = typeof navigator.getGamepads === 'function';
    const hasHid = !!(navigator.hid);
    setApiAvailable(hasGamepad);
    setHidAvailable(hasHid);

    const onConnect = (e) => {
      setLastEvent(`CONNECTED: ${e.gamepad.id} (index ${e.gamepad.index})`);
    };
    const onDisconnect = (e) => {
      setLastEvent(`DISCONNECTED: ${e.gamepad.id}`);
    };

    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);

    const poll = () => {
      pollCountRef.current++;
      try {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const detected = [];
        const pressed = [];
        for (let i = 0; i < 4; i++) {
          const gp = pads[i];
          if (gp && gp.connected) {
            detected.push({ index: gp.index, id: gp.id, mapping: gp.mapping, buttons: gp.buttons.length, axes: gp.axes.length });
            for (let b = 0; b < gp.buttons.length; b++) {
              if (gp.buttons[b].pressed) pressed.push(`Btn${b}`);
            }
            for (let a = 0; a < gp.axes.length; a++) {
              if (Math.abs(gp.axes[a]) > 0.3) pressed.push(`Axis${a}:${gp.axes[a].toFixed(1)}`);
            }
          }
        }
        if (pollCountRef.current % 10 === 0) {
          setGamepads(detected);
          setPressedButtons(pressed);
          setPollCount(pollCountRef.current);
        }
      } catch (e) { /* */ }
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);

    const onKey = (e) => { if (e.key === 'F9') setVisible(v => !v); };
    window.addEventListener('keydown', onKey);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const startListening = useCallback(() => {
    setWaitingForInput(true);
    setLastEvent('Listening... Press ANY button on controller NOW');
    let checks = 0;
    const interval = setInterval(() => {
      checks++;
      try {
        const pads = navigator.getGamepads();
        for (let i = 0; i < 4; i++) {
          if (pads[i] && pads[i].connected) {
            setLastEvent(`DETECTED: ${pads[i].id}`);
            setWaitingForInput(false);
            clearInterval(interval);
            return;
          }
        }
        if (checks >= 100) {
          setLastEvent('Not detected after 10s. Try WebHID below or use Edge.');
          setWaitingForInput(false);
          clearInterval(interval);
        }
      } catch (e) {
        setLastEvent(`Error: ${e.message}`);
        setWaitingForInput(false);
        clearInterval(interval);
      }
    }, 100);
  }, []);

  // WebHID fallback - bypasses Gamepad API entirely
  const tryWebHID = useCallback(async () => {
    if (!navigator.hid) {
      setHidStatus('WebHID not available in this browser');
      return;
    }
    try {
      setHidStatus('Requesting device access...');
      // Xbox controller USB vendor IDs
      const filters = [
        { vendorId: 0x045e }, // Microsoft
        { vendorId: 0x054c }, // Sony
        { vendorId: 0x057e }, // Nintendo
        { vendorId: 0x28de }, // Valve (Steam Controller)
      ];
      const devices = await navigator.hid.requestDevice({ filters });
      if (devices.length > 0) {
        const dev = devices[0];
        setHidDevice(dev);
        setHidStatus(`WebHID FOUND: ${dev.productName} (vendor: 0x${dev.vendorId.toString(16)})`);
        console.log('[WebHID] Device found:', dev);
        
        // Open device and read input
        if (!dev.opened) await dev.open();
        dev.addEventListener('inputreport', (event) => {
          const { data } = event;
          const bytes = new Uint8Array(data.buffer);
          // Dispatch a synthetic gamepadconnected-like event
          console.log('[WebHID] Input report:', Array.from(bytes).map(b => b.toString(16)).join(' '));
        });
      } else {
        setHidStatus('No device selected. Try again and pick your controller from the list.');
      }
    } catch (e) {
      setHidStatus(`WebHID error: ${e.message}`);
      console.error('[WebHID] Error:', e);
    }
  }, []);

  if (!visible) {
    return (
      <div onClick={() => setVisible(true)} data-testid="gamepad-diag-toggle"
        style={{
          position: 'fixed', top: 10, right: 10, zIndex: 99999,
          width: 40, height: 40, borderRadius: '50%',
          background: gamepads.length > 0 ? '#2d7a2d' : '#444',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff', fontSize: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}
        title="Controller Diagnostic (F9)"
      >
        🎮
      </div>
    );
  }

  const green = { color: '#5eff5e' };
  const red = { color: '#ff5e5e' };
  const yellow = { color: '#ff0' };
  const cyan = { color: '#60d0ff' };
  const dim = { color: '#888' };

  return (
    <div data-testid="gamepad-diagnostic" style={{
      position: 'fixed', top: 10, right: 10, zIndex: 99999,
      width: 390, padding: 16,
      background: 'rgba(10,12,8,0.96)', color: '#ddd',
      fontFamily: "'MC360', 'Segoe UI', monospace", fontSize: 12,
      borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
      border: '1px solid rgba(144,195,29,0.2)',
      lineHeight: 1.7, maxHeight: '92vh', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: '#90c31d', fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>CONTROLLER DIAGNOSTIC</span>
        <span onClick={() => setVisible(false)} style={{ cursor: 'pointer', color: '#888', fontSize: 16 }}>X</span>
      </div>

      {/* Status */}
      <div style={{ marginBottom: 3 }}><span style={dim}>Gamepad API: </span><span style={apiAvailable ? green : red}>{apiAvailable ? 'Available' : 'N/A'}</span></div>
      <div style={{ marginBottom: 3 }}><span style={dim}>WebHID API: </span><span style={hidAvailable ? green : red}>{hidAvailable ? 'Available' : 'N/A'}</span></div>
      <div style={{ marginBottom: 3 }}><span style={dim}>Polls: </span><span style={dim}>{pollCount}</span></div>
      <div style={{ marginBottom: 6 }}><span style={dim}>Status: </span><span style={yellow}>{lastEvent}</span></div>

      {/* Controllers */}
      <div style={{ margin: '8px 0', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
        <span style={gamepads.length > 0 ? green : red}>Controllers: {gamepads.length}</span>
      </div>

      {gamepads.map(gp => (
        <div key={gp.index} style={{ background: 'rgba(45,122,45,0.2)', padding: 8, borderRadius: 6, marginBottom: 6 }}>
          <div style={green}>Controller #{gp.index}</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>{gp.id}</div>
          <div style={{ fontSize: 11 }}>Mapping: {gp.mapping || 'none'} | Btns: {gp.buttons} | Axes: {gp.axes}</div>
        </div>
      ))}

      {pressedButtons.length > 0 && (
        <div style={{ marginTop: 4 }}><span style={green}>Active: </span><span style={yellow}>{pressedButtons.join(', ')}</span></div>
      )}

      {/* Method 1: Standard Gamepad API */}
      <button onClick={startListening} style={{
        marginTop: 8, width: '100%', padding: '12px 0',
        background: waitingForInput ? '#995500' : '#1a6b1a',
        border: '2px solid ' + (waitingForInput ? '#ff8800' : '#2d9a2d'),
        color: '#fff', borderRadius: 8, cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
        animation: waitingForInput ? 'pulse 1s infinite' : 'none',
      }}>
        {waitingForInput ? 'LISTENING... PRESS CONTROLLER NOW' : 'METHOD 1: Gamepad API — Click, then press button'}
      </button>

      {/* Method 2: WebHID fallback */}
      {hidAvailable && (
        <button onClick={tryWebHID} style={{
          marginTop: 6, width: '100%', padding: '12px 0',
          background: '#1a4a6b', border: '2px solid #2d7a9a',
          color: '#fff', borderRadius: 8, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
        }}>
          METHOD 2: WebHID — Click, pick controller from popup
        </button>
      )}

      {hidStatus && (
        <div style={{ marginTop: 4, fontSize: 11, ...cyan }}>{hidStatus}</div>
      )}

      {/* Method 3: Edge */}
      <div style={{ margin: '10px 0', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
        <div style={{ color: '#f90', fontWeight: 700, marginBottom: 6, fontSize: 13 }}>If nothing works in Chrome:</div>
        <div style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 6 }}>
          <span style={{ ...cyan, fontWeight: 700 }}>Try Microsoft Edge</span> — it has built-in Xbox controller support. 
          Copy this URL into Edge:
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.08)', padding: '6px 10px', borderRadius: 4,
          fontSize: 11, color: '#90c31d', wordBreak: 'break-all', cursor: 'text',
          userSelect: 'all',
        }}>
          {window.location.href}
        </div>
      </div>

      {gamepads.length === 0 && (
        <div style={{ margin: '8px 0', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, fontSize: 11, lineHeight: 1.6 }}>
          <div style={{ ...dim }}>
            <span style={{ color: '#f66', fontWeight: 700 }}>Close Steam</span> if running — it steals controller access.<br/>
            Make sure controller shows in <span style={cyan}>Windows Settings → Devices</span>.<br/>
            Try <span style={cyan}>USB wired</span> if Bluetooth isn't detected.
          </div>
        </div>
      )}

      <div style={{ marginTop: 6, fontSize: 10, color: '#444', textAlign: 'center' }}>F9 to toggle</div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
      `}</style>
    </div>
  );
};

export default GamepadDiagnostic;

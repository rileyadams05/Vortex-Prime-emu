import React, { useState, useEffect, useRef, useCallback } from 'react';

const GamepadDiagnostic = () => {
  const [visible, setVisible] = useState(true);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [secureContext, setSecureContext] = useState(false);
  const [gamepads, setGamepads] = useState([]);
  const [lastEvent, setLastEvent] = useState('Waiting...');
  const [pressedButtons, setPressedButtons] = useState([]);
  const [pollCount, setPollCount] = useState(0);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const rafRef = useRef(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    setApiAvailable(typeof navigator.getGamepads === 'function');
    setSecureContext(window.isSecureContext === true);

    const onConnect = (e) => {
      const name = e.gamepad.id || 'Controller';
      setLastEvent(`CONNECTED: ${name} (index ${e.gamepad.index})`);
      console.log('[Gamepad] CONNECTED:', e.gamepad.id, 'index:', e.gamepad.index, 'mapping:', e.gamepad.mapping, 'buttons:', e.gamepad.buttons.length);
    };
    const onDisconnect = (e) => {
      setLastEvent(`DISCONNECTED: ${e.gamepad.id}`);
      console.log('[Gamepad] DISCONNECTED:', e.gamepad.id);
    };

    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);

    // Check on mount
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) {
          setLastEvent(`Found on mount: ${pads[i].id}`);
          console.log('[Gamepad] Found on mount:', pads[i].id);
        }
      }
    } catch (e) { console.log('[Gamepad] API error:', e.message); }

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
              index: gp.index, id: gp.id, mapping: gp.mapping,
              buttons: gp.buttons.length, axes: gp.axes.length,
            });
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
      } catch (e) { /* silent */ }
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
    setLastEvent('Listening... Press ANY button on your controller NOW');
    console.log('[Gamepad] User activated listening - press any controller button now');
    
    // Force a check every 100ms for 10 seconds
    let checks = 0;
    const interval = setInterval(() => {
      checks++;
      try {
        const pads = navigator.getGamepads();
        let found = false;
        for (let i = 0; i < 4; i++) {
          if (pads[i] && pads[i].connected) {
            found = true;
            setLastEvent(`DETECTED: ${pads[i].id}`);
            console.log('[Gamepad] DETECTED via manual poll:', pads[i]);
            setWaitingForInput(false);
            clearInterval(interval);
            break;
          }
        }
        if (!found && checks >= 100) {
          setLastEvent('No controller found after 10 seconds. See troubleshooting below.');
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

  if (!visible) {
    return (
      <div onClick={() => setVisible(true)} data-testid="gamepad-diag-toggle"
        style={{
          position: 'fixed', top: 10, right: 10, zIndex: 99999,
          width: 40, height: 40, borderRadius: '50%',
          background: gamepads.length > 0 ? '#2d7a2d' : '#444',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff', fontSize: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)', fontFamily: 'sans-serif',
        }}
        title="Controller Diagnostic (F9)"
      >
        🎮
      </div>
    );
  }

  const S = {
    panel: {
      position: 'fixed', top: 10, right: 10, zIndex: 99999,
      width: 380, padding: 16,
      background: 'rgba(10,12,8,0.96)', color: '#ddd',
      fontFamily: "'MC360', 'Segoe UI', monospace", fontSize: 12,
      borderRadius: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
      border: '1px solid rgba(144,195,29,0.2)',
      lineHeight: 1.7, maxHeight: '90vh', overflowY: 'auto',
    },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    title: { color: '#90c31d', fontWeight: 700, fontSize: 14, letterSpacing: 1 },
    close: { cursor: 'pointer', color: '#888', fontSize: 16, padding: '0 4px' },
    row: { marginBottom: 4 },
    label: { color: '#888' },
    green: { color: '#5eff5e' },
    red: { color: '#ff5e5e' },
    yellow: { color: '#ff0' },
    cyan: { color: '#0ff' },
    section: { margin: '10px 0', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 },
    bigBtn: {
      marginTop: 8, width: '100%', padding: '14px 0',
      background: waitingForInput ? '#995500' : '#1a6b1a',
      border: '2px solid ' + (waitingForInput ? '#ff8800' : '#2d9a2d'),
      color: '#fff', borderRadius: 8, cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
      letterSpacing: 0.5,
      animation: waitingForInput ? 'pulse 1s infinite' : 'none',
    },
    troubleItem: { marginBottom: 6, paddingLeft: 12, fontSize: 11, lineHeight: 1.5 },
    troubleNum: { color: '#90c31d', fontWeight: 700 },
  };

  return (
    <div data-testid="gamepad-diagnostic" style={S.panel}>
      <div style={S.header}>
        <span style={S.title}>CONTROLLER DIAGNOSTIC</span>
        <span onClick={() => setVisible(false)} style={S.close}>X</span>
      </div>

      <div style={S.row}><span style={S.label}>Gamepad API: </span><span style={apiAvailable ? S.green : S.red}>{apiAvailable ? 'Available' : 'NOT AVAILABLE'}</span></div>
      <div style={S.row}><span style={S.label}>Secure Context: </span><span style={secureContext ? S.green : S.red}>{secureContext ? 'Yes' : 'No'}</span></div>
      <div style={S.row}><span style={S.label}>Polls: </span><span style={{color:'#aaa'}}>{pollCount}</span></div>
      <div style={S.row}><span style={S.label}>Status: </span><span style={S.yellow}>{lastEvent}</span></div>

      <div style={S.section}>
        <span style={gamepads.length > 0 ? S.green : S.red}>
          Controllers Detected: {gamepads.length}
        </span>
      </div>

      {gamepads.length > 0 && gamepads.map(gp => (
        <div key={gp.index} style={{ background: 'rgba(45,122,45,0.2)', padding: 8, borderRadius: 6, marginBottom: 6 }}>
          <div style={S.green}>Controller #{gp.index}</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>{gp.id}</div>
          <div style={{ fontSize: 11 }}>Mapping: {gp.mapping || 'none'} | Btns: {gp.buttons} | Axes: {gp.axes}</div>
        </div>
      ))}

      {pressedButtons.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <span style={S.green}>Active: </span>
          <span style={S.yellow}>{pressedButtons.join(', ')}</span>
        </div>
      )}

      {/* Big action button */}
      <button onClick={startListening} data-testid="gamepad-listen-btn" style={S.bigBtn}>
        {waitingForInput ? 'LISTENING... PRESS CONTROLLER BUTTON NOW' : 'CLICK HERE, THEN PRESS ANY CONTROLLER BUTTON'}
      </button>

      {gamepads.length === 0 && (
        <div style={{ ...S.section, color: '#bbb' }}>
          <div style={{ color: '#f90', fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Troubleshooting:</div>
          
          <div style={S.troubleItem}>
            <span style={S.troubleNum}>1. </span>
            Click the green button above, then <strong>press any button</strong> on your controller. Chrome won't detect it until you do.
          </div>
          
          <div style={S.troubleItem}>
            <span style={S.troubleNum}>2. </span>
            <strong style={{color:'#ff6666'}}>Close Steam completely</strong> — Steam grabs exclusive controller access and blocks Chrome from seeing it.
          </div>
          
          <div style={S.troubleItem}>
            <span style={S.troubleNum}>3. </span>
            Test your controller at <a href="https://html5gamepad.com" target="_blank" rel="noreferrer" style={{color:'#60d0ff'}}>html5gamepad.com</a> — if it doesn't work there either, it's a Chrome/driver issue.
          </div>
          
          <div style={S.troubleItem}>
            <span style={S.troubleNum}>4. </span>
            Try <a href="https://gamepad-tester.com" target="_blank" rel="noreferrer" style={{color:'#60d0ff'}}>gamepad-tester.com</a> as another test.
          </div>
          
          <div style={S.troubleItem}>
            <span style={S.troubleNum}>5. </span>
            Go to <span style={{color:'#60d0ff'}}>chrome://flags</span> → search "gamepad" → make sure nothing is disabled.
          </div>
          
          <div style={S.troubleItem}>
            <span style={S.troubleNum}>6. </span>
            Check Windows: Settings → Devices → verify Xbox controller appears.
          </div>

          <div style={S.troubleItem}>
            <span style={S.troubleNum}>7. </span>
            Try USB wired connection instead of Bluetooth/wireless.
          </div>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 10, color: '#555', textAlign: 'center' }}>Press F9 to toggle</div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default GamepadDiagnostic;

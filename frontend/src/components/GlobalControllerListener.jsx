import { useEffect, useRef, useState } from 'react';

const GlobalControllerListener = () => {
  const requestRef = useRef();
  const lastButtonState = useRef({});
  const [controllerConnected, setControllerConnected] = useState(false);
  const [controllerName, setControllerName] = useState('');
  const [showStatus, setShowStatus] = useState(false);
  const statusTimerRef = useRef(null);

  const triggerKey = (key) => {
    const keyEvent = new KeyboardEvent('keydown', {
      key: key,
      code: key,
      bubbles: true,
      cancelable: true,
      view: window
    });
    document.dispatchEvent(keyEvent);
  };

  useEffect(() => {
    let isTauri = false;
    let unlistenDown = null;
    let unlistenUp = null;

    // Check for Tauri environment
    try {
      if (window.__TAURI__) {
        isTauri = true;
      }
    } catch (e) {
      isTauri = false;
    }

    // --- TAURI MODE ---
    if (isTauri) {
      const setupTauri = async () => {
        try {
          const { listen } = await import('@tauri-apps/api/event');
          const tauriState = {};

          const getMapping = (btnName) => {
            switch (btnName) {
              case 'South': return 'Enter';
              case 'East': return 'Backspace';
              case 'DPadUp': return 'ArrowUp';
              case 'DPadDown': return 'ArrowDown';
              case 'DPadLeft': return 'ArrowLeft';
              case 'DPadRight': return 'ArrowRight';
              case 'Start': return 'Escape';
              case 'Mode': return 'Home';
              case 'LeftTrigger': return 'q';
              case 'RightTrigger': return 'e';
              default: return null;
            }
          };

          const handleTauriPress = (payload) => {
            const key = getMapping(payload);
            if (key && !tauriState[payload]) {
              tauriState[payload] = { pressed: true, startTime: Date.now(), lastFireTime: Date.now() };
              triggerKey(key);
            }
          };

          const handleTauriRelease = (payload) => {
            tauriState[payload] = null;
          };

          const pollTauriRepeats = () => {
            const now = Date.now();
            Object.entries(tauriState).forEach(([btn, state]) => {
              if (state && state.pressed) {
                const isNav = ['DPadUp', 'DPadDown', 'DPadLeft', 'DPadRight'].includes(btn);
                if (isNav && now - state.startTime > 400 && now - state.lastFireTime > 100) {
                  const key = getMapping(btn);
                  if (key) triggerKey(key);
                  tauriState[btn] = { ...state, lastFireTime: now };
                }
              }
            });
            requestRef.current = requestAnimationFrame(pollTauriRepeats);
          };

          requestRef.current = requestAnimationFrame(pollTauriRepeats);
          unlistenDown = await listen('controller-button-down', (e) => handleTauriPress(e.payload));
          unlistenUp = await listen('controller-button-up', (e) => handleTauriRelease(e.payload));

          setControllerConnected(true);
          setControllerName('Tauri Controller');
        } catch (err) {
          console.warn('Tauri controller setup failed:', err);
        }
      };
      setupTauri();
    }
    
    // --- BROWSER GAMEPAD API MODE ---
    else {
      const showStatusBriefly = (name, connected) => {
        setControllerConnected(connected);
        setControllerName(name);
        setShowStatus(true);
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
        statusTimerRef.current = setTimeout(() => setShowStatus(false), 3000);
      };

      // Listen for gamepad connection events
      const onGamepadConnected = (e) => {
        console.log('Gamepad connected:', e.gamepad.id, 'index:', e.gamepad.index);
        showStatusBriefly(e.gamepad.id.split('(')[0].trim(), true);
      };

      const onGamepadDisconnected = (e) => {
        console.log('Gamepad disconnected:', e.gamepad.id);
        showStatusBriefly(e.gamepad.id.split('(')[0].trim(), false);
      };

      window.addEventListener('gamepadconnected', onGamepadConnected);
      window.addEventListener('gamepaddisconnected', onGamepadDisconnected);

      // Polling loop
      const pollGamepads = () => {
        let gamepads;
        try {
          gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        } catch (e) {
          requestRef.current = requestAnimationFrame(pollGamepads);
          return;
        }

        // Find first connected gamepad
        let gp = null;
        for (let i = 0; i < 4; i++) {
          if (gamepads[i] && gamepads[i].connected) {
            gp = gamepads[i];
            break;
          }
        }

        if (gp) {
          if (!controllerConnected) {
            setControllerConnected(true);
            setControllerName(gp.id.split('(')[0].trim());
          }

          const DEADZONE = 0.5;
          const axes = { lx: gp.axes[0] || 0, ly: gp.axes[1] || 0 };

          // Button mappings (Standard Gamepad)
          const buttons = {
            a: gp.buttons[0]?.pressed || false,
            b: gp.buttons[1]?.pressed || false,
            x: gp.buttons[2]?.pressed || false,
            y: gp.buttons[3]?.pressed || false,
            lb: gp.buttons[4]?.pressed || false,
            rb: gp.buttons[5]?.pressed || false,
            lt: gp.buttons[6]?.pressed || false,
            rt: gp.buttons[7]?.pressed || false,
            back: gp.buttons[8]?.pressed || false,
            start: gp.buttons[9]?.pressed || false,
            lstick: gp.buttons[10]?.pressed || false,
            rstick: gp.buttons[11]?.pressed || false,
            dpadUp: gp.buttons[12]?.pressed || false,
            dpadDown: gp.buttons[13]?.pressed || false,
            dpadLeft: gp.buttons[14]?.pressed || false,
            dpadRight: gp.buttons[15]?.pressed || false,
            guide: gp.buttons[16]?.pressed || false,
          };

          const checkPress = (name, isPressed, key) => {
            if (!key) return;
            const isNavButton = ['dpadUp', 'dpadDown', 'dpadLeft', 'dpadRight', 'lb', 'rb', 'stickLeft', 'stickRight', 'stickUp', 'stickDown'].includes(name);
            
            if (isPressed) {
              const now = Date.now();
              const lastState = lastButtonState.current[name];
              
              if (!lastState || !lastState.pressed) {
                triggerKey(key);
                lastButtonState.current[name] = { pressed: true, startTime: now, lastFireTime: now };
              } 
              else if (isNavButton) {
                const INITIAL_DELAY = 400;
                const REPEAT_RATE = 100;
                if (now - lastState.startTime > INITIAL_DELAY && now - lastState.lastFireTime > REPEAT_RATE) {
                  triggerKey(key);
                  lastButtonState.current[name] = { ...lastState, lastFireTime: now };
                }
              }
            } else {
              lastButtonState.current[name] = { pressed: false };
            }
          };

          // Map all buttons
          checkPress('a', buttons.a, 'Enter');
          checkPress('b', buttons.b, 'Backspace');
          checkPress('dpadUp', buttons.dpadUp, 'ArrowUp');
          checkPress('dpadDown', buttons.dpadDown, 'ArrowDown');
          checkPress('dpadLeft', buttons.dpadLeft, 'ArrowLeft');
          checkPress('dpadRight', buttons.dpadRight, 'ArrowRight');
          checkPress('start', buttons.start, 'Escape');
          checkPress('guide', buttons.guide, 'Home');
          checkPress('lb', buttons.lb, 'q');
          checkPress('rb', buttons.rb, 'e');

          // Left stick as D-pad
          checkPress('stickUp', axes.ly < -DEADZONE, 'ArrowUp');
          checkPress('stickDown', axes.ly > DEADZONE, 'ArrowDown');
          checkPress('stickLeft', axes.lx < -DEADZONE, 'ArrowLeft');
          checkPress('stickRight', axes.lx > DEADZONE, 'ArrowRight');
        }

        requestRef.current = requestAnimationFrame(pollGamepads);
      };

      requestRef.current = requestAnimationFrame(pollGamepads);

      return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        window.removeEventListener('gamepadconnected', onGamepadConnected);
        window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      };
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (unlistenDown) unlistenDown();
      if (unlistenUp) unlistenUp();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Render controller status indicator
  if (!showStatus) return null;

  return (
    <div 
      data-testid="controller-status"
      className={`controller-status ${controllerConnected ? 'connected' : 'disconnected'}`}
      style={{
        position: 'fixed',
        bottom: '12px',
        right: '12px',
        zIndex: 20000,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 600,
        fontFamily: "'MC360', 'Segoe UI', sans-serif",
        pointerEvents: 'none',
        background: controllerConnected ? 'rgba(60, 160, 40, 0.9)' : 'rgba(80, 80, 90, 0.9)',
        color: 'white',
        transition: 'opacity 0.3s ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: controllerConnected ? '#90ff60' : '#666',
        boxShadow: controllerConnected ? '0 0 6px #90ff60' : 'none',
        display: 'inline-block',
      }} />
      {controllerConnected ? `${controllerName || 'Controller'} Connected` : `${controllerName || 'Controller'} Disconnected`}
    </div>
  );
};

export default GlobalControllerListener;

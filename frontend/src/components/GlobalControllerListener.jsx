import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';

const GlobalControllerListener = () => {
  const requestRef = useRef();
  const lastButtonState = useRef({}); // Shared state for both modes

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

  const getMapping = (btnName) => {
      switch (btnName) {
          case 'South': return 'Enter'; // A
          case 'East': return 'Backspace'; // B
          case 'DPadUp': return 'ArrowUp';
          case 'DPadDown': return 'ArrowDown';
          case 'DPadLeft': return 'ArrowLeft';
          case 'DPadRight': return 'ArrowRight';
          case 'Start': return 'Escape';
          case 'Mode': return null; // Guide Button - DISABLED
          case 'LeftTrigger': return 'q'; // LB
          case 'RightTrigger': return 'e'; // RB
          default: return null;
      }
  };

  useEffect(() => {
    let unlistenDown = null;
    let unlistenUp = null;

    // --- MODE A: TAURI (RUST BACKEND) ---
    if (window.__TAURI__) {
      const buttonState = {}; // { btnName: { pressed: true, startTime: ms, lastFireTime: ms } }
      const REPEAT_DELAY = 400;
      const REPEAT_RATE = 100;
      const NAV_BUTTONS = ['DPadUp', 'DPadDown', 'DPadLeft', 'DPadRight', 'LeftTrigger', 'RightTrigger'];

      const handleTauriPress = (btnName) => {
          const key = getMapping(btnName);
          if (!key) return;

          // Initial Press
          if (!buttonState[btnName]) {
              triggerKey(key);
              buttonState[btnName] = { 
                  pressed: true, 
                  startTime: Date.now(), 
                  lastFireTime: Date.now() 
              };
          }
      };

      const handleTauriRelease = (btnName) => {
          delete buttonState[btnName];
      };

      // Poll for repeats
      const pollTauriRepeats = () => {
          const now = Date.now();
          Object.keys(buttonState).forEach(btnName => {
              if (NAV_BUTTONS.includes(btnName)) {
                  const state = buttonState[btnName];
                  if (state && state.pressed) {
                      if (now - state.startTime > REPEAT_DELAY && now - state.lastFireTime > REPEAT_RATE) {
                          const key = getMapping(btnName);
                          if (key) {
                              triggerKey(key);
                              state.lastFireTime = now;
                          }
                      }
                  }
              }
          });
          requestRef.current = requestAnimationFrame(pollTauriRepeats);
      };

      // Start Polling
      requestRef.current = requestAnimationFrame(pollTauriRepeats);

      // Listeners
      listen('controller-button-down', (e) => handleTauriPress(e.payload)).then(u => unlistenDown = u);
      listen('controller-button-up', (e) => handleTauriRelease(e.payload)).then(u => unlistenUp = u);
    } 
    
    // --- MODE B: BROWSER (WEB GAMEPAD API) ---
    else {
      console.log("Browser Mode: Polling Gamepad API...");
      
      const pollGamepads = () => {
        const gamepads = navigator.getGamepads();
        const gp = gamepads[0]; // Support first player

        if (gp) {
          // Standard Mapping (Xbox 360/One)
          const buttons = {
            a: gp.buttons[0]?.pressed,
            b: gp.buttons[1]?.pressed,
            x: gp.buttons[2]?.pressed,
            y: gp.buttons[3]?.pressed,
            lb: gp.buttons[4]?.pressed,
            rb: gp.buttons[5]?.pressed,
            lt: gp.buttons[6]?.pressed,
            rt: gp.buttons[7]?.pressed,
            back: gp.buttons[8]?.pressed,
            start: gp.buttons[9]?.pressed,
            lstick: gp.buttons[10]?.pressed,
            rstick: gp.buttons[11]?.pressed,
            dpadUp: gp.buttons[12]?.pressed,
            dpadDown: gp.buttons[13]?.pressed,
            dpadLeft: gp.buttons[14]?.pressed,
            dpadRight: gp.buttons[15]?.pressed,
            guide: gp.buttons[16]?.pressed,
          };

          const axes = { lx: gp.axes[0], ly: gp.axes[1] };
          const DEADZONE = 0.5;

          const checkPress = (name, isPressed, key) => {
             const isNavButton = ['dpadUp', 'dpadDown', 'dpadLeft', 'dpadRight', 'lb', 'rb', 'stickLeft', 'stickRight', 'stickUp', 'stickDown'].includes(name);
             
             if (isPressed) {
                const now = Date.now();
                const lastState = lastButtonState.current[name];
                
                if (!lastState || !lastState.pressed) {
                    triggerKey(key);
                    lastButtonState.current[name] = { pressed: true, startTime: now, lastFireTime: now };
                } 
                else if (isNavButton) {
                    const { startTime, lastFireTime } = lastState;
                    const INITIAL_DELAY = 400; 
                    const REPEAT_RATE = 100;   

                    if (now - startTime > INITIAL_DELAY && now - lastFireTime > REPEAT_RATE) {
                        triggerKey(key);
                        lastButtonState.current[name] = { ...lastState, lastFireTime: now };
                    }
                }
             } else {
                 lastButtonState.current[name] = { pressed: false };
             }
          };

          checkPress('a', buttons.a, 'Enter');
          checkPress('b', buttons.b, 'Backspace');
          checkPress('dpadUp', buttons.dpadUp, 'ArrowUp');
          checkPress('dpadDown', buttons.dpadDown, 'ArrowDown');
          checkPress('dpadLeft', buttons.dpadLeft, 'ArrowLeft');
          checkPress('dpadRight', buttons.dpadRight, 'ArrowRight');
          checkPress('start', buttons.start, 'Escape');
          // checkPress('guide', buttons.guide, 'Home'); // Guide Button - DISABLED
          checkPress('lb', buttons.lb, 'q');
          checkPress('rb', buttons.rb, 'e');

          checkPress('stickLeft', axes.lx < -DEADZONE, 'ArrowLeft');
          checkPress('stickRight', axes.lx > DEADZONE, 'ArrowRight');
          checkPress('stickUp', axes.ly < -DEADZONE, 'ArrowUp');
          checkPress('stickDown', axes.ly > DEADZONE, 'ArrowDown');
        }

        requestRef.current = requestAnimationFrame(pollGamepads);
      };

      requestRef.current = requestAnimationFrame(pollGamepads);
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (unlistenDown) unlistenDown();
      if (unlistenUp) unlistenUp();
    };
  }, []);

  return null;
};

export default GlobalControllerListener;

import React, { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import '../styles/GuideOverlay.css';

const GuideOverlay = ({ isOpen, onClose, gamerscore, gamertag }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState(0);
  
  // Sound refs
  const selectSound = useRef(new Audio('/assets/blades/sounds/ui_select.wav'));
  const navSound = useRef(new Audio('/assets/blades/sounds/ui_nav_click.wav'));
  const backSound = useRef(new Audio('/assets/blades/sounds/ui_back.wav'));

  const playSound = (audioRef) => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.warn("Audio play failed", e));
    }
  };

  useEffect(() => {
    if (isOpen) {
      playSound(selectSound);
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Gamepad Polling
  const lastButtonState = useRef({
      a: false,
      b: false,
      up: false,
      down: false,
      guide: true, // Start with guide=true to prevent instant close on open
      back: false,
      start: false
  });

  useEffect(() => {
    if (!isOpen) return;

    let animationFrameId;
    const pollGamepad = () => {
      const gamepads = navigator.getGamepads();
      if (gamepads[0]) {
        const gp = gamepads[0];
        const a = gp.buttons[0]?.pressed;
        const b = gp.buttons[1]?.pressed;
        const back = gp.buttons[8]?.pressed;
        const start = gp.buttons[9]?.pressed;
        const guide = gp.buttons[16]?.pressed;
        
        const dpadUp = gp.buttons[12]?.pressed;
        const dpadDown = gp.buttons[13]?.pressed;

        const isGuidePressed = guide || (back && start);

        // Toggle Guide (Close)
        // Handled by GlobalControllerListener -> Home Key -> Parent Toggle
        // We keep this check to update lastButtonState, but disable direct close to avoid conflict
        /* 
        if (isGuidePressed && !lastButtonState.current.guide) {
             onClose();
        }
        */

        // Navigate Up
        if (dpadUp && !lastButtonState.current.up) {
            playSound(navSound);
            setSelectedItem(prev => (prev > 0 ? prev - 1 : 2));
        }

        // Navigate Down
        if (dpadDown && !lastButtonState.current.down) {
            playSound(navSound);
            setSelectedItem(prev => (prev < 2 ? prev + 1 : 0));
        }

        // Select (A)
        if (a && !lastButtonState.current.a) {
             playSound(selectSound);
             if (selectedItem === 2) {
                // Shutdown/Exit
                if (window.__TAURI__) {
                  import('@tauri-apps/plugin-process').then(({ exit }) => {
                    exit(0);
                  });
                } else {
                  console.log("Shutdown System triggered");
                }
             }
        }

        // Close (B)
        if (b && !lastButtonState.current.b) {
             playSound(backSound);
             onClose();
        }

        lastButtonState.current = { a, b, up: dpadUp, down: dpadDown, guide: isGuidePressed, back, start };
      }
      animationFrameId = requestAnimationFrame(pollGamepad);
    };

    pollGamepad();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isOpen, selectedItem, onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      switch(e.key) {
        case 'ArrowUp':
          playSound(navSound);
          setSelectedItem(prev => (prev > 0 ? prev - 1 : 2));
          break;
        case 'ArrowDown':
          playSound(navSound);
          setSelectedItem(prev => (prev < 2 ? prev + 1 : 0));
          break;
        case 'Enter':
          playSound(selectSound);
          if (selectedItem === 2) {
             // Shutdown/Exit
             if (window.__TAURI__) {
               import('@tauri-apps/plugin-process').then(({ exit }) => {
                 exit(0);
               });
             } else {
               console.log("Shutdown System triggered");
             }
          }
          break;
        case 'Home':
          // Let parent handle toggle
          break;
        case 'Escape':
        case 'Backspace':
          playSound(backSound);
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedItem, onClose]);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const menuItems = [
    { label: 'XENIA Dashboard', badge: '(coming soon)' },
    { label: 'Quick Launch', badge: '(coming soon)' },
    { label: 'Shutdown System', badge: '(Exit App)' }
  ];

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="guide-overlay-backdrop" />
        <Dialog.Content className="guide-modal-container" onEscapeKeyDown={(e) => e.preventDefault()}>
          {/* Top Info Bar */}
          <div className="guide-header-bar">
            <span className="header-gamerscore">{gamerscore || '1337'} G</span>
            <div className="header-avatar-box">
               <div className="avatar-inner-box">
                 <img src="/for app/XB-Windows.ico" alt="Avatar" style={{width: '100%', height: '100%'}} />
               </div>
            </div>
            <span className="header-clock">{formatTime(currentTime)}</span>
          </div>

          {/* Main Content Area with Side Tabs */}
          <div className="guide-content-wrapper">
            
            {/* Left Tabs */}
            <div className="guide-left-tabs">
              <div className="tab-vertical secondary">
                 <span>XENIA Guide</span>
              </div>
              <div className="tab-vertical primary">
                 <span>HOME</span>
              </div>
            </div>

            {/* Center Panel */}
            <div className="guide-center-panel">
              <div className="menu-list">
                {menuItems.map((item, index) => (
                  <div 
                    key={index} 
                    className={`guide-menu-item ${index === selectedItem ? 'selected' : ''}`}
                    onClick={() => setSelectedItem(index)}
                    onMouseEnter={() => {
                      if (selectedItem !== index) {
                        playSound(navSound);
                        setSelectedItem(index);
                      }
                    }}
                  >
                    <span className="menu-label">{item.label}</span>
                    <span className="menu-badge">{item.badge}</span>
                  </div>
                ))}
              </div>

              <div className="guide-footer-hints">
                <div className="hint-group">
                  <div className="hint-btn green">A</div>
                  <span>Select</span>
                </div>
                <div className="hint-group">
                  <div className="hint-btn red">B</div>
                  <span>Close</span>
                </div>
              </div>
            </div>

            {/* Right Tab */}
            <div className="guide-right-tabs">
              <div className="tab-vertical right">
                 <span>Games</span>
              </div>
            </div>

          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default GuideOverlay;

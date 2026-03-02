import React, { useState, useEffect, useCallback, useRef } from 'react';
import playSound from '../utils/soundManager';
import '../styles/GuideOverlay.css';

const GuideOverlay = ({ isOpen, onClose, xboxProfile, isLoggedIn, onLogin }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState(0);
  const [activeTab, setActiveTab] = useState(0); // 0 = HOME, 1 = Games
  const containerRef = useRef(null);

  const menuItems = [
    { label: 'XENIA Dashboard', badge: '(coming soon)', badgeClass: '' },
    { label: 'Quick Launch', badge: '(coming soon)', badgeClass: '' },
    { label: 'Shutdown System', badge: '(Exit App)', badgeClass: 'exit-badge' },
  ];

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Reset selected item when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedItem(0);
      setActiveTab(0);
    }
  }, [isOpen]);

  // Focus container when opened
  useEffect(() => {
    if (isOpen && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isOpen]);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;
      // Don't handle Tab/Home - let the parent dashboard handle toggle
      if (e.key === 'Tab' || e.key === 'Home') return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          playSound('focus');
          setSelectedItem((prev) => (prev > 0 ? prev - 1 : menuItems.length - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          playSound('focus');
          setSelectedItem((prev) => (prev < menuItems.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation();
          playSound('panelLeft');
          setActiveTab((prev) => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation();
          playSound('panelRight');
          setActiveTab((prev) => Math.min(1, prev + 1));
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          playSound('select');
          handleMenuSelect(selectedItem);
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          e.stopPropagation();
          playSound('back');
          onClose();
          break;
        default:
          break;
      }
    },
    [isOpen, selectedItem, onClose, menuItems.length]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleKeyDown]);

  // Gamepad polling
  const lastBtnRef = useRef({ a: false, b: false, up: false, down: false, left: false, right: false });

  useEffect(() => {
    if (!isOpen) return;
    let rafId;

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[0];

      if (gp) {
        const a = gp.buttons[0]?.pressed;
        const b = gp.buttons[1]?.pressed;
        const dpadUp = gp.buttons[12]?.pressed;
        const dpadDown = gp.buttons[13]?.pressed;
        const dpadLeft = gp.buttons[14]?.pressed;
        const dpadRight = gp.buttons[15]?.pressed;
        const last = lastBtnRef.current;

        if (dpadUp && !last.up) {
          playSound('focus');
          setSelectedItem((prev) => (prev > 0 ? prev - 1 : menuItems.length - 1));
        }
        if (dpadDown && !last.down) {
          playSound('focus');
          setSelectedItem((prev) => (prev < menuItems.length - 1 ? prev + 1 : 0));
        }
        if (dpadLeft && !last.left) {
          playSound('panelLeft');
          setActiveTab((prev) => Math.max(0, prev - 1));
        }
        if (dpadRight && !last.right) {
          playSound('panelRight');
          setActiveTab((prev) => Math.min(1, prev + 1));
        }
        if (a && !last.a) {
          playSound('select');
          handleMenuSelect(selectedItem);
        }
        if (b && !last.b) {
          playSound('back');
          onClose();
        }

        lastBtnRef.current = { a, b, up: dpadUp, down: dpadDown, left: dpadLeft, right: dpadRight };
      }

      rafId = requestAnimationFrame(pollGamepad);
    };

    rafId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, selectedItem, onClose, menuItems.length]);

  const handleMenuSelect = (index) => {
    if (index === 2) {
      if (window.__TAURI__) {
        import('@tauri-apps/plugin-process').then(({ exit }) => {
          exit(0);
        });
      }
    }
  };

  const handleSignInClick = () => {
    if (!isLoggedIn && onLogin) {
      playSound('select');
      onLogin();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="guide-overlay-backdrop"
        className="guide-overlay-backdrop"
        onClick={onClose}
      />

      {/* Guide Panel */}
      <div
        ref={containerRef}
        data-testid="guide-modal-container"
        className="guide-modal-container"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Sign-in / Profile Picture + Clock */}
        <div data-testid="guide-header-bar" className="guide-header-bar">
          <div className="header-spacer-left" />
          <div 
            className="header-avatar-box" 
            data-testid="guide-avatar-box"
            onClick={handleSignInClick}
            style={{ cursor: isLoggedIn ? 'default' : 'pointer' }}
          >
            {isLoggedIn && xboxProfile?.profilePicture ? (
              <img src={xboxProfile.profilePicture} alt="Avatar" className="guide-avatar-img" />
            ) : (
              <div className="avatar-inner-fallback" />
            )}
          </div>
          {!isLoggedIn && (
            <span 
              className="header-signin-text" 
              data-testid="guide-signin-text"
              onClick={handleSignInClick}
            >
              Sign In
            </span>
          )}
          {isLoggedIn && xboxProfile?.gamertag && (
            <span className="header-gamertag" data-testid="guide-gamertag">
              {xboxProfile.gamertag}
            </span>
          )}
          <span data-testid="guide-clock" className="header-clock">
            {formatTime(currentTime)}
          </span>
        </div>

        {/* Main Content: Tabs + Panel */}
        <div className="guide-content-wrapper">
          {/* Left Tabs */}
          <div className="guide-left-tabs">
            <div
              data-testid="guide-tab-xenia"
              className="tab-vertical secondary"
              onClick={() => { playSound('panelLeft'); setActiveTab(0); }}
            >
              <span>Xenia Guide</span>
            </div>
            <div
              data-testid="guide-tab-home"
              className={`tab-vertical primary`}
              onClick={() => { playSound('panelLeft'); setActiveTab(0); }}
            >
              <span>HOME</span>
            </div>
          </div>

          {/* Center Panel */}
          <div data-testid="guide-center-panel" className="guide-center-panel">
            <div className="menu-list">
              {menuItems.map((item, index) => (
                <div
                  key={index}
                  data-testid={`guide-menu-item-${index}`}
                  className={`guide-menu-item ${index === selectedItem ? 'selected' : ''}`}
                  onClick={() => {
                    playSound('select');
                    setSelectedItem(index);
                    handleMenuSelect(index);
                  }}
                  onMouseEnter={() => {
                    if (index !== selectedItem) {
                      playSound('focus');
                      setSelectedItem(index);
                    }
                  }}
                >
                  <span className="menu-label">{item.label}</span>
                  <span className={`menu-badge ${item.badgeClass}`}>{item.badge}</span>
                </div>
              ))}
            </div>

            {/* Footer Hints */}
            <div data-testid="guide-footer-hints" className="guide-footer-hints">
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
            <div
              data-testid="guide-tab-games"
              className={`tab-vertical right`}
              onClick={() => { playSound('panelRight'); setActiveTab(1); }}
            >
              <span>Games</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GuideOverlay;

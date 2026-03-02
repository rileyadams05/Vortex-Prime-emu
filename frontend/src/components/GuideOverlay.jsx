import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../styles/GuideOverlay.css';

const GuideOverlay = ({ isOpen, onClose, gamerscore, gamertag }) => {
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

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setSelectedItem((prev) => (prev > 0 ? prev - 1 : menuItems.length - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setSelectedItem((prev) => (prev < menuItems.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation();
          setActiveTab((prev) => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation();
          setActiveTab((prev) => Math.min(1, prev + 1));
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          handleMenuSelect(selectedItem);
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          e.stopPropagation();
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
          setSelectedItem((prev) => (prev > 0 ? prev - 1 : menuItems.length - 1));
        }
        if (dpadDown && !last.down) {
          setSelectedItem((prev) => (prev < menuItems.length - 1 ? prev + 1 : 0));
        }
        if (dpadLeft && !last.left) {
          setActiveTab((prev) => Math.max(0, prev - 1));
        }
        if (dpadRight && !last.right) {
          setActiveTab((prev) => Math.min(1, prev + 1));
        }
        if (a && !last.a) {
          handleMenuSelect(selectedItem);
        }
        if (b && !last.b) {
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
      // Shutdown System
      if (window.__TAURI__) {
        import('@tauri-apps/plugin-process').then(({ exit }) => {
          exit(0);
        });
      } else {
        console.log('[Guide] Shutdown System triggered (not in Tauri)');
      }
    }
    // Items 0 and 1 are "coming soon"
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
        {/* Header: Gamerscore | Avatar | Clock */}
        <div data-testid="guide-header-bar" className="guide-header-bar">
          <span data-testid="guide-gamerscore" className="header-gamerscore">
            {gamerscore || '1337'} G
          </span>
          <div className="header-avatar-box">
            <div className="avatar-inner-fallback" />
          </div>
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
              onClick={() => setActiveTab(0)}
            >
              <span>Xenia Guide</span>
            </div>
            <div
              data-testid="guide-tab-home"
              className={`tab-vertical primary ${activeTab === 0 ? '' : ''}`}
              onClick={() => setActiveTab(0)}
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
                    setSelectedItem(index);
                    handleMenuSelect(index);
                  }}
                  onMouseEnter={() => setSelectedItem(index)}
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
              onClick={() => setActiveTab(1)}
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

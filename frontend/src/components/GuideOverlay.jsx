import React, { useState, useEffect, useCallback, useRef } from 'react';
import playSound from '../utils/soundManager';
import '../styles/GuideOverlay.css';

const GuideOverlay = ({ isOpen, onClose, onNavigateHome, xboxProfile, isLoggedIn, onLogin, recentGames, onQuickResume }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState(0);
  const containerRef = useRef(null);

  // Build unified menu: Home, Shutdown, then recent games
  const menuItems = [
    { id: 'home', label: 'Home', badge: '', badgeClass: '', type: 'action' },
    { id: 'shutdown', label: 'Shutdown System', badge: '(Exit App)', badgeClass: 'exit-badge', type: 'action' },
    ...((recentGames || []).slice(0, 5).map((game, i) => ({
      id: `game-${i}`,
      label: game.title,
      badge: game.hasQuickResume ? 'Quick Resume' : '',
      badgeClass: game.hasQuickResume ? 'resume-badge' : '',
      type: 'game',
      game,
    }))),
  ];

  const itemCount = menuItems.length;

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSelectedItem(0);
    }
  }, [isOpen]);

  // Focus
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

  const handleMenuAction = useCallback((index) => {
    const item = menuItems[index];
    if (!item) return;

    if (item.id === 'home') {
      playSound('select');
      onClose();
      if (onNavigateHome) onNavigateHome();
    } else if (item.id === 'shutdown') {
      playSound('select');
      if (window.__TAURI__) {
        import('@tauri-apps/plugin-process').then(({ exit }) => exit(0));
      }
    } else if (item.type === 'game' && item.game) {
      playSound('select');
      if (onQuickResume) onQuickResume(item.game);
      onClose();
    }
  }, [menuItems, onClose, onNavigateHome, onQuickResume]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;
      if (e.key === 'Tab' || e.key === 'Home') return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          playSound('focus');
          setSelectedItem((prev) => (prev > 0 ? prev - 1 : itemCount - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          playSound('focus');
          setSelectedItem((prev) => (prev < itemCount - 1 ? prev + 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          handleMenuAction(selectedItem);
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
    [isOpen, selectedItem, itemCount, onClose, handleMenuAction]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleKeyDown]);

  // Direct gamepad polling for Guide
  const lastBtnRef = useRef({ a: false, b: false, up: false, down: false });

  useEffect(() => {
    if (!isOpen) return;
    let rafId;

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let gp = null;
      for (let i = 0; i < 4; i++) {
        if (gamepads[i] && gamepads[i].connected) { gp = gamepads[i]; break; }
      }

      if (gp) {
        const a = gp.buttons[0]?.pressed;
        const b = gp.buttons[1]?.pressed;
        const dpadUp = gp.buttons[12]?.pressed;
        const dpadDown = gp.buttons[13]?.pressed;
        // Also check left stick
        const stickUp = gp.axes[1] < -0.5;
        const stickDown = gp.axes[1] > 0.5;
        const last = lastBtnRef.current;

        const up = dpadUp || stickUp;
        const down = dpadDown || stickDown;

        if (up && !last.up) {
          playSound('focus');
          setSelectedItem((prev) => (prev > 0 ? prev - 1 : itemCount - 1));
        }
        if (down && !last.down) {
          playSound('focus');
          setSelectedItem((prev) => (prev < itemCount - 1 ? prev + 1 : 0));
        }
        if (a && !last.a) {
          handleMenuAction(selectedItem);
        }
        if (b && !last.b) {
          playSound('back');
          onClose();
        }

        lastBtnRef.current = { a, b, up, down };
      }

      rafId = requestAnimationFrame(pollGamepad);
    };

    rafId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, selectedItem, itemCount, onClose, handleMenuAction]);

  const handleSignInClick = () => {
    if (!isLoggedIn && onLogin) {
      playSound('select');
      onLogin();
    }
  };

  if (!isOpen) return null;

  const hasGames = recentGames && recentGames.length > 0;

  return (
    <>
      <div
        data-testid="guide-overlay-backdrop"
        className="guide-overlay-backdrop"
        onClick={onClose}
      />

      <div
        ref={containerRef}
        data-testid="guide-modal-container"
        className="guide-modal-container"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Single Clean Panel */}
        <div data-testid="guide-center-panel" className="guide-center-panel">
          {/* Panel Header: Xenia Guide title */}
          <div className="guide-panel-header" data-testid="guide-panel-header">
            <span className="guide-title-text">Xenia Guide</span>
          </div>

          {/* Profile Row: Avatar + Sign In/Gamertag + Clock */}
          <div className="guide-profile-row" data-testid="guide-profile-row">
            <div 
              className="profile-avatar-box" 
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
            <div className="profile-info">
              {!isLoggedIn && (
                <span className="profile-signin-text" data-testid="guide-signin-text" onClick={handleSignInClick}>
                  Sign In
                </span>
              )}
              {isLoggedIn && xboxProfile?.gamertag && (
                <span className="profile-gamertag" data-testid="guide-gamertag">{xboxProfile.gamertag}</span>
              )}
            </div>
            <span data-testid="guide-clock" className="profile-clock">{formatTime(currentTime)}</span>
          </div>

          {/* Divider */}
          <div className="guide-divider" />

          {/* Menu Items */}
          <div className="guide-menu-list" data-testid="guide-menu-list">
            {/* Home + Shutdown */}
            {menuItems.slice(0, 2).map((item, index) => (
              <div
                key={item.id}
                data-testid={`guide-menu-item-${index}`}
                className={`guide-menu-item ${index === selectedItem ? 'selected' : ''}`}
                onClick={() => { setSelectedItem(index); handleMenuAction(index); }}
                onMouseEnter={() => { if (index !== selectedItem) { playSound('focus'); setSelectedItem(index); } }}
              >
                <span className="menu-label">{item.label}</span>
                {item.badge && <span className={`menu-badge ${item.badgeClass}`}>{item.badge}</span>}
              </div>
            ))}

            {/* Games Section */}
            {hasGames && (
              <>
                <div className="guide-section-divider" />
                <div className="guide-section-header" data-testid="guide-games-header">Games</div>
                {menuItems.slice(2).map((item, index) => {
                  const globalIndex = index + 2;
                  return (
                    <div
                      key={item.id}
                      data-testid={`guide-game-item-${index}`}
                      className={`guide-menu-item game-item ${globalIndex === selectedItem ? 'selected' : ''}`}
                      onClick={() => { setSelectedItem(globalIndex); handleMenuAction(globalIndex); }}
                      onMouseEnter={() => { if (globalIndex !== selectedItem) { playSound('focus'); setSelectedItem(globalIndex); } }}
                    >
                      <div className="game-item-info">
                        {item.game?.cover && <img src={item.game.cover} alt="" className="game-thumb" />}
                        <span className="menu-label">{item.label}</span>
                      </div>
                      {item.badge && <span className={`menu-badge ${item.badgeClass}`}>{item.badge}</span>}
                    </div>
                  );
                })}
              </>
            )}
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
      </div>
    </>
  );
};

export default GuideOverlay;

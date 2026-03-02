import React, { useState, useEffect, useCallback, useRef } from 'react';
import playSound from '../utils/soundManager';
import '../styles/GuideOverlay.css';

const GuideOverlay = ({ isOpen, onClose, onNavigateHome, xboxProfile, isLoggedIn, onLogin, recentGames, onQuickResume }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState(0);
  const [activeTab, setActiveTab] = useState(0); // 0 = Friends & Parties, 1 = Games
  const [slideDirection, setSlideDirection] = useState(null);
  const containerRef = useRef(null);

  // Tab 0: Friends & Parties
  const friendsItems = [
    { id: 'home', label: 'Home' },
    { id: 'shutdown', label: 'Shutdown System', badge: '(Exit App)', badgeClass: 'exit-badge' },
  ];

  // Tab 1: Games (recently played)
  const gamesItems = (recentGames || []).slice(0, 5).map((game, i) => ({
    id: `recent-${i}`,
    label: game.title,
    badge: game.hasQuickResume ? 'Quick Resume' : '',
    badgeClass: game.hasQuickResume ? 'resume-badge' : '',
    game,
  }));

  const currentItems = activeTab === 0 ? friendsItems : gamesItems;
  const itemCount = currentItems.length || 1;

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSelectedItem(0);
      setActiveTab(0);
      setSlideDirection(null);
    }
  }, [isOpen]);

  // Focus
  useEffect(() => {
    if (isOpen && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isOpen]);

  // Reset selection when switching tabs
  useEffect(() => {
    setSelectedItem(0);
  }, [activeTab]);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const switchTab = useCallback((direction) => {
    const newTab = activeTab + direction;
    if (newTab < 0 || newTab > 1) return;
    setSlideDirection(direction > 0 ? 'slide-left' : 'slide-right');
    playSound(direction > 0 ? 'panelRight' : 'panelLeft');
    setActiveTab(newTab);
    setTimeout(() => setSlideDirection(null), 250);
  }, [activeTab]);

  const handleMenuAction = useCallback((index) => {
    if (activeTab === 0) {
      // Friends & Parties tab
      const item = friendsItems[index];
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
      }
    } else {
      // Games tab - quick resume / launch
      const item = gamesItems[index];
      if (!item) return;
      playSound('select');
      if (onQuickResume && item.game) {
        onQuickResume(item.game);
      }
      onClose();
    }
  }, [activeTab, friendsItems, gamesItems, onClose, onNavigateHome, onQuickResume]);

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
        case 'ArrowLeft':
        case 'q': // LB
          e.preventDefault();
          e.stopPropagation();
          switchTab(-1);
          break;
        case 'ArrowRight':
        case 'e': // RB
          e.preventDefault();
          e.stopPropagation();
          switchTab(1);
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
    [isOpen, selectedItem, itemCount, onClose, switchTab, handleMenuAction]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleKeyDown]);

  // Gamepad direct polling (backup for when GlobalControllerListener isn't catching)
  const lastBtnRef = useRef({ a: false, b: false, up: false, down: false, left: false, right: false, lb: false, rb: false });

  useEffect(() => {
    if (!isOpen) return;
    let rafId;

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[0];

      if (gp) {
        const a = gp.buttons[0]?.pressed;
        const b = gp.buttons[1]?.pressed;
        const lb = gp.buttons[4]?.pressed;
        const rb = gp.buttons[5]?.pressed;
        const dpadUp = gp.buttons[12]?.pressed;
        const dpadDown = gp.buttons[13]?.pressed;
        const dpadLeft = gp.buttons[14]?.pressed;
        const dpadRight = gp.buttons[15]?.pressed;
        const last = lastBtnRef.current;

        if (dpadUp && !last.up) {
          playSound('focus');
          setSelectedItem((prev) => (prev > 0 ? prev - 1 : itemCount - 1));
        }
        if (dpadDown && !last.down) {
          playSound('focus');
          setSelectedItem((prev) => (prev < itemCount - 1 ? prev + 1 : 0));
        }
        if ((dpadLeft && !last.left) || (lb && !last.lb)) {
          switchTab(-1);
        }
        if ((dpadRight && !last.right) || (rb && !last.rb)) {
          switchTab(1);
        }
        if (a && !last.a) {
          handleMenuAction(selectedItem);
        }
        if (b && !last.b) {
          playSound('back');
          onClose();
        }

        lastBtnRef.current = { a, b, up: dpadUp, down: dpadDown, left: dpadLeft, right: dpadRight, lb, rb };
      }

      rafId = requestAnimationFrame(pollGamepad);
    };

    rafId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, selectedItem, itemCount, onClose, switchTab, handleMenuAction]);

  const handleSignInClick = () => {
    if (!isLoggedIn && onLogin) {
      playSound('select');
      onLogin();
    }
  };

  if (!isOpen) return null;

  const renderFriendsTab = () => (
    <div className={`tab-content ${slideDirection || ''}`} data-testid="guide-friends-content">
      <div className="menu-list">
        {friendsItems.map((item, index) => (
          <div
            key={item.id}
            data-testid={`guide-menu-item-${index}`}
            className={`guide-menu-item ${index === selectedItem ? 'selected' : ''}`}
            onClick={() => {
              setSelectedItem(index);
              handleMenuAction(index);
            }}
            onMouseEnter={() => {
              if (index !== selectedItem) {
                playSound('focus');
                setSelectedItem(index);
              }
            }}
          >
            <span className="menu-label">{item.label}</span>
            {item.badge && <span className={`menu-badge ${item.badgeClass || ''}`}>{item.badge}</span>}
          </div>
        ))}
      </div>
    </div>
  );

  const renderGamesTab = () => (
    <div className={`tab-content ${slideDirection || ''}`} data-testid="guide-games-content">
      {gamesItems.length > 0 ? (
        <div className="menu-list">
          <div className="recently-played-header" data-testid="recently-played-header">Recently Played</div>
          {gamesItems.map((item, index) => (
            <div
              key={item.id}
              data-testid={`guide-game-item-${index}`}
              className={`guide-menu-item game-item ${index === selectedItem ? 'selected' : ''}`}
              onClick={() => {
                setSelectedItem(index);
                handleMenuAction(index);
              }}
              onMouseEnter={() => {
                if (index !== selectedItem) {
                  playSound('focus');
                  setSelectedItem(index);
                }
              }}
            >
              <div className="game-item-info">
                {item.game?.cover && (
                  <img src={item.game.cover} alt="" className="game-thumb" />
                )}
                <span className="menu-label">{item.label}</span>
              </div>
              {item.badge && (
                <span className={`menu-badge ${item.badgeClass}`}>{item.badge}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="menu-list">
          <div className="empty-games-msg" data-testid="no-recent-games">
            No recently played games
          </div>
        </div>
      )}
    </div>
  );

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
        {/* Header */}
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
            <span className="header-signin-text" data-testid="guide-signin-text" onClick={handleSignInClick}>
              Sign In
            </span>
          )}
          {isLoggedIn && xboxProfile?.gamertag && (
            <span className="header-gamertag" data-testid="guide-gamertag">{xboxProfile.gamertag}</span>
          )}
          <span data-testid="guide-clock" className="header-clock">{formatTime(currentTime)}</span>
        </div>

        {/* Tabs + Panel */}
        <div className="guide-content-wrapper">
          {/* Left Tabs */}
          <div className="guide-left-tabs">
            <div
              data-testid="guide-tab-xenia"
              className="tab-vertical secondary"
              onClick={() => switchTab(activeTab === 0 ? 0 : -1)}
            >
              <span>Xenia Guide</span>
            </div>
            <div
              data-testid="guide-tab-friends"
              className={`tab-vertical ${activeTab === 0 ? 'primary active-tab' : 'primary inactive-tab'}`}
              onClick={() => { if (activeTab !== 0) switchTab(-1); }}
            >
              <span>Friends &amp; Parties</span>
            </div>
          </div>

          {/* Center Panel */}
          <div data-testid="guide-center-panel" className="guide-center-panel">
            <div className="panel-content-area">
              {activeTab === 0 ? renderFriendsTab() : renderGamesTab()}
            </div>

            {/* Footer Hints */}
            <div data-testid="guide-footer-hints" className="guide-footer-hints">
              <div className="hint-group">
                <div className="hint-btn bumper-hint">LB</div>
                <div className="hint-btn bumper-hint">RB</div>
                <span>Tabs</span>
              </div>
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
              className={`tab-vertical ${activeTab === 1 ? 'right active-tab' : 'right inactive-tab'}`}
              onClick={() => { if (activeTab !== 1) switchTab(1); }}
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

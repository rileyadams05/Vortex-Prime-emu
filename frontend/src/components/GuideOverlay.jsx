import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useGamepad } from '../context/GamepadContext';
import playSound from '../utils/soundManager';
import '../styles/GuideOverlay.css';

const GuideOverlay = ({ isOpen, onClose, onNavigateHome, xboxProfile, isLoggedIn, onLogin, recentGames, onQuickResume }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState(0);
  const containerRef = useRef(null);
  const { onPress: onGamepadPress } = useGamepad();

  const menuItems = useMemo(() => [
    { id: 'friends', label: 'Friends & Parties', badge: '', badgeClass: '', type: 'section', sectionStart: true, sectionLabel: '' },
    { id: 'home', label: 'Home', badge: '', badgeClass: '', type: 'action', sectionStart: true, sectionLabel: '' },
    { id: 'shutdown', label: 'Shutdown System', badge: '(Exit App)', badgeClass: 'exit-badge', type: 'action' },
    ...((recentGames || []).slice(0, 5).map((game, i) => ({
      id: `game-${i}`,
      label: game.title,
      badge: game.hasQuickResume ? 'Quick Resume' : '',
      badgeClass: game.hasQuickResume ? 'resume-badge' : '',
      type: 'game',
      game,
      sectionStart: i === 0,
      sectionLabel: 'Games',
    }))),
  ], [recentGames]);

  const itemCount = menuItems.length;

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Reset on open
  useEffect(() => {
    if (isOpen) setSelectedItem(0);
  }, [isOpen]);

  // Focus
  useEffect(() => {
    if (isOpen && containerRef.current) containerRef.current.focus();
  }, [isOpen]);

  const formatTime = (date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const handleMenuAction = useCallback((index) => {
    const item = menuItems[index];
    if (!item) return;

    if (item.id === 'friends') {
      playSound('select');
      // Friends & Parties - placeholder for now
    } else if (item.id === 'home') {
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
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return;
    if (e.key === 'Tab' || e.key === 'Home') return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault(); e.stopPropagation();
        playSound('focus');
        setSelectedItem(prev => (prev > 0 ? prev - 1 : itemCount - 1));
        break;
      case 'ArrowDown':
        e.preventDefault(); e.stopPropagation();
        playSound('focus');
        setSelectedItem(prev => (prev < itemCount - 1 ? prev + 1 : 0));
        break;
      case 'Enter':
        e.preventDefault(); e.stopPropagation();
        handleMenuAction(selectedItem);
        break;
      case 'Escape':
      case 'Backspace':
        e.preventDefault(); e.stopPropagation();
        playSound('back');
        onClose();
        break;
      default: break;
    }
  }, [isOpen, selectedItem, itemCount, onClose, handleMenuAction]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleKeyDown]);

  // ==== GAMEPAD: Direct controller input ====
  const selectedRef = useRef(selectedItem);
  const itemCountRef = useRef(itemCount);
  useEffect(() => { selectedRef.current = selectedItem; }, [selectedItem]);
  useEffect(() => { itemCountRef.current = itemCount; }, [itemCount]);

  useEffect(() => {
    if (!isOpen) return;

    const unsub = onGamepadPress((event) => {
      if (event.type !== 'press') return;
      const btn = event.button;
      const count = itemCountRef.current;
      const sel = selectedRef.current;

      if (btn === 'dpadUp' || btn === 'stickUp') {
        playSound('focus');
        setSelectedItem(sel > 0 ? sel - 1 : count - 1);
      }
      if (btn === 'dpadDown' || btn === 'stickDown') {
        playSound('focus');
        setSelectedItem(sel < count - 1 ? sel + 1 : 0);
      }
      if (btn === 'a') {
        handleMenuAction(sel);
      }
      if (btn === 'b') {
        playSound('back');
        onClose();
      }
    });

    return unsub;
  }, [isOpen, onGamepadPress, onClose, handleMenuAction]);

  const handleSignInClick = () => {
    if (!isLoggedIn && onLogin) { playSound('select'); onLogin(); }
  };

  if (!isOpen) return null;

  const hasGames = recentGames && recentGames.length > 0;

  // Group items for rendering with section headers
  const renderMenuItem = (item, index) => {
    const isSelected = index === selectedItem;
    const isGameItem = item.type === 'game';

    return (
      <div
        key={item.id}
        data-testid={isGameItem ? `guide-game-item-${index - 3}` : `guide-menu-item-${index}`}
        className={`guide-menu-item ${isGameItem ? 'game-item' : ''} ${isSelected ? 'selected' : ''}`}
        onClick={() => { setSelectedItem(index); handleMenuAction(index); }}
        onMouseEnter={() => { if (index !== selectedItem) { playSound('focus'); setSelectedItem(index); } }}
      >
        {isGameItem ? (
          <>
            <div className="game-item-info">
              {item.game?.cover && <img src={item.game.cover} alt="" className="game-thumb" />}
              <span className="menu-label">{item.label}</span>
            </div>
            {item.badge && <span className={`menu-badge ${item.badgeClass}`}>{item.badge}</span>}
          </>
        ) : (
          <>
            <span className="menu-label">{item.label}</span>
            {item.badge && <span className={`menu-badge ${item.badgeClass}`}>{item.badge}</span>}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div data-testid="guide-overlay-backdrop" className="guide-overlay-backdrop" onClick={onClose} />

      <div ref={containerRef} data-testid="guide-modal-container" className="guide-modal-container" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div data-testid="guide-center-panel" className="guide-center-panel">
          {/* Panel Header */}
          <div className="guide-panel-header" data-testid="guide-panel-header">
            <span className="guide-title-text">Xenia Guide</span>
          </div>

          {/* Profile Row */}
          <div className="guide-profile-row" data-testid="guide-profile-row">
            <div className="profile-avatar-box" data-testid="guide-avatar-box" onClick={handleSignInClick} style={{ cursor: isLoggedIn ? 'default' : 'pointer' }}>
              {isLoggedIn && xboxProfile?.profilePicture ? (
                <img src={xboxProfile.profilePicture} alt="Avatar" className="guide-avatar-img" />
              ) : (
                <div className="avatar-inner-fallback" />
              )}
            </div>
            <div className="profile-info">
              {!isLoggedIn && <span className="profile-signin-text" data-testid="guide-signin-text" onClick={handleSignInClick}>Sign In</span>}
              {isLoggedIn && xboxProfile?.gamertag && <span className="profile-gamertag" data-testid="guide-gamertag">{xboxProfile.gamertag}</span>}
            </div>
            <span data-testid="guide-clock" className="profile-clock">{formatTime(currentTime)}</span>
          </div>

          <div className="guide-divider" />

          {/* Menu Items */}
          <div className="guide-menu-list" data-testid="guide-menu-list">
            {/* Friends & Parties */}
            {renderMenuItem(menuItems[0], 0)}

            {/* Divider before Home/Shutdown */}
            <div className="guide-section-divider" />

            {/* Home + Shutdown */}
            {renderMenuItem(menuItems[1], 1)}
            {renderMenuItem(menuItems[2], 2)}

            {/* Games Section */}
            {hasGames && (
              <>
                <div className="guide-section-divider" />
                <div className="guide-section-header" data-testid="guide-games-header">Games</div>
                {menuItems.slice(3).map((item, i) => renderMenuItem(item, i + 3))}
              </>
            )}
          </div>

          {/* Footer */}
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

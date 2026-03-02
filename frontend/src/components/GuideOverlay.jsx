import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useGamepad } from '../context/GamepadContext';
import playSound from '../utils/soundManager';
import '../styles/GuideOverlay.css';

const tauriInvoke = async (cmd, args = {}) => {
  if (window.__TAURI__) {
    const { invoke } = window.__TAURI__.core || window.__TAURI__.tauri;
    return invoke(cmd, args);
  }
  return null;
};

const sendQuickResumeCommand = async (gameId, savePath) => {
  return tauriInvoke('quick_resume_load', { gameId, savePath });
};

const TAB_NAMES = ['Friends and Parties', 'Messages', 'Home'];
const TAB_COUNT = 3;

const GuideOverlay = ({ isOpen, onClose, onNavigateHome, onNavigateSettings, xboxProfile, isLoggedIn, onLogin, recentGames, onQuickResume, gameGroups, onCreateGroup, onOpenGroups, onOpenKeyboard }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState(0);
  const [focusZone, setFocusZone] = useState('menu');
  const [tabTransition, setTabTransition] = useState('');
  const containerRef = useRef(null);
  const { onPress: onGamepadPress } = useGamepad();

  // Home tab sub-views
  const [homeSection, setHomeSection] = useState('main'); // main | groups

  // Friends & Parties + Messages: Coming Soon (requires Xbox account)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(0);
      setSelectedItem(0);
      setFocusZone('menu');
      setHomeSection('main');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && containerRef.current) containerRef.current.focus();
  }, [isOpen]);

  const formatTime = useCallback((date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }), []);

  // Seed initial messages for a conversation if not yet loaded
  // HOME tab items
  const homeMenuItems = useMemo(() => [
    { id: 'home', label: 'Home', type: 'action' },
    { id: 'settings', label: 'Settings', type: 'action' },
    { id: 'shutdown', label: 'Shutdown System', badge: '(Exit App)', type: 'action' },
    ...((recentGames || []).slice(0, 5).map((game, i) => ({
      id: `home-game-${i}`,
      label: game.title,
      type: 'game',
      game,
      hasQuickResume: game.hasQuickResume || false,
    }))),
  ], [recentGames]);

  const switchTab = useCallback((direction) => {
    const newTab = direction === 'right'
      ? Math.min(activeTab + 1, TAB_COUNT - 1)
      : Math.max(activeTab - 1, 0);
    if (newTab === activeTab) return;
    playSound('focus');
    setTabTransition(direction === 'right' ? 'slide-left' : 'slide-right');
    setTimeout(() => {
      setActiveTab(newTab);
      setSelectedItem(0);
      setFocusZone('menu');
      setHomeSection('main');
      setTabTransition('');
    }, 150);
  }, [activeTab]);

  const handleHomeAction = useCallback((index) => {
    const item = homeMenuItems[index];
    if (!item) return;
    if (item.id === 'home') { playSound('select'); onClose(); if (onNavigateHome) onNavigateHome(); }
    else if (item.id === 'settings') { playSound('select'); onClose(); if (onNavigateSettings) onNavigateSettings(); }
    else if (item.id === 'shutdown') {
      playSound('select');
      if (window.__TAURI__) { import('@tauri-apps/plugin-process').then(({ exit }) => exit(0)); }
    } else if (item.type === 'game' && item.game) {
      playSound('select');
      if (item.hasQuickResume) sendQuickResumeCommand(item.game.titleId || item.game.id, item.game.savePath || '');
      if (onQuickResume) onQuickResume(item.game);
      onClose();
    }
  }, [homeMenuItems, onClose, onNavigateHome, onNavigateSettings, onQuickResume]);

  // Keyboard handler
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return;
    if (e.key === 'Tab' || e.key === 'Home') return;

    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && focusZone === 'tabs') {
      e.preventDefault(); e.stopPropagation();
      switchTab(e.key === 'ArrowRight' ? 'right' : 'left');
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault(); e.stopPropagation();
        playSound('focus');
        if (focusZone === 'menu') {
          if (selectedItem > 0) setSelectedItem(prev => prev - 1);
          else setFocusZone('tabs');
        }
        break;
      case 'ArrowDown':
        e.preventDefault(); e.stopPropagation();
        playSound('focus');
        if (focusZone === 'tabs') { setFocusZone('menu'); setSelectedItem(0); }
        else if (focusZone === 'menu') setSelectedItem(prev => prev + 1);
        break;
      case 'Enter':
        e.preventDefault(); e.stopPropagation();
        // Handled per-tab in renderers via click
        break;
      case 'Escape':
      case 'Backspace':
        e.preventDefault(); e.stopPropagation();
        playSound('back');
        // Check if we're in a sub-section first
        if (activeTab === 2 && homeSection !== 'main') {
          setHomeSection('main'); setSelectedItem(0);
        } else {
          onClose();
        }
        break;
      default: break;
    }
  }, [isOpen, selectedItem, focusZone, activeTab, homeSection, onClose, switchTab]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleKeyDown]);

  // Gamepad
  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = { selectedItem, focusZone, activeTab, homeSection };
  }, [selectedItem, focusZone, activeTab, homeSection]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = onGamepadPress((event) => {
      if (event.type !== 'press') return;
      const btn = event.button;
      const s = stateRef.current;

      if (btn === 'b') {
        playSound('back');
        if (s.activeTab === 2 && s.homeSection !== 'main') {
          setHomeSection('main'); setSelectedItem(0);
        } else { onClose(); }
        return;
      }
      if (btn === 'lb' || btn === 'leftBumper') { switchTab('left'); return; }
      if (btn === 'rb' || btn === 'rightBumper') { switchTab('right'); return; }

      if (btn === 'dpadUp' || btn === 'stickUp') {
        playSound('focus');
        if (s.focusZone === 'menu') {
          if (s.selectedItem > 0) setSelectedItem(s.selectedItem - 1);
          else setFocusZone('tabs');
        }
      }
      if (btn === 'dpadDown' || btn === 'stickDown') {
        playSound('focus');
        if (s.focusZone === 'tabs') { setFocusZone('menu'); setSelectedItem(0); }
        else if (s.focusZone === 'menu') setSelectedItem(s.selectedItem + 1);
      }
      if (btn === 'dpadLeft' || btn === 'stickLeft') {
        if (s.focusZone === 'tabs') switchTab('left');
      }
      if (btn === 'dpadRight' || btn === 'stickRight') {
        if (s.focusZone === 'tabs') switchTab('right');
      }
    });
    return unsub;
  }, [isOpen, onGamepadPress, onClose, switchTab]);

  if (!isOpen) return null;

  // ========== FRIENDS & PARTIES TAB ==========
  const renderFriendsPartiesTab = () => (
    <div className={`guide-tab-content ${tabTransition}`}>
      <div className="coming-soon-tab" data-testid="friends-coming-soon">
        <div className="coming-soon-tab-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <span className="coming-soon-tab-title">Friends and Parties</span>
        <span className="coming-soon-badge large">Coming Soon</span>
        <p className="coming-soon-tab-desc">Sign in with your Xbox account to see your Xbox Live friends and linked Discord friends here.</p>
      </div>
    </div>
  );

  // ========== MESSAGES TAB ==========
  const renderMessagesTab = () => (
    <div className={`guide-tab-content ${tabTransition}`}>
      <div className="coming-soon-tab" data-testid="messages-coming-soon">
        <div className="coming-soon-tab-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <span className="coming-soon-tab-title">Messages</span>
        <span className="coming-soon-badge large">Coming Soon</span>
        <p className="coming-soon-tab-desc">Your Xbox Live and Discord messages will appear here once you connect your Xbox account.</p>
      </div>
    </div>
  );

  // ========== HOME TAB ==========
  const renderHomeTab = () => {
    // Sub-view: My Groups
    if (homeSection === 'groups') {
      const groups = gameGroups || [];
      return (
        <div className={`guide-tab-content ${tabTransition}`}>
          <div className="guide-section-header-row">
            <button className="guide-back-btn" data-testid="groups-back-btn" onClick={() => { playSound('back'); setHomeSection('main'); setSelectedItem(0); }}>Back</button>
            <span className="guide-section-title">My Groups</span>
          </div>
          <div
            className={`guide-menu-item party-action create ${focusZone === 'menu' && selectedItem === 0 ? 'selected' : ''}`}
            data-testid="guide-create-group-btn"
            onClick={() => {
              playSound('select');
              if (onOpenKeyboard) {
                onOpenKeyboard((name) => { if (onCreateGroup) onCreateGroup(name); });
              }
            }}
            onMouseEnter={() => { setFocusZone('menu'); setSelectedItem(0); }}
          >
            <span className="menu-label">+ Create New Group</span>
          </div>
          {groups.length === 0 && <div className="friends-empty">No groups yet</div>}
          {groups.map((group, i) => (
            <div key={group.id}
              className={`guide-menu-item ${focusZone === 'menu' && selectedItem === i + 1 ? 'selected' : ''}`}
              data-testid={`guide-group-${i}`}
              onClick={() => { playSound('select'); onClose(); if (onOpenGroups) onOpenGroups(); }}
              onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(i + 1); }}
            >
              <span className="menu-label">{group.name}</span>
              <span className="menu-badge">{group.games.length} game{group.games.length !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      );
    }

    // Main Home view
    return (
      <div className={`guide-tab-content ${tabTransition}`}>
        <div
          className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 0 ? 'selected' : ''}`}
          data-testid="guide-home-btn"
          onClick={() => { setFocusZone('menu'); setSelectedItem(0); handleHomeAction(0); }}
          onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(0); }}
        >
          <span className="menu-label">Home</span>
        </div>
        <div
          className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 1 ? 'selected' : ''}`}
          data-testid="guide-my-groups-btn"
          onClick={() => { playSound('select'); setHomeSection('groups'); setSelectedItem(0); }}
          onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(1); }}
        >
          <span className="menu-label">My Groups</span>
          <span className="menu-badge">{(gameGroups || []).length} group{(gameGroups || []).length !== 1 ? 's' : ''}</span>
        </div>
        <div
          className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 2 ? 'selected' : ''}`}
          data-testid="guide-settings-btn"
          onClick={() => { setFocusZone('menu'); setSelectedItem(2); handleHomeAction(1); }}
          onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(2); }}
        >
          <span className="menu-label">Settings</span>
        </div>
        <div
          className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 3 ? 'selected' : ''}`}
          data-testid="guide-shutdown-btn"
          onClick={() => { setFocusZone('menu'); setSelectedItem(3); handleHomeAction(2); }}
          onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(3); }}
        >
          <span className="menu-label">Shutdown System</span>
          <span className="menu-badge exit-badge">(Exit App)</span>
        </div>

        <div className="guide-section-divider" />
        <div className="guide-section-header">Recently Played</div>

        {homeMenuItems.slice(3).map((item, idx) => {
          const menuIdx = idx + 4;
          return (
            <div
              key={item.id}
              className={`guide-menu-item game-item ${focusZone === 'menu' && selectedItem === menuIdx ? 'selected' : ''}`}
              data-testid={`guide-home-game-${idx}`}
              onClick={() => { setFocusZone('menu'); setSelectedItem(menuIdx); handleHomeAction(menuIdx - 1); }}
              onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(menuIdx); }}
            >
              <div className="game-item-info">
                {item.game?.cover && <img src={item.game.cover} alt="" className="game-thumb" />}
                <span className="menu-label">{item.label}</span>
              </div>
              {item.hasQuickResume && <span className="menu-badge resume-badge">Quick Resume</span>}
            </div>
          );
        })}

        {(recentGames || []).length === 0 && (
          <div className="friends-empty">No recently played games</div>
        )}
      </div>
    );
  };

  const tabRenderers = [renderFriendsPartiesTab, renderMessagesTab, renderHomeTab];

  return (
    <>
      <div data-testid="guide-overlay-backdrop" className="guide-overlay-backdrop" onClick={onClose} />
      <div ref={containerRef} data-testid="guide-modal-container" className="guide-modal-container" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div data-testid="guide-center-panel" className="guide-center-panel">
          <div className="guide-panel-header"><span className="guide-title-text">Guide</span></div>

          <div className="guide-profile-row" data-testid="guide-profile-row">
            <div className="profile-avatar-box">
              {isLoggedIn && xboxProfile?.profilePicture ? <img src={xboxProfile.profilePicture} alt="Avatar" className="guide-avatar-img" /> : <div className="avatar-inner-fallback" />}
            </div>
            <div className="profile-info">
              {isLoggedIn && xboxProfile?.gamertag && <span className="profile-gamertag" data-testid="guide-gamertag">{xboxProfile.gamertag}</span>}
            </div>
            <span data-testid="guide-clock" className="profile-clock">{formatTime(currentTime)}</span>
          </div>

          <div className="guide-divider" />

          <div className={`guide-tab-bar ${focusZone === 'tabs' ? 'focused' : ''}`} data-testid="guide-tab-bar">
            {TAB_NAMES.map((name, i) => (
              <button key={i} className={`guide-tab ${activeTab === i ? 'active' : ''}`} data-testid={`tab-${name.toLowerCase().replace(/ /g, '-')}`}
                onClick={() => { if (activeTab !== i) { playSound('focus'); setTabTransition(i > activeTab ? 'slide-left' : 'slide-right'); setTimeout(() => { setActiveTab(i); setSelectedItem(0); setFocusZone('menu'); setHomeSection('main'); setTabTransition(''); }, 150); } }}>
                {name}
              </button>
            ))}
          </div>

          <div className="guide-menu-list" data-testid="guide-menu-list">
            {tabRenderers[activeTab]()}
          </div>

          <div data-testid="guide-footer-hints" className="guide-footer-hints">
            <div className="hint-group"><div className="hint-btn green">A</div><span>Select</span></div>
            <div className="hint-group"><div className="hint-btn red">B</div><span>{
              (activeTab === 2 && homeSection !== 'main') ? 'Back' : 'Close'
            }</span></div>
            <div className="hint-group"><span className="hint-bumper">LB</span><span className="hint-bumper">RB</span><span>Switch Tab</span></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GuideOverlay;

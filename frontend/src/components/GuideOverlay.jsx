import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGamepad } from '../context/GamepadContext';
import playSound from '../utils/soundManager';
import '../styles/GuideOverlay.css';

// Tauri command wrappers - these call real Rust commands when in Tauri
const tauriInvoke = async (cmd, args = {}) => {
  if (window.__TAURI__) {
    const { invoke } = window.__TAURI__.core || window.__TAURI__.tauri;
    return invoke(cmd, args);
  }
  return null;
};

const fetchUnifiedFriendsList = async (xuid) => {
  const result = await tauriInvoke('fetch_unified_friends_list', { xuid });
  if (result) return result;
  // Not in Tauri - return empty (no mock data)
  return { xbox_friends: [], discord_friends: [], linked_discord_id: null };
};

const sendQuickResumeCommand = async (gameId, savePath) => {
  return tauriInvoke('quick_resume_load', { gameId, savePath });
};

const GuideOverlay = ({ isOpen, onClose, onNavigateHome, xboxProfile, isLoggedIn, onLogin, recentGames, onQuickResume }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState(0); // 0 = Friends & Parties, 1 = Games
  const [selectedItem, setSelectedItem] = useState(0);
  const [focusZone, setFocusZone] = useState('menu'); // 'tabs' | 'toggle' | 'search' | 'menu'
  const [tabTransition, setTabTransition] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);
  const { onPress: onGamepadPress } = useGamepad();

  // Friends state
  const [platformFocus, setPlatformFocus] = useState('xbox'); // 'xbox' | 'discord'
  const [searchQuery, setSearchQuery] = useState('');
  const [friendsData, setFriendsData] = useState({ xbox_friends: [], discord_friends: [], linked_discord_id: null });
  const [friendsLoading, setFriendsLoading] = useState(false);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(0);
      setSelectedItem(0);
      setFocusZone('menu');
      setSearchQuery('');
    }
  }, [isOpen]);

  // Focus container
  useEffect(() => {
    if (isOpen && containerRef.current) containerRef.current.focus();
  }, [isOpen]);

  // Fetch friends when opened and logged in
  useEffect(() => {
    if (isOpen && isLoggedIn && xboxProfile?.xuid) {
      setFriendsLoading(true);
      fetchUnifiedFriendsList(xboxProfile.xuid).then(data => {
        setFriendsData(data);
        setFriendsLoading(false);
      }).catch(() => setFriendsLoading(false));
    }
  }, [isOpen, isLoggedIn, xboxProfile?.xuid]);

  const formatTime = (date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Tab content definitions
  const friendsMenuItems = [
    { id: 'home', label: 'Home', type: 'action' },
    { id: 'friends', label: 'Friends', type: 'friends-section' },
    { id: 'shutdown', label: 'Shutdown System', badge: '(Exit App)', type: 'action' },
  ];

  const gamesMenuItems = (recentGames || []).slice(0, 5).map((game, i) => ({
    id: `game-${i}`,
    label: game.title,
    type: 'game',
    game,
    hasQuickResume: game.hasQuickResume || false,
  }));

  const currentMenuItems = activeTab === 0 ? friendsMenuItems : gamesMenuItems;
  const itemCount = currentMenuItems.length;

  // Filtered friends for search
  const filteredXboxFriends = friendsData.xbox_friends.filter(f =>
    f.gamertag?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDiscordFriends = friendsData.discord_friends.filter(f =>
    f.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Tab switch with transition
  const switchTab = useCallback((direction) => {
    const newTab = direction === 'right' ? 1 : 0;
    if (newTab === activeTab) return;
    playSound('focus');
    setTabTransition(direction === 'right' ? 'slide-left' : 'slide-right');
    setTimeout(() => {
      setActiveTab(newTab);
      setSelectedItem(0);
      setFocusZone('menu');
      setTabTransition('');
    }, 150);
  }, [activeTab]);

  // Handle menu action
  const handleMenuAction = useCallback((index) => {
    const item = currentMenuItems[index];
    if (!item) return;

    if (item.id === 'home') {
      playSound('select');
      onClose();
      if (onNavigateHome) onNavigateHome();
    } else if (item.id === 'friends') {
      playSound('select');
      setFocusZone('toggle');
    } else if (item.id === 'shutdown') {
      playSound('select');
      if (window.__TAURI__) {
        import('@tauri-apps/plugin-process').then(({ exit }) => exit(0));
      }
    } else if (item.type === 'game' && item.game) {
      playSound('select');
      if (item.hasQuickResume) {
        // Wire to Tauri quick resume command
        sendQuickResumeCommand(item.game.titleId || item.game.id, item.game.savePath || '');
      }
      if (onQuickResume) onQuickResume(item.game);
      onClose();
    }
  }, [currentMenuItems, onClose, onNavigateHome, onQuickResume]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return;
    if (e.key === 'Tab' || e.key === 'Home') return;

    // LB/RB or ArrowLeft/Right at tab level switches tabs
    if (e.key === 'ArrowLeft' && focusZone === 'tabs') {
      e.preventDefault(); e.stopPropagation();
      switchTab('left');
      return;
    }
    if (e.key === 'ArrowRight' && focusZone === 'tabs') {
      e.preventDefault(); e.stopPropagation();
      switchTab('right');
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault(); e.stopPropagation();
        playSound('focus');
        if (focusZone === 'menu') {
          if (selectedItem > 0) setSelectedItem(prev => prev - 1);
          else setFocusZone(activeTab === 0 ? 'search' : 'tabs');
        } else if (focusZone === 'search') {
          setFocusZone('toggle');
        } else if (focusZone === 'toggle') {
          setFocusZone('tabs');
        } else if (focusZone === 'tabs') {
          // already at top
        }
        break;
      case 'ArrowDown':
        e.preventDefault(); e.stopPropagation();
        playSound('focus');
        if (focusZone === 'tabs') {
          setFocusZone(activeTab === 0 ? 'toggle' : 'menu');
        } else if (focusZone === 'toggle') {
          setFocusZone('search');
        } else if (focusZone === 'search') {
          setFocusZone('menu');
          setSelectedItem(0);
        } else if (focusZone === 'menu') {
          setSelectedItem(prev => (prev < itemCount - 1 ? prev + 1 : prev));
        }
        break;
      case 'ArrowLeft':
        e.preventDefault(); e.stopPropagation();
        if (focusZone === 'toggle') {
          setPlatformFocus('xbox');
          playSound('focus');
        }
        break;
      case 'ArrowRight':
        e.preventDefault(); e.stopPropagation();
        if (focusZone === 'toggle') {
          setPlatformFocus('discord');
          playSound('focus');
        }
        break;
      case 'Enter':
        e.preventDefault(); e.stopPropagation();
        if (focusZone === 'menu') handleMenuAction(selectedItem);
        else if (focusZone === 'search' && searchRef.current) searchRef.current.focus();
        else if (focusZone === 'tabs') { /* already handled by LR */ }
        break;
      case 'Escape':
      case 'Backspace':
        e.preventDefault(); e.stopPropagation();
        playSound('back');
        onClose();
        break;
      default: break;
    }
  }, [isOpen, selectedItem, itemCount, focusZone, activeTab, onClose, handleMenuAction, switchTab]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleKeyDown]);

  // Gamepad navigation
  const stateRef = useRef({ selectedItem, focusZone, activeTab, itemCount, platformFocus });
  useEffect(() => {
    stateRef.current = { selectedItem, focusZone, activeTab, itemCount, platformFocus };
  }, [selectedItem, focusZone, activeTab, itemCount, platformFocus]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = onGamepadPress((event) => {
      if (event.type !== 'press') return;
      const btn = event.button;
      const s = stateRef.current;

      if (btn === 'b') { playSound('back'); onClose(); return; }

      // LB/RB = tab switch
      if (btn === 'lb' || btn === 'leftBumper') { switchTab('left'); return; }
      if (btn === 'rb' || btn === 'rightBumper') { switchTab('right'); return; }

      if (btn === 'dpadUp' || btn === 'stickUp') {
        playSound('focus');
        if (s.focusZone === 'menu') {
          if (s.selectedItem > 0) setSelectedItem(s.selectedItem - 1);
          else setFocusZone(s.activeTab === 0 ? 'search' : 'tabs');
        } else if (s.focusZone === 'search') setFocusZone('toggle');
        else if (s.focusZone === 'toggle') setFocusZone('tabs');
      }
      if (btn === 'dpadDown' || btn === 'stickDown') {
        playSound('focus');
        if (s.focusZone === 'tabs') setFocusZone(s.activeTab === 0 ? 'toggle' : 'menu');
        else if (s.focusZone === 'toggle') setFocusZone('search');
        else if (s.focusZone === 'search') { setFocusZone('menu'); setSelectedItem(0); }
        else if (s.focusZone === 'menu') setSelectedItem(Math.min(s.selectedItem + 1, s.itemCount - 1));
      }
      if (btn === 'dpadLeft' || btn === 'stickLeft') {
        if (s.focusZone === 'toggle') { setPlatformFocus('xbox'); playSound('focus'); }
        if (s.focusZone === 'tabs') switchTab('left');
      }
      if (btn === 'dpadRight' || btn === 'stickRight') {
        if (s.focusZone === 'toggle') { setPlatformFocus('discord'); playSound('focus'); }
        if (s.focusZone === 'tabs') switchTab('right');
      }
      if (btn === 'a') {
        if (s.focusZone === 'menu') handleMenuAction(s.selectedItem);
      }
    });
    return unsub;
  }, [isOpen, onGamepadPress, onClose, handleMenuAction, switchTab]);

  const handleSignInClick = () => {
    if (!isLoggedIn && onLogin) { playSound('select'); onLogin(); }
  };

  if (!isOpen) return null;

  const renderFriendsTab = () => (
    <div className={`guide-tab-content ${tabTransition}`}>
      {/* Menu items: Home, Friends, Shutdown */}
      {friendsMenuItems.map((item, i) => {
        if (item.id === 'friends') {
          // Render the friends section inline
          return (
            <div key="friends-section">
              <div
                className={`guide-menu-item ${focusZone === 'menu' && selectedItem === i ? 'selected' : ''}`}
                data-testid="guide-friends-item"
                onClick={() => { setSelectedItem(i); handleMenuAction(i); }}
                onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(i); }}
              >
                <span className="menu-label">Friends</span>
              </div>

              {/* Platform Toggle */}
              <div className={`platform-toggle ${focusZone === 'toggle' ? 'focused' : ''}`} data-testid="platform-toggle">
                <button
                  className={`toggle-btn ${platformFocus === 'xbox' ? 'active' : ''}`}
                  data-testid="toggle-xbox"
                  onClick={() => { setPlatformFocus('xbox'); playSound('focus'); }}
                >
                  Xbox Live
                </button>
                <button
                  className={`toggle-btn ${platformFocus === 'discord' ? 'active' : ''}`}
                  data-testid="toggle-discord"
                  onClick={() => { setPlatformFocus('discord'); playSound('focus'); }}
                >
                  Discord
                </button>
              </div>

              {/* Search */}
              <div className={`guide-search ${focusZone === 'search' ? 'focused' : ''}`}>
                <input
                  ref={searchRef}
                  type="text"
                  data-testid="friends-search-input"
                  className="guide-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={platformFocus === 'xbox' ? 'Search Gamertag...' : 'Search Discord Username...'}
                />
              </div>

              {/* Friends List */}
              <div className="friends-list" data-testid="friends-list">
                {friendsLoading && <div className="friends-loading">Loading friends...</div>}

                {!friendsLoading && isLoggedIn && (
                  <>
                    {(platformFocus === 'xbox' || platformFocus === 'all') && (
                      <div className="friends-category">
                        <div className="category-header">Xbox Friends</div>
                        {filteredXboxFriends.length === 0 && (
                          <div className="friends-empty">
                            {friendsData.xbox_friends.length === 0
                              ? 'Connect to Xbox Live to see friends'
                              : 'No matches'}
                          </div>
                        )}
                        {filteredXboxFriends.map(f => (
                          <div key={f.xuid} className="friend-item" data-testid={`xbox-friend-${f.xuid}`}>
                            <div className="friend-avatar">
                              {f.avatar_url ? <img src={f.avatar_url} alt="" /> : <div className="friend-avatar-placeholder" />}
                            </div>
                            <div className="friend-info">
                              <span className="friend-name">{f.gamertag}</span>
                              <span className={`friend-status ${f.status}`}>{f.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {(platformFocus === 'discord' || platformFocus === 'all') && friendsData.linked_discord_id && (
                      <div className="friends-category">
                        <div className="category-header">Discord Friends</div>
                        {filteredDiscordFriends.length === 0 && (
                          <div className="friends-empty">
                            {friendsData.discord_friends.length === 0
                              ? 'No Discord friends linked'
                              : 'No matches'}
                          </div>
                        )}
                        {filteredDiscordFriends.map(f => (
                          <div key={f.discord_id} className="friend-item discord" data-testid={`discord-friend-${f.discord_id}`}>
                            <div className="friend-avatar">
                              {f.avatar_url ? <img src={f.avatar_url} alt="" /> : <div className="friend-avatar-placeholder discord" />}
                            </div>
                            <div className="friend-info">
                              <span className="friend-name">{f.username}</span>
                              <span className={`friend-status ${f.status}`}>{f.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!friendsData.linked_discord_id && platformFocus === 'discord' && (
                      <div className="friends-empty">No Discord account linked to this Xbox profile</div>
                    )}
                  </>
                )}

                {!isLoggedIn && (
                  <div className="friends-empty" data-testid="friends-sign-in-prompt">
                    Sign in to view friends
                  </div>
                )}
              </div>

              <div className="guide-section-divider" />
            </div>
          );
        }

        return (
          <div
            key={item.id}
            className={`guide-menu-item ${focusZone === 'menu' && selectedItem === i ? 'selected' : ''}`}
            data-testid={`guide-menu-${item.id}`}
            onClick={() => { setFocusZone('menu'); setSelectedItem(i); handleMenuAction(i); }}
            onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(i); }}
          >
            <span className="menu-label">{item.label}</span>
            {item.badge && <span className="menu-badge exit-badge">{item.badge}</span>}
          </div>
        );
      })}
    </div>
  );

  const renderGamesTab = () => (
    <div className={`guide-tab-content ${tabTransition}`}>
      {gamesMenuItems.length === 0 ? (
        <div className="friends-empty">No recently played games</div>
      ) : (
        gamesMenuItems.map((item, i) => (
          <div
            key={item.id}
            className={`guide-menu-item game-item ${focusZone === 'menu' && selectedItem === i ? 'selected' : ''}`}
            data-testid={`guide-game-${i}`}
            onClick={() => { setFocusZone('menu'); setSelectedItem(i); handleMenuAction(i); }}
            onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(i); }}
          >
            <div className="game-item-info">
              {item.game?.cover && <img src={item.game.cover} alt="" className="game-thumb" />}
              <span className="menu-label">{item.label}</span>
            </div>
            {item.hasQuickResume && (
              <span className="menu-badge resume-badge">Quick Resume</span>
            )}
          </div>
        ))
      )}
    </div>
  );

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

          {/* Tab Bar */}
          <div className={`guide-tab-bar ${focusZone === 'tabs' ? 'focused' : ''}`} data-testid="guide-tab-bar">
            <button
              className={`guide-tab ${activeTab === 0 ? 'active' : ''}`}
              data-testid="tab-friends"
              onClick={() => { if (activeTab !== 0) switchTab('left'); }}
            >
              Friends and Parties
            </button>
            <button
              className={`guide-tab ${activeTab === 1 ? 'active' : ''}`}
              data-testid="tab-games"
              onClick={() => { if (activeTab !== 1) switchTab('right'); }}
            >
              Games
            </button>
          </div>

          {/* Tab Content */}
          <div className="guide-menu-list" data-testid="guide-menu-list">
            {activeTab === 0 ? renderFriendsTab() : renderGamesTab()}
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
            <div className="hint-group">
              <span className="hint-bumper">LB</span>
              <span className="hint-bumper">RB</span>
              <span>Switch Tab</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GuideOverlay;

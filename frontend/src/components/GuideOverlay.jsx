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

const fetchUnifiedFriendsList = async (xuid) => {
  const result = await tauriInvoke('fetch_unified_friends_list', { xuid });
  if (result) return result;
  return { xbox_friends: [], discord_friends: [], linked_discord_id: null };
};

const fetchChatHistory = async (xuid) => {
  const result = await tauriInvoke('fetch_chat_history', { xuid });
  if (result) return result;
  return { conversations: [] };
};

const sendQuickResumeCommand = async (gameId, savePath) => {
  return tauriInvoke('quick_resume_load', { gameId, savePath });
};

const TAB_NAMES = ['Home', 'Friends and Parties', 'Games', 'Messages'];
const TAB_COUNT = 4;

const GuideOverlay = ({ isOpen, onClose, onNavigateHome, onNavigateSettings, xboxProfile, isLoggedIn, onLogin, recentGames, onQuickResume }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState(0);
  const [focusZone, setFocusZone] = useState('menu');
  const [tabTransition, setTabTransition] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);
  const { onPress: onGamepadPress } = useGamepad();

  const [platformFocus, setPlatformFocus] = useState('xbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [friendsData, setFriendsData] = useState({ xbox_friends: [], discord_friends: [], linked_discord_id: null });
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [chatData, setChatData] = useState({ conversations: [] });
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(0);
      setSelectedItem(0);
      setFocusZone('menu');
      setSearchQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && containerRef.current) containerRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isLoggedIn && xboxProfile?.xuid) {
      setFriendsLoading(true);
      fetchUnifiedFriendsList(xboxProfile.xuid).then(data => {
        setFriendsData(data);
        setFriendsLoading(false);
      }).catch(() => setFriendsLoading(false));

      setChatLoading(true);
      fetchChatHistory(xboxProfile.xuid).then(data => {
        setChatData(data);
        setChatLoading(false);
      }).catch(() => setChatLoading(false));
    }
  }, [isOpen, isLoggedIn, xboxProfile?.xuid]);

  const formatTime = (date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  // HOME tab items
  const homeMenuItems = useMemo(() => [
    { id: 'home', label: 'Home', type: 'action' },
    { id: 'settings', label: 'Settings', type: 'action' },
    ...((recentGames || []).slice(0, 5).map((game, i) => ({
      id: `home-game-${i}`,
      label: game.title,
      type: 'game',
      game,
      hasQuickResume: game.hasQuickResume || false,
    }))),
    { id: 'shutdown', label: 'Shutdown System', badge: '(Exit App)', type: 'action' },
  ], [recentGames]);

  // FRIENDS tab items
  const friendsMenuItems = useMemo(() => [
    { id: 'friends', label: 'Friends', type: 'friends-section' },
  ], []);

  // GAMES tab items
  const gamesMenuItems = useMemo(() => (recentGames || []).slice(0, 5).map((game, i) => ({
    id: `game-${i}`,
    label: game.title,
    type: 'game',
    game,
    hasQuickResume: game.hasQuickResume || false,
  })), [recentGames]);

  // MESSAGES tab items
  const messagesMenuItems = useMemo(() => chatData.conversations.length > 0
    ? chatData.conversations.map((conv, i) => ({
        id: `chat-${i}`,
        label: conv.friend_name || conv.gamertag || 'Unknown',
        type: 'chat',
        lastMessage: conv.last_message || '',
        timestamp: conv.timestamp || '',
        unread: conv.unread || 0,
      }))
    : [], [chatData.conversations]);

  const currentMenuItems = useMemo(() => {
    const all = [homeMenuItems, friendsMenuItems, gamesMenuItems, messagesMenuItems];
    return all[activeTab] || [];
  }, [activeTab, homeMenuItems, friendsMenuItems, gamesMenuItems, messagesMenuItems]);
  const itemCount = currentMenuItems.length;

  const filteredXboxFriends = friendsData.xbox_friends.filter(f =>
    f.gamertag?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDiscordFriends = friendsData.discord_friends.filter(f =>
    f.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      setTabTransition('');
    }, 150);
  }, [activeTab]);

  const handleMenuAction = useCallback((index) => {
    const item = currentMenuItems[index];
    if (!item) return;

    if (item.id === 'home') {
      playSound('select');
      onClose();
      if (onNavigateHome) onNavigateHome();
    } else if (item.id === 'settings') {
      playSound('select');
      onClose();
      if (onNavigateSettings) onNavigateSettings();
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
        sendQuickResumeCommand(item.game.titleId || item.game.id, item.game.savePath || '');
      }
      if (onQuickResume) onQuickResume(item.game);
      onClose();
    } else if (item.type === 'chat') {
      playSound('select');
      // Will open chat in Tauri
      tauriInvoke('open_chat', { conversationId: item.id });
    }
  }, [currentMenuItems, onClose, onNavigateHome, onNavigateSettings, onQuickResume]);

  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return;
    if (e.key === 'Tab' || e.key === 'Home') return;

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

    const isFriendsTab = activeTab === 1;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault(); e.stopPropagation();
        playSound('focus');
        if (focusZone === 'menu') {
          if (selectedItem > 0) setSelectedItem(prev => prev - 1);
          else setFocusZone(isFriendsTab ? 'search' : 'tabs');
        } else if (focusZone === 'search') setFocusZone('toggle');
        else if (focusZone === 'toggle') setFocusZone('tabs');
        break;
      case 'ArrowDown':
        e.preventDefault(); e.stopPropagation();
        playSound('focus');
        if (focusZone === 'tabs') setFocusZone(isFriendsTab ? 'toggle' : 'menu');
        else if (focusZone === 'toggle') setFocusZone('search');
        else if (focusZone === 'search') { setFocusZone('menu'); setSelectedItem(0); }
        else if (focusZone === 'menu') setSelectedItem(prev => (prev < itemCount - 1 ? prev + 1 : prev));
        break;
      case 'ArrowLeft':
        e.preventDefault(); e.stopPropagation();
        if (focusZone === 'toggle') { setPlatformFocus('xbox'); playSound('focus'); }
        break;
      case 'ArrowRight':
        e.preventDefault(); e.stopPropagation();
        if (focusZone === 'toggle') { setPlatformFocus('discord'); playSound('focus'); }
        break;
      case 'Enter':
        e.preventDefault(); e.stopPropagation();
        if (focusZone === 'menu') handleMenuAction(selectedItem);
        else if (focusZone === 'search' && searchRef.current) searchRef.current.focus();
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

  // Gamepad
  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = { selectedItem, focusZone, activeTab, itemCount, platformFocus };
  }, [selectedItem, focusZone, activeTab, itemCount, platformFocus]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = onGamepadPress((event) => {
      if (event.type !== 'press') return;
      const btn = event.button;
      const s = stateRef.current;
      const isFriendsTab = s.activeTab === 1;

      if (btn === 'b') { playSound('back'); onClose(); return; }
      if (btn === 'lb' || btn === 'leftBumper') { switchTab('left'); return; }
      if (btn === 'rb' || btn === 'rightBumper') { switchTab('right'); return; }

      if (btn === 'dpadUp' || btn === 'stickUp') {
        playSound('focus');
        if (s.focusZone === 'menu') {
          if (s.selectedItem > 0) setSelectedItem(s.selectedItem - 1);
          else setFocusZone(isFriendsTab ? 'search' : 'tabs');
        } else if (s.focusZone === 'search') setFocusZone('toggle');
        else if (s.focusZone === 'toggle') setFocusZone('tabs');
      }
      if (btn === 'dpadDown' || btn === 'stickDown') {
        playSound('focus');
        if (s.focusZone === 'tabs') setFocusZone(isFriendsTab ? 'toggle' : 'menu');
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

  if (!isOpen) return null;

  // ========== TAB RENDERERS ==========

  const renderHomeTab = () => (
    <div className={`guide-tab-content ${tabTransition}`}>
      {/* Home + Settings */}
      <div
        className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 0 ? 'selected' : ''}`}
        data-testid="guide-home-btn"
        onClick={() => { setFocusZone('menu'); setSelectedItem(0); handleMenuAction(0); }}
        onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(0); }}
      >
        <span className="menu-label">Home</span>
      </div>
      <div
        className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 1 ? 'selected' : ''}`}
        data-testid="guide-settings-btn"
        onClick={() => { setFocusZone('menu'); setSelectedItem(1); handleMenuAction(1); }}
        onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(1); }}
      >
        <span className="menu-label">Settings</span>
      </div>

      <div className="guide-section-divider" />
      <div className="guide-section-header">Recently Played</div>

      {/* Recent games with Quick Resume */}
      {homeMenuItems.slice(2, -1).map((item, idx) => {
        const menuIdx = idx + 2;
        return (
          <div
            key={item.id}
            className={`guide-menu-item game-item ${focusZone === 'menu' && selectedItem === menuIdx ? 'selected' : ''}`}
            data-testid={`guide-home-game-${idx}`}
            onClick={() => { setFocusZone('menu'); setSelectedItem(menuIdx); handleMenuAction(menuIdx); }}
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

      <div className="guide-section-divider" />

      {/* Shutdown */}
      <div
        className={`guide-menu-item ${focusZone === 'menu' && selectedItem === homeMenuItems.length - 1 ? 'selected' : ''}`}
        data-testid="guide-shutdown-btn"
        onClick={() => { setFocusZone('menu'); setSelectedItem(homeMenuItems.length - 1); handleMenuAction(homeMenuItems.length - 1); }}
        onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(homeMenuItems.length - 1); }}
      >
        <span className="menu-label">Shutdown System</span>
        <span className="menu-badge exit-badge">(Exit App)</span>
      </div>
    </div>
  );

  const renderFriendsTab = () => (
    <div className={`guide-tab-content ${tabTransition}`}>
      <div
        className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 0 ? 'selected' : ''}`}
        data-testid="guide-friends-item"
        onClick={() => { setFocusZone('menu'); setSelectedItem(0); handleMenuAction(0); }}
        onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(0); }}
      >
        <span className="menu-label">Friends</span>
      </div>

      <div className={`platform-toggle ${focusZone === 'toggle' ? 'focused' : ''}`} data-testid="platform-toggle">
        <button className={`toggle-btn ${platformFocus === 'xbox' ? 'active' : ''}`} data-testid="toggle-xbox" onClick={() => { setPlatformFocus('xbox'); playSound('focus'); }}>Xbox Live</button>
        <button className={`toggle-btn ${platformFocus === 'discord' ? 'active' : ''}`} data-testid="toggle-discord" onClick={() => { setPlatformFocus('discord'); playSound('focus'); }}>Discord</button>
      </div>

      <div className={`guide-search ${focusZone === 'search' ? 'focused' : ''}`}>
        <input ref={searchRef} type="text" data-testid="friends-search-input" className="guide-search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={platformFocus === 'xbox' ? 'Search Gamertag...' : 'Search Discord Username...'} />
      </div>

      <div className="friends-list" data-testid="friends-list">
        {friendsLoading && <div className="friends-loading">Loading friends...</div>}
        {!friendsLoading && isLoggedIn && (
          <>
            {platformFocus === 'xbox' && (
              <div className="friends-category">
                <div className="category-header">Xbox Friends</div>
                {filteredXboxFriends.length === 0 && <div className="friends-empty">{friendsData.xbox_friends.length === 0 ? 'Connect to Xbox Live to see friends' : 'No matches'}</div>}
                {filteredXboxFriends.map(f => (
                  <div key={f.xuid} className="friend-item" data-testid={`xbox-friend-${f.xuid}`}>
                    <div className="friend-avatar">{f.avatar_url ? <img src={f.avatar_url} alt="" /> : <div className="friend-avatar-placeholder" />}</div>
                    <div className="friend-info"><span className="friend-name">{f.gamertag}</span><span className={`friend-status ${f.status}`}>{f.status}</span></div>
                  </div>
                ))}
              </div>
            )}
            {platformFocus === 'discord' && friendsData.linked_discord_id && (
              <div className="friends-category">
                <div className="category-header">Discord Friends</div>
                {filteredDiscordFriends.length === 0 && <div className="friends-empty">{friendsData.discord_friends.length === 0 ? 'No Discord friends linked' : 'No matches'}</div>}
                {filteredDiscordFriends.map(f => (
                  <div key={f.discord_id} className="friend-item discord" data-testid={`discord-friend-${f.discord_id}`}>
                    <div className="friend-avatar">{f.avatar_url ? <img src={f.avatar_url} alt="" /> : <div className="friend-avatar-placeholder discord" />}</div>
                    <div className="friend-info"><span className="friend-name">{f.username}</span><span className={`friend-status ${f.status}`}>{f.status}</span></div>
                  </div>
                ))}
              </div>
            )}
            {platformFocus === 'discord' && !friendsData.linked_discord_id && <div className="friends-empty">No Discord account linked to this Xbox profile</div>}
          </>
        )}
        {!isLoggedIn && <div className="friends-empty" data-testid="friends-sign-in-prompt">Sign in to view friends</div>}
      </div>
    </div>
  );

  const renderGamesTab = () => (
    <div className={`guide-tab-content ${tabTransition}`}>
      {gamesMenuItems.length === 0 ? (
        <div className="friends-empty">No recently played games</div>
      ) : (
        gamesMenuItems.map((item, i) => (
          <div key={item.id} className={`guide-menu-item game-item ${focusZone === 'menu' && selectedItem === i ? 'selected' : ''}`}
            data-testid={`guide-game-${i}`}
            onClick={() => { setFocusZone('menu'); setSelectedItem(i); handleMenuAction(i); }}
            onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(i); }}
          >
            <div className="game-item-info">
              {item.game?.cover && <img src={item.game.cover} alt="" className="game-thumb" />}
              <span className="menu-label">{item.label}</span>
            </div>
            {item.hasQuickResume && <span className="menu-badge resume-badge">Quick Resume</span>}
          </div>
        ))
      )}
    </div>
  );

  const renderMessagesTab = () => (
    <div className={`guide-tab-content ${tabTransition}`}>
      {chatLoading && <div className="friends-loading">Loading messages...</div>}
      {!chatLoading && !isLoggedIn && <div className="friends-empty" data-testid="messages-sign-in-prompt">Sign in to view messages</div>}
      {!chatLoading && isLoggedIn && messagesMenuItems.length === 0 && <div className="friends-empty" data-testid="no-messages">No recent conversations</div>}
      {!chatLoading && messagesMenuItems.map((item, i) => (
        <div key={item.id} className={`guide-menu-item chat-item ${focusZone === 'menu' && selectedItem === i ? 'selected' : ''}`}
          data-testid={`guide-chat-${i}`}
          onClick={() => { setFocusZone('menu'); setSelectedItem(i); handleMenuAction(i); }}
          onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(i); }}
        >
          <div className="chat-item-info">
            <span className="menu-label">{item.label}</span>
            {item.lastMessage && <span className="chat-preview">{item.lastMessage}</span>}
          </div>
          <div className="chat-meta">
            {item.unread > 0 && <span className="chat-unread">{item.unread}</span>}
            {item.timestamp && <span className="chat-time">{item.timestamp}</span>}
          </div>
        </div>
      ))}
    </div>
  );

  const tabRenderers = [renderHomeTab, renderFriendsTab, renderGamesTab, renderMessagesTab];

  return (
    <>
      <div data-testid="guide-overlay-backdrop" className="guide-overlay-backdrop" onClick={onClose} />
      <div ref={containerRef} data-testid="guide-modal-container" className="guide-modal-container" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div data-testid="guide-center-panel" className="guide-center-panel">
          <div className="guide-panel-header"><span className="guide-title-text">Xenia Guide</span></div>

          <div className="guide-profile-row" data-testid="guide-profile-row">
            <div className="profile-avatar-box" onClick={() => !isLoggedIn && onLogin && onLogin()} style={{ cursor: isLoggedIn ? 'default' : 'pointer' }}>
              {isLoggedIn && xboxProfile?.profilePicture ? <img src={xboxProfile.profilePicture} alt="Avatar" className="guide-avatar-img" /> : <div className="avatar-inner-fallback" />}
            </div>
            <div className="profile-info">
              {!isLoggedIn && <span className="profile-signin-text" data-testid="guide-signin-text" onClick={() => onLogin && onLogin()}>Sign In</span>}
              {isLoggedIn && xboxProfile?.gamertag && <span className="profile-gamertag" data-testid="guide-gamertag">{xboxProfile.gamertag}</span>}
            </div>
            <span data-testid="guide-clock" className="profile-clock">{formatTime(currentTime)}</span>
          </div>

          <div className="guide-divider" />

          <div className={`guide-tab-bar ${focusZone === 'tabs' ? 'focused' : ''}`} data-testid="guide-tab-bar">
            {TAB_NAMES.map((name, i) => (
              <button key={i} className={`guide-tab ${activeTab === i ? 'active' : ''}`} data-testid={`tab-${name.toLowerCase().replace(/ /g, '-')}`}
                onClick={() => { if (activeTab !== i) { playSound('focus'); setTabTransition(i > activeTab ? 'slide-left' : 'slide-right'); setTimeout(() => { setActiveTab(i); setSelectedItem(0); setFocusZone('menu'); setTabTransition(''); }, 150); } }}>
                {name}
              </button>
            ))}
          </div>

          <div className="guide-menu-list" data-testid="guide-menu-list">
            {tabRenderers[activeTab]()}
          </div>

          <div data-testid="guide-footer-hints" className="guide-footer-hints">
            <div className="hint-group"><div className="hint-btn green">A</div><span>Select</span></div>
            <div className="hint-group"><div className="hint-btn red">B</div><span>Close</span></div>
            <div className="hint-group"><span className="hint-bumper">LB</span><span className="hint-bumper">RB</span><span>Switch Tab</span></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GuideOverlay;

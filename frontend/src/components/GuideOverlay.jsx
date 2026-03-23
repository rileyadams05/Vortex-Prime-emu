import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useGamepad } from '../context/GamepadContext';
import playSound from '../utils/soundManager';
import { toast } from 'sonner';
import '../styles/GuideOverlay.css';

const tauriInvoke = async (cmd, args = {}) => {
  if (window.__TAURI_INTERNALS__) {
    return invoke(cmd, args);
  }
  return null;
};

const sendQuickResumeCommand = async (gameId, savePath) => {
  return tauriInvoke('quick_resume_load', { gameId, savePath });
};

const TAB_NAMES = ['Friends and Parties', 'Messages', 'Home'];
const TAB_COUNT = 3;

const GuideOverlay = ({ isOpen, onClose, onNavigateHome, onNavigateSettings, userProfile, isLoggedIn, onLogin, recentGames, onQuickResume, gameGroups, onCreateGroup, onOpenGroups, onOpenKeyboard }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState(0);
  const [focusZone, setFocusZone] = useState('menu');
  const [tabTransition, setTabTransition] = useState('');
  const containerRef = useRef(null);
  const { onPress: onGamepadPress } = useGamepad();

  // Home tab sub-views
  const [homeSection, setHomeSection] = useState('main'); // main | groups

  // Discord integration state (mocked for now)
  const [discordStatus, setDiscordStatus] = useState('Disconnected');
  const [googleProfilePic, setGoogleProfilePic] = useState(null);
  const [discordFriends, setDiscordFriends] = useState([]);
  const [discordMessages, setDiscordMessages] = useState([]);

  useEffect(() => {
    if (userProfile?.profilePicture) {
      setGoogleProfilePic(userProfile.profilePicture);
    }
  }, [userProfile]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGoogleProfilePic(reader.result);
        // In a real app, you'd save this to the user profile on the backend
      };
      reader.readAsDataURL(file);
    }
  };

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

  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;

    const connectWS = () => {
      if (!isLoggedIn) return;
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
      const wsUrl = `${protocol}//${host}/api/discord/ws`;

      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("Connected to Discord WebSocket Bridge");
        setDiscordStatus('Connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received live Discord event:", data);
          
          if (data && data.type !== 1) { // Ignore Discord PING acknowledgments
            playSound('focus'); 
            
            // This is a naive catch-all for any incoming Discord webhook
            // You can specialize this depending on the `data.type` or `data.event.type`
            toast('Discord Notification', { 
              description: "A new event arrived from Discord!" 
            });
            
            setDiscordMessages(prev => [{
                id: Date.now(), 
                author: 'Discord Webhook', 
                content: 'New event received. Check console for payload.', 
                time: new Date()
            }, ...prev]);
          }
        } catch(e) {
          console.error("WS Parse error", e);
        }
      };
      
      ws.onclose = () => {
        setDiscordStatus('Disconnected');
        reconnectTimer = setTimeout(connectWS, 3000);
      };
      
      ws.onerror = (e) => {
        console.error("WebSocket error", e);
      };
    };

    if (isLoggedIn) {
       connectWS();
    }

    return () => {
      if (ws) {
        ws.onclose = null; // don't try to reconnect on expected unmount
        ws.close();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [isLoggedIn]);

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
      if (window.__TAURI_INTERNALS__) { import('@tauri-apps/plugin-process').then(({ exit }) => exit(0)); }
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

  // ========== DISCORD FRIENDS & PARTIES TAB ==========
  const renderFriendsPartiesTab = () => (
    <div className={`guide-tab-content ${tabTransition}`}>
      <div className="coming-soon-tab" data-testid="friends-empty-state">
        <div className="coming-soon-tab-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#5865F2" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <span className="coming-soon-tab-title">{isLoggedIn ? `Discord Friends (${discordStatus})` : 'Discord Social'}</span>
        <p className="coming-soon-tab-desc" style={{ maxWidth: '280px', margin: '10px auto' }}>
          {isLoggedIn 
            ? 'Your Discord friends list is currently empty. Connect your account to see who is online.' 
            : 'Log in with your Discord account to access Discord integration and join parties.'}
        </p>
        {isLoggedIn && (
          <div className="guide-profile-edit" style={{ marginTop: '20px', width: '80%' }}>
            <label className="guide-menu-item" style={{ cursor: 'pointer', borderRadius: '4px', textAlign: 'center', background: 'rgba(255,255,255,0.05)' }}>
              Change Profile Picture
              <input type="file" hidden accept="image/*" onChange={handleFileUpload} />
            </label>
          </div>
        )}
      </div>
    </div>
  );

  // ========== MESSAGES TAB ==========
  const renderMessagesTab = () => (
    <div className={`guide-tab-content ${tabTransition}`}>
      <div className="coming-soon-tab" data-testid="messages-empty-state">
        <div className="coming-soon-tab-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#5865F2" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <span className="coming-soon-tab-title">{isLoggedIn ? 'Discord Messages' : 'Discord Messages'}</span>
        <p className="coming-soon-tab-desc" style={{ maxWidth: '280px', margin: '10px auto' }}>
          {!isLoggedIn && 'Log in with your Discord account to view and respond to Discord messages.'}
        </p>
        
        {isLoggedIn && discordMessages.length > 0 && (
          <div className="discord-messages-list" style={{ marginTop: '20px', width: '100%', textAlign: 'left', maxHeight: '200px', overflowY: 'auto' }}>
            {discordMessages.map(msg => (
              <div key={msg.id} style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', color: '#5865F2' }}>{msg.author}</span>
                <span style={{ fontSize: '0.8em', color: 'gray', marginLeft: '10px' }}>{msg.time.toLocaleTimeString()}</span>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.9em' }}>{msg.content}</p>
              </div>
            ))}
          </div>
        )}
        {isLoggedIn && discordMessages.length === 0 && (
          <p className="coming-soon-tab-desc" style={{ maxWidth: '280px', margin: '10px auto' }}>
             No unread messages from Discord.
          </p>
        )}
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
          <div className="guide-panel-header"><span className="guide-title-text">Guide System</span></div>

          <div 
            className={`guide-profile-row ${!isLoggedIn ? 'clickable' : ''}`} 
            data-testid="guide-profile-row"
            onClick={() => { if (!isLoggedIn && onLogin) { playSound('select'); onLogin(); } }}
          >
            <div className="profile-avatar-box" style={{ borderRadius: '50%' }}>
              {isLoggedIn && googleProfilePic ? 
                <img src={googleProfilePic} alt="Avatar" className="guide-avatar-img" /> : 
                <div className="avatar-inner-fallback" />
              }
            </div>
            <div className="profile-info">
              {isLoggedIn && userProfile?.name ? (
                <span className="profile-gamertag" data-testid="guide-gamertag">{userProfile.name}</span>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg viewBox="0 0 24 24" fill="#5865F2" width="16" height="16">
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2758-3.68-.2758-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1971.3728.2914a.077.077 0 01-.0066.1277 12.2986 12.2986 0 01-1.8732.8923.076.076 0 00-.0416.1057c.3604.698.7719 1.3628 1.226 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
                  </svg>
                  <span className="profile-signin-text">Log in with Discord</span>
                </div>
              )}
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

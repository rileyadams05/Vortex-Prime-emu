import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useGamepad } from '../context/GamepadContext';
import { mockXboxFriends, mockDiscordFriends, mockConversations } from '../data/xeniaData';
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

const GuideOverlay = ({ isOpen, onClose, onNavigateHome, onNavigateSettings, xboxProfile, isLoggedIn, onLogin, recentGames, onQuickResume }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState(0);
  const [focusZone, setFocusZone] = useState('menu');
  const [tabTransition, setTabTransition] = useState('');
  const containerRef = useRef(null);
  const { onPress: onGamepadPress } = useGamepad();

  // Friends & Parties state
  const [friendsSection, setFriendsSection] = useState('main'); // main | friends | parties
  const [friendsPlatform, setFriendsPlatform] = useState(null); // null | 'xbox' | 'discord'
  const [partyActive, setPartyActive] = useState(false);
  const [partyMembers, setPartyMembers] = useState([]);
  const [showInviteList, setShowInviteList] = useState(false);

  // Messages state
  const [selectedConversation, setSelectedConversation] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(0);
      setSelectedItem(0);
      setFocusZone('menu');
      setFriendsSection('main');
      setFriendsPlatform(null);
      setShowInviteList(false);
      setSelectedConversation(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && containerRef.current) containerRef.current.focus();
  }, [isOpen]);

  const formatTime = (date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

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
      setFriendsSection('main');
      setFriendsPlatform(null);
      setShowInviteList(false);
      setSelectedConversation(null);
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
        if (activeTab === 0 && friendsSection !== 'main') {
          if (showInviteList) setShowInviteList(false);
          else if (friendsPlatform) setFriendsPlatform(null);
          else { setFriendsSection('main'); setSelectedItem(0); }
        } else if (activeTab === 1 && selectedConversation) {
          setSelectedConversation(null); setSelectedItem(0);
        } else {
          onClose();
        }
        break;
      default: break;
    }
  }, [isOpen, selectedItem, focusZone, activeTab, friendsSection, friendsPlatform, showInviteList, selectedConversation, onClose, switchTab]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleKeyDown]);

  // Gamepad
  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = { selectedItem, focusZone, activeTab, friendsSection, friendsPlatform, showInviteList, selectedConversation };
  }, [selectedItem, focusZone, activeTab, friendsSection, friendsPlatform, showInviteList, selectedConversation]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = onGamepadPress((event) => {
      if (event.type !== 'press') return;
      const btn = event.button;
      const s = stateRef.current;

      if (btn === 'b') {
        playSound('back');
        if (s.activeTab === 0 && s.friendsSection !== 'main') {
          if (s.showInviteList) setShowInviteList(false);
          else if (s.friendsPlatform) setFriendsPlatform(null);
          else { setFriendsSection('main'); setSelectedItem(0); }
        } else if (s.activeTab === 1 && s.selectedConversation) {
          setSelectedConversation(null); setSelectedItem(0);
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
  const renderFriendsPartiesTab = () => {
    // Sub-view: Xbox friends list
    if (friendsSection === 'friends' && friendsPlatform === 'xbox') {
      return (
        <div className={`guide-tab-content ${tabTransition}`}>
          <div className="guide-section-header-row">
            <button className="guide-back-btn" data-testid="friends-back-btn" onClick={() => { playSound('back'); setFriendsPlatform(null); setSelectedItem(0); }}>Back</button>
            <span className="guide-section-title">Xbox Live Friends</span>
          </div>
          <div className="friends-list" data-testid="xbox-friends-list">
            {mockXboxFriends.map((f, i) => (
              <div key={f.xuid} className={`friend-item ${focusZone === 'menu' && selectedItem === i ? 'selected' : ''}`}
                data-testid={`xbox-friend-${f.xuid}`}
                onClick={() => { setSelectedItem(i); playSound('focus'); }}
                onMouseEnter={() => { setSelectedItem(i); setFocusZone('menu'); }}
              >
                <div className="friend-avatar"><div className="friend-avatar-placeholder" /></div>
                <div className="friend-info">
                  <span className="friend-name">{f.gamertag}</span>
                  <span className={`friend-status ${f.status}`}>{f.status}{f.activity ? ` - ${f.activity}` : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Sub-view: Discord friends list
    if (friendsSection === 'friends' && friendsPlatform === 'discord') {
      return (
        <div className={`guide-tab-content ${tabTransition}`}>
          <div className="guide-section-header-row">
            <button className="guide-back-btn" data-testid="discord-back-btn" onClick={() => { playSound('back'); setFriendsPlatform(null); setSelectedItem(0); }}>Back</button>
            <span className="guide-section-title">Discord Friends</span>
          </div>
          <div className="friends-list" data-testid="discord-friends-list">
            {mockDiscordFriends.map((f, i) => (
              <div key={f.discord_id} className={`friend-item discord ${focusZone === 'menu' && selectedItem === i ? 'selected' : ''}`}
                data-testid={`discord-friend-${f.discord_id}`}
                onClick={() => { setSelectedItem(i); playSound('focus'); }}
                onMouseEnter={() => { setSelectedItem(i); setFocusZone('menu'); }}
              >
                <div className="friend-avatar"><div className="friend-avatar-placeholder discord" /></div>
                <div className="friend-info">
                  <span className="friend-name">{f.username}</span>
                  <span className={`friend-status ${f.status}`}>{f.status}{f.activity ? ` - ${f.activity}` : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Sub-view: Friends platform picker (Xbox / Discord)
    if (friendsSection === 'friends') {
      return (
        <div className={`guide-tab-content ${tabTransition}`}>
          <div className="guide-section-header-row">
            <button className="guide-back-btn" data-testid="friends-section-back" onClick={() => { playSound('back'); setFriendsSection('main'); setSelectedItem(0); }}>Back</button>
            <span className="guide-section-title">Friends</span>
          </div>
          <div
            className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 0 ? 'selected' : ''}`}
            data-testid="friends-xbox-live-btn"
            onClick={() => { playSound('select'); setFriendsPlatform('xbox'); setSelectedItem(0); }}
            onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(0); }}
          >
            <span className="menu-label">Xbox Live</span>
            <span className="menu-badge">{mockXboxFriends.filter(f => f.status === 'online').length} online</span>
          </div>
          <div
            className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 1 ? 'selected' : ''}`}
            data-testid="friends-discord-btn"
            onClick={() => { playSound('select'); setFriendsPlatform('discord'); setSelectedItem(0); }}
            onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(1); }}
          >
            <span className="menu-label">Discord</span>
            <span className="menu-badge">{mockDiscordFriends.filter(f => f.status === 'online').length} online</span>
          </div>
        </div>
      );
    }

    // Sub-view: Parties (active party or create)
    if (friendsSection === 'parties') {
      // Show invite list overlay
      if (showInviteList) {
        const allFriends = [
          ...mockXboxFriends.map(f => ({ ...f, name: f.gamertag, platform: 'xbox' })),
          ...mockDiscordFriends.map(f => ({ ...f, name: f.username, platform: 'discord' })),
        ];
        return (
          <div className={`guide-tab-content ${tabTransition}`}>
            <div className="guide-section-header-row">
              <button className="guide-back-btn" data-testid="invite-back-btn" onClick={() => { playSound('back'); setShowInviteList(false); setSelectedItem(0); }}>Back</button>
              <span className="guide-section-title">Invite to Party</span>
            </div>
            <div className="friends-list" data-testid="invite-friends-list">
              {allFriends.filter(f => f.status === 'online' || f.status === 'away').map((f, i) => {
                const isInParty = partyMembers.some(m => m.name === f.name);
                return (
                  <div key={f.name} className={`friend-item invite-item ${isInParty ? 'in-party' : ''} ${focusZone === 'menu' && selectedItem === i ? 'selected' : ''}`}
                    data-testid={`invite-friend-${i}`}
                    onClick={() => {
                      if (!isInParty) {
                        playSound('select');
                        setPartyMembers(prev => [...prev, f]);
                      }
                    }}
                    onMouseEnter={() => { setFocusZone('menu'); setSelectedItem(i); }}
                  >
                    <div className="friend-avatar"><div className={`friend-avatar-placeholder ${f.platform === 'discord' ? 'discord' : ''}`} /></div>
                    <div className="friend-info">
                      <span className="friend-name">{f.name}</span>
                      <span className="friend-status">{f.platform === 'xbox' ? 'Xbox Live' : 'Discord'}</span>
                    </div>
                    {isInParty ? (
                      <span className="invite-status invited">Invited</span>
                    ) : (
                      <span className="invite-status available">Invite</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      // Active party view
      if (partyActive) {
        return (
          <div className={`guide-tab-content ${tabTransition}`}>
            <div className="guide-section-header-row">
              <button className="guide-back-btn" data-testid="party-back-btn" onClick={() => { playSound('back'); setFriendsSection('main'); setSelectedItem(0); }}>Back</button>
              <span className="guide-section-title">Your Party</span>
            </div>
            <div className="party-container" data-testid="party-container">
              <div className="party-member-list">
                <div className="party-member you">
                  <div className="friend-avatar"><div className="friend-avatar-placeholder" /></div>
                  <div className="friend-info">
                    <span className="friend-name">{xboxProfile?.gamertag || 'You'}</span>
                    <span className="friend-status party-host">Party Leader</span>
                  </div>
                </div>
                {partyMembers.map((m, i) => (
                  <div key={i} className="party-member">
                    <div className="friend-avatar"><div className={`friend-avatar-placeholder ${m.platform === 'discord' ? 'discord' : ''}`} /></div>
                    <div className="friend-info">
                      <span className="friend-name">{m.name}</span>
                      <span className="friend-status">{m.platform === 'xbox' ? 'Xbox Live' : 'Discord'}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div
                className={`guide-menu-item party-action ${focusZone === 'menu' && selectedItem === 0 ? 'selected' : ''}`}
                data-testid="invite-more-btn"
                onClick={() => { playSound('select'); setShowInviteList(true); setSelectedItem(0); }}
                onMouseEnter={() => { setFocusZone('menu'); setSelectedItem(0); }}
              >
                <span className="menu-label">Invite More</span>
              </div>
              <div
                className={`guide-menu-item party-action leave ${focusZone === 'menu' && selectedItem === 1 ? 'selected' : ''}`}
                data-testid="leave-party-btn"
                onClick={() => { playSound('back'); setPartyActive(false); setPartyMembers([]); setFriendsSection('main'); setSelectedItem(0); }}
                onMouseEnter={() => { setFocusZone('menu'); setSelectedItem(1); }}
              >
                <span className="menu-label">Leave Party</span>
              </div>
            </div>
          </div>
        );
      }

      // Parties main - no active party
      return (
        <div className={`guide-tab-content ${tabTransition}`}>
          <div className="guide-section-header-row">
            <button className="guide-back-btn" data-testid="parties-back-btn" onClick={() => { playSound('back'); setFriendsSection('main'); setSelectedItem(0); }}>Back</button>
            <span className="guide-section-title">Parties</span>
          </div>
          <div className="party-empty-state" data-testid="party-empty-state">
            <p>You are not in a party</p>
          </div>
          <div
            className={`guide-menu-item party-action create ${focusZone === 'menu' && selectedItem === 0 ? 'selected' : ''}`}
            data-testid="create-party-btn"
            onClick={() => { playSound('select'); setPartyActive(true); setSelectedItem(0); }}
            onMouseEnter={() => { setFocusZone('menu'); setSelectedItem(0); }}
          >
            <span className="menu-label">Create Party</span>
          </div>
        </div>
      );
    }

    // Main view: Friends / Parties buttons
    return (
      <div className={`guide-tab-content ${tabTransition}`}>
        <div
          className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 0 ? 'selected' : ''}`}
          data-testid="guide-friends-btn"
          onClick={() => { playSound('select'); setFriendsSection('friends'); setSelectedItem(0); }}
          onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(0); }}
        >
          <span className="menu-label">Friends</span>
          <span className="menu-badge">{mockXboxFriends.filter(f => f.status === 'online').length + mockDiscordFriends.filter(f => f.status === 'online').length} online</span>
        </div>
        <div
          className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 1 ? 'selected' : ''}`}
          data-testid="guide-parties-btn"
          onClick={() => { playSound('select'); setFriendsSection('parties'); setSelectedItem(0); }}
          onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(1); }}
        >
          <span className="menu-label">Parties</span>
          <span className="menu-badge">{partyActive ? '1 active' : 'None'}</span>
        </div>
      </div>
    );
  };

  // ========== MESSAGES TAB ==========
  const renderMessagesTab = () => {
    // Conversation detail view
    if (selectedConversation) {
      return (
        <div className={`guide-tab-content ${tabTransition}`}>
          <div className="guide-section-header-row">
            <button className="guide-back-btn" data-testid="messages-back-btn" onClick={() => { playSound('back'); setSelectedConversation(null); setSelectedItem(0); }}>Back</button>
            <span className="guide-section-title">{selectedConversation.friend_name}</span>
          </div>
          <div className="message-detail" data-testid="message-detail">
            <div className="message-bubble received">
              <span className="message-text">{selectedConversation.last_message}</span>
              <span className="message-time">{selectedConversation.timestamp}</span>
            </div>
          </div>
          <div className="guide-section-divider" />
          <div className="message-actions">
            <div
              className={`guide-menu-item party-action ${focusZone === 'menu' && selectedItem === 0 ? 'selected' : ''}`}
              data-testid="msg-invite-party-btn"
              onClick={() => {
                playSound('select');
                if (!partyActive) { setPartyActive(true); setPartyMembers([]); }
                const friend = { name: selectedConversation.friend_name, platform: selectedConversation.platform };
                setPartyMembers(prev => prev.some(m => m.name === friend.name) ? prev : [...prev, friend]);
              }}
              onMouseEnter={() => { setFocusZone('menu'); setSelectedItem(0); }}
            >
              <span className="menu-label">Invite to Party</span>
            </div>
            <div
              className={`guide-menu-item party-action coming-soon ${focusZone === 'menu' && selectedItem === 1 ? 'selected' : ''}`}
              data-testid="msg-invite-game-btn"
              onMouseEnter={() => { setFocusZone('menu'); setSelectedItem(1); }}
            >
              <span className="menu-label">Invite to Game</span>
              <span className="coming-soon-badge">Coming Soon</span>
            </div>
            <div className="coming-soon-info" data-testid="coming-soon-info">
              Invite friends to PC games (Steam, emulator) — Coming Soon
            </div>
          </div>
        </div>
      );
    }

    // Conversations list
    return (
      <div className={`guide-tab-content ${tabTransition}`}>
        {mockConversations.length === 0 && <div className="friends-empty" data-testid="no-messages">No recent conversations</div>}
        {mockConversations.map((conv, i) => (
          <div key={conv.id} className={`guide-menu-item chat-item ${focusZone === 'menu' && selectedItem === i ? 'selected' : ''}`}
            data-testid={`guide-chat-${i}`}
            onClick={() => { playSound('select'); setSelectedConversation(conv); setSelectedItem(0); setFocusZone('menu'); }}
            onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(i); }}
          >
            <div className="chat-item-info">
              <span className="menu-label">{conv.friend_name}</span>
              <span className="chat-preview">{conv.last_message}</span>
            </div>
            <div className="chat-meta">
              {conv.unread > 0 && <span className="chat-unread">{conv.unread}</span>}
              <span className="chat-time">{conv.timestamp}</span>
              <span className="chat-platform-tag">{conv.platform === 'xbox' ? 'XBL' : 'DC'}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ========== HOME TAB ==========
  const renderHomeTab = () => (
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
        data-testid="guide-settings-btn"
        onClick={() => { setFocusZone('menu'); setSelectedItem(1); handleHomeAction(1); }}
        onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(1); }}
      >
        <span className="menu-label">Settings</span>
      </div>
      <div
        className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 2 ? 'selected' : ''}`}
        data-testid="guide-shutdown-btn"
        onClick={() => { setFocusZone('menu'); setSelectedItem(2); handleHomeAction(2); }}
        onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(2); }}
      >
        <span className="menu-label">Shutdown System</span>
        <span className="menu-badge exit-badge">(Exit App)</span>
      </div>

      <div className="guide-section-divider" />
      <div className="guide-section-header">Recently Played</div>

      {homeMenuItems.slice(3).map((item, idx) => {
        const menuIdx = idx + 3;
        return (
          <div
            key={item.id}
            className={`guide-menu-item game-item ${focusZone === 'menu' && selectedItem === menuIdx ? 'selected' : ''}`}
            data-testid={`guide-home-game-${idx}`}
            onClick={() => { setFocusZone('menu'); setSelectedItem(menuIdx); handleHomeAction(menuIdx); }}
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

  const tabRenderers = [renderFriendsPartiesTab, renderMessagesTab, renderHomeTab];

  return (
    <>
      <div data-testid="guide-overlay-backdrop" className="guide-overlay-backdrop" onClick={onClose} />
      <div ref={containerRef} data-testid="guide-modal-container" className="guide-modal-container" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div data-testid="guide-center-panel" className="guide-center-panel">
          <div className="guide-panel-header"><span className="guide-title-text">Guide</span></div>

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
                onClick={() => { if (activeTab !== i) { playSound('focus'); setTabTransition(i > activeTab ? 'slide-left' : 'slide-right'); setTimeout(() => { setActiveTab(i); setSelectedItem(0); setFocusZone('menu'); setFriendsSection('main'); setFriendsPlatform(null); setShowInviteList(false); setSelectedConversation(null); setTabTransition(''); }, 150); } }}>
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
              (activeTab === 0 && friendsSection !== 'main') || (activeTab === 1 && selectedConversation) ? 'Back' : 'Close'
            }</span></div>
            <div className="hint-group"><span className="hint-bumper">LB</span><span className="hint-bumper">RB</span><span>Switch Tab</span></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GuideOverlay;

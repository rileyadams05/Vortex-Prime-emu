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

  // Friends & Parties state
  const [friendsSection, setFriendsSection] = useState('main'); // main | friends | parties
  const [friendsPlatform, setFriendsPlatform] = useState(null); // null | 'xbox' | 'discord'
  const [partyActive, setPartyActive] = useState(false);
  const [partyMembers, setPartyMembers] = useState([]);
  const [showInviteList, setShowInviteList] = useState(false);
  const [invitePlatform, setInvitePlatform] = useState(null); // null | 'xbox' | 'discord' for invite flow
  const [viewingProfile, setViewingProfile] = useState(null); // { name, platform, status, activity }

  // Messages state
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messagesPlatform, setMessagesPlatform] = useState(null); // null | 'xbox' | 'discord'
  const [chatMessages, setChatMessages] = useState({}); // { convId: [{text, sender, time}] }
  const [messageInput, setMessageInput] = useState('');
  const messageInputRef = useRef(null);
  const chatEndRef = useRef(null);

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
      setInvitePlatform(null);
      setViewingProfile(null);
      setSelectedConversation(null);
      setMessagesPlatform(null);
      setHomeSection('main');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && containerRef.current) containerRef.current.focus();
  }, [isOpen]);

  const formatTime = useCallback((date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }), []);

  // Seed initial messages for a conversation if not yet loaded
  const getMessages = useCallback((conv) => {
    if (!conv) return [];
    if (chatMessages[conv.id]) return chatMessages[conv.id];
    // Seed from mock data
    const initial = [{ text: conv.last_message, sender: 'them', time: conv.timestamp }];
    setChatMessages(prev => ({ ...prev, [conv.id]: initial }));
    return initial;
  }, [chatMessages]);

  const sendMessage = useCallback(() => {
    if (!messageInput.trim() || !selectedConversation) return;
    const newMsg = { text: messageInput.trim(), sender: 'you', time: formatTime(new Date()) };
    setChatMessages(prev => ({
      ...prev,
      [selectedConversation.id]: [...(prev[selectedConversation.id] || []), newMsg],
    }));
    setMessageInput('');
    playSound('select');
    // Scroll to bottom
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [messageInput, selectedConversation, formatTime]);

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
      setInvitePlatform(null);
      setViewingProfile(null);
      setSelectedConversation(null);
      setMessagesPlatform(null);
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
        if (activeTab === 0 && viewingProfile) {
          setViewingProfile(null); setSelectedItem(0);
        } else if (activeTab === 0 && friendsSection !== 'main') {
          if (invitePlatform) setInvitePlatform(null);
          else if (showInviteList) setShowInviteList(false);
          else if (friendsPlatform) setFriendsPlatform(null);
          else { setFriendsSection('main'); setSelectedItem(0); }
        } else if (activeTab === 1 && selectedConversation) {
          setSelectedConversation(null); setMessageInput(''); setSelectedItem(0);
        } else if (activeTab === 1 && messagesPlatform) {
          setMessagesPlatform(null); setSelectedItem(0);
        } else if (activeTab === 2 && homeSection !== 'main') {
          setHomeSection('main'); setSelectedItem(0);
        } else {
          onClose();
        }
        break;
      default: break;
    }
  }, [isOpen, selectedItem, focusZone, activeTab, friendsSection, friendsPlatform, showInviteList, invitePlatform, viewingProfile, selectedConversation, messagesPlatform, homeSection, onClose, switchTab]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleKeyDown]);

  // Gamepad
  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = { selectedItem, focusZone, activeTab, friendsSection, friendsPlatform, showInviteList, invitePlatform, viewingProfile, selectedConversation, messagesPlatform, homeSection };
  }, [selectedItem, focusZone, activeTab, friendsSection, friendsPlatform, showInviteList, invitePlatform, viewingProfile, selectedConversation, messagesPlatform, homeSection]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = onGamepadPress((event) => {
      if (event.type !== 'press') return;
      const btn = event.button;
      const s = stateRef.current;

      if (btn === 'b') {
        playSound('back');
        if (s.activeTab === 0 && s.viewingProfile) {
          setViewingProfile(null); setSelectedItem(0);
        } else if (s.activeTab === 0 && s.friendsSection !== 'main') {
          if (s.invitePlatform) setInvitePlatform(null);
          else if (s.showInviteList) setShowInviteList(false);
          else if (s.friendsPlatform) setFriendsPlatform(null);
          else { setFriendsSection('main'); setSelectedItem(0); }
        } else if (s.activeTab === 1 && s.selectedConversation) {
          setSelectedConversation(null); setMessageInput(''); setSelectedItem(0);
        } else if (s.activeTab === 1 && s.messagesPlatform) {
          setMessagesPlatform(null); setSelectedItem(0);
        } else if (s.activeTab === 2 && s.homeSection !== 'main') {
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
  const renderFriendsPartiesTab = () => {
    // Friend profile popup (Xbox 360 style)
    if (viewingProfile) {
      const isXbox = viewingProfile.platform === 'xbox';
      return (
        <div className={`guide-tab-content ${tabTransition}`}>
          <div className="guide-section-header-row">
            <button className="guide-back-btn" data-testid="profile-back-btn" onClick={() => { playSound('back'); setViewingProfile(null); setSelectedItem(0); }}>Back</button>
            <span className="guide-section-title">Player Profile</span>
          </div>
          <div className="friend-profile-card" data-testid="friend-profile-card">
            <div className="profile-card-top">
              <div className={`profile-card-avatar ${isXbox ? '' : 'discord'}`}><div className="friend-avatar-placeholder large" /></div>
              <div className="profile-card-info">
                <span className="profile-card-name">{viewingProfile.name}</span>
                <span className="profile-card-platform">{isXbox ? 'Xbox Live' : 'Discord'}</span>
                <span className={`profile-card-status ${viewingProfile.status}`}>{viewingProfile.status}</span>
                {viewingProfile.activity && <span className="profile-card-activity">{viewingProfile.activity}</span>}
              </div>
            </div>
          </div>
          <div className="profile-actions">
            <div
              className={`guide-menu-item party-action ${focusZone === 'menu' && selectedItem === 0 ? 'selected' : ''}`}
              data-testid="profile-invite-party-btn"
              onClick={() => {
                playSound('select');
                if (!partyActive) { setPartyActive(true); setPartyMembers([]); }
                setPartyMembers(prev => prev.some(m => m.name === viewingProfile.name) ? prev : [...prev, viewingProfile]);
                setViewingProfile(null); setSelectedItem(0);
              }}
              onMouseEnter={() => { setFocusZone('menu'); setSelectedItem(0); }}
            >
              <span className="menu-label">Invite to Party</span>
              <span className="menu-badge controller-hint">X</span>
            </div>
            <div
              className={`guide-menu-item party-action coming-soon ${focusZone === 'menu' && selectedItem === 1 ? 'selected' : ''}`}
              data-testid="profile-invite-game-btn"
              onMouseEnter={() => { setFocusZone('menu'); setSelectedItem(1); }}
            >
              <span className="menu-label">Invite to Game</span>
              <span className="coming-soon-badge">Coming Soon</span>
              <span className="menu-badge controller-hint">Y</span>
            </div>
            <div className="coming-soon-info">PC games (Steam, emulator) — Coming Soon</div>
          </div>
        </div>
      );
    }

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
                onClick={() => { playSound('select'); setViewingProfile({ name: f.gamertag, platform: 'xbox', status: f.status, activity: f.activity }); setSelectedItem(0); }}
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
                onClick={() => { playSound('select'); setViewingProfile({ name: f.username, platform: 'discord', status: f.status, activity: f.activity }); setSelectedItem(0); }}
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

    // Sub-view: Parties
    if (friendsSection === 'parties') {
      // Invite flow: platform picker
      if (showInviteList && !invitePlatform) {
        return (
          <div className={`guide-tab-content ${tabTransition}`}>
            <div className="guide-section-header-row">
              <button className="guide-back-btn" data-testid="invite-back-btn" onClick={() => { playSound('back'); setShowInviteList(false); setSelectedItem(0); }}>Back</button>
              <span className="guide-section-title">Invite to Party</span>
            </div>
            <div
              className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 0 ? 'selected' : ''}`}
              data-testid="invite-xbox-btn"
              onClick={() => { playSound('select'); setInvitePlatform('xbox'); setSelectedItem(0); }}
              onMouseEnter={() => { setFocusZone('menu'); setSelectedItem(0); }}
            >
              <span className="menu-label">Xbox Live</span>
              <span className="menu-badge">{mockXboxFriends.filter(f => f.status === 'online').length} online</span>
            </div>
            <div
              className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 1 ? 'selected' : ''}`}
              data-testid="invite-discord-btn"
              onClick={() => { playSound('select'); setInvitePlatform('discord'); setSelectedItem(0); }}
              onMouseEnter={() => { setFocusZone('menu'); setSelectedItem(1); }}
            >
              <span className="menu-label">Discord</span>
              <span className="menu-badge">{mockDiscordFriends.filter(f => f.status === 'online').length} online</span>
            </div>
          </div>
        );
      }

      // Invite flow: friends list for selected platform
      if (showInviteList && invitePlatform) {
        const friends = invitePlatform === 'xbox'
          ? mockXboxFriends.map(f => ({ ...f, name: f.gamertag, platform: 'xbox' }))
          : mockDiscordFriends.map(f => ({ ...f, name: f.username, platform: 'discord' }));
        return (
          <div className={`guide-tab-content ${tabTransition}`}>
            <div className="guide-section-header-row">
              <button className="guide-back-btn" data-testid="invite-platform-back-btn" onClick={() => { playSound('back'); setInvitePlatform(null); setSelectedItem(0); }}>Back</button>
              <span className="guide-section-title">{invitePlatform === 'xbox' ? 'Xbox Live' : 'Discord'} Friends</span>
            </div>
            <div className="friends-list" data-testid="invite-friends-list">
              {friends.filter(f => f.status === 'online' || f.status === 'away').map((f, i) => {
                const isInParty = partyMembers.some(m => m.name === f.name);
                return (
                  <div key={f.name} className={`friend-item invite-item ${isInParty ? 'in-party' : ''} ${focusZone === 'menu' && selectedItem === i ? 'selected' : ''}`}
                    data-testid={`invite-friend-${i}`}
                    onClick={() => { if (!isInParty) { playSound('select'); setPartyMembers(prev => [...prev, f]); } }}
                    onMouseEnter={() => { setFocusZone('menu'); setSelectedItem(i); }}
                  >
                    <div className="friend-avatar"><div className={`friend-avatar-placeholder ${f.platform === 'discord' ? 'discord' : ''}`} /></div>
                    <div className="friend-info">
                      <span className="friend-name">{f.name}</span>
                      <span className={`friend-status ${f.status}`}>{f.status}</span>
                    </div>
                    {isInParty ? <span className="invite-status invited">Invited</span> : <span className="invite-status available">Invite</span>}
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
                onClick={() => { playSound('select'); setShowInviteList(true); setInvitePlatform(null); setSelectedItem(0); }}
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
    // Conversation detail view — full chat with message input
    if (selectedConversation) {
      const messages = getMessages(selectedConversation);
      return (
        <div className={`guide-tab-content ${tabTransition}`}>
          <div className="guide-section-header-row">
            <button className="guide-back-btn" data-testid="messages-back-btn" onClick={() => { playSound('back'); setSelectedConversation(null); setMessageInput(''); setSelectedItem(0); }}>Back</button>
            <span className="guide-section-title">{selectedConversation.friend_name}</span>
          </div>
          <div className="chat-messages-area" data-testid="chat-messages-area">
            {messages.map((msg, i) => (
              <div key={i} className={`message-bubble ${msg.sender === 'you' ? 'sent' : 'received'}`}>
                <span className="message-text">{msg.text}</span>
                <span className="message-time">{msg.time}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-input-row" data-testid="chat-input-row">
            <div
              className="chat-input-trigger"
              data-testid="chat-message-input"
              onClick={() => {
                if (onOpenKeyboard) {
                  onOpenKeyboard((text) => {
                    if (text && text.trim()) {
                      const newMsg = { text: text.trim(), sender: 'you', time: formatTime(new Date()) };
                      setChatMessages(prev => ({
                        ...prev,
                        [selectedConversation.id]: [...(prev[selectedConversation.id] || []), newMsg],
                      }));
                      playSound('select');
                      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                    }
                  });
                }
              }}
            >
              <span className="chat-input-placeholder">Type a message...</span>
              <span className="chat-input-hint">A</span>
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

    // Sub-view: Xbox Live conversations
    if (messagesPlatform === 'xbox') {
      const xboxConvos = mockConversations.filter(c => c.platform === 'xbox');
      return (
        <div className={`guide-tab-content ${tabTransition}`}>
          <div className="guide-section-header-row">
            <button className="guide-back-btn" data-testid="msg-xbox-back-btn" onClick={() => { playSound('back'); setMessagesPlatform(null); setSelectedItem(0); }}>Back</button>
            <span className="guide-section-title">Xbox Live Messages</span>
          </div>
          {xboxConvos.length === 0 && <div className="friends-empty">No Xbox Live conversations</div>}
          {xboxConvos.map((conv, i) => (
            <div key={conv.id} className={`guide-menu-item chat-item ${focusZone === 'menu' && selectedItem === i ? 'selected' : ''}`}
              data-testid={`guide-xbox-chat-${i}`}
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
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Sub-view: Discord conversations
    if (messagesPlatform === 'discord') {
      const discordConvos = mockConversations.filter(c => c.platform === 'discord');
      return (
        <div className={`guide-tab-content ${tabTransition}`}>
          <div className="guide-section-header-row">
            <button className="guide-back-btn" data-testid="msg-discord-back-btn" onClick={() => { playSound('back'); setMessagesPlatform(null); setSelectedItem(0); }}>Back</button>
            <span className="guide-section-title">Discord Messages</span>
          </div>
          {discordConvos.length === 0 && <div className="friends-empty">No Discord conversations</div>}
          {discordConvos.map((conv, i) => (
            <div key={conv.id} className={`guide-menu-item chat-item ${focusZone === 'menu' && selectedItem === i ? 'selected' : ''}`}
              data-testid={`guide-discord-chat-${i}`}
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
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Main view: Xbox Live / Discord buttons
    const xboxUnread = mockConversations.filter(c => c.platform === 'xbox' && c.unread > 0).reduce((sum, c) => sum + c.unread, 0);
    const discordUnread = mockConversations.filter(c => c.platform === 'discord' && c.unread > 0).reduce((sum, c) => sum + c.unread, 0);

    return (
      <div className={`guide-tab-content ${tabTransition}`}>
        <div
          className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 0 ? 'selected' : ''}`}
          data-testid="msg-xbox-live-btn"
          onClick={() => { playSound('select'); setMessagesPlatform('xbox'); setSelectedItem(0); }}
          onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(0); }}
        >
          <span className="menu-label">Xbox Live</span>
          <span className="menu-badge">{xboxUnread > 0 ? `${xboxUnread} unread` : `${mockConversations.filter(c => c.platform === 'xbox').length} chats`}</span>
        </div>
        <div
          className={`guide-menu-item ${focusZone === 'menu' && selectedItem === 1 ? 'selected' : ''}`}
          data-testid="msg-discord-btn"
          onClick={() => { playSound('select'); setMessagesPlatform('discord'); setSelectedItem(0); }}
          onMouseEnter={() => { playSound('focus'); setFocusZone('menu'); setSelectedItem(1); }}
        >
          <span className="menu-label">Discord</span>
          <span className="menu-badge">{discordUnread > 0 ? `${discordUnread} unread` : `${mockConversations.filter(c => c.platform === 'discord').length} chats`}</span>
        </div>
      </div>
    );
  };

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
              (activeTab === 0 && (viewingProfile || friendsSection !== 'main')) || (activeTab === 1 && (selectedConversation || messagesPlatform)) || (activeTab === 2 && homeSection !== 'main') ? 'Back' : 'Close'
            }</span></div>
            <div className="hint-group"><span className="hint-bumper">LB</span><span className="hint-bumper">RB</span><span>Switch Tab</span></div>
            {viewingProfile && (
              <div className="hint-group"><div className="hint-btn blue">X</div><span>Party</span><div className="hint-btn yellow">Y</div><span>Game</span></div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default GuideOverlay;

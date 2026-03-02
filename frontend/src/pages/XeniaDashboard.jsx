import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Search, Disc, Trophy, Settings, ChevronLeft, ChevronRight, Image as ImageIcon, Video, Store, Bot } from 'lucide-react';
import axios from 'axios';
import { mockGames, mockAchievements } from '../data/xeniaData';
import NXESettings from '../components/NXESettings';
import BladesOverlay from '../components/BladesOverlay';
import GuideOverlay from '../components/GuideOverlay';
import ThemeManager from '../components/ThemeManager';
import Marketplace from '../components/Marketplace';
import Xbox360Keyboard from '../components/Xbox360Keyboard';
import { initializeMsal, loginAndFetchProfile, logout } from '../services/xboxAuthService';
import { useGamepad } from '../context/GamepadContext';
import playSound from '../utils/soundManager';
import '../styles/XeniaDashboard.css';
import '../styles/Marketplace.css';
import '../styles/Xbox360Keyboard.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const XeniaDashboard = () => {
  const [currentView, setCurrentView] = useState('home');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isGuidePressed, setIsGuidePressed] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [gameCarouselIndex, setGameCarouselIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // AI Panel state
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);

  // Xbox 360 Keyboard state
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardCallback, setKeyboardCallback] = useState(null);

  const loadActiveTheme = useCallback(async () => {
    try {
      await fetch(`${API}/themes/active`);
    } catch (e) { /* fallback */ }
  }, []);

  useEffect(() => { loadActiveTheme(); }, [loadActiveTheme]);

  // Recently Played Games (persisted to localStorage)
  const [recentGames, setRecentGames] = useState(() => {
    try {
      const saved = localStorage.getItem('recentGames');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const addToRecentGames = (game) => {
    setRecentGames(prev => {
      const filtered = prev.filter(g => g.title !== game.title);
      const updated = [{ ...game, lastPlayed: Date.now(), hasQuickResume: true }, ...filtered].slice(0, 5);
      localStorage.setItem('recentGames', JSON.stringify(updated));
      return updated;
    });
  };

  // Seed recently played on first visit so Games tab has content
  useEffect(() => {
    if (recentGames.length === 0 && mockGames.length > 0) {
      const seeded = mockGames.slice(0, 3).map((g, i) => ({
        ...g,
        lastPlayed: Date.now() - (i * 3600000),
        hasQuickResume: i < 2,
      }));
      setRecentGames(seeded);
      localStorage.setItem('recentGames', JSON.stringify(seeded));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Guide Button Listener (Rust Backend via Tauri events)
  useEffect(() => {
    let unlisten = null;

    const setupListener = async () => {
      try {
        if (window.__TAURI__) {
          unlisten = await listen('toggle-guide', () => {
            console.log("Guide button detected from Rust!");
            setIsGuidePressed(true);
            setTimeout(() => setIsGuidePressed(false), 200);
            setIsGuideOpen(prev => !prev);
          });
        }
      } catch (err) {
        console.warn("Failed to setup guide listener:", err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Robustly define filteredGames to avoid ReferenceError
  const filteredGames = (mockGames || []).filter(game => 
    game.title.toLowerCase().includes((searchQuery || '').toLowerCase())
  );
  
  // Auth State
  const [xboxProfile, setXboxProfile] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Assets State
  const [startupVideos, setStartupVideos] = useState([]);
  const [wallpapers, setWallpapers] = useState([]);
  const [showStartupVideo, setShowStartupVideo] = useState(true);

  const mainCards = useMemo(() => [
    { id: 'library', title: 'GAMES', icon: Disc, action: () => setCurrentView('gameLibrary') },
    { id: 'settings', title: 'SYSTEM SETTINGS', icon: Settings, action: () => setCurrentView('settings') },
    { id: 'achievements', title: 'ACHIEVEMENTS', icon: Trophy, action: () => setCurrentView('achievements') },
    { id: 'marketplace', title: 'MARKETPLACE', icon: Store, action: () => setCurrentView('marketplace') },
    { id: 'themes', title: 'THEMES', icon: ImageIcon, action: () => setCurrentView('themes') },
    { id: 'startup', title: 'STARTUP', icon: Video, action: () => setCurrentView('startup') }
  ], []);

  // Core action callbacks (defined before useEffects that reference them)
  const handleCardSelect = useCallback((index) => {
    playSound('select');
    setSelectedCardIndex(index);
    mainCards[index].action();
  }, [mainCards]);

  const launchGame = useCallback(async (game) => {
    if (window.__TAURI__) {
       try {
           const { invoke } = window.__TAURI__.core || window.__TAURI__.tauri; 
           const xuid = xboxProfile?.xuid || "0000000000000000";
           const gamertag = xboxProfile?.gamertag || "Player";
           console.log(`Launching ${game.title} ...`);
           await invoke('launch_xenia', { 
               gamePath: game.path,
               xuid: xuid,
               gamertag: gamertag
           });
       } catch (e) {
           console.error("Failed to launch Vortex Prime Emu AMF:", e);
           alert("Failed to launch Vortex Prime Emu AMF: " + e);
       }
    } else {
        alert(`Launching ${game.title} with Vortex Prime Emu...\nPath: ${game.path}\n(Not in Tauri environment)`);
    }
  }, [xboxProfile]);

  const handleGameSelect = useCallback((game) => {
    playSound('select');
    addToRecentGames(game);
    if (currentView === 'achievements') {
      setSelectedGame(game);
      setCurrentView('achievement');
    } else {
      launchGame(game);
    }
  }, [currentView, launchGame]);

  const navigateCarousel = useCallback((direction) => {
    playSound('focus');
    if (direction === 'left') {
      setGameCarouselIndex(prev => prev > 0 ? prev - 1 : prev);
    } else if (direction === 'right') {
      setGameCarouselIndex(prev => prev < mockGames.length - 1 ? prev + 1 : prev);
    }
  }, []);

  // ==== GAMEPAD: Direct controller input via GamepadContext ====
  const { onPress: onGamepadPress } = useGamepad();
  
  // Use refs so the gamepad callback always has current state
  const viewRef = useRef(currentView);
  const cardRef = useRef(selectedCardIndex);
  const carouselRef = useRef(gameCarouselIndex);
  const guideRef = useRef(isGuideOpen);
  
  useEffect(() => { viewRef.current = currentView; }, [currentView]);
  useEffect(() => { cardRef.current = selectedCardIndex; }, [selectedCardIndex]);
  useEffect(() => { carouselRef.current = gameCarouselIndex; }, [gameCarouselIndex]);
  useEffect(() => { guideRef.current = isGuideOpen; }, [isGuideOpen]);

  useEffect(() => {
    const unsub = onGamepadPress((event) => {
      if (event.type !== 'press') return;
      const btn = event.button;

      // Guide/Home button toggles guide
      if (btn === 'guide' || btn === 'back') {
        if (btn === 'guide') {
          playSound('panelUnfold');
          setIsGuidePressed(true);
          setTimeout(() => setIsGuidePressed(false), 200);
          setIsGuideOpen(prev => !prev);
          return;
        }
      }

      // If Guide is open, let GuideOverlay handle it
      if (guideRef.current) return;

      const view = viewRef.current;

      if (btn === 'a') {
        playSound('select');
        if (view === 'home') {
          handleCardSelect(cardRef.current);
        } else if (view === 'gameLibrary' || view === 'achievements') {
          const game = filteredGames[carouselRef.current];
          if (game) handleGameSelect(game);
        }
      }

      if (btn === 'b') {
        if (view !== 'home') {
          playSound('back');
          if (view === 'achievement') setCurrentView('achievements');
          else setCurrentView('home');
        }
      }

      if (btn === 'start') {
        playSound('panelUnfold');
        setIsGuidePressed(true);
        setTimeout(() => setIsGuidePressed(false), 200);
        setIsGuideOpen(prev => !prev);
      }

      // D-pad + Stick navigation
      if (btn === 'dpadLeft' || btn === 'stickLeft') {
        if (view === 'home') {
          const newIdx = Math.max(0, cardRef.current - 1);
          if (newIdx !== cardRef.current) { playSound('focus'); setSelectedCardIndex(newIdx); }
        } else if (view === 'gameLibrary' || view === 'achievements') {
          navigateCarousel('left');
        }
      }

      if (btn === 'dpadRight' || btn === 'stickRight') {
        if (view === 'home') {
          const newIdx = Math.min(mainCards.length - 1, cardRef.current + 1);
          if (newIdx !== cardRef.current) { playSound('focus'); setSelectedCardIndex(newIdx); }
        } else if (view === 'gameLibrary' || view === 'achievements') {
          navigateCarousel('right');
        }
      }

      if (btn === 'dpadUp' || btn === 'stickUp') {
        playSound('focus');
        if (view === 'gameLibrary' || view === 'achievements') {
          navigateCarousel('left');
        }
      }

      if (btn === 'dpadDown' || btn === 'stickDown') {
        playSound('focus');
        if (view === 'gameLibrary' || view === 'achievements') {
          navigateCarousel('right');
        }
      }

      // LB / RB
      if (btn === 'lb') {
        playSound('channelDown');
        if (view === 'home') setSelectedCardIndex(prev => Math.max(0, prev - 1));
        else navigateCarousel('left');
      }
      if (btn === 'rb') {
        playSound('channelUp');
        if (view === 'home') setSelectedCardIndex(prev => Math.min(mainCards.length - 1, prev + 1));
        else navigateCarousel('right');
      }
    });
    return unsub;
  }, [onGamepadPress, filteredGames, handleCardSelect, handleGameSelect, navigateCarousel, mainCards.length]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Toggle Guide on Tab / Home key
      if (e.key === 'Tab' || e.key === 'Home') {
        e.preventDefault();
        e.stopPropagation();
        playSound('panelUnfold');
        setIsGuidePressed(true);
        setTimeout(() => setIsGuidePressed(false), 200);
        setIsGuideOpen(prev => !prev);
        return;
      }

      // If Guide is open, don't process dashboard keys (Guide handles its own)
      if (isGuideOpen) {
        return;
      }

      // --- Dashboard Navigation Logic ---
      
      // "A" Button (Enter) Logic
      if (e.key === 'Enter') {
          playSound('select');
          if (currentView === 'home') {
              handleCardSelect(selectedCardIndex);
          } else if (currentView === 'gameLibrary' || currentView === 'achievements') {
             const game = filteredGames[gameCarouselIndex];
             if (game) handleGameSelect(game);
          }
      }

      // "B" Button (Backspace) Logic
      if (e.key === 'Backspace') {
          if (currentView !== 'home') {
              playSound('back');
              if (currentView === 'achievement') setCurrentView('achievements');
              else setCurrentView('home');
          }
      }

      // D-Pad Left (ArrowLeft) Logic
      if (e.key === 'ArrowLeft') {
           if (currentView === 'home') {
               const newIndex = Math.max(0, selectedCardIndex - 1);
               if (newIndex !== selectedCardIndex) {
                   playSound('focus');
                   setSelectedCardIndex(newIndex);
               }
           } else if (currentView === 'gameLibrary' || currentView === 'achievements') {
               navigateCarousel('left');
           }
      }

      // D-Pad Right (ArrowRight) Logic
      if (e.key === 'ArrowRight') {
           if (currentView === 'home') {
               const newIndex = Math.min(mainCards.length - 1, selectedCardIndex + 1);
               if (newIndex !== selectedCardIndex) {
                   playSound('focus');
                   setSelectedCardIndex(newIndex);
               }
           } else if (currentView === 'gameLibrary' || currentView === 'achievements') {
               navigateCarousel('right');
           }
      }

      // LB/RB for fast navigation
      if (e.key === 'q') {
          playSound('channelDown');
          if (currentView === 'home') {
            setSelectedCardIndex((prev) => Math.max(0, prev - 1));
          } else if (currentView === 'gameLibrary' || currentView === 'achievements') {
            navigateCarousel('left');
          }
      }
      if (e.key === 'e') {
          playSound('channelUp');
          if (currentView === 'home') {
            setSelectedCardIndex((prev) => Math.min(mainCards.length - 1, prev + 1));
          } else if (currentView === 'gameLibrary' || currentView === 'achievements') {
            navigateCarousel('right');
          }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [currentView, gameCarouselIndex, filteredGames, selectedCardIndex, isGuideOpen, handleCardSelect, handleGameSelect, mainCards.length, navigateCarousel]);

  useEffect(() => {
    // 1. Initialize MSAL
    initializeMsal().catch(e => console.error("MSAL Init Error:", e));

    // 2. Check Login Session
    const savedProfile = localStorage.getItem('xboxProfile');
    if (savedProfile) {
      try {
        setXboxProfile(JSON.parse(savedProfile));
        setIsLoggedIn(true);
      } catch (e) {
        localStorage.removeItem('xboxProfile');
      }
    }

    // 3. Handle Startup Video
    const skipStartup = localStorage.getItem('skipStartup');
    if (skipStartup === 'true') {
      setShowStartupVideo(false);
    } else {
      setTimeout(() => {
        setShowStartupVideo(false);
        localStorage.setItem('skipStartup', 'true');
      }, 3000); 
    }

    // 4. Load Assets
    loadStartupVideos();
    loadWallpapers();
    
    // Listen for OAuth
    const handleOAuthCallback = (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data.type === 'XBOX_AUTH_SUCCESS') {
          const { profile } = event.data;
          setXboxProfile(profile);
          setIsLoggedIn(true);
          localStorage.setItem('xboxProfile', JSON.stringify(profile));
        }
    };
    window.addEventListener('message', handleOAuthCallback);
    return () => window.removeEventListener('message', handleOAuthCallback);

  }, []);

  const loadStartupVideos = async () => {
    try {
      const response = await axios.get(`${API}/startup/videos`);
      setStartupVideos(response.data.videos);
    } catch (error) {
      console.error('Failed to load startup videos', error);
    }
  };

  const loadWallpapers = async () => {
    try {
      const response = await axios.get(`${API}/wallpapers`);
      setWallpapers(response.data.wallpapers);
    } catch (error) {
      console.error('Failed to load wallpapers', error);
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      const profileData = await loginAndFetchProfile();
      setXboxProfile(profileData);
      setIsLoggedIn(true);
      localStorage.setItem('xboxProfile', JSON.stringify(profileData));
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed. Please check console for details.");
    }
  };

  const handleToggleWallpaper = async (filename, currentStatus) => {
    playSound('select');
    try {
        const action = currentStatus === 'active' ? 'disable' : 'enable';
        await axios.post(`${API}/wallpapers/toggle`, { filename, action });
        
        loadWallpapers();
        
        if (action === 'enable') {
            if (window.confirm(`Enabled ${filename}. Restart app to see changes?`)) {
               if (window.__TAURI__) {
                   import('@tauri-apps/plugin-process').then(({ relaunch }) => {
                       relaunch();
                   });
               } else {
                   window.location.reload(); 
               }
            }
        }
    } catch (error) {
        alert('Error toggling wallpaper: ' + error.message);
    }
  };

  const handleToggleStartupVideo = async (filename, currentStatus) => {
    playSound('select');
    try {
      const action = currentStatus === 'active' ? 'disable' : 'enable';
      await axios.post(`${API}/startup/toggle`, { filename, action });
      
      loadStartupVideos();
      
      if (action === 'enable') {
        if (window.confirm(`Enabled ${filename}. Restart app to see changes?`)) {
           if (window.__TAURI__) {
               import('@tauri-apps/plugin-process').then(({ relaunch }) => {
                   relaunch();
               });
           } else {
               window.location.reload(); 
           }
        }
      }
    } catch (error) {
      alert('Error toggling video: ' + error.message);
    }
  };

  const renderHome = () => {
    return (
      <div className="xenia-home">
        <div className="home-header">
          <h1 className="my-xenia" data-testid="dashboard-title">VORTEX PRIME EMU</h1>
          {isLoggedIn && xboxProfile?.gamerscore != null && (
            <div className="home-gamerscore" data-testid="home-gamerscore">
              <span className="gs-value">{xboxProfile.gamerscore}</span>
              <span className="gs-label">G</span>
            </div>
          )}
        </div>

        {/* Recently Played - directly under title */}
        {recentGames.length > 0 && (
          <div className="recent-games-strip" data-testid="recent-games-strip">
            <h3 className="recent-title">Recently Played</h3>
            <div className="recent-games-row">
              {recentGames.slice(0, 5).map((game, i) => (
                <div key={i} className="recent-game-tile small"
                  data-testid={`recent-game-${i}`}
                  onClick={() => { playSound('select'); launchGame(game); }}
                >
                  <img src={game.boxart || game.icon} alt={game.title} className="recent-game-art" />
                  <span className="recent-game-name">{game.title}</span>
                  {game.hasQuickResume && <span className="qr-badge">QR</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main dashboard cards */}
        <div className="main-cards-container">
          {mainCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className={`main-card ${index === selectedCardIndex ? 'selected' : ''}`}
                data-testid={`card-${card.id}`}
                onClick={() => handleCardSelect(index)}
                onMouseEnter={() => {
                  if (index !== selectedCardIndex) {
                    playSound('focus');
                    setSelectedCardIndex(index);
                  }
                }}
              >
                <div className="card-content">
                  <Icon size={48} className="card-icon" />
                  <h2 className="card-title">{card.title}</h2>
                </div>
              </div>
            );
          })}
        </div>

        {/* Extra game slots at bottom */}
        <div className="extra-game-slots" data-testid="extra-game-slots">
          {mockGames.slice(0, 2).map((game, i) => (
            <div key={i} className="extra-game-card" data-testid={`extra-game-${i}`}
              onClick={() => { playSound('select'); handleGameSelect(game); }}
            >
              <img src={game.cover} alt={game.title} className="extra-game-cover" />
              <div className="extra-game-info">
                <span className="extra-game-title">{game.title}</span>
                <span className="extra-game-pub">{game.publisher}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderGameLibrary = () => (
    <div className="game-library-view">
      <div className="library-header">
        <button className="back-btn" onClick={() => {
            playSound('back');
            setCurrentView('home');
        }}>
          <ChevronLeft size={24} /> Back
        </button>
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="SEARCH LIBRARY"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="search-hint">R3</span>
        </div>
      </div>

      <div className="game-carousel">
        <button 
          className="carousel-nav left"
          onClick={() => navigateCarousel('left')}
          disabled={gameCarouselIndex === 0}
        >
          <ChevronLeft size={48} />
        </button>

        <div className="carousel-wrapper">
          {filteredGames.map((game, index) => {
            const offset = index - gameCarouselIndex;
            const isCenter = offset === 0;
            const isLeft = offset === -1;
            const isRight = offset === 1;
            const isVisible = Math.abs(offset) <= 2;

            return (
              <div
                key={game.id}
                className={`game-box ${
                  isCenter ? 'center' : 
                  isLeft ? 'left' : 
                  isRight ? 'right' : 
                  offset < 0 ? 'far-left' : 'far-right'
                } ${!isVisible ? 'hidden' : ''}`}
                onClick={() => isCenter && handleGameSelect(game)}
                style={{ zIndex: 100 - Math.abs(offset) }}
              >
                <div className="xbox-banner">XBOX 360 LIVE</div>
                <img src={game.cover} alt={game.title} className="game-cover" />
                <div className="game-box-title">{game.title}</div>
              </div>
            );
          })}
        </div>

        <button 
          className="carousel-nav right"
          onClick={() => navigateCarousel('right')}
          disabled={gameCarouselIndex >= filteredGames.length - 1}
        >
          <ChevronRight size={48} />
        </button>
      </div>

      <div className="game-details-panel">
        {filteredGames[gameCarouselIndex] && (
          <>
            <h2>{filteredGames[gameCarouselIndex].title}</h2>
            <p className="game-description">{filteredGames[gameCarouselIndex].description}</p>
            <div className="game-meta">
              <span>Title ID: {filteredGames[gameCarouselIndex].titleId}</span>
              <span>Publisher: {filteredGames[gameCarouselIndex].publisher}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderAchievementView = () => (
    <div className="achievement-modal-overlay" onClick={() => {
        playSound('back');
        setCurrentView('achievements');
    }}>
      <div className="achievement-modal" onClick={(e) => e.stopPropagation()}>
        <div className="achievement-header">
          <img src={selectedGame?.banner} alt={selectedGame?.title} className="game-banner" />
        </div>
        <div className="achievement-body">
          <h2>{selectedGame?.title}</h2>
          <p className="title-id">TITLE ID: {selectedGame?.titleId}</p>
          <div className="achievement-score">
            <Trophy size={32} />
            <span className="score">0</span>
            <p>0 / {selectedGame?.achievementCount} Achievements</p>
          </div>
          <div className="achievements-grid">
            {Array.from({ length: selectedGame?.achievementCount || 30 }).map((_, i) => (
              <div key={i} className="achievement-icon locked">
                <div className="lock-icon">🔒</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderThemesView = () => (
    <ThemeManager
      onBack={() => { playSound('back'); setCurrentView('home'); }}
      onThemeChange={loadActiveTheme}
    />
  );

  const renderStartupView = () => (
    <div className="game-library-view">
        <div className="library-header">
            <button className="back-btn" onClick={() => {
                playSound('back');
                setCurrentView('home');
            }}>
                <ChevronLeft size={24} /> Back
            </button>
            <h2 style={{marginLeft: 20}}>Startup Video Manager</h2>
        </div>
        <div className="assets-grid">
            {startupVideos.map((vid, i) => (
                <div key={i} className={`asset-card ${vid.status}`} onClick={() => handleToggleStartupVideo(vid.name, vid.status)}>
                    <div className="asset-icon"><Video size={48}/></div>
                    <div className="asset-info">
                        <h3>{vid.name}</h3>
                        <span className={`status-badge ${vid.status}`}>{vid.status}</span>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  if (showStartupVideo) {
    return (
      <div className="startup-screen">
        <div className="startup-video-container">
           {/* If we had a real video URL, we'd play it here. For now, showing the animation. */}
           <div className="xbox-startup-logo">
             <div className="xbox-icon-large"></div>
           </div>
           <div className="startup-text">Xbox 360</div>
           <div className="loading-bar"><div className="loading-progress"></div></div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className={`xenia-dashboard ${isGuideOpen ? 'blurred' : ''}`} data-testid="xenia-dashboard" style={{ 
        transition: 'filter 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
        filter: isGuideOpen ? 'blur(12px) brightness(0.7)' : 'none' 
    }}>
      <BladesOverlay currentView={currentView} setCurrentView={setCurrentView} />
      
      <div className="xenia-background" style={{ backgroundImage: "url(/wallpapers/Play/default.png)" }}>
        <div className="bg-overlay"></div>
      </div>

      <div className="xenia-header">
        <div className="header-spacer"></div>
        <div className="ai-box" data-testid="ai-box">
          <button
            className="ai-toggle-btn"
            data-testid="ai-toggle-btn"
            onClick={() => { playSound('select'); setIsAiPanelOpen(prev => !prev); }}
          >
            <Bot size={18} />
            <span>AI</span>
          </button>
          <div className="user-profile" onClick={() => !isLoggedIn && handleMicrosoftLogin()} style={{cursor: 'pointer'}}>
            {isLoggedIn ? (
              <>
                <span className="gamertag">{xboxProfile?.gamertag}</span>
                <span className="gamerscore">{xboxProfile?.gamerscore || 0} G</span>
                <div className="user-avatar-circle">
                  {xboxProfile?.profilePicture ?
                    <img src={xboxProfile.profilePicture} alt="Avatar" className="avatar-img"/> :
                    <div className="avatar-placeholder"></div>
                  }
                </div>
              </>
            ) : (
              <>
                <span className="gamertag">Sign In</span>
                <div className="user-avatar-circle">
                  <div className="avatar-placeholder"></div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* AI Panel - Open WebUI container (plug-and-play) */}
      {isAiPanelOpen && (
        <div className="ai-panel" data-testid="ai-panel">
          <div className="ai-panel-header">
            <Bot size={20} />
            <h3>Open WebUI</h3>
            <button className="ai-panel-close" onClick={() => setIsAiPanelOpen(false)} data-testid="ai-panel-close">X</button>
          </div>
          <div className="ai-panel-body">
            <div className="ai-panel-status">
              <div className="ai-status-dot"></div>
              <span>Waiting for local connection</span>
            </div>
            <p className="ai-panel-info">
              Connect to your local Open WebUI at <code>localhost:8080</code>
            </p>
            <p className="ai-panel-info">
              This panel will automatically connect when running as a Tauri desktop app.
            </p>
            <iframe
              src="http://localhost:8080"
              title="Open WebUI"
              className="ai-iframe"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
        </div>
      )}

      <div className="xenia-content">
        {currentView === 'home' && renderHome()}
        {currentView === 'gameLibrary' && renderGameLibrary()}
        {currentView === 'achievements' && renderGameLibrary()} 
        {currentView === 'themes' && renderThemesView()}
        {currentView === 'startup' && renderStartupView()}
        {currentView === 'achievement' && renderAchievementView()}
        <NXESettings 
          isActive={currentView === 'settings'} 
          onBack={() => setCurrentView('home')} 
        />
      </div>

      <div className="xenia-footer">
        <div className="footer-controls">
          <div className="control-item">
            <span className="btn-icon bumper">LB</span>
            <span className="btn-icon bumper">RB</span>
            <span className="btn-label">Tabs</span>
          </div>
          {/* Guide Home Button */}
          <div className="control-item">
            <span 
              className={`btn-icon home ${isGuidePressed ? 'pressed' : ''}`} 
              data-testid="guide-home-button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                playSound('panelUnfold');
                setIsGuidePressed(true);
                setTimeout(() => setIsGuidePressed(false), 200);
                setIsGuideOpen(prev => !prev);
              }}
            ></span>
            <span className="btn-label">Home</span>
          </div>
          <div className="control-item">
            <span className="btn-icon green">A</span>
            <span className="btn-label">Select</span>
          </div>
          <div className="control-item">
            <span className="btn-icon red">B</span>
            <span className="btn-label">Back</span>
          </div>
        </div>
      </div>
    </div>

      {/* Guide Overlay - Rendered outside dashboard container to avoid blur inheritance */}
      <GuideOverlay 
        isOpen={isGuideOpen}  
        onClose={() => setIsGuideOpen(false)}
        onNavigateHome={() => setCurrentView('home')}
        xboxProfile={xboxProfile}
        isLoggedIn={isLoggedIn}
        onLogin={handleMicrosoftLogin}
        recentGames={recentGames}
        onQuickResume={(game) => {
          addToRecentGames(game);
          launchGame(game);
        }}
      />
    </>
  );
};

export default XeniaDashboard;

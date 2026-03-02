import React, { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Search, Disc, Trophy, Settings, ChevronLeft, ChevronRight, Image as ImageIcon, Video } from 'lucide-react';
import axios from 'axios';
import { mockGames, mockAchievements } from '../data/xeniaData';
import NXESettings from '../components/NXESettings';
import BladesOverlay from '../components/BladesOverlay';
import GuideOverlay from '../components/GuideOverlay';
import { initializeMsal, loginAndFetchProfile, logout } from '../services/xboxAuthService';
import '../styles/XeniaDashboard.css';

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
  
  // Sounds
  const navClickSound = useRef(new Audio('/assets/blades/sounds/ui_nav_click.wav'));
  const selectSound = useRef(new Audio('/assets/blades/sounds/ui_select.wav'));
  const backSound = useRef(new Audio('/assets/blades/sounds/ui_back.wav'));
  const bladeShiftSound = useRef(new Audio('/assets/blades/sounds/ui_blade_shift.wav'));

  const playSound = (soundRef) => {
    if (soundRef.current) {
      soundRef.current.currentTime = 0;
      soundRef.current.play().catch(e => console.error("Sound play failed", e));
    }
  };

  // Auth State
  const [xboxProfile, setXboxProfile] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Assets State
  const [startupVideos, setStartupVideos] = useState([]);
  const [wallpapers, setWallpapers] = useState([]);
  const [showStartupVideo, setShowStartupVideo] = useState(true);

  const mainCards = [
    { id: 'library', title: 'GAMES', icon: Disc, action: () => setCurrentView('gameLibrary') },
    { id: 'settings', title: 'SYSTEM SETTINGS', icon: Settings, action: () => setCurrentView('settings') },
    { id: 'achievements', title: 'ACHIEVEMENTS', icon: Trophy, action: () => setCurrentView('achievements') },
    { id: 'themes', title: 'THEMES', icon: ImageIcon, action: () => setCurrentView('themes') },
    { id: 'startup', title: 'STARTUP', icon: Video, action: () => setCurrentView('startup') }
  ];

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Toggle Guide on Tab / Home key
      if (e.key === 'Tab' || e.key === 'Home') {
        console.log("Guide toggle key detected:", e.key);
        e.preventDefault();
        setIsGuidePressed(true);
        setTimeout(() => setIsGuidePressed(false), 200);
        setIsGuideOpen(prev => !prev);
        return;
      }

      // If Guide is open, block all dashboard input
      if (isGuideOpen) {
        return;
      }

      // --- Dashboard Navigation Logic ---
      
      // "A" Button (Enter) Logic
      if (e.key === 'Enter') {
          playSound(selectSound);
          if (currentView === 'home') {
              handleCardSelect(selectedCardIndex);
          } else if (currentView === 'gameLibrary' || currentView === 'achievements') {
             const game = filteredGames[gameCarouselIndex];
             if (game) handleGameSelect(game);
          } else if (currentView === 'achievement') {
              // Toggle lock?
          }
      }

      // "B" Button (Backspace) Logic
      if (e.key === 'Backspace') {
          if (currentView !== 'home') {
              playSound(backSound);
              if (currentView === 'achievement') setCurrentView('achievements');
              else setCurrentView('home');
          }
      }

      // D-Pad Left (ArrowLeft) Logic
      if (e.key === 'ArrowLeft') {
           if (currentView === 'home') {
               const newIndex = Math.max(0, selectedCardIndex - 1);
               if (newIndex !== selectedCardIndex) {
                   playSound(navClickSound);
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
                   playSound(navClickSound);
                   setSelectedCardIndex(newIndex);
               }
           } else if (currentView === 'gameLibrary' || currentView === 'achievements') {
               navigateCarousel('right');
           }
      }

      // Blade Switching (LB/RB -> q/e)
      // Note: XeniaDashboard doesn't have multiple blades in this view, 
      // but if we wanted to switch views or tabs, we'd do it here.
      if (e.key === 'q') {
          // LB Action
          playSound(bladeShiftSound);
          if (currentView === 'home') {
            // Stop at 0 if holding/pressing (no wrap)
            setSelectedCardIndex((prev) => Math.max(0, prev - 1));
          } else if (currentView === 'gameLibrary' || currentView === 'achievements') {
            navigateCarousel('left');
          }
      }
      if (e.key === 'e') {
          // RB Action
          playSound(bladeShiftSound);
          if (currentView === 'home') {
            // Stop at end if holding/pressing (no wrap)
            setSelectedCardIndex((prev) => Math.min(mainCards.length - 1, prev + 1));
          } else if (currentView === 'gameLibrary' || currentView === 'achievements') {
            navigateCarousel('right');
          }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentView, gameCarouselIndex, filteredGames, selectedCardIndex, isGuideOpen]);

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

  const handleCardSelect = (index) => {
    playSound(selectSound);
    setSelectedCardIndex(index);
    mainCards[index].action();
  };

  const launchGame = async (game) => {
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
  };

  const handleGameSelect = (game) => {
    playSound(selectSound);
    if (currentView === 'achievements') {
      setSelectedGame(game);
      setCurrentView('achievement');
    } else {
      launchGame(game);
    }
  };

  // Gamepad Polling Logic Removed - Replaced by GlobalControllerListener + handleGlobalKeyDown
  /* 
  const lastButtonState = useRef({...});
  useEffect(() => { ...pollGamepad... }, [...]);
  */

  const navigateCarousel = (direction) => {
    playSound(navClickSound);
    if (direction === 'left' && gameCarouselIndex > 0) {
      setGameCarouselIndex(gameCarouselIndex - 1);
    } else if (direction === 'right' && gameCarouselIndex < mockGames.length - 1) {
      setGameCarouselIndex(gameCarouselIndex + 1);
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
    playSound(selectSound);
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
    playSound(selectSound);
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

  const renderHome = () => (
    <div className="xenia-home">
      <div className="home-header">
        <h1 className="my-xenia">VORTEX PRIME EMU</h1>
      </div>
      <div className="main-cards-container">
        {mainCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className={`main-card ${index === selectedCardIndex ? 'selected' : ''}`}
              onClick={() => handleCardSelect(index)}
              onMouseEnter={() => {
                if (index !== selectedCardIndex) {
                   playSound(navClickSound);
                   setSelectedCardIndex(index);
                }
              }}
            >
              <div className="card-content">
                <Icon size={64} className="card-icon" />
                <h2 className="card-title">{card.title}</h2>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderGameLibrary = () => (
    <div className="game-library-view">
      <div className="library-header">
        <button className="back-btn" onClick={() => {
            playSound(backSound);
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
        playSound(backSound);
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
    <div className="game-library-view">
        <div className="library-header">
            <button className="back-btn" onClick={() => {
                playSound(backSound);
                setCurrentView('home');
            }}>
                <ChevronLeft size={24} /> Back
            </button>
            <h2 style={{marginLeft: 20}}>Themes Manager</h2>
        </div>
        <div className="assets-grid">
            {wallpapers.map((wp, i) => (
                <div key={i} className={`asset-card ${wp.status}`} onClick={() => handleToggleWallpaper(wp.name, wp.status)}>
                    <div className="asset-icon"><ImageIcon size={48}/></div>
                    <div className="asset-info">
                        <h3>{wp.name}</h3>
                        <span className={`status-badge ${wp.status}`}>{wp.status}</span>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  const renderStartupView = () => (
    <div className="game-library-view">
        <div className="library-header">
            <button className="back-btn" onClick={() => {
                playSound(backSound);
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
    <div className={`xenia-dashboard ${isGuideOpen ? 'blurred' : ''}`} style={{ 
        transition: 'filter 0.3s ease', 
        filter: isGuideOpen ? 'blur(8px)' : 'none' 
    }}>
      <BladesOverlay currentView={currentView} setCurrentView={setCurrentView} />
      
      <div className="xenia-background" style={{ backgroundImage: "url(/wallpapers/Play/default.png)" }}>
        <div className="bg-overlay"></div>
      </div>

      <div className="xenia-header">
        <div className="header-spacer"></div>
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
          {/* Guide Home Button - DISABLED
          <div className="control-item">
            <span 
              className={`btn-icon home ${isGuidePressed ? 'pressed' : ''}`} 
              onClick={(e) => {
                console.log("Home UI Button Clicked");
                e.preventDefault();
                e.stopPropagation();
                setIsGuidePressed(true);
                setTimeout(() => setIsGuidePressed(false), 200);
                setIsGuideOpen(prev => {
                    console.log("UI Toggle: Setting isGuideOpen to:", !prev);
                    return !prev;
                });
              }}
            ></span>
            <span className="btn-label">Home</span>
          </div>
          */}
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

      {/* Guide Overlay - DISABLED
      <GuideOverlay 
        isOpen={isGuideOpen}  
        onClose={() => setIsGuideOpen(false)}
        gamerscore={xboxProfile?.gamerscore}
        gamertag={xboxProfile?.gamertag}
      />
      */}
    </>
  );
};

export default XeniaDashboard;

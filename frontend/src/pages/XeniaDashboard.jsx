import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Search, Disc, Trophy, Settings, ChevronLeft, ChevronRight, Image as ImageIcon, Video, Store, Heart, Cpu, Shield, AlertTriangle, Trash2 } from 'lucide-react';
import axios from 'axios';

import NXESettings from '../components/NXESettings';
import BladesOverlay from '../components/BladesOverlay';
import GuideOverlay from '../components/GuideOverlay';
import ThemeManager from '../components/ThemeManager';
import Marketplace from '../components/Marketplace';
import Xbox360Keyboard from '../components/Xbox360Keyboard';
import VortexAIChat from '../components/VortexAIChat';
import { useDropzone } from 'react-dropzone';
import { initializeMsal, loginAndFetchProfile, logout } from '../services/xboxAuthService';
import { useGamepad } from '../context/GamepadContext';
import playSound from '../utils/soundManager';
import { coreConfigApi } from '../services/apiServices';
import '../styles/XeniaDashboard.css';
import '../styles/Marketplace.css';
import '../styles/Xbox360Keyboard.css';

const API = '/api';

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
  const aiChatRef = useRef(null);

  // Xbox 360 Keyboard state
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardCallback, setKeyboardCallback] = useState(null);

  // Game Groups / Favorites state
  const [gameGroups, setGameGroups] = useState(() => {
    const saved = localStorage.getItem('gameGroups');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isAddingToGroup, setIsAddingToGroup] = useState(false);

  useEffect(() => {
    localStorage.setItem('gameGroups', JSON.stringify(gameGroups));
  }, [gameGroups]);

  const createGroup = useCallback((name) => {
    if (!name.trim()) return;
    const newGroup = { id: `grp-${Date.now()}`, name: name.trim(), games: [] };
    setGameGroups(prev => [...prev, newGroup]);
    playSound('select');
  }, []);

  const addGameToGroup = useCallback((groupId, game) => {
    setGameGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      if (g.games.some(gm => gm.id === game.id)) return g;
      return { ...g, games: [...g.games, { id: game.id, title: game.title, cover: game.cover }] };
    }));
    playSound('select');
  }, []);

  const removeGameFromGroup = useCallback((groupId, gameId) => {
    setGameGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      return { ...g, games: g.games.filter(gm => gm.id !== gameId) };
    }));
    playSound('back');
  }, []);

  const deleteGroup = useCallback((groupId) => {
    setGameGroups(prev => prev.filter(g => g.id !== groupId));
    setSelectedGroup(null);
    playSound('back');
  }, []);

  const loadActiveTheme = useCallback(async () => {
    try {
      await fetch(`${API}/themes/active`);
    } catch (e) { /* fallback */ }
  }, []);

  useEffect(() => { loadActiveTheme(); }, [loadActiveTheme]);

  // GPU vendor state (auto-detected from backend)
  const [gpuVendor, setGpuVendor] = useState(null);

  // Games folder state
  const [gamesFolder, setGamesFolder] = useState(() => {
    return localStorage.getItem('gamesFolder') || '';
  });
  const [userGames, setUserGames] = useState(() => {
    try {
      const saved = localStorage.getItem('userGames');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (gamesFolder) localStorage.setItem('gamesFolder', gamesFolder);
  }, [gamesFolder]);

  useEffect(() => {
    localStorage.setItem('userGames', JSON.stringify(userGames));
  }, [userGames]);

  /**
   * Scan games via backend API — returns enriched game list with
   * SteamGridDB cover art, x360db metadata, and integrity status.
   */
  const scanGamesFolder = useCallback(async (folderPath) => {
    setIsScanning(true);
    try {
      const res = await axios.post('/api/games/scan', { folder: folderPath || '' });
      const scanned = res.data.games || [];
      setUserGames(scanned);
      localStorage.setItem('userGames', JSON.stringify(scanned));
      return scanned;
    } catch (err) {
      console.error('Games scan failed:', err);
      return [];
    } finally {
      setIsScanning(false);
    }
  }, []);

  /**
   * Load cached games from backend without triggering a full rescan.
   */
  const loadCachedGames = useCallback(async () => {
    setIsScanning(true);
    try {
      const res = await axios.get('/api/games/list');
      const cached = res.data.games || [];
      if (cached.length > 0) {
        setUserGames(cached);
      }
    } catch { /* silent */ } finally {
      setIsScanning(false);
    }
  }, []);

  const onDrop = useCallback(async (acceptedFiles) => {
    // Note: react-dropzone file.path isn't a full OS path for security, 
    // but in Tauri environments, it can often be retrieved.
    // However, the cleanest way for a "folder drop" is to use the directory picker
    // or if we have a way to get the path. 
    // For now, if someone drops a folder, we'll try to handle it.
    if (acceptedFiles.length > 0) {
      playSound('select');
      const firstFile = acceptedFiles[0];
      // On Tauri, firstFile.path might be the full path.
      const path = firstFile.path || firstFile.webkitRelativePath || '';
      if (path) {
        // Extract directory if it's a file
        const dirPath = path.substring(0, path.lastIndexOf(/[/\\]/));
        if (dirPath) {
          setGamesFolder(dirPath);
          await scanGamesFolder(dirPath);
        }
      }
    }
  }, [scanGamesFolder]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true, // we have a button for that
    noKeyboard: true,
  });

  const createGamesFolder = useCallback(async () => {
    try {
      playSound('select');
      const res = await coreConfigApi.browseFolder();
      if (res && res.path) {
        setGamesFolder(res.path);
        // Automatic scan immediately after selection
        await scanGamesFolder(res.path);
        playSound('select');
      }
    } catch (err) {
      console.error('Folder selection failed:', err);
    }
  }, [scanGamesFolder]);

  const handleManualCreateFolder = useCallback(async () => {
    try {
      playSound('select');
      // Step 1: Browse for Parent path
      const browseRes = await coreConfigApi.browseFolder();
      if (!browseRes || !browseRes.path) return;

      const parentPath = browseRes.path;

      // Step 2: Prompt for folder name
      setIsKeyboardOpen(true);
      setKeyboardCallback(() => async (name) => {
        if (!name || !name.trim()) return;
        try {
          const folderPath = `${parentPath}\\${name.trim()}`;
          const res = await axios.post('/api/games/create-folder', { path: folderPath });
          if (res.data.status === 'success') {
            const fullPath = res.data.path;
            setGamesFolder(fullPath);
            await scanGamesFolder(fullPath);
            playSound('select');
          }
        } catch (err) {
          console.error('Folder creation failed:', err);
          alert('Failed to create folder. Make sure the path is valid.');
        }
      });
    } catch (err) {
      console.error('Browse parent failed:', err);
    }
  }, [scanGamesFolder]);

  // Combined games: user-imported games only (no mock data)
  const allGames = useMemo(() => [...userGames], [userGames]);

  // Recently Played Games — only real games from user's library
  // Clear any stale/fake data from before the cleanup
  const [recentGames, setRecentGames] = useState([]);

  const addToRecentGames = useCallback((game) => {
    // Only track games that exist in the user's actual library
    if (allGames.length === 0) return;
    if (!allGames.some(g => g.title === game.title)) return;
    setRecentGames(prev => {
      const filtered = prev.filter(g => g.title !== game.title);
      const updated = [{ ...game, lastPlayed: Date.now(), hasQuickResume: true }, ...filtered].slice(0, 5);
      localStorage.setItem('recentGames', JSON.stringify(updated));
      return updated;
    });
  }, [allGames]);

  // Load recently played from localStorage, but only keep games that exist in the library
  useEffect(() => {
    if (allGames.length === 0) {
      // No games in library — clear any stale recently played data
      localStorage.removeItem('recentGames');
      setRecentGames([]);
      return;
    }
    try {
      const saved = localStorage.getItem('recentGames');
      if (saved) {
        const parsed = JSON.parse(saved);
        const valid = parsed.filter(g => allGames.some(lg => lg.title === g.title));
        setRecentGames(valid);
        localStorage.setItem('recentGames', JSON.stringify(valid));
      }
    } catch { setRecentGames([]); }
  }, [allGames]);

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
  const filteredGames = (allGames || []).filter(game =>
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
    { id: 'favorites', title: 'FAVORITES', icon: Heart, action: () => setCurrentView('favorites') },
    { id: 'settings', title: 'SYSTEM SETTINGS', icon: Settings, action: () => setCurrentView('settings') },
    { id: 'achievements', title: 'ACHIEVEMENTS', icon: Trophy, action: () => setCurrentView('achievements') },
  ], []);

  // Core action callbacks (defined before useEffects that reference them)
  const handleCardSelect = useCallback((index) => {
    playSound('select');
    setSelectedCardIndex(index);
    mainCards[index].action();
  }, [mainCards]);

  const launchGame = useCallback(async (game) => {
    // Write-Before-Flight: call backend which handles GPU profile + config write + launch
    try {
      console.log(`[Write-Before-Flight] Launching: ${game.title}`);
      const res = await axios.post('/api/games/launch', {
        game_path: game.path,
        title_id: game.title_id || '',
        gpu_vendor: gpuVendor || undefined,
      });
      if (res.data.success) {
        console.log(`Launched PID: ${res.data.pid} via ${gpuVendor?.toUpperCase() || 'auto'} profile`);
      }
    } catch (launchErr) {
      const detail = launchErr.response?.data?.detail || launchErr.message;
      // Fallback: if backend launch fails (e.g. no exe), try Tauri
      if (window.__TAURI__) {
        try {
          const { invoke } = window.__TAURI__.core || window.__TAURI__.tauri;
          await invoke('launch_xenia', {
            gamePath: game.path,
            xuid: xboxProfile?.xuid || '0000000000000000',
            gamertag: xboxProfile?.gamertag || 'Player',
          });
        } catch (e) {
          console.error('Tauri fallback launch failed:', e);
          alert('Failed to launch game: ' + detail);
        }
      } else {
        console.error('Launch failed:', launchErr);
        alert(`Failed to launch ${game.title}: ${detail}`);
      }
    }
  }, [xboxProfile, gpuVendor]);

  const handleGameSelect = useCallback((game) => {
    playSound('select');
    addToRecentGames(game);
    if (currentView === 'achievements') {
      setSelectedGame(game);
      setCurrentView('achievement');
    } else {
      launchGame(game);
    }
  }, [currentView, launchGame, addToRecentGames]);

  const navigateCarousel = useCallback((direction) => {
    playSound('focus');
    if (direction === 'left') {
      setGameCarouselIndex(prev => prev > 0 ? prev - 1 : prev);
    } else if (direction === 'right') {
      setGameCarouselIndex(prev => prev < filteredGames.length - 1 ? prev + 1 : prev);
    }
  }, [filteredGames.length]);

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
        if (currentView !== 'home' && currentView !== 'settings') {
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

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentView, gameCarouselIndex, filteredGames, selectedCardIndex, isGuideOpen, handleCardSelect, handleGameSelect, mainCards.length, navigateCarousel]);

  useEffect(() => {
    // 1. Initialize MSAL
    initializeMsal().catch(e => console.error('MSAL Init Error:', e));

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

    // 5. Load cached games from backend (no rescan)
    loadCachedGames();

    // 6. Detect GPU vendor
    axios.get('/api/gpu/detect').then(res => {
      setGpuVendor(res.data.vendor || null);
    }).catch(() => { });

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

  }, [loadCachedGames]);

  const loadStartupVideos = async () => {
    try {
      const response = await axios.get(`/api/startup/videos`);
      setStartupVideos(response.data.videos);
    } catch (error) {
      console.error('Failed to load startup videos', error);
    }
  };

  const loadWallpapers = async () => {
    try {
      const response = await axios.get(`/api/wallpapers`);
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
      await axios.post(`/api/wallpapers/toggle`, { filename, action });

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
      await axios.post(`/api/startup/toggle`, { filename, action });

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

        {/* Recently Played - shows your real games once added */}
        <div className="top-games-section" data-testid="top-games-section">
          <h3 className="recent-title">Recently Played</h3>
          {recentGames.length > 0 ? (
            <div className="recent-games-row">
              {recentGames.slice(0, 5).map((game, i) => (
                <div key={`recent-${i}`} className="recent-game-tile"
                  data-testid={`recent-game-${i}`}
                  onClick={() => { playSound('select'); launchGame(game); }}
                >
                  <img src={game.cover || game.boxart || game.icon} alt={game.title} className="recent-game-art" />
                  <span className="recent-game-name">{game.title}</span>
                  {game.hasQuickResume && <span className="qr-badge">QR</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="recent-empty-state" data-testid="recent-empty-state">
              <span>No recently played games. Import your games to get started.</span>
            </div>
          )}
        </div>

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
      </div>
    );
  };

  const renderFavoritesView = () => {
    // If a group is selected, show its games
    if (selectedGroup) {
      const group = gameGroups.find(g => g.id === selectedGroup);
      if (!group) { setSelectedGroup(null); return null; }

      // Adding games to the group
      if (isAddingToGroup) {
        return (
          <div className="favorites-view" data-testid="favorites-add-games">
            <div className="library-header">
              <button className="back-btn" onClick={() => { playSound('back'); setIsAddingToGroup(false); }}>
                <ChevronLeft size={24} /> Back
              </button>
              <h2 className="section-title">Add Games to "{group.name}"</h2>
            </div>
            <div className="favorites-game-grid">
              {allGames.length === 0 ? (
                <div className="fav-empty"><p>No games in your library yet. Import a games folder first.</p></div>
              ) : allGames.map(game => {
                const inGroup = group.games.some(g => g.id === game.id);
                return (
                  <div key={game.id} className={`fav-game-tile ${inGroup ? 'in-group' : ''}`}
                    data-testid={`add-game-${game.id}`}
                    onClick={() => !inGroup && addGameToGroup(group.id, game)}
                  >
                    <img src={game.cover} alt={game.title} className="fav-game-art" />
                    <span className="fav-game-name">{game.title}</span>
                    {inGroup && <span className="fav-added-badge">Added</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      return (
        <div className="favorites-view" data-testid="favorites-group-detail">
          <div className="library-header">
            <button className="back-btn" onClick={() => { playSound('back'); setSelectedGroup(null); }}>
              <ChevronLeft size={24} /> Back
            </button>
            <h2 className="section-title">{group.name}</h2>
            <button className="fav-action-btn add" data-testid="group-add-games-btn" onClick={() => { playSound('select'); setIsAddingToGroup(true); }}>
              Add Games
            </button>
            <button className="fav-action-btn delete" data-testid="group-delete-btn" onClick={() => deleteGroup(group.id)}>
              Delete Group
            </button>
          </div>
          {group.games.length === 0 ? (
            <div className="fav-empty">
              <p>No games in this group yet</p>
              <button className="fav-action-btn add" onClick={() => { playSound('select'); setIsAddingToGroup(true); }}>Add Games</button>
            </div>
          ) : (
            <div className="favorites-game-grid">
              {group.games.map(game => (
                <div key={game.id} className="fav-game-tile" data-testid={`group-game-${game.id}`}>
                  <img src={game.cover} alt={game.title} className="fav-game-art" />
                  <span className="fav-game-name">{game.title}</span>
                  <button className="fav-remove-btn" onClick={(e) => { e.stopPropagation(); removeGameFromGroup(group.id, game.id); }}>X</button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Groups list view
    return (
      <div className="favorites-view" data-testid="favorites-view">
        <div className="library-header">
          <button className="back-btn" onClick={() => { playSound('back'); setCurrentView('home'); }}>
            <ChevronLeft size={24} /> Back
          </button>
          <h2 className="section-title">Favorites</h2>
        </div>
        <div className="favorites-groups-list">
          <div className="fav-group-card create" data-testid="create-group-card"
            onClick={() => {
              playSound('select');
              setIsKeyboardOpen(true);
              setKeyboardCallback(() => (name) => createGroup(name));
            }}
          >
            <span className="fav-create-plus">+</span>
            <span className="fav-create-label">Create Group</span>
          </div>
          {gameGroups.map(group => (
            <div key={group.id} className="fav-group-card" data-testid={`group-card-${group.id}`}
              onClick={() => { playSound('select'); setSelectedGroup(group.id); }}
            >
              <div className="fav-group-art">
                {group.games.slice(0, 4).map((g, i) => (
                  <img key={i} src={g.cover} alt="" className="fav-group-thumb" />
                ))}
                {group.games.length === 0 && <div className="fav-group-empty-art" />}
              </div>
              <span className="fav-group-name">{group.name}</span>
              <span className="fav-group-count">{group.games.length} game{group.games.length !== 1 ? 's' : ''}</span>
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
        {allGames.length > 0 && (
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
        )}
      </div>

      <div className="section-header">
        <h2 className="section-title">Games</h2>
      </div>

      {allGames.length === 0 ? (
        <div {...getRootProps()} className={`games-empty-state ${isDragActive ? 'drag-active' : ''}`} data-testid="games-empty-state">
          <input {...getInputProps()} />
          <h3 className="games-empty-title">{isScanning ? 'Discovering Library...' : 'No Games Found'}</h3>

          <div className="game-path-main-asset" style={{ margin: '20px 0', position: 'relative' }}>
            <img
              src="/assets/for-app/xbox 360-gamepad.png"
              alt="Xbox 360 Game Path Asset"
              className="xbox-360-gamepad-img"
              style={{
                width: '320px',
                opacity: isDragActive ? 0.3 : 0.9,
                filter: 'drop-shadow(0 0 30px rgba(144, 195, 29, 0.15))',
                transition: 'all 0.3s ease'
              }}
            />
          </div>

          <p className="games-empty-desc" style={{ marginBottom: '30px' }}>
            {isScanning 
              ? "Automatically pulling game data and patches..."
              : isDragActive
                ? "Drop your ROMs folder here to begin scanning..."
                : 'Set your ROMs path to discover and identify your Xbox 360 library.'
            }
          </p>

          <div className="empty-actions" style={{ display: 'flex', gap: '20px' }}>
            <button className="games-folder-btn" data-testid="create-games-folder-btn" onClick={createGamesFolder}>
              {gamesFolder ? 'Change ROMs Path' : 'Set ROMs Path'}
            </button>
            <button className="games-folder-btn secondary" onClick={handleManualCreateFolder}>
              Create New Folder
            </button>
            {isScanning && (
              <div className="loading-spinner" style={{
                width: 30, height: 30, border: '3px solid rgba(255,255,255,0.1)',
                borderTopColor: '#90C31D', borderRadius: '50%', animation: 'spin 1s linear infinite'
              }} />
            )}
          </div>

          {gamesFolder && !isDragActive && (
            <span className="games-folder-path" data-testid="games-folder-path">Selected Path: {gamesFolder}</span>
          )}
        </div>
      ) : (
        <div className="games-loaded-content">
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
                const isCorrupted = game.integrity === 'corrupted';

                return (
                  <div
                    key={game.id}
                    className={`game-box ${isCenter ? 'center' :
                      isLeft ? 'left' :
                        isRight ? 'right' :
                          offset < 0 ? 'far-left' : 'far-right'
                      } ${!isVisible ? 'hidden' : ''} ${isCorrupted ? 'corrupted' : ''}`}
                    onClick={() => isCenter && !isCorrupted && handleGameSelect(game)}
                    style={{ zIndex: 100 - Math.abs(offset) }}
                  >
                    <div className="xbox-banner">XBOX 360 LIVE</div>
                    {/* Integrity badge */}
                    {isCenter && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8, zIndex: 10,
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: isCorrupted ? 'rgba(244,67,54,0.85)' : 'rgba(0,200,83,0.85)',
                        borderRadius: 3, padding: '3px 6px', fontSize: '0.6rem',
                        fontWeight: 700, letterSpacing: 1, color: '#fff'
                      }}>
                        {isCorrupted ? <AlertTriangle size={10} /> : <Shield size={10} />}
                        {isCorrupted ? 'CORRUPTED' : 'VERIFIED'}
                      </div>
                    )}
                    <img
                      src={game.cover_url || game.cover || ''}
                      alt={game.title}
                      className="game-cover"
                      style={{ objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    {!game.cover_url && !game.cover && (
                      <div style={{
                        width: '100%', height: '100%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,255,255,0.05)', flexDirection: 'column', gap: 12,
                        position: 'relative', overflow: 'hidden'
                      }}>
                        <img
                          src="/assets/for-app/xbox 360-gamepad.png"
                          alt=""
                          style={{
                            width: '80%', opacity: 0.1, position: 'absolute', top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)', filter: 'grayscale(1)'
                          }}
                        />
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)',
                          textAlign: 'center', padding: '0 12px', zIndex: 1, textTransform: 'uppercase',
                          letterSpacing: '1px'
                        }}>
                          {game.title}
                        </span>
                      </div>
                    )}
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
              <div key={filteredGames[gameCarouselIndex].id}>
                <h2>{filteredGames[gameCarouselIndex].title}</h2>
                <p className="game-description">{filteredGames[gameCarouselIndex].description}</p>
                <div className="game-meta">
                  <span>Title ID: {filteredGames[gameCarouselIndex].title_id || 'Unknown'}</span>
                  <span>Publisher: {filteredGames[gameCarouselIndex].publisher || 'Unknown'}</span>
                  {filteredGames[gameCarouselIndex].size_mb && (
                    <span>Size: {filteredGames[gameCarouselIndex].size_mb} MB</span>
                  )}
                  {filteredGames[gameCarouselIndex].integrity === 'corrupted' && (
                    <span style={{ color: '#f44336', fontWeight: 700 }}>⚠ FILE CORRUPTED</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
    <div className="game-library-view" data-testid="startup-view">
      <div className="library-header">
        <button className="back-btn" onClick={() => {
          playSound('back');
          setCurrentView('home');
        }}>
          <ChevronLeft size={24} /> Back
        </button>
        <h2 style={{ marginLeft: 20 }}>Startup Video Manager</h2>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)' }}>Play / Disabled folder structure</span>
      </div>
      <div className="folder-sections">
        <div className="folder-section">
          <h3 className="folder-label play-label">Play (Active)</h3>
          <div className="assets-grid">
            {startupVideos.filter(v => v.status === 'active').map((vid, i) => (
              <div key={i} className="asset-card active" onClick={() => handleToggleStartupVideo(vid.name, vid.status)}>
                <div className="asset-icon"><Video size={48} /></div>
                <div className="asset-info">
                  <h3>{vid.name}</h3>
                  <span className="status-badge active">Active</span>
                </div>
              </div>
            ))}
            {startupVideos.filter(v => v.status === 'active').length === 0 && (
              <div className="empty-folder">No active startup videos</div>
            )}
          </div>
        </div>
        <div className="folder-section">
          <h3 className="folder-label disabled-label">Disabled</h3>
          <div className="assets-grid">
            {startupVideos.filter(v => v.status === 'disabled').map((vid, i) => (
              <div key={i} className="asset-card disabled" onClick={() => handleToggleStartupVideo(vid.name, vid.status)}>
                <div className="asset-icon"><Video size={48} /></div>
                <div className="asset-info">
                  <h3>{vid.name}</h3>
                  <span className="status-badge disabled">Disabled</span>
                </div>
              </div>
            ))}
            {startupVideos.filter(v => v.status === 'disabled').length === 0 && (
              <div className="empty-folder">No disabled startup videos</div>
            )}
          </div>
        </div>
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
              data-testid="open-webui-btn"
              onClick={() => { playSound('select'); setIsAiPanelOpen(prev => !prev); }}
            >
              <img src="/assets/App%20Icon/icon.svg" alt="Vortex AI" className="open-webui-icon" />
              <span>Vortex AI</span>
            </button>
            <div className="user-profile" data-testid="user-profile">
              {isLoggedIn && (
                <>
                  <span className="gamertag">{xboxProfile?.gamertag}</span>
                  <span className="gamerscore">{xboxProfile?.gamerscore || 0} G</span>
                </>
              )}
              <div className="user-avatar-circle">
                {isLoggedIn && xboxProfile?.profilePicture ?
                  <img src={xboxProfile.profilePicture} alt="Avatar" className="avatar-img" /> :
                  <div className="user-avatar-placeholder-silhouette" style={{
                    width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(255,255,255,0.08)'
                  }}></div>
                }
              </div>
            </div>
          </div>
        </div>

        {/* AI Panel - Vortex AI (native Gemini chat) */}
        {isAiPanelOpen && (
          <div className="ai-panel" data-testid="ai-panel">
            <div className="ai-panel-header">
              <img src="/assets/App%20Icon/icon.svg" alt="" className="open-webui-icon" />
              <h3>Vortex AI</h3>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  className="ai-panel-clear" 
                  onClick={() => { playSound('back'); aiChatRef.current?.clearChat(); }}
                  title="Clear Chat"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ff6b6b'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                >
                  <Trash2 size={16} />
                </button>
                <button className="ai-panel-close" onClick={() => setIsAiPanelOpen(false)} data-testid="ai-panel-close">✕</button>
              </div>
            </div>
            <div className="ai-panel-body" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <VortexAIChat ref={aiChatRef} />
            </div>
          </div>
        )}

        <div className="xenia-content">
          {currentView === 'home' && renderHome()}
          {currentView === 'favorites' && renderFavoritesView()}
          {currentView === 'gameLibrary' && renderGameLibrary()}
          {currentView === 'achievements' && renderGameLibrary()}
          {currentView === 'marketplace' && (
            <Marketplace onBack={() => { playSound('back'); setCurrentView('home'); }} />
          )}
          {currentView === 'themes' && renderThemesView()}
          {currentView === 'startup' && renderStartupView()}
          {currentView === 'achievement' && renderAchievementView()}
          <NXESettings
            isActive={currentView === 'settings'}
            onBack={() => setCurrentView('home')}
          />
        </div>

        <div className="xenia-footer">
          <div className="footer-controls" style={{ width: '100%' }}>
            {currentView !== 'settings' && (
              <>
                <div className="control-item">
                  <span className="btn-icon green">A</span>
                  <span className="btn-label">Select</span>
                </div>
                <div className="control-item">
                  <span className="btn-icon bumper">LB</span>
                  <span className="btn-icon bumper">RB</span>
                  <span className="btn-label">Tabs</span>
                </div>
                {currentView !== 'home' && (
                  <div className="control-item">
                    <span className="btn-icon red">B</span>
                    <span className="btn-label">Back</span>
                  </div>
                )}
              </>
            )}
            {/* Guide Home Button */}
            <div className="control-item" style={{ marginLeft: 'auto' }}>
              <div
                className={`xbox-guide-button ${isGuidePressed ? 'pressed' : ''}`}
                data-testid="guide-home-button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  playSound('panelUnfold');
                  setIsGuidePressed(true);
                  setTimeout(() => setIsGuidePressed(false), 200);
                  setIsGuideOpen(prev => !prev);
                }}
              >

                <div className="xbox-guide-inner">
                  <svg viewBox="0 0 512 512" className="xbox-guide-svg">
                    <defs>
                      <linearGradient id="silverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#e0e0e0" />
                        <stop offset="50%" stopColor="#f8f8f8" />
                        <stop offset="100%" stopColor="#d0d0d0" />
                      </linearGradient>
                      <radialGradient id="greenGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#107C10" />
                        <stop offset="100%" stopColor="#0b550b" />
                      </radialGradient>
                    </defs>
                    {/* Green Background (The Light) */}
                    <circle cx="256" cy="256" r="240" className="xbox-green-bg xbox-x-glow" fill="url(#greenGlow)" />
                    
                    {/* The Sphere Shell (Silver) - The X is the hole */}
                    <path d="M369.9 318.2c44.3 54.3 64.7 98.8 54.4 118.7-7.9 15.1-56.7 44.6-92.6 55.9-29.6 9.3-68.4 13.3-100.4 10.2-38.2-3.7-76.9-17.4-110.1-39C93.3 445.8 87 438.3 87 423.4c0-29.9 32.9-82.3 89.2-142.1 32-33.9 76.5-73.7 81.4-72.6 9.4 2.1 84.3 75.1 112.3 109.5zM188.6 143.8c-29.7-26.9-58.1-53.9-86.4-63.4-15.2-5.1-16.3-4.8-28.7 8.1-29.2 30.4-53.5 79.7-60.3 122.4-5.4 34.2-6.1 43.8-4.2 60.5 5.6 50.5 17.3 85.4 40.5 120.9 9.5 14.6 12.1 17.3 9.3 9.9-4.2-11-.3-37.5 9.5-64 14.3-39 53.9-112.9 120.3-194.4zm311.6 63.5C483.3 127.3 432.7 77 425.6 77c-7.3 0-24.2 6.5-36 13.9-23.3 14.5-41 31.4-64.3 52.8C367.7 197 427.5 283.1 448.2 346c6.8 20.7 9.7 41.1 7.4 52.3-1.7 8.5-1.7 8.5 1.4 4.6 6.1-7.7 19.9-31.3 25.4-43.5 7.4-16.2 15-40.2 18.6-58.7 4.3-22.5 3.9-70.8-.8-93.4zM141.3 43C189 40.5 251 77.5 255.6 78.4c.7.1 10.4-4.2 21.6-9.7 63.9-31.1 94-25.8 107.4-25.2-63.9-39.3-152.7-50-233.9-11.7-23.4 11.1-24 11.9-9.4 11.2z" fill="url(#silverGradient)" />
                  </svg>
                </div>
              </div>
              <span className="btn-label">Home</span>
            </div>
          </div>
        </div>
      </div>

      {/* Guide Overlay - Rendered outside dashboard container to avoid blur inheritance */}
      <GuideOverlay
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onNavigateHome={() => setCurrentView('home')}
        onNavigateSettings={() => setCurrentView('settings')}
        xboxProfile={xboxProfile}
        isLoggedIn={isLoggedIn}
        onLogin={handleMicrosoftLogin}
        recentGames={recentGames}
        onQuickResume={(game) => {
          addToRecentGames(game);
          launchGame(game);
        }}
        gameGroups={gameGroups}
        onCreateGroup={createGroup}
        onOpenGroups={() => { setIsGuideOpen(false); setCurrentView('favorites'); }}
        onOpenKeyboard={(callback) => { setIsKeyboardOpen(true); setKeyboardCallback(() => callback); }}
      />

      {/* Xbox 360 On-Screen Keyboard */}
      <Xbox360Keyboard
        isOpen={isKeyboardOpen}
        onClose={() => setIsKeyboardOpen(false)}
        onSubmit={(value) => {
          if (keyboardCallback) keyboardCallback(value);
          setIsKeyboardOpen(false);
        }}
        placeholder="Type with your controller..."
      />
    </>
  );
};

export default XeniaDashboard;

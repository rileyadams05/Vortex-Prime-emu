import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Search, Disc, Trophy, Settings, ChevronLeft, ChevronRight, Image as ImageIcon, Video, Store, Heart, Cpu, Shield, AlertTriangle, Trash2, Plus, RotateCcw, X, Star, Minus } from 'lucide-react';
import axios from 'axios';

import NXESettings from '../components/NXESettings';
import BladesOverlay from '../components/BladesOverlay';
import GuideOverlay from '../components/GuideOverlay';
import ThemeManager from '../components/ThemeManager';
import Marketplace from '../components/Marketplace';
import CommunityHubModal from '../components/CommunityHubModal';
import Xbox360Keyboard from '../components/Xbox360Keyboard';
import { useDropzone } from 'react-dropzone';
import UserProfileWidget from '../components/UserProfileWidget';
import { loginDiscord, logout as logoutAuth } from '../services/authService';
import { useGamepad } from '../context/GamepadContext';
import playSound from '../utils/soundManager';
import { coreConfigApi, externalApiConfig, settingsApi } from '../services/apiServices';
import '../styles/XeniaDashboard.css';
import '../styles/Marketplace.css';
import '../styles/Xbox360Keyboard.css';
import '../styles/CommunityHubModal.css';
import VortexBackground from '../components/VortexBackground';

const API = '/api';

const DEFAULT_BG = null;

const XeniaDashboard = () => {
  const [currentView, setCurrentView] = useState('home');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isGuidePressed, setIsGuidePressed] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [gameCarouselIndex, setGameCarouselIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTestPanel, setShowTestPanel] = useState(false);

  // Background image state
  const [bgImage, setBgImage] = useState(DEFAULT_BG);

  useEffect(() => {
    settingsApi.get()
      .then(s => { if (s.background_image) setBgImage(`${API}/settings/serve-background`); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleBgChange = (e) => {
      if (e.detail.path) {
        setBgImage(`${API}/settings/serve-background?t=${Date.now()}`);
      } else {
        setBgImage(DEFAULT_BG);
      }
    };
    window.addEventListener('background-image-changed', handleBgChange);
    return () => window.removeEventListener('background-image-changed', handleBgChange);
  }, []);

  // Community Hub / Store state
  const [isCommunityHubOpen, setIsCommunityHubOpen] = useState(false);
  const [storeDefaultTab, setStoreDefaultTab] = useState('browse');

  // RetroAchievements Data State
  const [raData, setRaData] = useState(null);
  const [isLoadingRA, setIsLoadingRA] = useState(false);

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
  
  // Avatar upload state
  const avatarInputRef = useRef(null);

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
    noClick: true,
    noKeyboard: true,
  });

  // Avatar-specific Dropzone
  const onDropAvatar = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        setUserProfile(prev => {
          const updated = { ...prev, profilePicture: dataUrl };
          localStorage.setItem('userProfile', JSON.stringify(updated));
          return updated;
        });
        playSound('select');
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps: getAvatarRootProps, getInputProps: getAvatarInputProps } = useDropzone({
    onDrop: onDropAvatar,
    noClick: true,
    accept: { 'image/*': [] }
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
  const [userProfile, setUserProfile] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('userProfile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUserProfile(parsed);
        setIsLoggedIn(true);
      } catch (e) { console.error("Stale profile data", e); }
    }
  }, []);

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
            uid: userProfile?.id || '00000000',
            username: userProfile?.name || 'Log in',
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
  }, [userProfile, gpuVendor]);

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
      // Dev Test Panel Toggle
      if (e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        playSound('select');
        setShowTestPanel(prev => !prev);
        return;
      }

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

      // Map "Tab" key to toggle the guide open/close with press animation
      if (e.key === 'Tab') {
        e.preventDefault(); // Prevent default focus jump
        playSound('panelUnfold');
        setIsGuidePressed(true);
        setTimeout(() => setIsGuidePressed(false), 200);
        setIsGuideOpen(prev => !prev);
        return;
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
    // 1. Check Login Session
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        // Force logout if it's the old mock/fake profile
        if (parsed.name === "Vortex Player" || parsed.discordId === "fake-id") {
          console.log("Cleaning up stale demo profile...");
          localStorage.removeItem('userProfile');
          setUserProfile(null);
          setIsLoggedIn(false);
        } else {
          setUserProfile(parsed);
          setIsLoggedIn(true);
        }
      } catch (e) {
        localStorage.removeItem('userProfile');
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
      if (event.data.type === 'GOOGLE_AUTH_SUCCESS' || event.data.type === 'DISCORD_AUTH_SUCCESS') {
        const { profile } = event.data;
        console.log("Auth Message Received:", event.data.type, profile);
        setUserProfile(profile);
        setIsLoggedIn(true);
        localStorage.setItem('userProfile', JSON.stringify(profile));
      }
    };
    window.addEventListener('message', handleOAuthCallback);
    return () => window.removeEventListener('message', handleOAuthCallback);

  }, [loadCachedGames]);

  useEffect(() => {
    let isMounted = true;
    const loadRA = async () => {
      try {
        // Fetch API credentials from backend
        const apiConfig = await externalApiConfig.get();
        const RA_KEY = apiConfig.retroAchievements?.apiKey;
        const RA_USER = apiConfig.retroAchievements?.username;

        if (!RA_KEY || !RA_USER) {
          console.log("RetroAchievements: Credentials not configured");
          return;
        }

        if (!isMounted) return;
        setIsLoadingRA(true);

        // The correct API endpoint format for RetroAchievements
        const url = `https://retroachievements.org/API/API_GetUserSummary.php?y=${RA_KEY}&u=${RA_USER}`;
        const res = await axios.get(url);

        if (isMounted && res.data) {
          setRaData(res.data);
          console.log("RetroAchievements data loaded successfully");
        }
      } catch (err) {
        if (isMounted) {
          console.error("RetroAchievements fetch failed:", err.message);
          if (err.message?.includes('404') || err.message?.includes('Failed to fetch external API configuration')) {
            console.error("⚠️ Backend API endpoint not found. Please restart the backend server to load the new /api/config/external-apis endpoint.");
            console.error("💡 Run: node start-dev-servers.js");
          } else if (err.response?.status === 422) {
            console.error("Invalid API credentials or username. Please verify your RetroAchievements API key and username in backend/.env");
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingRA(false);
        }
      }
    };

    loadRA();

    return () => {
      isMounted = false;
    };
  }, []);

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

  const handleLogout = useCallback(() => {
    console.log("Logging out...");
    logoutAuth();
    setUserProfile(null);
    setIsLoggedIn(false);
    playSound('back');
  }, []);

  const handleDiscordLogin = async () => {
    try {
      const profile = await loginDiscord();
      setUserProfile(profile);
      setIsLoggedIn(true);
      localStorage.setItem('userProfile', JSON.stringify(profile));
      playSound('panelUnfold');
    } catch (error) {
      console.error("Discord login failed:", error);
      alert(`Discord Login failed: ${error.message}`);
    }
  };

  const handleAvatarUploadClick = (e) => {
    e.stopPropagation();
    avatarInputRef.current?.click();
  };

  const handleAvatarFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        setUserProfile(prev => {
          const updated = { ...prev, profilePicture: dataUrl };
          localStorage.setItem('userProfile', JSON.stringify(updated));
          return updated;
        });
        playSound('select');
      };
      reader.readAsDataURL(file);
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
          
          {isLoggedIn && userProfile?.name && (
            <div className="home-profile-badge" data-testid="home-profile-badge">
              <span className="profile-name-text">{userProfile.name}</span>
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

          {/* Hidden DEV panel toggleable by F1 */}
          {showTestPanel && (
            <div 
              className="main-card test-panel-card"
              style={{ 
                width: '200px', 
                background: 'rgba(20, 0, 0, 0.6)', 
                border: '2px dashed #ff3333',
                padding: '15px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                justifyContent: 'center',
                animation: 'slideUp 0.3s ease-out',
                cursor: 'default'
              }}
              onClick={(e) => { e.stopPropagation(); }} /* Prevent dashboard click bleed */
            >
              <div style={{ color: '#ff7777', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', letterSpacing: '1px' }}>
                DEBUG: POPUPS
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); playSound('select'); if(window.testAchievement) window.testAchievement('ps5'); }}
                style={{ background: '#003791', color: 'white', border: '1px solid #0055d4', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                TEST PS5
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); playSound('select'); if(window.testAchievement) window.testAchievement('xbox'); }}
                style={{ background: '#107C10', color: 'white', border: '1px solid #1f9a1f', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                TEST XBOX
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); playSound('select'); if(window.testAchievement) window.testAchievement('steam'); }}
                style={{ background: '#171a21', color: 'white', border: '1px solid #333', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                TEST STEAM
              </button>
            </div>
          )}
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



          <p className="games-empty-desc" style={{ marginBottom: '30px' }}>
            {isScanning 
              ? "Automatically pulling game data and patches..."
              : isDragActive
                ? "Drop your ROMs folder here to begin scanning..."
                : 'set your ROMS/games path'
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

  const renderAchievementsGallery = () => {
    return (
      <div className="game-library-view" style={{ overflowY: 'auto' }}>
        <div className="library-header">
          <button className="back-btn" onClick={() => { playSound('back'); setCurrentView('home'); }}>
            <ChevronLeft size={24} /> Back
          </button>
          {raData && (
             <div style={{ marginLeft: 'auto', display: 'flex', gap: '20px', alignItems: 'center', background: 'rgba(0,0,0,0.5)', padding: '10px 20px', borderRadius: '30px' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{raData.User || "Budm4n"}</span>
                <span style={{ color: '#FFD700', fontWeight: 'bold' }}>
                  <Trophy size={18} style={{ display:'inline', marginRight: 5, verticalAlign: 'text-bottom' }}/> 
                  {raData.TotalPoints} / {raData.TotalTruePoints} TruePoints
                </span>
             </div>
          )}
        </div>
        <h2 className="section-title">RetroAchievements Sync</h2>
        
        {isLoadingRA ? (
            <div className="loading-spinner" style={{
                margin: '50px auto', width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)',
                borderTopColor: '#90C31D', borderRadius: '50%', animation: 'spin 1s linear infinite'
              }} />
        ) : !raData ? (
           <div className="games-empty-state"><p>Connecting to RetroAchievements...</p></div>
        ) : (
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '25px', paddingBottom: '50px', marginTop: '20px' }}>
              {raData.RecentlyPlayed && raData.RecentlyPlayed.map((game, i) => {
                 const possible = game.NumPossibleAchievements || 0;
                 const earned = game.NumAchieved || 0;
                 const percent = possible > 0 ? (earned / possible) * 100 : 0;
                 const imgUrl = game.ImageIcon ? `https://media.retroachievements.org${game.ImageIcon}` : '';
                 return (
                 <div key={i} className="asset-card" style={{ padding: '0', background: 'rgba(30,30,30,0.9)', overflow: 'hidden' }} onClick={() => {
                     playSound('select');
                     setSelectedGame({
                        title: game.Title,
                        titleId: game.GameID,
                        consoleName: game.ConsoleName,
                        achievementCount: possible,
                        earned: earned,
                        banner: imgUrl
                     });
                     setCurrentView('achievement');
                 }}>
                    <div style={{ height: '140px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       {imgUrl && <img src={imgUrl} alt={game.Title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
                    </div>
                    <div style={{ padding: '15px', textAlign: 'left' }}>
                       <h3 style={{ fontSize: '1rem', margin: '0 0 5px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{game.Title}</h3>
                       <span style={{ fontSize: '0.8rem', color: '#90C31D', fontWeight: 'bold' }}>{game.ConsoleName}</span>
                       <div style={{ marginTop: '15px', background: 'rgba(255,255,255,0.1)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                           <div style={{ width: `${percent}%`, background: '#90C31D', height: '100%' }}></div>
                       </div>
                       <p style={{ fontSize: '0.8rem', marginTop: '8px', color: 'rgba(255,255,255,0.6)' }}>{earned} / {possible} Achievements</p>
                    </div>
                 </div>
              )})}
           </div>
        )}
      </div>
    );
  };

  const renderAchievementView = () => (
    <div className="achievement-modal-overlay" onClick={() => {
      playSound('back');
      setCurrentView('achievements');
    }}>
      <div className="achievement-modal" onClick={(e) => e.stopPropagation()}>
        <div className="achievement-header">
          <img src={selectedGame?.banner} alt={selectedGame?.title} className="game-banner" style={{ filter: 'brightness(0.6)' }}/>
          <div style={{ position: 'absolute', bottom: 20, left: 40, right: 40, display: 'flex', alignItems: 'flex-end', gap: 20 }}>
              <img src={selectedGame?.banner} alt="icon" style={{ width: 100, height: 100, borderRadius: 8, border: '2px solid rgba(255,255,255,0.2)', background: 'black' }} />
              <div>
                  <h2 style={{ fontSize: '2rem', margin: '0 0 5px 0', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{selectedGame?.title}</h2>
                  <p style={{ color: '#90C31D', fontWeight: 'bold', margin: 0, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{selectedGame?.consoleName}</p>
              </div>
          </div>
        </div>
        <div className="achievement-body">
          <p className="title-id" style={{ marginTop: 0 }}>GAME ID: {selectedGame?.titleId}</p>
          <div className="achievement-score">
            <Trophy size={32} color="#FFD700" />
            <span className="score">{selectedGame?.earned || 0}</span>
            <p style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.7)' }}> / {selectedGame?.achievementCount} Earned</p>
          </div>
          <div className="achievements-grid">
            {Array.from({ length: selectedGame?.achievementCount || 30 }).map((_, i) => {
              const unlocked = i < (selectedGame?.earned || 0);
              return (
                <div key={i} className={`achievement-icon ${unlocked ? '' : 'locked'}`} style={{ borderColor: unlocked ? '#90C31D' : '#444', background: unlocked ? 'rgba(144, 195, 29, 0.1)' : '#333' }}>
                  <div className="lock-icon" style={{ opacity: unlocked ? 1 : 0.4 }}>{unlocked ? '🏆' : '🔒'}</div>
                </div>
              );
            })}
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
        filter: isGuideOpen ? 'brightness(0.7)' : 'none'
      }}>
        <VortexBackground src={bgImage} />

        <BladesOverlay currentView={currentView} setCurrentView={setCurrentView} />

        {currentView === 'home' && (
          <div className="xenia-header">
            <div className="header-spacer"></div>

            <UserProfileWidget 
              username={userProfile?.name}
              avatarUrl={userProfile?.profilePicture}
              isLoggedIn={isLoggedIn}
              onLogin={handleDiscordLogin}
              onLogout={handleLogout}
              dropzoneRootProps={getAvatarRootProps()}
              dropzoneInputProps={getAvatarInputProps()}
            />


          </div>
        )}

        <div className="xenia-content">
          {currentView === 'home' && renderHome()}
          {currentView === 'favorites' && renderFavoritesView()}
          {currentView === 'gameLibrary' && renderGameLibrary()}
          {currentView === 'achievements' && renderAchievementsGallery()}
          {currentView === 'marketplace' && (
            <Marketplace
              onBack={() => { playSound('back'); setCurrentView('home'); }}
              defaultTab={storeDefaultTab}
            />
          )}
          {currentView === 'themes' && renderThemesView()}
          {currentView === 'startup' && renderStartupView()}
          {currentView === 'achievement' && renderAchievementView()}
          <NXESettings
            isActive={currentView === 'settings'}
            onBack={() => setCurrentView('home')}
            userProfile={userProfile}
            isLoggedIn={isLoggedIn}
            onLogout={handleLogout}
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
            {currentView === 'home' && (
              <div className="control-item" style={{ marginLeft: 'auto', flexDirection: 'column', gap: '0px', transform: 'translateY(-50px)' }}>
                <div
                  className={`xbox-guide-button scene-3d ${isGuidePressed ? 'pressed' : ''}`}
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

                  <div className={`ground-surface ${isGuideOpen || isGuidePressed ? 'animating' : ''}`}>
                    <div className="icon-ground-shadow"></div>
                    <div className="ripple-wave"></div>
                    <div className="ripple-wave"></div>
                    <div className="ripple-wave"></div>
                    <div className="ripple-wave"></div>
                    <div className="ripple-wave"></div>
                  </div>

                  <div className="xbox-guide-inner guide-icon">
                    <img 
                      src="/assets/AppIcon/icon.svg" 
                      alt="Home Guide" 
                      className="xbox-guide-svg" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    />
                  </div>
                </div>
                
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Community Hub Modal */}
      <CommunityHubModal
        isOpen={isCommunityHubOpen}
        onClose={() => setIsCommunityHubOpen(false)}
        onViewStore={() => {
          setIsCommunityHubOpen(false);
          setStoreDefaultTab('browse');
          setCurrentView('marketplace');
        }}
        onUpload={() => {
          setIsCommunityHubOpen(false);
          setStoreDefaultTab('upload');
          setCurrentView('marketplace');
        }}
      />

      {/* Guide Overlay - Rendered outside dashboard container to avoid blur inheritance */}
      <GuideOverlay
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onNavigateHome={() => setCurrentView('home')}
        onNavigateSettings={() => setCurrentView('settings')}
        userProfile={userProfile}
        isLoggedIn={isLoggedIn}
        onLogin={handleDiscordLogin}
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

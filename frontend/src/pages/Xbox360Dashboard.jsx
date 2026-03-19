import React, { useState, useEffect } from 'react';
import { Disc, Heart, Settings, Trophy, Loader2, Gamepad, Image as ImageIcon } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { initializeMsal, loginAndFetchProfile, logout } from '../services/xboxAuthService';
import BladeSettings from '../components/BladeSettings';
import SetupWizard from '../components/SetupWizard';
import AnimatedBackground from '../components/AnimatedBackground';
import '../styles/Xbox360Dashboard.css';
import '../styles/NXESettings.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;



// Official Xbox Icon
const XboxIcon = () => (
  <img 
    src='/assets/XB-logo.svg'
    alt="Xbox" 
    className="xbox-icon"
  />
);

const Xbox360Dashboard = () => {
  const [activeTab, setActiveTab] = useState('games');
  const [xboxProfile, setXboxProfile] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedTile, setSelectedTile] = useState(0);
  const [recentGames, setRecentGames] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const [gameLibrary, setGameLibrary] = useState([]);
  const [showStartupVideo, setShowStartupVideo] = useState(true);
  const [showBladeSettings, setShowBladeSettings] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  useEffect(() => {
    // Initialize MSAL
    const initAuth = async () => {
      try {
        await initializeMsal();
        // Handle redirect promise if we used redirect flow instead of popup
        // const response = await msalInstance.handleRedirectPromise();
        // if (response) { ... }
      } catch (e) {
        console.error("MSAL Init Error:", e);
      }
    };
    initAuth();

    // Check startup video setting
    const skipStartup = localStorage.getItem('skipStartup');
    if (skipStartup === 'true') {
      setShowStartupVideo(false);
    } else {
      // Play startup video
      setTimeout(() => {
        setShowStartupVideo(false);
        localStorage.setItem('skipStartup', 'true');
      }, 3000); // 3 second startup video
    }

    // Load saved session
    const savedProfile = localStorage.getItem('xboxProfile');
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        setXboxProfile(profile);
        setIsLoggedIn(true);
        loadRecentGames();
        loadGameLibrary();
      } catch (e) {
        console.error('Failed to load profile', e);
        localStorage.removeItem('xboxProfile');
      }
    }

    // Load theme and startup video settings (removed unused state variables)
    // Settings are now managed by the BladeSettings component

    // Listen for OAuth callback
    window.addEventListener('message', handleOAuthCallback);
    
    // Check for first run / setup
    const libraryPath = localStorage.getItem('gameLibraryPath');
    if (!libraryPath) {
      // Delay slightly to let startup animation finish if it's running, 
      // or show immediately if skipped.
      setTimeout(() => setShowSetupWizard(true), skipStartup === 'true' ? 500 : 3500);
    }
    
    return () => window.removeEventListener('message', handleOAuthCallback);
  }, []);

  const loadRecentGames = () => {
    const saved = localStorage.getItem('recentGames');
    if (saved) {
      setRecentGames(JSON.parse(saved));
    }
  };

  const loadGameLibrary = () => {
    const libraryPath = localStorage.getItem('gameLibraryPath');
    if (libraryPath) {
      const mockLibrary = [
        { id: 1, title: 'Halo 3', titleId: '4D5307D1', path: '/games/halo3.iso' },
        { id: 2, title: 'Gears of War 2', titleId: '4D5308AB', path: '/games/gow2.iso' },
        { id: 3, title: 'Red Dead Redemption', titleId: '5454082B', path: '/games/rdr.iso' }
      ];
      setGameLibrary(mockLibrary);
    } else {
      setGameLibrary([]);
    }
  };

  const handleOAuthCallback = (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data.type === 'XBOX_AUTH_SUCCESS') {
      const { profile } = event.data;
      setXboxProfile(profile);
      setIsLoggedIn(true);
      localStorage.setItem('xboxProfile', JSON.stringify(profile));
      loadRecentGames();
      loadGameLibrary();
    }
  };

  const loadAchievements = async () => {
    if (!isLoggedIn || !xboxProfile?.gamertag) return;
    
    setLoadingAchievements(true);
    try {
      const response = await axios.get(`${API}/xbox/achievements/${xboxProfile.gamertag}`);
      setAchievements(response.data.achievements || []);
    } catch (error) {
      console.error('Failed to load achievements', error);
    } finally {
      setLoadingAchievements(false);
    }
  };

  const launchGame = async (game) => {
    // Launch logic
    if (window.__TAURI_INTERNALS__) {
       try {
           const xuid = xboxProfile?.xuid || "0000000000000000";
           const gamertag = xboxProfile?.gamertag || "Player";
           
           console.log(`Launching ${game.title} (${game.path}) as ${gamertag} [${xuid}]`);
           
           const result = await invoke('launch_xenia', { 
               gamePath: game.path,
               xuid: xuid,
               gamertag: gamertag
           });
           
           console.log(result);
           
       } catch (e) {
           console.error("Failed to launch Vortex Prime Emu:", e);
           alert("Failed to launch Vortex Prime Emu: " + e);
       }
    } else {
        alert(`Launching ${game.title} with Vortex Prime Emu AMF...\nGame Path: ${game.path}\n(Not in Tauri environment)`);
    }

    const updatedRecent = [
      { id: game.id, title: game.title, lastPlayed: 'Just now', canResume: true },
      ...recentGames.filter(g => g.id !== game.id)
    ].slice(0, 4);
    setRecentGames(updatedRecent);
    localStorage.setItem('recentGames', JSON.stringify(updatedRecent));
  };

  const [startupVideos, setStartupVideos] = useState([]);
  const [wallpapers, setWallpapers] = useState([]);
  const [currentWallpaper, setCurrentWallpaper] = useState(null);

  useEffect(() => {
    if (activeTab === 'startup') {
      loadStartupVideos();
    } else if (activeTab === 'themes') {
      loadWallpapers();
    }
  }, [activeTab]);

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
      
      // Check if we have a saved active wallpaper in local storage
      const savedWallpaper = localStorage.getItem('selectedWallpaper');
      if (savedWallpaper) {
          setCurrentWallpaper(savedWallpaper);
      } else {
          // If no saved preference, try to find an active one from backend
          const active = response.data.wallpapers.find(w => w.status === 'active');
          if (active) {
              setCurrentWallpaper(active.name);
          }
      }
    } catch (error) {
      console.error('Failed to load wallpapers', error);
    }
  };

  const handleToggleStartupVideo = async (filename, currentStatus) => {
    try {
      const action = currentStatus === 'active' ? 'disable' : 'enable';
      await axios.post(`${API}/startup/toggle`, {
         filename,
         action
      });
      
      // Refresh list
      loadStartupVideos();
      
      // If enabled, offer to restart
      if (action === 'enable') {
        if (window.confirm(`Enabled ${filename}. Restart app to see changes?`)) {
           // Use Tauri process API to relaunch
           if (window.__TAURI_INTERNALS__) {
             import('@tauri-apps/plugin-process').then(({ relaunch }) => {
                relaunch();
             });
           } else {
             window.location.reload(); 
           }
        }
      }
    } catch (error) {
      console.error('Failed to toggle video', error);
      alert('Error toggling video: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleToggleWallpaper = async (filename, currentStatus) => {
    try {
        const action = currentStatus === 'active' ? 'disable' : 'enable';
        await axios.post(`${API}/wallpapers/toggle`, {
           filename,
           action
        });
        
        // Refresh list
        loadWallpapers();
        
        if (action === 'enable') {
            localStorage.setItem('selectedWallpaper', filename);
            setCurrentWallpaper(filename);
            alert(`Wallpaper ${filename} enabled.`);
        } else {
             if (currentWallpaper === filename) {
                 localStorage.removeItem('selectedWallpaper');
                 setCurrentWallpaper(null);
             }
        }
        
    } catch (error) {
        console.error('Failed to toggle wallpaper', error);
        alert('Error toggling wallpaper: ' + (error.response?.data?.detail || error.message));
    }
  };

  const tabs = ['games', 'achievements', 'themes', 'startup', 'settings'];

  const systemTiles = [
    { id: 'console', title: 'Console Settings', icon: Settings, action: () => setShowBladeSettings(true) },
    { id: 'display', title: 'Display', icon: Settings, action: () => setShowBladeSettings(true) },
    { id: 'network', title: 'Network Settings', icon: Settings, action: () => setShowBladeSettings(true) },
    { id: 'storage', title: 'Storage', icon: Settings, action: () => setShowBladeSettings(true) },
    { id: 'global', title: 'Global Settings', icon: Settings, action: () => setShowBladeSettings(true) },
    { id: 'game', title: 'Game Settings', icon: Settings, action: () => setShowBladeSettings(true) },
    { id: 'about', title: 'System Info', icon: Settings, action: () => setShowBladeSettings(true) }
  ];

  const handleApplySettings = (settings) => {
    if (settings.theme) {
      localStorage.setItem('selectedTheme', settings.theme);
    }
    if (settings.startupVideo) {
      localStorage.setItem('selectedStartupVideo', settings.startupVideo);
      localStorage.setItem('skipStartup', 'false');
    }
    
    alert('Settings applied! App will restart to apply changes.\n\nIn Tauri app, this would actually restart the application.');
    setShowBladeSettings(false);
  };

  const handleMicrosoftLogin = async () => {
    try {
      const profileData = await loginAndFetchProfile();
      setXboxProfile(profileData);
      setIsLoggedIn(true);
      localStorage.setItem('xboxProfile', JSON.stringify(profileData));
      loadRecentGames();
      loadGameLibrary();
    } catch (error) {
      console.error("Login failed:", error);
      
      // Fallback: Use Tauri Shell to open browser if popup is blocked
      if (window.__TAURI_INTERNALS__) {
         if (window.confirm("Login popup may be blocked. Open in default browser?")) {
            import('@tauri-apps/plugin-shell').then(({ open }) => {
                // We can't do the full flow this way easily without a deep link callback
                // But we can at least open the auth URL if we had one.
                // For now, let's just alert the user.
                alert("Please check your taskbar for a hidden login window, or try Alt+Tab.");
            });
         }
      } else {
         alert("Login failed. Please disable popup blockers and try again.");
      }
    }
  };

  const handleLogout = () => {
    logout();
    setXboxProfile(null);
    setIsLoggedIn(false);
    setRecentGames([]);
    setAchievements([]);
    localStorage.clear();
  };

  const getCurrentTiles = () => {
    return activeTab === 'settings' ? systemTiles : [];
  };

  const handleTileClick = (index) => {
    setSelectedTile(index);
    const tiles = getCurrentTiles();
    tiles[index].action();
  };

  useEffect(() => {
    if (activeTab === 'achievements') {
      loadAchievements();
    }
  }, [activeTab]);

  if (showStartupVideo) {
    return (
      <div className="startup-screen">
        <div className="startup-video-container">
          <div className="xbox-startup-logo">
            <XboxIcon />
          </div>
          <div className="startup-text">Xbox 360</div>
          <div className="loading-bar">
            <div className="loading-progress"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="xbox360-dashboard">
      <AnimatedBackground backgroundImage="/assets/wallpapers/vortex-prime-bg.jpg" />

      {/* Blade Settings */}
      <BladeSettings 
        isOpen={showBladeSettings} 
        onClose={() => setShowBladeSettings(false)}
        onApply={handleApplySettings}
      />
      
      {/* Setup Wizard */}
      <SetupWizard
        isOpen={showSetupWizard}
        onClose={() => setShowSetupWizard(false)}
        onComplete={(path) => {
          setShowSetupWizard(false);
          loadGameLibrary(); // Refresh library with new path
        }}
      />

      {/* Header */}
      <div className="xbox-header">
        <div className="header-spacer"></div>
        <div className="header-right">
          <div 
            className="xbox-profile-avatar" 
            onClick={() => !isLoggedIn && handleMicrosoftLogin()}
            title={isLoggedIn ? 'Profile' : 'Sign in with Microsoft'}
          >
            {isLoggedIn ? (
              <div className="profile-section">
                <div className="profile-info-logged">
                  <div className="gamertag">{xboxProfile?.gamertag}</div>
                  <div className="gamerscore">
                    <svg className="gamerscore-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <span className="score-value">{xboxProfile?.gamerscore || 0}</span>
                  </div>
                </div>
                <div className="profile-avatar logged-in">
                  {xboxProfile?.profilePicture ? (
                    <img src={xboxProfile.profilePicture} alt="Profile" />
                  ) : (
                    <div className="avatar-icon"><XboxIcon /></div>
                  )}
                </div>
              </div>
            ) : (
              <div className="profile-login-section">
                <div className="profile-avatar not-logged-in">
                  <div className="avatar-icon"><XboxIcon /></div>
                </div>
                <div className="login-text">Log in with Xbox</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="navigation-tabs">
        <button className={`nav-tab ${activeTab === 'games' ? 'active' : ''}`} onClick={() => setActiveTab('games')}>games</button>
        <button className={`nav-tab ${activeTab === 'achievements' ? 'active' : ''}`} onClick={() => setActiveTab('achievements')}>achievements</button>
        <button className={`nav-tab ${activeTab === 'themes' ? 'active' : ''}`} onClick={() => setActiveTab('themes')}>themes</button>
        <button className={`nav-tab ${activeTab === 'startup' ? 'active' : ''}`} onClick={() => setActiveTab('startup')}>startup</button>
        <button className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>settings</button>
      </div>

      {/* Content */}
      <div className="dashboard-content">
        {activeTab === 'games' && (
          <div className="games-library">
            <h3 className="section-title">Game Library</h3>
            {gameLibrary.length > 0 ? (
              <div className="games-grid">
                {gameLibrary.map((game) => (
                  <div key={game.id} className="game-card" onClick={() => launchGame(game)}>
                    <div className="game-cover"><Gamepad size={64} /></div>
                    <div className="game-title">{game.title}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-games-message">
                <Gamepad size={64} opacity={0.3} />
                <p>No games available</p>
                <span className="hint-text">Play a game to see it here</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="achievements-view">
            <h3 className="section-title">Achievements</h3>
            {!isLoggedIn ? (
              <div className="no-games-message">
                <Trophy size={64} opacity={0.3} />
                <p>Sign in to view achievements</p>
              </div>
            ) : loadingAchievements ? (
              <div className="loading-achievements">
                <Loader2 size={48} className="spinner" />
                <p>Loading achievements...</p>
              </div>
            ) : achievements.length > 0 ? (
              <div className="achievements-grid">
                {achievements.map((achievement, i) => (
                  <div key={i} className="achievement-card">
                    <div className="achievement-icon"><Trophy size={32} /></div>
                    <div className="achievement-info">
                      <div className="achievement-name">{achievement.name}</div>
                      <div className="achievement-desc">{achievement.description}</div>
                      <div className="achievement-points">{achievement.gamerscore}G</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-games-message">
                <Trophy size={64} opacity={0.3} />
                <p>No achievements yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'themes' && (
          <div className="themes-view">
             <h3 className="section-title">Themes & Wallpapers</h3>
             <div className="startup-options">
               {wallpapers.length > 0 ? (
                 wallpapers.map((wallpaper, i) => (
                   <div 
                     key={i} 
                     className={`startup-card ${wallpaper.status === 'disabled' ? 'disabled' : ''}`}
                     onClick={() => handleToggleWallpaper(wallpaper.name, wallpaper.status)}
                   >
                     <div className="startup-icon"><ImageIcon size={32}/></div>
                     <div className="startup-name">{wallpaper.name}</div>
                     <div className="startup-status">{wallpaper.status}</div>
                   </div>
                 ))
               ) : (
                 <div className="no-games-message">
                   <ImageIcon size={64} opacity={0.3} />
                   <p>No wallpapers found.</p>
                   <span className="hint-text">Add images to assets/wallpapers/play or disabled</span>
                 </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'startup' && (
          <div className="startup-view">
            <h3 className="section-title">Startup Animation</h3>
            <div className="startup-options">
               {startupVideos.length > 0 ? (
                 startupVideos.map((video, i) => (
                   <div 
                     key={i} 
                     className={`startup-card ${video.status === 'disabled' ? 'disabled' : ''}`}
                     onClick={() => handleToggleStartupVideo(video.name, video.status)}
                   >
                     <div className="startup-icon"><Disc size={32}/></div>
                     <div className="startup-name">{video.name}</div>
                     <div className="startup-status">{video.status}</div>
                   </div>
                 ))
               ) : (
                 <div className="no-games-message">
                   <Disc size={64} opacity={0.3} />
                   <p>No startup videos found.</p>
                   <span className="hint-text">Add videos to assets/startup/play or disabled</span>
                 </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-view">
             <h3 className="section-title">System Settings</h3>
             <div className="games-grid">
               {systemTiles.map((tile) => {
                 const Icon = tile.icon;
                 return (
                   <div key={tile.id} className="game-card" onClick={tile.action}>
                     <div className="game-cover" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)'}}>
                        <Icon size={64} color="#9ECE6A" />
                     </div>
                     <div className="game-title">{tile.title}</div>
                   </div>
                 );
               })}
             </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="xbox-footer">
        <div className="footer-hint">
          <span className="hint-icon">A</span>
          <span className="hint-text">Select</span>
        </div>
        {isLoggedIn && (
          <button className="logout-button" onClick={handleLogout}>Sign Out</button>
        )}
      </div>
    </div>
  );
};

export default Xbox360Dashboard;

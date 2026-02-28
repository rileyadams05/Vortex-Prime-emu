import React, { useState, useEffect } from 'react';
import { Disc, Heart, Settings, Trophy, Loader2, Gamepad2 } from 'lucide-react';
import axios from 'axios';
import BladeSettings from '../components/BladeSettings';
import '../styles/Xbox360Dashboard.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Official Xbox Icon
const XboxIcon = () => (
  <img 
    src="https://customer-assets.emergentagent.com/job_xbox360-dashboard/artifacts/4yo0cne7_Xb-windows.ico" 
    alt="Xbox" 
    className="xbox-icon"
  />
);

const Xbox360Dashboard = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [xboxProfile, setXboxProfile] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedTile, setSelectedTile] = useState(0);
  const [recentGames, setRecentGames] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const [gameLibrary, setGameLibrary] = useState([]);
  const [showStartupVideo, setShowStartupVideo] = useState(true);
  const [showBladeSettings, setShowBladeSettings] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('default');
  const [selectedStartupVideo, setSelectedStartupVideo] = useState('default');
  const [availableThemes, setAvailableThemes] = useState(['default', 'dark-green', 'blue-wave']);
  const [availableStartupVideos, setAvailableStartupVideos] = useState(['default', 'classic-360', 'kinect-intro']);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
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

    // Load theme and startup video settings
    const savedTheme = localStorage.getItem('selectedTheme');
    const savedStartup = localStorage.getItem('selectedStartupVideo');
    if (savedTheme) setSelectedTheme(savedTheme);
    if (savedStartup) setSelectedStartupVideo(savedStartup);

    // Listen for OAuth callback
    window.addEventListener('message', handleOAuthCallback);
    return () => window.removeEventListener('message', handleOAuthCallback);
  }, []);

  const loadRecentGames = () => {
    const saved = localStorage.getItem('recentGames');
    if (saved) {
      setRecentGames(JSON.parse(saved));
    }
  };

  const loadGameLibrary = () => {
    const mockLibrary = [
      { id: 1, title: 'Halo 3', titleId: '4D5307D1', path: '/games/halo3.iso' },
      { id: 2, title: 'Gears of War 2', titleId: '4D5308AB', path: '/games/gow2.iso' },
      { id: 3, title: 'Red Dead Redemption', titleId: '5454082B', path: '/games/rdr.iso' }
    ];
    setGameLibrary(mockLibrary);
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

  const launchGame = (game) => {
    alert(`Launching ${game.title} with Xenia...\nGame Path: ${game.path}`);
    
    const updatedRecent = [
      { id: game.id, title: game.title, lastPlayed: 'Just now', canResume: true },
      ...recentGames.filter(g => g.id !== game.id)
    ].slice(0, 4);
    setRecentGames(updatedRecent);
    localStorage.setItem('recentGames', JSON.stringify(updatedRecent));
  };

  const homeTiles = [
    { id: 'open-tray', title: 'Open Tray', icon: Disc, action: () => alert('Insert disc or select ISO file') },
    { id: 'my-favorites', title: 'My Favorites', icon: Heart, action: () => alert('Your favorite games') }
  ];

  const systemTiles = [
    { id: 'system-settings', title: 'System Settings', icon: Settings, action: () => setShowSystemSettings(true) }
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

  const handleMicrosoftLogin = () => {
    const clientId = '00000000402b5328';
    const redirectUri = encodeURIComponent('https://login.live.com/oauth20_desktop.srf');
    const scope = encodeURIComponent('service::user.auth.xboxlive.com::MBI_SSL');
    const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`;
    
    window.open(authUrl, '_blank');
  };

  const handleLogout = () => {
    setXboxProfile(null);
    setIsLoggedIn(false);
    setRecentGames([]);
    setAchievements([]);
    localStorage.clear();
  };

  const getCurrentTiles = () => {
    return activeTab === 'settings' ? systemTiles : homeTiles;
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
      <div className="xbox-background">
        <div className="bg-gradient"></div>
      </div>

      {/* System Settings Modal */}
      {showSystemSettings && (
        <div className="system-settings-modal-overlay" onClick={() => setShowSystemSettings(false)}>
          <div className="system-settings-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="settings-modal-title">System Settings</h2>
            
            <div className="settings-section">
              <div className="setting-item">
                <div className="setting-label">
                  <Palette size={20} />
                  <span>Theme</span>
                </div>
                <select 
                  className="setting-select"
                  value={selectedTheme}
                  onChange={(e) => setSelectedTheme(e.target.value)}
                >
                  {availableThemes.map(theme => (
                    <option key={theme} value={theme}>{theme}</option>
                  ))}
                </select>
              </div>

              <div className="setting-item">
                <div className="setting-label">
                  <Video size={20} />
                  <span>Startup Video</span>
                </div>
                <select 
                  className="setting-select"
                  value={selectedStartupVideo}
                  onChange={(e) => setSelectedStartupVideo(e.target.value)}
                >
                  {availableStartupVideos.map(video => (
                    <option key={video} value={video}>{video}</option>
                  ))}
                </select>
              </div>

              <button 
                className="apply-settings-btn"
                onClick={handleApplySettings}
                disabled={isApplying}
              >
                {isApplying ? (
                  <><Loader2 size={20} className="spinner" /> Applying & Restarting...</>
                ) : (
                  'Apply'
                )}
              </button>
            </div>

            <div className="settings-section">
              <button className="settings-option-btn" onClick={() => alert('Global Settings')}>
                <Globe size={24} />
                <span>Global Settings</span>
              </button>
              
              <button className="settings-option-btn" onClick={() => alert('Game Settings')}>
                <Gamepad size={24} />
                <span>Game Settings</span>
              </button>
            </div>

            <button className="close-settings-btn" onClick={() => setShowSystemSettings(false)}>Close</button>
          </div>
        </div>
      )}

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
        <button className={`nav-tab ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>home</button>
        <button className={`nav-tab ${activeTab === 'games' ? 'active' : ''}`} onClick={() => setActiveTab('games')}>games</button>
        <button className={`nav-tab ${activeTab === 'achievements' ? 'active' : ''}`} onClick={() => setActiveTab('achievements')}>achievements</button>
        <button className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>settings</button>
      </div>

      {/* Content */}
      <div className="dashboard-content">
        {activeTab === 'home' && (
          <>
            {recentGames.length > 0 ? (
              <div className="recent-games-section">
                <h3 className="section-title">Recent Games</h3>
                <div className="recent-games-list">
                  {recentGames.map((game) => (
                    <div key={game.id} className="recent-game-item" onClick={() => launchGame(game)}>
                      <div className="game-thumbnail"><Gamepad size={32} /></div>
                      <div className="game-info">
                        <div className="game-name">{game.title}</div>
                        <div className="game-time">{game.lastPlayed}</div>
                        {game.canResume && <div className="quick-resume-badge">Quick Resume</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="no-games-message">
                <Gamepad size={64} opacity={0.3} />
                <p>No games available</p>
                <span className="hint-text">Play a game to see it here</span>
              </div>
            )}

            <div className="tiles-grid">
              {homeTiles.map((tile, index) => {
                const Icon = tile.icon;
                return (
                  <div key={tile.id} className={`xbox-tile ${index === selectedTile ? 'selected' : ''}`} onClick={() => handleTileClick(index)}>
                    <div className="tile-content">
                      <Icon size={48} className="tile-icon" />
                      <div className="tile-title">{tile.title}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'games' && (
          <div className="games-library">
            <h3 className="section-title">Game Library</h3>
            <div className="games-grid">
              {gameLibrary.map((game) => (
                <div key={game.id} className="game-card" onClick={() => launchGame(game)}>
                  <div className="game-cover"><Gamepad size={64} /></div>
                  <div className="game-title">{game.title}</div>
                </div>
              ))}
            </div>
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

        {activeTab === 'settings' && (
          <div className="tiles-grid">
            {systemTiles.map((tile, index) => {
              const Icon = tile.icon;
              return (
                <div key={tile.id} className={`xbox-tile ${index === selectedTile ? 'selected' : ''}`} onClick={() => handleTileClick(index)}>
                  <div className="tile-content">
                    <Icon size={48} className="tile-icon" />
                    <div className="tile-title">{tile.title}</div>
                  </div>
                </div>
              );
            })}
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
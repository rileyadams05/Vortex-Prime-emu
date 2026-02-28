import React, { useState, useEffect } from 'react';
import { Disc, Heart, Gamepad2, Settings, Trophy, Loader2 } from 'lucide-react';
import axios from 'axios';
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

  useEffect(() => {
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
    // Mock game library - in Tauri, this would scan directories
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
    // In Tauri, this would execute: window.__TAURI__.invoke('launch_xenia', { gamePath: game.path })
    alert(`Launching ${game.title} with Xenia...\nGame Path: ${game.path}`);
    
    // Add to recent games
    const updatedRecent = [
      { id: game.id, title: game.title, lastPlayed: 'Just now', canResume: true },
      ...recentGames.filter(g => g.id !== game.id)
    ].slice(0, 4);
    setRecentGames(updatedRecent);
    localStorage.setItem('recentGames', JSON.stringify(updatedRecent));
  };

  const homeTiles = [
    { 
      id: 'open-tray', 
      title: 'Open Tray', 
      icon: Disc, 
      action: () => alert('Insert disc or select ISO file') 
    },
    { 
      id: 'my-favorites', 
      title: 'My Favorites', 
      icon: Heart, 
      action: () => alert('Your favorite games') 
    },
    { 
      id: 'my-games', 
      title: 'My Games', 
      icon: Gamepad2, 
      action: () => setActiveTab('games') 
    }
  ];

  const systemTiles = [
    { 
      id: 'system', 
      title: 'System', 
      icon: Settings, 
      action: () => alert('System Settings:\n- Display & Audio\n- Network\n- Storage\n- About') 
    }
  ];

  const handleMicrosoftLogin = () => {
    // Open real Microsoft OAuth in default browser
    const clientId = '00000000402b5328'; // Xbox Live client ID
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

  return (
    <div className="xbox360-dashboard">
      <div className="xbox-background">
        <div className="bg-gradient"></div>
      </div>

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
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <>
            {recentGames.length > 0 ? (
              <div className="recent-games-section">
                <h3 className="section-title">Recent Games</h3>
                <div className="recent-games-list">
                  {recentGames.map((game) => (
                    <div key={game.id} className="recent-game-item" onClick={() => launchGame(game)}>
                      <div className="game-thumbnail"><Gamepad2 size={32} /></div>
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
                <Gamepad2 size={64} opacity={0.3} />
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

        {/* GAMES TAB */}
        {activeTab === 'games' && (
          <div className="games-library">
            <h3 className="section-title">Game Library</h3>
            <div className="games-grid">
              {gameLibrary.map((game) => (
                <div key={game.id} className="game-card" onClick={() => launchGame(game)}>
                  <div className="game-cover"><Gamepad2 size={64} /></div>
                  <div className="game-title">{game.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACHIEVEMENTS TAB */}
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

        {/* SETTINGS TAB */}
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
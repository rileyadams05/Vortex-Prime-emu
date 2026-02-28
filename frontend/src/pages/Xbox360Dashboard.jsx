import React, { useState, useEffect } from 'react';
import { Disc, Heart, Gamepad2, Settings } from 'lucide-react';
import axios from 'axios';
import '../styles/Xbox360Dashboard.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Microsoft login icon SVG
const MicrosoftIcon = () => (
  <svg viewBox="0 0 23 23" className="microsoft-icon">
    <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
    <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
    <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
    <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
  </svg>
);

const Xbox360Dashboard = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [xboxProfile, setXboxProfile] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedTile, setSelectedTile] = useState(0);
  const [recentGames, setRecentGames] = useState([]);

  useEffect(() => {
    // Check for existing session
    const savedProfile = localStorage.getItem('xboxProfile');
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        setXboxProfile(profile);
        setIsLoggedIn(true);
        loadRecentGames();
      } catch (e) {
        console.error('Failed to load saved profile', e);
        localStorage.removeItem('xboxProfile');
      }
    }

    // Listen for OAuth callback
    window.addEventListener('message', handleOAuthCallback);
    return () => window.removeEventListener('message', handleOAuthCallback);
  }, []);

  const loadRecentGames = () => {
    // Load from localStorage or API
    const saved = localStorage.getItem('recentGames');
    if (saved) {
      setRecentGames(JSON.parse(saved));
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
    }
  };

  const homeTiles = [
    { id: 'open-tray', title: 'Open Tray', icon: 'disc', action: () => alert('Insert disc or mount ISO') },
    { id: 'my-favorites', title: 'My Favorites', icon: 'heart', action: () => alert('My Favorites') },
    { id: 'my-games', title: 'My Games', icon: 'gamepad', action: () => alert('My Games library') }
  ];

  const systemTiles = [
    { id: 'system', title: 'System', icon: 'settings', action: () => alert('System settings') }
  ];

  const handleMicrosoftLogin = () => {
    // Open Microsoft login in default browser
    const authUrl = 'https://login.live.com/oauth20_authorize.srf?client_id=00000000402b5328&response_type=code&redirect_uri=https://login.live.com/oauth20_desktop.srf&scope=service::user.auth.xboxlive.com::MBI_SSL';
    window.open(authUrl, '_blank');
  };

  const handleLogout = () => {
    setXboxProfile(null);
    setIsLoggedIn(false);
    setRecentGames([]);
    localStorage.removeItem('xboxProfile');
    localStorage.removeItem('recentGames');
  };

  const getCurrentTiles = () => {
    return activeTab === 'settings' ? systemTiles : homeTiles;
  };

  const handleTileClick = (index) => {
    setSelectedTile(index);
    const tiles = getCurrentTiles();
    tiles[index].action();
  };

  const renderIcon = (iconType) => {
    switch(iconType) {
      case 'disc':
        return <Disc size={48} className="tile-icon" />;
      case 'heart':
        return <Heart size={48} className="tile-icon" />;
      case 'gamepad':
        return <Gamepad2 size={48} className="tile-icon" />;
      case 'settings':
        return <Settings size={48} className="tile-icon" />;
      default:
        return null;
    }
  };

  const handleKeyPress = (e) => {
    const tiles = getCurrentTiles();
    const cols = 3;
    
    switch (e.key) {
      case 'ArrowLeft':
        if (selectedTile % cols !== 0) setSelectedTile(selectedTile - 1);
        break;
      case 'ArrowRight':
        if ((selectedTile + 1) % cols !== 0 && selectedTile < tiles.length - 1) setSelectedTile(selectedTile + 1);
        break;
      case 'ArrowUp':
        if (selectedTile >= cols) setSelectedTile(selectedTile - cols);
        break;
      case 'ArrowDown':
        if (selectedTile + cols < tiles.length) setSelectedTile(selectedTile + cols);
        break;
      case 'Enter':
        tiles[selectedTile].action();
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTile, activeTab]);

  return (
    <div className="xbox360-dashboard">
      <div className="xbox-background">
        <div className="bg-gradient"></div>
      </div>

      <div className="xbox-header">
        <div className="header-spacer"></div>
        <div className="header-right">
          <div 
            className="xbox-profile-avatar" 
            onClick={() => !isLoggedIn && handleMicrosoftLogin()}
            title={isLoggedIn ? 'View Profile' : 'Sign in with Microsoft'}
          >
            {isLoggedIn ? (
              <div className="profile-section">
                <div className="profile-info-logged">
                  <div className="gamertag">{xboxProfile?.gamertag || 'Xbox Gamer'}</div>
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
                    <div className="avatar-placeholder"><MicrosoftIcon /></div>
                  )}
                </div>
              </div>
            ) : (
              <div className="profile-avatar not-logged-in">
                <div className="avatar-microsoft"><MicrosoftIcon /></div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="navigation-tabs">
        <button 
          className={`nav-tab ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => { setActiveTab('home'); setSelectedTile(0); }}
        >
          home
        </button>
        <button 
          className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => { setActiveTab('settings'); setSelectedTile(0); }}
        >
          settings
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'home' && recentGames.length > 0 && (
          <div className="recent-games-section">
            <h3 className="section-title">Recent Games</h3>
            <div className="recent-games-list">
              {recentGames.map((game, index) => (
                <div key={game.id} className="recent-game-item">
                  <div className="game-thumbnail">
                    <Gamepad2 size={32} />
                  </div>
                  <div className="game-info">
                    <div className="game-name">{game.title}</div>
                    <div className="game-time">{game.lastPlayed}</div>
                    {game.canResume && <div className="quick-resume">Quick Resume</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'home' && recentGames.length === 0 && (
          <div className="no-games-message">
            <Gamepad2 size={64} opacity={0.3} />
            <p>No games available</p>
            <span className="hint-text">Play a game to see it here</span>
          </div>
        )}

        <div className="tiles-grid">
          {getCurrentTiles().map((tile, index) => {
            return (
              <div
                key={tile.id}
                className={`xbox-tile ${index === selectedTile ? 'selected' : ''}`}
                onClick={() => handleTileClick(index)}
              >
                <div className="tile-content">
                  {renderIcon(tile.icon)}
                  <div className="tile-title">{tile.title}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="xbox-footer">
        <div className="footer-hint">
          <span className="hint-icon">A</span>
          <span className="hint-text">Select</span>
        </div>
        {isLoggedIn && (
          <button className="logout-button" onClick={handleLogout}>
            Sign Out
          </button>
        )}
      </div>
    </div>
  );
};

export default Xbox360Dashboard;
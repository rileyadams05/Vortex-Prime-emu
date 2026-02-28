import React, { useState, useEffect } from 'react';
import { Disc, Heart, Clock, Gamepad2, HelpCircle, Settings, X, LogIn } from 'lucide-react';
import axios from 'axios';
import '../styles/Xbox360Dashboard.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Xbox360Dashboard = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [xboxProfile, setXboxProfile] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [gamertag, setGamertag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTile, setSelectedTile] = useState(0);
  const [recentGames, setRecentGames] = useState([
    { id: 1, title: 'Halo 3', lastPlayed: '2 hours ago', canResume: true },
    { id: 2, title: 'Gears of War 2', lastPlayed: 'Yesterday', canResume: true },
    { id: 3, title: 'Red Dead Redemption', lastPlayed: '2 days ago', canResume: false },
    { id: 4, title: 'Call of Duty: MW2', lastPlayed: '3 days ago', canResume: false }
  ]);

  const homeTiles = [
    { id: 'open-tray', title: 'Open Tray', icon: Disc, action: () => alert('Insert disc or mount ISO') },
    { id: 'my-favorites', title: 'My Favorites', icon: Heart, action: () => alert('My Favorites') },
    { id: 'recent', title: 'Recent Games', icon: Clock, action: () => showRecentGames() },
    { id: 'my-games', title: 'My Games', icon: Gamepad2, action: () => alert('My Games library') },
    { id: 'need-help', title: 'Need Help?', icon: HelpCircle, action: () => window.open('https://support.xbox.com', '_blank') }
  ];

  const settingsTiles = [
    { id: 'display', title: 'Display & Sound', icon: Settings, action: () => alert('Display settings') },
    { id: 'network', title: 'Network', icon: Settings, action: () => alert('Network settings') },
    { id: 'storage', title: 'Storage', icon: Settings, action: () => alert('Storage management') },
    { id: 'system', title: 'System', icon: Settings, action: () => alert('System settings') }
  ];

  const showRecentGames = () => {
    alert(`Recent Games:\n${recentGames.map(g => `${g.title} - ${g.lastPlayed}${g.canResume ? ' (Quick Resume Available)' : ''}`).join('\n')}`);
  };

  const handleLogin = async () => {
    if (!gamertag.trim()) {
      setError('Please enter a gamertag');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Fetch Xbox profile using the gamertag
      const response = await axios.get(`${API}/xbox/profile/${gamertag}`);
      setXboxProfile(response.data);
      setIsLoggedIn(true);
      setShowLoginModal(false);
    } catch (err) {
      console.error('Error fetching Xbox profile:', err);
      setError('Failed to fetch Xbox profile. Please check the gamertag and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setXboxProfile(null);
    setIsLoggedIn(false);
    setGamertag('');
  };

  const getCurrentTiles = () => {
    switch (activeTab) {
      case 'settings':
        return settingsTiles;
      default:
        return homeTiles;
    }
  };

  const handleTileClick = (index) => {
    setSelectedTile(index);
    const tiles = getCurrentTiles();
    tiles[index].action();
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
            onClick={() => !isLoggedIn && setShowLoginModal(true)}
            title={isLoggedIn ? 'View Profile' : 'Sign in to Xbox Live'}
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
                    <div className="avatar-placeholder">👤</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="profile-avatar not-logged-in">
                <div className="avatar-placeholder">👤</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showLoginModal && (
        <div className="login-modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="login-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowLoginModal(false)}>
              <X size={24} />
            </button>
            <div className="modal-header">
              <LogIn size={48} />
              <h2>Sign in to Xbox Live</h2>
              <p>Enter your Xbox gamertag to view your profile</p>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Enter your gamertag"
                value={gamertag}
                onChange={(e) => setGamertag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="gamertag-input"
              />
              {error && <div className="error-message">{error}</div>}
              <button 
                onClick={handleLogin} 
                disabled={loading}
                className="login-button"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className="tiles-grid">
          {getCurrentTiles().map((tile, index) => {
            const Icon = tile.icon;
            return (
              <div
                key={tile.id}
                className={`xbox-tile ${index === selectedTile ? 'selected' : ''}`}
                onClick={() => handleTileClick(index)}
              >
                <div className="tile-content">
                  <Icon size={48} className="tile-icon" />
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
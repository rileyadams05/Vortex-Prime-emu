import React, { useState, useEffect } from 'react';
import { Disc, Pin, Clock, Gamepad2, Grid3x3, HelpCircle, Users, Settings } from 'lucide-react';
import axios from 'axios';
import '../styles/Xbox360Dashboard.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Xbox360Dashboard = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [xboxProfile, setXboxProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTile, setSelectedTile] = useState(0);

  useEffect(() => {
    fetchXboxProfile();
  }, []);

  const fetchXboxProfile = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/xbox/profile`);
      setXboxProfile(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching Xbox profile:', err);
      setError('Failed to load Xbox profile. Using demo profile.');
      // Fallback to demo profile
      setXboxProfile({
        gamertag: 'Xbox Gamer',
        gamerscore: 0,
        profilePicture: null
      });
    } finally {
      setLoading(false);
    }
  };

  const homeTiles = [
    { id: 'open-tray', title: 'Open Tray', icon: Disc, action: () => alert('Insert disc or mount ISO') },
    { id: 'my-pins', title: 'My Pins', icon: Pin, action: () => alert('My Pins') },
    { id: 'recent', title: 'Recent', icon: Clock, action: () => alert('Recent activities') },
    { id: 'my-games', title: 'My Games', icon: Gamepad2, action: () => alert('My Games library') },
    { id: 'my-apps', title: 'My Apps', icon: Grid3x3, action: () => alert('My Apps') },
    { id: 'need-help', title: 'Need Help?', icon: HelpCircle, action: () => window.open('https://support.xbox.com', '_blank') }
  ];

  const socialTiles = [
    { id: 'friends', title: 'Friends', icon: Users, action: () => alert('Friends list') },
    { id: 'activity', title: 'Activity Feed', icon: Clock, action: () => alert('Activity feed') },
    { id: 'messages', title: 'Messages', icon: Grid3x3, action: () => alert('Messages') },
    { id: 'parties', title: 'Parties', icon: Users, action: () => alert('Party chat') }
  ];

  const settingsTiles = [
    { id: 'display', title: 'Display & Sound', icon: Settings, action: () => alert('Display settings') },
    { id: 'network', title: 'Network', icon: Settings, action: () => alert('Network settings') },
    { id: 'storage', title: 'Storage', icon: Settings, action: () => alert('Storage management') },
    { id: 'system', title: 'System', icon: Settings, action: () => alert('System settings') }
  ];

  const getCurrentTiles = () => {
    switch (activeTab) {
      case 'social':
        return socialTiles;
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
        <div className="header-left">
          <div className="xbox-logo-text">Xbox</div>
        </div>
        <div className="header-right">
          {loading ? (
            <div className="profile-loading">Loading profile...</div>
          ) : (
            <div className="xbox-profile">
              <div className="profile-info">
                <div className="gamertag">{xboxProfile?.gamertag || 'Xbox Gamer'}</div>
                <div className="gamerscore">
                  <span className="score-icon">G</span>
                  <span className="score-value">{xboxProfile?.gamerscore || 0}</span>
                </div>
              </div>
              <div className="profile-avatar">
                {xboxProfile?.profilePicture ? (
                  <img src={xboxProfile.profilePicture} alt="Profile" />
                ) : (
                  <div className="avatar-placeholder">👤</div>
                )}
              </div>
            </div>
          )}
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
          className={`nav-tab ${activeTab === 'social' ? 'active' : ''}`}
          onClick={() => { setActiveTab('social'); setSelectedTile(0); }}
        >
          social
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
        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
};

export default Xbox360Dashboard;
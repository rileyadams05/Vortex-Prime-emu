import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, User, Settings, Gamepad2, Film, Users, Wifi } from 'lucide-react';
import { mockUserData, mockGames, mockMedia, mockFriends } from '../data/mockData';
import AnimatedBackground from '../components/AnimatedBackground';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const [activeBladeIndex, setActiveBladeIndex] = useState(0); // Start at "Games" (Index 0 now)
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const blades = [
    {
      id: 'games',
      title: 'Games',
      icon: Gamepad2,
      content: 'games'
    },
    {
      id: 'media',
      title: 'Media',
      icon: Film,
      content: 'media'
    },
    {
      id: 'system',
      title: 'System',
      icon: Settings,
      content: 'system'
    },
    {
      id: 'friends',
      title: 'Friends',
      icon: Users,
      content: 'friends'
    }
  ];

  const navigateBlade = (direction) => {
    if (direction === 'left' && activeBladeIndex > 0) {
      setActiveBladeIndex(activeBladeIndex - 1);
    } else if (direction === 'right' && activeBladeIndex < blades.length - 1) {
      setActiveBladeIndex(activeBladeIndex + 1);
    }
  };

  const navigateGame = (direction) => {
    if (direction === 'up' && selectedGameIndex > 0) {
      setSelectedGameIndex(selectedGameIndex - 1);
    } else if (direction === 'down' && selectedGameIndex < mockGames.length - 1) {
      setSelectedGameIndex(selectedGameIndex + 1);
    }
  };

  const navigateMedia = (direction) => {
    if (direction === 'up' && selectedMediaIndex > 0) {
      setSelectedMediaIndex(selectedMediaIndex - 1);
    } else if (direction === 'down' && selectedMediaIndex < mockMedia.length - 1) {
      setSelectedMediaIndex(selectedMediaIndex + 1);
    }
  };

  const renderBladeContent = (blade) => {
    switch (blade.content) {
      case 'games':
        return (
          <div className="blade-content games-blade">
            <div className="games-navigation">
              <button onClick={() => navigateGame('up')} className="nav-arrow-btn" disabled={selectedGameIndex === 0}>
                <ChevronLeft className="rotate-90" size={24} />
              </button>
            </div>
            <div className="games-list">
              {mockGames.map((game, index) => (
                <div
                  key={game.id}
                  className={`game-item ${index === selectedGameIndex ? 'selected' : ''} ${index < selectedGameIndex ? 'above' : ''} ${index > selectedGameIndex ? 'below' : ''}`}
                  onClick={() => setSelectedGameIndex(index)}
                >
                  <div className="game-icon">
                    <Gamepad2 size={32} />
                  </div>
                  <div className="game-info">
                    <div className="game-title">{game.title}</div>
                    {index === selectedGameIndex && (
                      <div className="game-details">
                        <div className="game-achievements">Achievements: {game.achievements}</div>
                        <div className="game-played">Last Played: {game.lastPlayed}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="games-navigation">
              <button onClick={() => navigateGame('down')} className="nav-arrow-btn" disabled={selectedGameIndex === mockGames.length - 1}>
                <ChevronRight className="rotate-90" size={24} />
              </button>
            </div>
          </div>
        );
      case 'media':
        return (
          <div className="blade-content media-blade">
            <div className="games-navigation">
              <button onClick={() => navigateMedia('up')} className="nav-arrow-btn" disabled={selectedMediaIndex === 0}>
                <ChevronLeft className="rotate-90" size={24} />
              </button>
            </div>
            <div className="media-list">
              {mockMedia.map((item, index) => (
                <div
                  key={item.id}
                  className={`media-item ${index === selectedMediaIndex ? 'selected' : ''} ${index < selectedMediaIndex ? 'above' : ''} ${index > selectedMediaIndex ? 'below' : ''}`}
                  onClick={() => setSelectedMediaIndex(index)}
                >
                  <div className="media-icon">
                    <Film size={32} />
                  </div>
                  <div className="media-info">
                    <div className="media-title">{item.title}</div>
                    {index === selectedMediaIndex && (
                      <div className="media-details">
                        <div className="media-type">{item.type}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="games-navigation">
              <button onClick={() => navigateMedia('down')} className="nav-arrow-btn" disabled={selectedMediaIndex === mockMedia.length - 1}>
                <ChevronRight className="rotate-90" size={24} />
              </button>
            </div>
          </div>
        );
      case 'system':
        return (
          <div className="blade-content">
            <div className="blade-menu-item" onClick={() => alert('Console Settings')}>Console Settings</div>
            <div className="blade-menu-item" onClick={() => alert('Family')}>Family</div>
            <div className="blade-menu-item" onClick={() => alert('Storage')}>Storage</div>
            <div className="blade-menu-item" onClick={() => alert('Network Settings')}>Network Settings</div>
            <div className="blade-menu-item" onClick={() => alert('System Info')}>System Info</div>
          </div>
        );
      case 'friends':
        return (
          <div className="blade-content friends-blade">
            {mockFriends.map((friend) => (
              <div key={friend.id} className="friend-item">
                <div className={`friend-status ${friend.online ? 'online' : 'offline'}`}></div>
                <div className="friend-avatar">
                  <User size={24} />
                </div>
                <div className="friend-info">
                  <div className="friend-name">{friend.name}</div>
                  <div className="friend-activity">{friend.activity}</div>
                </div>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="xbox-dashboard">
      <AnimatedBackground backgroundImage="/assets/wallpapers/vortex-prime-bg.jpg" />

      <div className="dashboard-header">
        <div className="header-left">
          <div className="user-avatar">
            <User size={48} />
          </div>
          <div className="user-info">
            <div className="gamertag">{mockUserData.gamertag}</div>
            <div className="gamer-score">
              <span className="score-label">Gamer Score:</span>
              <span className="score-value">{mockUserData.gamerScore}</span>
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="notification-badge">{mockUserData.notifications}</div>
          <div className="clock">
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </div>
        </div>
      </div>

      <div className="blades-container">
        <button
          className="blade-nav-button left"
          onClick={() => navigateBlade('left')}
          disabled={activeBladeIndex === 0}
        >
          <ChevronLeft size={48} />
        </button>

        <div className="blades-wrapper" style={{ transform: `translateX(-${activeBladeIndex * 400}px)` }}>
          {blades.map((blade, index) => {
            const Icon = blade.icon;
            return (
              <div
                key={blade.id}
                className={`blade ${index === activeBladeIndex ? 'active' : ''} ${index < activeBladeIndex ? 'passed' : ''} ${index > activeBladeIndex ? 'upcoming' : ''}`}
              >
                <div className="blade-header">
                  <Icon size={32} />
                  <h2 className="blade-title">{blade.title}</h2>
                </div>
                {renderBladeContent(blade)}
              </div>
            );
          })}
        </div>

        <button
          className="blade-nav-button right"
          onClick={() => navigateBlade('right')}
          disabled={activeBladeIndex === blades.length - 1}
        >
          <ChevronRight size={48} />
        </button>
      </div>

      <div className="dashboard-footer">
        <div className="blade-indicators">
          {blades.map((blade, index) => (
            <div
              key={blade.id}
              className={`blade-indicator ${index === activeBladeIndex ? 'active' : ''}`}
              onClick={() => setActiveBladeIndex(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

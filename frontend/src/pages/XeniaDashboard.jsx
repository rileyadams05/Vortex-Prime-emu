import React, { useState, useEffect } from 'react';
import { Search, Disc, Trophy, Folder, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { mockGames, mockAchievements } from '../data/xeniaData';
import '../styles/XeniaDashboard.css';

const XeniaDashboard = () => {
  const [currentView, setCurrentView] = useState('home');
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [gameCarouselIndex, setGameCarouselIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const mainCards = [
    { id: 'tray', title: 'OPEN TRAY', icon: Disc, action: () => alert('Insert disc or mount ISO') },
    { id: 'achievements', title: 'ACHIEVEMENTS', icon: Trophy, action: () => setCurrentView('achievements') },
    { id: 'library', title: 'GAME LIBRARY', icon: Folder, action: () => setCurrentView('gameLibrary') },
    { id: 'settings', title: 'SYSTEM SETTINGS', icon: Settings, action: () => setCurrentView('settings') }
  ];

  const handleCardSelect = (index) => {
    setSelectedCardIndex(index);
    mainCards[index].action();
  };

  const handleGameSelect = (game) => {
    setSelectedGame(game);
    setCurrentView('achievement');
  };

  const navigateCarousel = (direction) => {
    if (direction === 'left' && gameCarouselIndex > 0) {
      setGameCarouselIndex(gameCarouselIndex - 1);
    } else if (direction === 'right' && gameCarouselIndex < mockGames.length - 1) {
      setGameCarouselIndex(gameCarouselIndex + 1);
    }
  };

  const filteredGames = mockGames.filter(game => 
    game.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderHome = () => (
    <div className="xenia-home">
      <div className="home-header">
        <h1 className="my-xenia">MY XENIA</h1>
      </div>
      <div className="main-cards-container">
        {mainCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className={`main-card ${index === selectedCardIndex ? 'selected' : ''}`}
              onClick={() => handleCardSelect(index)}
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
        <button className="back-btn" onClick={() => setCurrentView('home')}>
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
    <div className="achievement-modal-overlay" onClick={() => setCurrentView('gameLibrary')}>
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

  return (
    <div className="xenia-dashboard">
      <div className="xenia-background">
        <div className="bg-overlay"></div>
      </div>

      <div className="xenia-header">
        <div className="header-spacer"></div>
        <div className="user-profile">
          <span className="gamertag">ALHROOBIX</span>
          <span className="gamerscore">800 G</span>
          <div className="user-avatar-circle">
            <div className="avatar-placeholder"></div>
          </div>
        </div>
      </div>

      <div className="xenia-content">
        {currentView === 'home' && renderHome()}
        {currentView === 'gameLibrary' && renderGameLibrary()}
        {currentView === 'achievement' && renderAchievementView()}
        {currentView === 'achievements' && renderGameLibrary()}
      </div>

      <div className="xenia-footer">
        <div className="footer-controls">
          <div className="control-item">
            <span className="btn-icon green">A</span>
            <span className="btn-label">Select</span>
          </div>
          <div className="control-item">
            <span className="btn-icon red">B</span>
            <span className="btn-label">Back</span>
          </div>
          <div className="control-item">
            <span className="btn-icon yellow">Y</span>
            <span className="btn-label">{currentView === 'gameLibrary' ? 'Delete Game' : 'Change Profile'}</span>
          </div>
          <div className="control-item">
            <span className="btn-icon blue">X</span>
            <span className="btn-label">Details</span>
          </div>
          {currentView === 'gameLibrary' && (
            <>
              <div className="control-item">
                <span className="btn-icon">LB</span>
                <span className="btn-label">Game Config</span>
              </div>
              <div className="control-item">
                <span className="btn-icon">RB</span>
                <span className="btn-label">Art Manager</span>
              </div>
            </>
          )}
          <div className="control-item">
            <span className="btn-icon">LB+Start</span>
            <span className="btn-label">Menu</span>
          </div>
        </div>
        <div className="xbox-logo">
          <div className="xbox-circle"></div>
        </div>
      </div>
    </div>
  );
};

export default XeniaDashboard;
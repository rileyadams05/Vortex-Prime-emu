import React, { useState, useEffect } from 'react';
import { Disc, Heart, Gamepad2, Settings, Trophy, Loader2 } from 'lucide-react';
import axios from 'axios';
import '../styles/Xbox360Dashboard.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Official Xbox Icon
const XboxIcon = () => (
  <svg viewBox="0 0 327 327" className="xbox-icon" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 0 C1.20765015 0.00506058 1.20765015 0.00506058 2.43969727 0.01022339 C15.55520185 0.08951181 28.10958902 0.93281491 40.8125 4.4375 C42.10051514 4.79158936 42.10051514 4.79158936 43.41455078 5.15283203 C61.61097876 10.34941826 79.60962228 18.05657478 94.8125 29.4375 C95.87984375 30.2109375 96.9471875 30.984375 98.046875 31.78125 C127.06044434 53.29982009 148.05056215 83.32541343 158.125 118 C158.47050903 119.18372192 158.47050903 119.18372192 158.82299805 120.39135742 C162.76669781 134.76668575 164.37179072 148.76614649 164.25 163.625 C164.24662628 164.4301001 164.24325256 165.2352002 164.23977661 166.06469727 C164.16048819 179.18020185 163.31718509 191.73458902 159.8125 204.4375 C159.57644043 205.29617676 159.34038086 206.15485352 159.09716797 207.03955078 C153.90058174 225.23597876 146.19342522 243.23462228 134.8125 258.4375 C134.0390625 259.50484375 133.265625 260.5721875 132.46875 261.671875 C110.95017991 290.68544434 80.92458657 311.67556215 46.25 321.75 C45.06627808 322.09550903 45.06627808 322.09550903 43.85864258 322.44799805 C29.48331425 326.39169781 15.48385351 327.99679072 0.625 327.875 C-0.1801001 327.87162628 -0.9852002 327.86825256 -1.81469727 327.86477661 C-14.93020185 327.78548819 -27.48458902 326.94218509 -40.1875 323.4375 C-41.04617676 323.20144043 -41.90485352 322.96538086 -42.78955078 322.72216797 C-60.98597876 317.52558174 -78.98462228 309.81842522 -94.1875 298.4375 C-95.25484375 297.6640625 -96.3221875 296.890625 -97.421875 296.09375 C-126.43544434 274.57517991 -147.42556215 244.54958657 -157.5 209.875 C-157.73033936 209.08585205 -157.96067871 208.2967041 -158.19799805 207.48364258 C-162.14169781 193.10831425 -163.74679072 179.10885351 -163.625 164.25 C-163.62162628 163.4448999 -163.61825256 162.6397998 -163.61477661 161.81030273 C-163.53548819 148.69479815 -162.69218509 136.14041098 -159.1875 123.4375 C-158.83341064 122.14948486 -158.83341064 122.14948486 -158.47216797 120.83544922 C-153.27558174 102.63902124 -145.56842522 84.64037772 -134.1875 69.4375 C-133.4140625 68.37015625 -132.640625 67.3028125 -131.84375 66.203125 C-110.32517991 37.18955566 -80.29958657 16.19943785 -45.625 6.125 C-44.83585205 5.89466064 -44.0467041 5.66432129 -43.23364258 5.42700195 C-28.85831425 1.48330219 -14.85885351 -0.12179072 0 0 Z " fill="#44AB19" transform="translate(163.1875,-0.4375)"/>
    <path d="M0 0 C3.9218254 1.3782415 6.49026187 3.82663428 9.546875 6.5859375 C10.12501953 7.09511719 10.70316406 7.60429687 11.29882812 8.12890625 C12.49438335 9.18310853 13.68610482 10.24167204 14.87426758 11.30419922 C16.7931339 13.01327218 18.73118594 14.69858437 20.671875 16.3828125 C24.84097875 20.0275734 28.89425033 23.7859734 32.921875 27.5859375 C33.65583496 28.27816406 34.38979492 28.97039062 35.14599609 29.68359375 C52.54995973 46.16161361 52.54995973 46.16161361 60.0703125 55.015625 C62.03576514 57.31326682 64.07167371 59.53966873 66.109375 61.7734375 C85.55797134 83.36467581 111.90933171 113.4904319 114.296875 144.0234375 C114.39162109 145.18552734 114.39162109 145.18552734 114.48828125 146.37109375 C111.25477669 157.47893584 92.37546698 167.32520913 82.859375 172.7109375 C71.08829719 179.1515799 59.0708277 184.52574473 46.171875 188.2734375 C44.98815308 188.61894653 44.98815308 188.61894653 43.78051758 188.97143555 C29.40518925 192.91513531 15.40572851 194.52022822 0.546875 194.3984375 C-0.66077515 194.39337692 -0.66077515 194.39337692 -1.89282227 194.38821411 C-15.00832685 194.30892569 -27.56271402 193.46562259 -40.265625 189.9609375 C-41.55364014 189.60684814 -41.55364014 189.60684814 -42.86767578 189.24560547 C-61.04091076 184.05564276 -79.1040376 176.3686243 -94.265625 164.9609375 C-94.84425293 164.52604004 -95.42288086 164.09114258 -96.01904297 163.64306641 C-100.17165751 160.50227847 -104.3025669 157.3392329 -108.265625 153.9609375 C-108.83418213 153.47987549 -109.40273926 152.99881348 -109.98852539 152.50317383 C-112.70072779 150.03603786 -114.10031739 148.60606103 -115.02734375 144.98828125 C-114.55769343 125.43599686 -102.50859522 107.34180519 -91.265625 91.9609375 C-90.61980469 91.04054688 -89.97398438 90.12015625 -89.30859375 89.171875 C-84.48377813 82.35227817 -79.18908944 75.99122663 -73.73632812 69.67431641 C-72.23885872 67.9297546 -70.75844349 66.1719069 -69.28125 64.41015625 C-62.94008568 56.87597755 -56.3290711 49.82352731 -49.265625 42.9609375 C-47.59752341 41.295707 -45.93109991 39.62879507 -44.265625 37.9609375 C-42.87534575 36.58168265 -41.48468455 35.20281275 -40.09375 33.82421875 C-38.56765324 32.3073471 -37.04161287 30.7904187 -35.515625 29.2734375 C-34.73574219 28.50193359 -33.95585937 27.73042969 -33.15234375 26.93554688 C-32.41113281 26.19755859 -31.66992188 25.45957031 -30.90625 24.69921875 C-30.23110352 24.02930908 -29.55595703 23.35939941 -28.86035156 22.66918945 C-27.18549453 21.03688787 -27.18549453 21.03688787 -26.265625 18.9609375 C-25.17894531 18.32285156 -25.17894531 18.32285156 -24.0703125 17.671875 C-20.79326042 15.67278195 -18.15303128 13.21865543 -15.390625 10.5859375 C-3.92863396 -0.06773507 -3.92863396 -0.06773507 0 0 Z " fill="#D1D1D1" transform="translate(163.265625,133.0390625)"/>
  </svg>
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
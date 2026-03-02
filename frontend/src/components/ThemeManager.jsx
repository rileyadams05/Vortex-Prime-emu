import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, Search, Palette, Check, Trash2, Plus, Image, Download } from 'lucide-react';
import { themeApi, steamGridApi } from '../services/apiServices';
import playSound from '../utils/soundManager';
import '../styles/ThemeManager.css';

const ThemeManager = ({ onBack, onThemeChange }) => {
  const [themes, setThemes] = useState({ active: [], disabled: [] });
  const [view, setView] = useState('list'); // list | create | studio
  const [loading, setLoading] = useState(true);
  const [activeTheme, setActiveTheme] = useState(null);

  // Studio state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSgdbGame, setSelectedSgdbGame] = useState(null);
  const [assets, setAssets] = useState({ grids: [], heroes: [], logos: [] });
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState({ grid: null, hero: null, logo: null });

  // Create form
  const [newTheme, setNewTheme] = useState({
    name: '', description: '', accent_color: '#90c31d',
    background_value: '#0a0c08', background_type: 'color',
  });

  const searchTimeout = useRef(null);

  const loadThemes = useCallback(async () => {
    setLoading(true);
    const data = await themeApi.listThemes();
    setThemes(data);
    const act = data.active?.[0] || null;
    setActiveTheme(act);
    setLoading(false);
  }, []);

  useEffect(() => { loadThemes(); }, [loadThemes]);

  const handleActivate = async (filename) => {
    playSound('select');
    await themeApi.activateTheme(filename);
    await loadThemes();
    if (onThemeChange) onThemeChange();
  };

  const handleDeactivate = async (filename) => {
    playSound('back');
    await themeApi.deactivateTheme(filename);
    await loadThemes();
    if (onThemeChange) onThemeChange();
  };

  const handleDelete = async (filename) => {
    playSound('back');
    await themeApi.deleteTheme(filename);
    await loadThemes();
  };

  const handleSearch = useCallback((term) => {
    setSearchTerm(term);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (term.length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      const data = await steamGridApi.searchGames(term);
      setSearchResults(data.results || []);
    }, 400);
  }, []);

  const handleSelectSgdbGame = async (game) => {
    playSound('select');
    setSelectedSgdbGame(game);
    setAssetsLoading(true);
    const data = await steamGridApi.getAssets(game.id);
    setAssets(data);
    setAssetsLoading(false);
    setSelectedAssets({ grid: null, hero: null, logo: null });
  };

  const handleCreateTheme = async () => {
    playSound('select');
    await themeApi.createTheme({
      ...newTheme,
      hero_url: selectedAssets.hero?.url || '',
      grid_url: selectedAssets.grid?.url || '',
      logo_url: selectedAssets.logo?.url || '',
      steamgriddb_game_id: selectedSgdbGame?.id || null,
    });
    setView('list');
    setNewTheme({ name: '', description: '', accent_color: '#90c31d', background_value: '#0a0c08', background_type: 'color' });
    setSelectedAssets({ grid: null, hero: null, logo: null });
    setSelectedSgdbGame(null);
    await loadThemes();
  };

  const allThemes = [
    ...(themes.active || []).map(t => ({ ...t, isActive: true })),
    ...(themes.disabled || []).map(t => ({ ...t, isActive: false })),
  ];

  const renderThemeList = () => (
    <div className="theme-list-view" data-testid="theme-list-view">
      <div className="theme-header">
        <button className="theme-back-btn" data-testid="theme-back-btn" onClick={() => { playSound('back'); onBack(); }}>
          <ChevronLeft size={20} /> Back
        </button>
        <h1 className="theme-title">THEMES</h1>
        <div className="theme-actions-top">
          <button className="theme-action-btn create-btn" data-testid="create-theme-btn" onClick={() => { playSound('select'); setView('create'); }}>
            <Plus size={16} /> New Theme
          </button>
          <button className="theme-action-btn studio-btn" data-testid="open-studio-btn" onClick={() => { playSound('select'); setView('studio'); }}>
            <Image size={16} /> Asset Studio
          </button>
        </div>
      </div>

      {loading ? (
        <div className="theme-loading">Loading themes...</div>
      ) : (
        <div className="theme-grid">
          {allThemes.map((theme) => (
            <div
              key={theme._filename}
              className={`theme-card ${theme.isActive ? 'active' : ''}`}
              data-testid={`theme-card-${theme.id}`}
              style={{ '--card-accent': theme.accent_color }}
            >
              <div className="theme-card-preview" style={{ background: theme.background?.value || '#0a0c08' }}>
                {theme.hero_url && <img src={theme.hero_url} alt="" className="theme-hero-img" />}
                {theme.logo_url && <img src={theme.logo_url} alt="" className="theme-logo-img" />}
                {!theme.hero_url && !theme.logo_url && (
                  <Palette size={40} style={{ color: theme.accent_color, opacity: 0.4 }} />
                )}
                {theme.isActive && (
                  <div className="theme-active-badge" data-testid="active-badge">
                    <Check size={14} /> ACTIVE
                  </div>
                )}
              </div>
              <div className="theme-card-info">
                <h3 className="theme-card-name">{theme.name}</h3>
                <p className="theme-card-desc">{theme.description}</p>
                <div className="theme-card-actions">
                  {theme.isActive ? (
                    <button className="theme-btn deactivate" data-testid={`deactivate-${theme.id}`} onClick={() => handleDeactivate(theme._filename)}>
                      Deactivate
                    </button>
                  ) : (
                    <button className="theme-btn activate" data-testid={`activate-${theme.id}`} onClick={() => handleActivate(theme._filename)}>
                      <Check size={14} /> Activate
                    </button>
                  )}
                  {!theme.isActive && (
                    <button className="theme-btn delete" data-testid={`delete-${theme.id}`} onClick={() => handleDelete(theme._filename)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="theme-accent-bar" style={{ background: theme.accent_color }} />
            </div>
          ))}
        </div>
      )}

      <div className="theme-footer-hint">
        <span className="hint-key">A</span> Select
        <span className="hint-key">B</span> Back
      </div>
    </div>
  );

  const renderCreateView = () => (
    <div className="theme-create-view" data-testid="theme-create-view">
      <div className="theme-header">
        <button className="theme-back-btn" onClick={() => { playSound('back'); setView('list'); }}>
          <ChevronLeft size={20} /> Back
        </button>
        <h1 className="theme-title">CREATE THEME</h1>
      </div>

      <div className="create-form">
        <div className="form-row">
          <label>Theme Name</label>
          <input
            type="text"
            data-testid="theme-name-input"
            value={newTheme.name}
            onChange={(e) => setNewTheme(p => ({ ...p, name: e.target.value }))}
            placeholder="My Custom Theme"
          />
        </div>
        <div className="form-row">
          <label>Description</label>
          <input
            type="text"
            data-testid="theme-desc-input"
            value={newTheme.description}
            onChange={(e) => setNewTheme(p => ({ ...p, description: e.target.value }))}
            placeholder="A brief description"
          />
        </div>
        <div className="form-row color-row">
          <div className="color-field">
            <label>Accent Color</label>
            <div className="color-input-wrap">
              <input
                type="color"
                data-testid="accent-color-input"
                value={newTheme.accent_color}
                onChange={(e) => setNewTheme(p => ({ ...p, accent_color: e.target.value }))}
              />
              <span>{newTheme.accent_color}</span>
            </div>
          </div>
          <div className="color-field">
            <label>Background</label>
            <div className="color-input-wrap">
              <input
                type="color"
                data-testid="bg-color-input"
                value={newTheme.background_value}
                onChange={(e) => setNewTheme(p => ({ ...p, background_value: e.target.value }))}
              />
              <span>{newTheme.background_value}</span>
            </div>
          </div>
        </div>

        {selectedAssets.hero && (
          <div className="form-row">
            <label>Selected Hero</label>
            <img src={selectedAssets.hero.thumb} alt="Hero" className="preview-thumb hero" />
          </div>
        )}
        {selectedAssets.grid && (
          <div className="form-row">
            <label>Selected Grid</label>
            <img src={selectedAssets.grid.thumb} alt="Grid" className="preview-thumb grid" />
          </div>
        )}

        <div className="form-actions">
          <button
            className="theme-btn activate wide"
            data-testid="save-theme-btn"
            disabled={!newTheme.name}
            onClick={handleCreateTheme}
          >
            <Plus size={16} /> Save Theme
          </button>
          <button className="theme-btn open-studio" onClick={() => { playSound('select'); setView('studio'); }}>
            <Image size={16} /> Add Art from SteamGridDB
          </button>
        </div>
      </div>
    </div>
  );

  const renderStudio = () => (
    <div className="theme-studio-view" data-testid="theme-studio-view">
      <div className="theme-header">
        <button className="theme-back-btn" onClick={() => { playSound('back'); setView(newTheme.name ? 'create' : 'list'); }}>
          <ChevronLeft size={20} /> Back
        </button>
        <h1 className="theme-title">ASSET STUDIO</h1>
      </div>

      <div className="studio-search">
        <Search size={18} />
        <input
          type="text"
          data-testid="sgdb-search-input"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search games on SteamGridDB..."
        />
      </div>

      {searchResults.length > 0 && !selectedSgdbGame && (
        <div className="studio-results" data-testid="sgdb-results">
          {searchResults.map(g => (
            <div key={g.id} className="sgdb-result-item" data-testid={`sgdb-result-${g.id}`} onClick={() => handleSelectSgdbGame(g)}>
              <span className="sgdb-name">{g.name}</span>
              {g.verified && <span className="sgdb-verified">Verified</span>}
            </div>
          ))}
        </div>
      )}

      {selectedSgdbGame && (
        <div className="studio-assets" data-testid="sgdb-assets-panel">
          <div className="studio-game-header">
            <h2>{selectedSgdbGame.name}</h2>
            <button className="theme-btn deactivate" onClick={() => { setSelectedSgdbGame(null); setAssets({ grids: [], heroes: [], logos: [] }); }}>
              Change Game
            </button>
          </div>

          {assetsLoading ? (
            <div className="theme-loading">Loading 4K assets...</div>
          ) : (
            <>
              {assets.heroes.length > 0 && (
                <div className="asset-section">
                  <h3>Heroes (Banners)</h3>
                  <div className="asset-row heroes-row">
                    {assets.heroes.map(h => (
                      <div
                        key={h.id}
                        className={`asset-thumb hero-thumb ${selectedAssets.hero?.id === h.id ? 'selected' : ''}`}
                        data-testid={`hero-${h.id}`}
                        onClick={() => { playSound('focus'); setSelectedAssets(p => ({ ...p, hero: h })); }}
                      >
                        <img src={h.thumb} alt="Hero" />
                        {selectedAssets.hero?.id === h.id && <div className="asset-check"><Check size={18} /></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {assets.grids.length > 0 && (
                <div className="asset-section">
                  <h3>Grids (Covers)</h3>
                  <div className="asset-row grids-row">
                    {assets.grids.map(g => (
                      <div
                        key={g.id}
                        className={`asset-thumb grid-thumb ${selectedAssets.grid?.id === g.id ? 'selected' : ''}`}
                        data-testid={`grid-${g.id}`}
                        onClick={() => { playSound('focus'); setSelectedAssets(p => ({ ...p, grid: g })); }}
                      >
                        <img src={g.thumb} alt="Grid" />
                        {selectedAssets.grid?.id === g.id && <div className="asset-check"><Check size={18} /></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {assets.logos.length > 0 && (
                <div className="asset-section">
                  <h3>Logos</h3>
                  <div className="asset-row logos-row">
                    {assets.logos.map(l => (
                      <div
                        key={l.id}
                        className={`asset-thumb logo-thumb ${selectedAssets.logo?.id === l.id ? 'selected' : ''}`}
                        data-testid={`logo-${l.id}`}
                        onClick={() => { playSound('focus'); setSelectedAssets(p => ({ ...p, logo: l })); }}
                      >
                        <img src={l.thumb} alt="Logo" />
                        {selectedAssets.logo?.id === l.id && <div className="asset-check"><Check size={18} /></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(selectedAssets.hero || selectedAssets.grid || selectedAssets.logo) && (
                <div className="studio-apply-bar">
                  <button
                    className="theme-btn activate wide"
                    data-testid="apply-assets-btn"
                    onClick={() => {
                      playSound('select');
                      setView(newTheme.name ? 'create' : 'create');
                      if (!newTheme.name) {
                        setNewTheme(p => ({ ...p, name: selectedSgdbGame.name + ' Theme' }));
                      }
                      setView('create');
                    }}
                  >
                    <Download size={16} /> Use Selected Assets in Theme
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="theme-manager" data-testid="theme-manager">
      {view === 'list' && renderThemeList()}
      {view === 'create' && renderCreateView()}
      {view === 'studio' && renderStudio()}
    </div>
  );
};

export default ThemeManager;

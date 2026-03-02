import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { ChevronLeft, Check, Trash2, Plus, Layout, Download, Upload, Grid3X3, LayoutGrid } from 'lucide-react';
import { themeApi } from '../services/apiServices';
import playSound from '../utils/soundManager';
import '../styles/ThemeManager.css';

const LAYOUT_ICONS = {
  default: Grid3X3,
  custom: LayoutGrid,
};

const ThemeManager = ({ onBack, onThemeChange }) => {
  const [themes, setThemes] = useState({ active: [], disabled: [] });
  const [loading, setLoading] = useState(true);

  const loadThemes = useCallback(async () => {
    setLoading(true);
    const data = await themeApi.listThemes();
    setThemes(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadThemes(); }, [loadThemes]);

  const handleActivate = async (folderName) => {
    playSound('select');
    await themeApi.activateTheme(folderName);
    await loadThemes();
    if (onThemeChange) onThemeChange();
  };

  const handleDeactivate = async (folderName) => {
    playSound('back');
    await themeApi.deactivateTheme(folderName);
    await loadThemes();
    if (onThemeChange) onThemeChange();
  };

  const handleDelete = async (folderName) => {
    playSound('back');
    await themeApi.deleteTheme(folderName);
    await loadThemes();
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    playSound('select');
    // Process dropped files - look for layout.json
    for (const file of acceptedFiles) {
      if (file.name === 'layout.json') {
        try {
          const text = await file.text();
          const layout = JSON.parse(text);
          if (layout.tiles && layout.name) {
            await themeApi.createTheme({
              name: layout.name,
              description: layout.description || 'Imported layout',
              tiles: layout.tiles,
              source: 'import',
              author: layout.author || 'Imported',
            });
            await loadThemes();
          }
        } catch (e) {
          console.error('Invalid layout.json:', e);
        }
      }
    }
  }, [loadThemes]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'] },
    noClick: true,
  });

  const allThemes = [
    ...(themes.active || []).map(t => ({ ...t, isActive: true })),
    ...(themes.disabled || []).map(t => ({ ...t, isActive: false })),
  ];

  const renderLayoutPreview = (layout) => {
    if (!layout || !layout.main_cards) return null;
    const cols = layout.grid_columns || 5;
    const rows = layout.grid_rows || 2;
    return (
      <div className="layout-preview-grid" style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}>
        {layout.main_cards.map((card) => (
          <div
            key={card.id}
            className="layout-preview-tile"
            style={{
              gridColumn: `${card.col + 1} / span ${card.width}`,
              gridRow: `${card.row + 1} / span ${card.height}`,
            }}
            title={card.title}
          >
            <span>{card.id === 'library' ? 'G' : card.id === 'settings' ? 'S' : card.id === 'achievements' ? 'A' : card.id === 'themes' ? 'T' : 'V'}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="theme-manager" data-testid="theme-manager" {...getRootProps()}>
      <input {...getInputProps()} />

      {isDragActive && (
        <div className="drop-overlay" data-testid="drop-overlay">
          <Upload size={48} />
          <p>Drop layout.json here</p>
        </div>
      )}

      <div className="theme-header">
        <button className="theme-back-btn" data-testid="theme-back-btn" onClick={() => { playSound('back'); onBack(); }}>
          <ChevronLeft size={20} /> Back
        </button>
        <h1 className="theme-title">DASHBOARD LAYOUTS</h1>
        <div className="theme-header-hint">
          <Layout size={14} />
          <span>Themes = Physical tile layouts, not color presets</span>
        </div>
      </div>

      {loading ? (
        <div className="theme-loading">Loading layouts...</div>
      ) : (
        <div className="theme-grid">
          {allThemes.map((theme) => {
            const LayoutIcon = LAYOUT_ICONS[theme.layout?.layout_mode] || Layout;
            return (
              <div
                key={theme.folder_name}
                className={`theme-card ${theme.isActive ? 'active' : ''}`}
                data-testid={`theme-card-${theme.folder_name}`}
              >
                <div className="theme-card-preview">
                  {renderLayoutPreview(theme.layout)}
                  {theme.isActive && (
                    <div className="theme-active-badge" data-testid="active-badge">
                      <Check size={14} /> ACTIVE
                    </div>
                  )}
                </div>
                <div className="theme-card-info">
                  <div className="theme-card-name-row">
                    <LayoutIcon size={16} className="layout-type-icon" />
                    <h3 className="theme-card-name">{theme.name}</h3>
                  </div>
                  <p className="theme-card-desc">{theme.description}</p>
                  <div className="theme-card-meta">
                    <span className="meta-source">{theme.source || 'local'}</span>
                    <span className="meta-author">by {theme.author}</span>
                  </div>
                  <div className="theme-card-actions">
                    {theme.isActive ? (
                      <button className="theme-btn deactivate" data-testid={`deactivate-${theme.folder_name}`} onClick={() => handleDeactivate(theme.folder_name)}>
                        Deactivate
                      </button>
                    ) : (
                      <button className="theme-btn activate" data-testid={`activate-${theme.folder_name}`} onClick={() => handleActivate(theme.folder_name)}>
                        <Check size={14} /> Activate
                      </button>
                    )}
                    {!theme.isActive && (
                      <button className="theme-btn delete" data-testid={`delete-${theme.folder_name}`} onClick={() => handleDelete(theme.folder_name)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="theme-card drop-card" data-testid="import-drop-zone">
            <div className="theme-card-preview drop-preview">
              <Download size={32} />
              <p>Drop layout.json<br/>to import</p>
            </div>
            <div className="theme-card-info">
              <h3 className="theme-card-name">Import Layout</h3>
              <p className="theme-card-desc">Drag a layout.json file here or from the marketplace</p>
            </div>
          </div>
        </div>
      )}

      <div className="theme-footer-hint">
        <span className="hint-key">A</span> Select
        <span className="hint-key">B</span> Back
      </div>
    </div>
  );
};

export default ThemeManager;

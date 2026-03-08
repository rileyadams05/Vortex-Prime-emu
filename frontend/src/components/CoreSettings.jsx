import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGamepad } from '../context/GamepadContext';
import playSound from '../utils/soundManager';
import { coreConfigApi } from '../services/apiServices';
import { CURATED_SECTIONS, SECTION_ORDER } from './coreSettingsConfig';
import { FileSearch, Globe, Save } from 'lucide-react';
import '../styles/CoreSettings.css';

// ─── Main Component ───────────────────────────────────────────────────────────
const CoreSettings = ({ onBack, preview = false, isActive = false }) => {
  const { onPress: onGamepadPress } = useGamepad();
  const [localConfig, setLocalConfig] = useState({});
  const [activeSection, setActiveSection] = useState('GLOBAL'); // Default to global config
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Game-specific config state
  const [gameConfigPath, setGameConfigPath] = useState(null);
  const [gameName, setGameName] = useState('');

  // ── Load config from backend ──
  const loadConfig = useCallback(async (path = null) => {
    setLoading(true);
    try {
      const data = await coreConfigApi.get(path);
      if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        throw new Error('Empty config');
      }

      // Map TOML sections based on the flat GLOBAL array
      const local = {};
      const globalSettings = CURATED_SECTIONS['GLOBAL'].settings;
      
      for (let j = 0; j < globalSettings.length; j++) {
        const { section, key } = globalSettings[j];
        if (!local[section]) local[section] = {};
        
        const rawSection = data[section] || {};
        if (key in rawSection) {
          local[section][key] = rawSection[key];
        }
      }
      
      // Store under GLOBAL for the activeSection to access it directly
      setLocalConfig(local);
      setIsDirty(false);
    } catch (e) {
      console.error('Failed to load config:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(gameConfigPath); }, [loadConfig, gameConfigPath]);

  // ── Save ──
  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    setSaveStatus('saving');
    try {
      await coreConfigApi.update(localConfig, gameConfigPath);
      setSaveStatus('saved');
      setIsDirty(false);
      playSound('panelUnfold');
      setTimeout(() => setSaveStatus(''), 2500);
    } catch (e) {
      console.error('Save failed:', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  }, [isDirty, localConfig, gameConfigPath]);

  // ── Change a setting ──
  const handleChange = useCallback((section, key, value) => {
    setLocalConfig(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
    setIsDirty(true);
  }, []);

  // ── Native Browser for Game Config ──
  const handleBrowseGameConfig = async () => {
    playSound('select');
    try {
      const result = await coreConfigApi.browse();
      if (result && result.path) {
        setGameConfigPath(result.path);
        setGameName(result.filename.replace('.toml', '').toUpperCase());
        playSound('panelUnfold');
      }
    } catch (e) {
      console.error('Native browser failed:', e);
      // Fallback or error UI?
    }
  };

  const clearGameConfig = () => {
    playSound('back');
    setGameConfigPath(null);
    setGameName('');
  };

  // ── Global save event from NXESettings X button ──
  useEffect(() => {
    const onGlobalSave = () => { if (isActive) handleSave(); };
    window.addEventListener('dashboard-save-settings', onGlobalSave);
    return () => window.removeEventListener('dashboard-save-settings', onGlobalSave);
  }, [isActive, handleSave]);

  // ── Keyboard nav ──
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSave();
        return;
      }
      const idx = SECTION_ORDER.indexOf(activeSection);
      if (e.key === 'ArrowUp') {
        setActiveSection(SECTION_ORDER[idx > 0 ? idx - 1 : SECTION_ORDER.length - 1]);
        playSound('focus');
      } else if (e.key === 'ArrowDown') {
        setActiveSection(SECTION_ORDER[idx < SECTION_ORDER.length - 1 ? idx + 1 : 0]);
        playSound('focus');
      } else if (e.key === 'x') {
        handleSave();
      } else if (e.key === 'y' && activeSection === 'GAME') {
        handleBrowseGameConfig();
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        onBack?.();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isActive, activeSection, handleSave, onBack]);

  // ── Gamepad ──
  useEffect(() => {
    if (!isActive) return;
    const unsub = onGamepadPress((event) => {
      if (event.type !== 'press') return;
      const idx = SECTION_ORDER.indexOf(activeSection);
      if (event.button === 'dpadUp' || event.button === 'stickUp') {
        setActiveSection(SECTION_ORDER[idx > 0 ? idx - 1 : SECTION_ORDER.length - 1]);
        playSound('focus');
      } else if (event.button === 'dpadDown' || event.button === 'stickDown') {
        setActiveSection(SECTION_ORDER[idx < SECTION_ORDER.length - 1 ? idx + 1 : 0]);
        playSound('focus');
      } else if (event.button === 'x') {
        handleSave();
      } else if (event.button === 'y' && activeSection === 'GAME') {
        handleBrowseGameConfig();
      } else if (event.button === 'b') {
        onBack?.();
      }
    });
    return unsub;
  }, [isActive, activeSection, handleSave, onBack, onGamepadPress]);

  if (loading) {
    return (
      <div className="core-settings-container">
        <div className="cs-loading">Loading Xenia Canary Config…</div>
      </div>
    );
  }

  const sectionMeta = CURATED_SECTIONS[activeSection];
  const sectionData = localConfig;

  return (
    <div className={`core-settings-container${preview ? ' preview-mode' : ''}`}>
      <div className="core-interface-wrapper">

        {/* Page title */}
        {!preview && (
          <div className="cs-page-title">
            {gameConfigPath ? `Applied for: ${gameName}` : 'Xenia Canary Config File'}
          </div>
        )}

        <div className="core-ui-box">
          {/* Sidebar */}
          <div className="core-sidebar">
            <SidebarList
              sections={SECTION_ORDER}
              curated={CURATED_SECTIONS}
              activeSection={activeSection}
              onSelect={(key) => { setActiveSection(key); playSound('focus'); }}
            />
          </div>

          {/* Content */}
          <div className="core-content">
            <div className="cs-section-header">
              <span className="cs-section-title">{sectionMeta.label}</span>
              <div className="cs-section-underline" />
            </div>

            {activeSection === 'GAME' ? (
              <div className="cs-game-dashboard">
                <div className="cs-game-status-box">
                  <div className="cs-status-icon">
                    {gameConfigPath ? <FileSearch size={48} color="#107C10" /> : <Globe size={48} color="#aaa" />}
                  </div>
                  <div className="cs-status-info">
                    <h3>{gameConfigPath ? 'Game Customization Active' : 'Global Settings Active'}</h3>
                    <p className="cs-path-text">{gameConfigPath || 'Using default Xenia core configuration.'}</p>
                  </div>
                </div>

                <div className="cs-game-actions">
                  <button className="cs-action-btn primary" onClick={handleBrowseGameConfig}>
                    <FileSearch size={20} />
                    <span>BROWSE FOLDERS</span>
                  </button>

                  {gameConfigPath && (
                    <button className="cs-action-btn secondary" onClick={clearGameConfig}>
                      <Globe size={20} />
                      <span>RESET TO GLOBAL</span>
                    </button>
                  )}
                </div>

                <div className="cs-instructions">
                  <p>Select a game-specific <strong>.toml</strong> file to apply custom overrides for just that title.</p>
                </div>
              </div>
            ) : (
              <div className="cs-settings-list">
                <SettingsList
                  settings={sectionMeta.settings}
                  data={sectionData}
                  section={activeSection}
                  onChange={handleChange}
                />
              </div>
            )}

            {saveStatus !== '' && (
              <div className={`cs-save-pill ${saveStatus}`}>
                {saveStatus === 'saving' ? '💾 Saving…' : saveStatus === 'saved' ? '✓ Saved' : '✗ Save failed'}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {!preview && (
          <div className="cs-footer">
            <div className="cs-footer-item">
              <div className="xbox-btn-circle green">A</div>
              <span>Select</span>
            </div>
            <div className="cs-footer-item" onClick={onBack} style={{ cursor: 'pointer' }}>
              <div className="xbox-btn-circle red">B</div>
              <span>Back</span>
            </div>
            <div className="cs-footer-item" onClick={handleSave} style={{ cursor: 'pointer' }}>
              <div className="xbox-btn-circle blue">X</div>
              <span>{isDirty ? 'Save *' : 'Save'}</span>
            </div>
            {activeSection === 'GAME' && (
              <div className="cs-footer-item" onClick={handleBrowseGameConfig} style={{ cursor: 'pointer' }}>
                <div className="xbox-btn-circle yellow">Y</div>
                <span>Browse Browser</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


// ─── Sidebar list — extracted to break Babel plugin traversal ─────────────────
function SidebarList({ sections, curated, activeSection, onSelect }) {
  const items = [];
  for (let i = 0; i < sections.length; i++) {
    const key = sections[i];
    items.push(
      <div
        key={key}
        className={`core-sidebar-item${activeSection === key ? ' active' : ''}`}
        onClick={() => onSelect(key)}
      >
        {'[ ' + curated[key].label + ' ]'}
      </div>
    );
  }
  return items;
}

// ─── Settings list — extracted to break Babel plugin traversal ────────────────
function SettingsList({ settings, data, section, onChange }) {
  const rows = [];
  let currentGroup = null;

  for (let i = 0; i < settings.length; i++) {
    const item = settings[i];
    
    // Group headers for cleanly displaying the unified GLOBAL settings
    if (item.section !== currentGroup) {
      currentGroup = item.section;
      rows.push(
        React.createElement('div', { key: `hdr-${currentGroup}`, className: 'cs-group-header', style: {
            marginTop: rows.length > 0 ? '20px' : '0',
            marginBottom: '10px',
            fontSize: '15px',
            color: '#107C10',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            borderBottom: '1px solid rgba(16, 124, 16, 0.4)',
            paddingBottom: '4px'
        } }, currentGroup)
      );
    }

    const value = data[item.section] ? data[item.section][item.key] : undefined;
    if (value === undefined) continue;
    rows.push(
      <SettingRow
        key={item.key}
        label={item.label}
        value={value}
        type={item.type}
        options={item.options}
        onChange={(v) => onChange(item.section, item.key, v)}
      />
    );
  }
  return rows;
}

function SettingRow({ label, value, type, options, onChange }) {
  let control;

  if (type === 'bool') {
    // Boolean is now handled by select in config, but keeping this for safety
    // Actually user said "everything as a drop-down bar"
    const optionEls = [
      React.createElement('option', { key: 'true', value: 'true' }, 'Enabled'),
      React.createElement('option', { key: 'false', value: 'false' }, 'Disabled')
    ];
    control = React.createElement(
      'select',
      {
        className: 'setting-input setting-select',
        value: String(value),
        onChange: (e) => onChange(e.target.value === 'true'),
      },
      ...optionEls
    );
  } else {
    // Use select for EVERYTHING else as requested
    const optionEls = (options || []).map((o) => {
      let label = o;
      if (o === '') label = '(default)';
      if (o === 0 && label !== '0') label = 'Off / Default';
      if (o === true) label = 'Enabled';
      if (o === false) label = 'Disabled';

      return React.createElement('option', { key: String(o), value: String(o) }, String(label))
    });

    control = React.createElement(
      'select',
      {
        className: 'setting-input setting-select',
        value: String(value !== undefined ? value : ''),
        onChange: (e) => {
          let val = e.target.value;
          // Convert types back
          if (val === 'true') val = true;
          else if (val === 'false') val = false;
          else if (!isNaN(val) && val !== '') val = Number(val);
          onChange(val);
        },
      },
      ...optionEls
    );
  }

  return React.createElement(
    'div',
    { className: 'setting-row' },
    React.createElement('span', { className: 'setting-label' }, label),
    React.createElement('div', { className: 'setting-control' }, control)
  );
}

export default CoreSettings;


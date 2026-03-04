import React, { useState, useEffect } from 'react';
import { useGamepad } from '../context/GamepadContext';
import playSound from '../utils/soundManager';
import { open } from '@tauri-apps/plugin-dialog';
import { coreConfigApi } from '../services/apiServices';
import '../styles/CoreSettings.css';

const CoreSettings = ({ onBack, preview = false }) => {
  const [config, setConfig] = useState({});
  const [activeSection, setActiveSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const [gameConfigPath, setGameConfigPath] = useState(null);

  // Fetch config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async (path = null) => {
    setLoading(true);
    try {
      // If path is provided, fetch specific game config, else fetch global core config
      const data = await coreConfigApi.get(path);
      
      // Validation: Ensure data is an object
      const validData = (data && typeof data === 'object') ? data : {};
      
      setConfig(validData);
      setGameConfigPath(path);
      
      // Active section logic moved to useEffect to ensure it runs after state update
    } catch (e) {
      console.error("Failed to load config", e);
      // Fallback for UI demonstration if API fails or is missing
      const fallbackData = {
          'APU': { 'apu': 'any', 'enable_xmp': true, 'debug': false },
          'CPU': { 'cpu': 'any', 'break_on_unhandled_instruction': true },
          'GPU': { 'gpu': 'any', 'vsync': true },
          'Display': { 'fullscreen': false, 'resolution': '1280x720' }
      };
      setConfig(fallbackData);
    } finally {
        setLoading(false);
    }
  };

  // Ensure an active section is always selected when config loads
  useEffect(() => {
      if (!loading && config && Object.keys(config).length > 0 && !activeSection) {
          const sections = Object.keys(config).filter(key => 
            config[key] && typeof config[key] === 'object' && !Array.isArray(config[key])
          ).sort();

          if (sections.includes('APU')) {
              setActiveSection('APU');
          } else if (sections.length > 0) {
              setActiveSection(sections[0]);
          }
      }
  }, [config, loading, activeSection]);

  const handleOpenGameConfig = async () => {
      if (preview) return;
      try {
          const selected = await open({
              multiple: false,
              filters: [{
                  name: 'Xenia Config',
                  extensions: ['config.toml', 'toml']
              }]
          });
          
          if (selected) {
              console.log("Selected config file:", selected);
              loadConfig(selected);
          }
      } catch (err) {
          console.error("Failed to open file dialog", err);
          // Fallback for browser mode (non-Tauri) or error
          alert("Could not open file picker. Ensure you are running in Tauri or check console.");
      }
  };

  const handleSave = async () => {
    if (preview) return;
    try {
      await coreConfigApi.update(config, gameConfigPath || null);
      playSound('success');
      setIsEditing(false);
    } catch (e) {
      console.error("Failed to save", e);
      playSound('error');
    }
  };

  const handleSettingChange = (section, key, value) => {
    if (preview) return;
    if (!isEditing) return;
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  // Interaction Handlers
  const handleSectionHover = (section) => {
    if (!isEditing) {
      setActiveSection(section);
      if (!preview) playSound('move');
    }
  };

  const handleSelect = () => {
    if (preview) return; // In preview mode, clicks do nothing (handled by parent to open modal)
    if (!isEditing) {
      setIsEditing(true);
      playSound('select');
    }
  };

  // Gamepad handling
  useGamepad({
    onPress: (button) => {
      if (preview) return; // No gamepad control in preview mode
      if (button === 'A') handleSelect();
      if (button === 'B') {
          if (isEditing) {
              setIsEditing(false);
              playSound('back');
          } else {
              onBack(); // Let parent handle back
          }
      }
      if (button === 'X') handleSave();
    }
  });

  if (loading) return <div style={{padding: '20px'}}>Loading...</div>;

  const sections = Object.keys(config).filter(key => 
    config[key] && typeof config[key] === 'object' && !Array.isArray(config[key])
  ).sort();

  return (
    <div className={`core-settings-container ${preview ? 'preview-mode' : ''}`} style={preview ? { pointerEvents: 'none' } : {}}>
      
      <div className="core-interface-wrapper">
        {/* Header matches the screenshot text */}
        {!preview && (
        <div className="core-header-area" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <div className="core-title">
                    {gameConfigPath ? 'Core Configuration: Game Settings' : 'Core Configuration'}
                </div>
                <div className="core-description">
                    {gameConfigPath 
                        ? `Editing configuration file: ${gameConfigPath}` 
                        : 'Configure core system settings including emulator paths, game folders, and metadata sources.'
                    }
                </div>
            </div>
            <div style={{display: 'flex', gap: '10px'}}>
                {gameConfigPath && (
                    <button 
                        onClick={() => loadConfig(null)} // Reset to global
                        style={{
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#aaa',
                            padding: '8px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        Back to Global
                    </button>
                )}
                <button 
                    onClick={handleOpenGameConfig}
                    style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                    }}
                >
                    Load Game Config
                </button>
            </div>
        </div>
        )}
        
        {/* Removed Manual Modal code as we use File Picker now */}
        
        <div className="core-ui-box" style={preview ? { border: 'none', background: 'transparent' } : {}}>
            {/* Sidebar */}
            <div className="core-sidebar" style={preview ? { background: 'transparent', borderRight: '1px solid rgba(255,255,255,0.1)' } : {}}>
            {sections.map(section => (
                <div 
                key={section}
                className={`core-sidebar-item ${activeSection === section ? 'active' : ''}`}
                onMouseEnter={() => handleSectionHover(section)}
                onClick={handleSelect}
                style={{ opacity: isEditing && activeSection !== section ? 0.5 : 1 }}
                >
                [ {section} ]
                </div>
            ))}
            </div>

            {/* Content */}
            <div className="core-content">
            {activeSection && (
                <>
                    <div className="core-section-header">{activeSection} Settings</div>
                    
                    {config[activeSection] && Object.entries(config[activeSection]).map(([key, value]) => (
                        <div key={key} className="setting-row">
                            <div className="setting-label">{key}</div>
                            <div className="setting-control">
                                {typeof value === 'boolean' ? (
                                    <div 
                                    className={`toggle-switch ${value ? 'on' : ''} disabled`}
                                    onClick={() => !preview && handleSettingChange(activeSection, key, !value)}
                                    >
                                    <div className="toggle-handle" />
                                    </div>
                                ) : (
                                    <input 
                                    className="setting-input"
                                    value={value}
                                    disabled={true} // Always disabled in preview
                                    onChange={(e) => {
                                        let val = e.target.value;
                                        if (!isNaN(val) && val.trim() !== '') {
                                            if (!val.endsWith('.')) {
                                                val = Number(val);
                                            }
                                        }
                                        handleSettingChange(activeSection, key, val);
                                    }}
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </>
            )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default CoreSettings;

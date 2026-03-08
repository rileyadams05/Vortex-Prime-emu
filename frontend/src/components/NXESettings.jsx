import React, { useState, useEffect, useRef } from 'react';
import { useGamepad } from '../context/GamepadContext';
import { useTheme } from '../context/ThemeContext';
import playSound from '../utils/soundManager';
import { AlertCircle, Volume2, Globe, Moon, Palette, Cpu } from 'lucide-react';
import GamepadDiagnostic from './GamepadDiagnostic';
import LanguageSettings from './LanguageSettings';
import SoundSettings from './SoundSettings';
import CoreSettings from './CoreSettings';
import ColorSettings from './ColorSettings';
import '../styles/NXESettings.css';


const NXESettings = ({ isActive, onBack }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activePanel, setActivePanel] = useState(null); // Default to null (Sidebar active)
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // 'saving', 'saved'
  const [countryCode, setCountryCode] = useState('AU');
  const listRef = useRef(null);
  const { onPress: onGamepadPress } = useGamepad();
  const { changeTheme } = useTheme();

  // Load initial country code
  useEffect(() => {
    const loadCountry = async () => {
      try {
        const { settingsApi } = await import('../services/apiServices');
        const saved = await settingsApi.get();
        if (saved && saved.country) setCountryCode(saved.country);
      } catch (e) {
        console.error("NXESettings: Failed to load country:", e);
      }
    };
    loadCountry();
  }, []);

  const dynamicSettingsItems = [
    { id: 'core', label: 'Core Configuration', icon: AlertCircle, description: 'Configure core system settings including emulator paths, game folders, and metadata sources. Set up your Xenia installation and scanning preferences.' },
    { id: 'sunshine', label: 'Sunshine', icon: Moon, description: 'Configure Sunshine as a game streaming host on your PC. Allows remote devices to connect and stream games from this machine.' },
    { id: 'sound', label: 'Sound Settings', icon: Volume2, description: 'Configure UI sound effects, navigation sounds, and background music volume. Enable or disable individual audio channels.' },
    { id: 'country', label: 'Country', icon: Globe, description: 'Change the display country/region for the dashboard interface.', badge: countryCode },
    { id: 'color', label: 'Theme Color', icon: Palette, description: 'Change the global accent color for the dashboard interface.' },
  ];

  const handleSave = () => {
    playSound('select');
    setIsSaving(true);
    setSaveStatus('saving');

    // Trigger save on active sub-components
    window.dispatchEvent(new Event('dashboard-save-settings'));

    // Sequence: Saving (2s) -> Ready to Restart
    setTimeout(() => {
      setSaveStatus('saved');
      playSound('panelUnfold'); // Success sound
    }, 2000);
  };

  const handleRestart = async () => {
    playSound('select');
    try {
      if (window.__TAURI__) {
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      } else {
        console.log("Web Preview: App restart simulated.");
        window.location.reload();
      }
    } catch (e) {
      console.error("Restart failed:", e);
      setIsSaving(false);
      setSaveStatus('');
    }
  };

  const handleDefault = () => {
    playSound('select');
    if (activePanel === 'color' || settingsItems[selectedIndex].id === 'color') {
      changeTheme('#107C10');
    } else {
      console.log("Restored to default");
      // Could add a similar overlay for restore if desired
    }
  };

  useEffect(() => {
    if (!isActive) {
      setActivePanel(null);
    }
  }, [isActive]);

  useEffect(() => {
    if (activePanel === null) {
      // ...
    }
  }, [activePanel]);

  useEffect(() => {
    if (!isActive || isSaving) return; // Block input during saving

    const handleKeyDown = (e) => {
      // If saving, block all input
      if (isSaving) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      // Handle Ctrl+S globally
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
        return;
      }

      // Ignore standard key bindings if user is focused on an input or textarea
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') {
          document.activeElement.blur();
        }
        return; // Let the input type naturally
      }

      e.stopPropagation();

      switch (e.key) {
        case 'ArrowUp':
          playSound('focus');
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : dynamicSettingsItems.length - 1));
          break;
        case 'ArrowDown':
          playSound('focus');
          setSelectedIndex(prev => (prev < dynamicSettingsItems.length - 1 ? prev + 1 : 0));
          break;
        case 'q': // LB
          playSound('focus');
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : dynamicSettingsItems.length - 1));
          break;
        case 'e': // RB
          playSound('focus');
          setSelectedIndex(prev => (prev < dynamicSettingsItems.length - 1 ? prev + 1 : 0));
          break;
        case 'x':
          handleSave();
          break;
        case 'y':
          handleDefault();
          break;
        case 'Enter':
          playSound('select');
          if (dynamicSettingsItems[selectedIndex].id === 'country') {
            setActivePanel('country');
          } else if (dynamicSettingsItems[selectedIndex].id === 'sound') {
            setActivePanel('sound');
          } else if (dynamicSettingsItems[selectedIndex].id === 'core') {
            setActivePanel('core');
          } else if (dynamicSettingsItems[selectedIndex].id === 'color') {
            setActivePanel('color');
          }
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          e.stopImmediatePropagation(); // Prevent dashboard from seeing this
          playSound('back');
          if (activePanel) {
            setActivePanel(null);
          } else {
            onBack();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isActive, selectedIndex, onBack, activePanel, isSaving]);

  const selectedRef = useRef(selectedIndex);
  const activePanelRef = useRef(activePanel);
  useEffect(() => { selectedRef.current = selectedIndex; }, [selectedIndex]);
  useEffect(() => { activePanelRef.current = activePanel; }, [activePanel]);

  useEffect(() => {
    if (!isActive || isSaving) return;
    const unsub = onGamepadPress((event) => {
      if (event.type !== 'press') return;

      if (activePanelRef.current) {
        if (activePanelRef.current === 'country' || activePanelRef.current === 'sound' || activePanelRef.current === 'core' || activePanelRef.current === 'color') return;

        if (event.button === 'b') {
          playSound('back');
          setActivePanel(null);
        }
        return;
      }

      if (event.button === 'dpadUp' || event.button === 'stickUp') {
        playSound('focus');
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : dynamicSettingsItems.length - 1));
      }
      if (event.button === 'dpadDown' || event.button === 'stickDown') {
        playSound('focus');
        setSelectedIndex(prev => (prev < dynamicSettingsItems.length - 1 ? prev + 1 : 0));
      }
      if (event.button === 'lb') {
        playSound('focus');
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : dynamicSettingsItems.length - 1));
      }
      if (event.button === 'rb') {
        playSound('focus');
        setSelectedIndex(prev => (prev < dynamicSettingsItems.length - 1 ? prev + 1 : 0));
      }
      if (event.button === 'x') {
        handleSave();
      }
      if (event.button === 'y') {
        handleDefault();
      }
      if (event.button === 'a') {
        playSound('select');
        const currentItem = dynamicSettingsItems[selectedRef.current];
        if (currentItem && currentItem.id === 'country') {
          setActivePanel('country');
        } else if (currentItem && currentItem.id === 'sound') {
          setActivePanel('sound');
        } else if (currentItem && currentItem.id === 'core') {
          setActivePanel('core');
        } else if (currentItem && currentItem.id === 'color') {
          setActivePanel('color');
        }
      }
      if (event.button === 'b') {
        playSound('back');
        onBack();
      }
    });
    return unsub;
  }, [isActive, onGamepadPress, onBack, isSaving]);

  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIndex];
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isActive) return null;

  const currentItem = dynamicSettingsItems[selectedIndex];

  return (
    <div className="nxe-settings-container" data-testid="nxe-settings">
      <div className="nxe-settings-title">Settings</div>

      <div className="nxe-settings-body">
        {/* Saving Overlay */}
        {isSaving && (
          <div className="nxe-loading-overlay">
            {saveStatus === 'saving' ? (
              <div className="nxe-dialog-box animate-scale-in">
                <div className="nxe-spinner"></div>
                <div className="nxe-saving-text">Please Wait... Saving</div>
                <div className="nxe-saving-subtext">Do not turn off your console.</div>
              </div>
            ) : (
              <div className="nxe-dialog-box animate-scale-in">
                <div className="nxe-saving-text" style={{ color: '#107C10' }}>Done Saving!</div>
                <div className="nxe-saving-subtext" style={{ marginBottom: '20px' }}>The settings have been applied successfully.</div>

                <button
                  className="nxe-confirm-btn"
                  onClick={handleRestart}
                  autoFocus
                >
                  OK (RESTART)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Left: Sidebar */}
        <div className="nxe-sidebar" ref={listRef}>
          {dynamicSettingsItems.map((item, index) => (
            <div
              key={item.id}
              className={`nxe-sidebar-item ${selectedIndex === index ? 'active' : ''} ${activePanel === item.id ? 'entered' : ''}`}
              onClick={() => {
                playSound('select');
                setSelectedIndex(index);
                setActivePanel(item.id);
              }}
              onMouseEnter={() => {
                if (!activePanel) setSelectedIndex(index);
              }}
            >
              <item.icon size={20} className="nxe-sidebar-icon" />
              <span className="nxe-sidebar-label">{item.label}</span>
              {item.badge && <span className="nxe-sidebar-badge">{item.badge}</span>}
            </div>
          ))}
        </div>

        {/* Right: Content Pane */}
        <div className="nxe-content-pane" data-testid="settings-content-pane">
          <div className="nxe-content-inner">
            <h2 className="nxe-content-title">{dynamicSettingsItems[selectedIndex].label}</h2>
            <p className="nxe-content-desc">{dynamicSettingsItems[selectedIndex].description}</p>

            <div className={`settings-preview-mount ${activePanel ? 'deep-focus' : ''}`}>
              {dynamicSettingsItems[selectedIndex].id === 'core' && (
                <CoreSettings preview={true} isActive={activePanel === 'core'} onBack={() => { playSound('back'); setActivePanel(null); }} />
              )}
              {dynamicSettingsItems[selectedIndex].id === 'country' && (
                <LanguageSettings
                  preview={true}
                  isActive={activePanel === 'country'}
                  onBack={() => { playSound('back'); setActivePanel(null); }}
                  onSelect={(v) => setCountryCode(v.code)}
                />
              )}
              {dynamicSettingsItems[selectedIndex].id === 'sound' && (
                <SoundSettings preview={true} isActive={activePanel === 'sound'} onBack={() => { playSound('back'); setActivePanel(null); }} />
              )}
              {dynamicSettingsItems[selectedIndex].id === 'color' && (
                <ColorSettings preview={true} isActive={activePanel === 'color'} onBack={() => { playSound('back'); setActivePanel(null); }} />
              )}
              {dynamicSettingsItems[selectedIndex].id === 'sunshine' && (
                <div style={{ color: '#aaa', padding: '20px', height: '100%' }}>Sunshine configuration coming soon.</div>
              )}

              {activePanel ? (
                <div className="nxe-enter-hint" style={{ color: '#fff' }}>
                  Press B to return to list
                  {activePanel === 'core' && ' | Press X to Save'}
                </div>
              ) : (
                <div className="nxe-enter-hint">Press A to enter & edit</div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="nxe-footer" data-testid="settings-footer">
        <div className="nxe-footer-item" style={{ cursor: 'default' }}>
          <div className="xbox-btn-bumper">LB</div>
          <div className="xbox-btn-bumper">RB</div>
          <span>Tabs</span>
        </div>
        <div className="nxe-footer-item" onClick={handleSave} style={{ cursor: 'pointer' }}>
          <div className="xbox-btn-circle blue">X</div>
          <span>Save</span>
        </div>
        <div className="nxe-footer-item" onClick={handleDefault} style={{ cursor: 'pointer' }}>
          <div className="xbox-btn-circle yellow">Y</div>
          <span>Default</span>
        </div>
        <div className="nxe-footer-item" onClick={() => {
          playSound('select');
          if (dynamicSettingsItems[selectedIndex].id === 'country') {
            setActivePanel('country');
          } else if (dynamicSettingsItems[selectedIndex].id === 'sound') {
            setActivePanel('sound');
          } else if (dynamicSettingsItems[selectedIndex].id === 'core') {
            setActivePanel('core');
          } else if (dynamicSettingsItems[selectedIndex].id === 'color') {
            setActivePanel('color');
          }
        }} style={{ cursor: 'pointer' }}>
          <div className="xbox-btn-circle green">A</div>
          <span>Select</span>
        </div>
        <div className="nxe-footer-item" onClick={() => { playSound('back'); setActivePanel(null); if (!activePanel) onBack(); }} style={{ cursor: 'pointer' }}>
          <div className="xbox-btn-circle red">B</div>
          <span>{activePanel ? 'Back to Settings' : 'Back to Dashboard'}</span>
        </div>
      </div>
    </div>
  );
};

export default NXESettings;

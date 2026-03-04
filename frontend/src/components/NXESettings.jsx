import React, { useState, useEffect, useRef } from 'react';
import { useGamepad } from '../context/GamepadContext';
import playSound from '../utils/soundManager';
import { AlertCircle, Volume2, Globe, Moon, Palette } from 'lucide-react';
import GamepadDiagnostic from './GamepadDiagnostic';
import LanguageSettings from './LanguageSettings';
import SoundSettings from './SoundSettings';
import CoreSettings from './CoreSettings';
import ColorSettings from './ColorSettings';
import '../styles/NXESettings.css';

const settingsItems = [
  { id: 'core', label: 'Core Configuration', icon: AlertCircle, description: 'Configure core system settings including emulator paths, game folders, and metadata sources. Set up your Xenia installation and scanning preferences.' },
  { id: 'sunshine', label: 'Sunshine', icon: Moon, description: 'Configure Sunshine as a game streaming host on your PC. Allows remote devices to connect and stream games from this machine.' },
  { id: 'sound', label: 'Sound Settings', icon: Volume2, description: 'Configure UI sound effects, navigation sounds, and background music volume. Enable or disable individual audio channels.' },
  { id: 'country', label: 'Country', icon: Globe, description: 'Change the display country/region for the dashboard interface. Currently set to Australia (AU).', badge: 'AU' },
  { id: 'color', label: 'Theme Color', icon: Palette, description: 'Change the global accent color for the dashboard interface.' },
];

const NXESettings = ({ isActive, onBack }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activePanel, setActivePanel] = useState(null); // Default to null (Sidebar active)
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // 'saving', 'saved'
  const listRef = useRef(null);
  const { onPress: onGamepadPress } = useGamepad();

  const handleSave = () => {
    playSound('select');
    setIsSaving(true);
    setSaveStatus('saving');
    
    // Simulate save delay
    setTimeout(() => {
        setSaveStatus('saved');
        playSound('panelUnfold'); // Success sound
        setTimeout(() => {
            setIsSaving(false);
            setSaveStatus('');
        }, 1500);
    }, 2000);
  };

  const handleDefault = () => {
    playSound('select');
    console.log("Restored to default");
    // Could add a similar overlay for restore if desired, but user only asked for save
  };

  useEffect(() => {
    if (activePanel === null) {
        // ...
    }
  }, [activePanel]);

  useEffect(() => {
    if (!isActive || isSaving) return; // Block input during saving

    const handleKeyDown = (e) => {
      if (activePanel) {
        if (activePanel === 'language' || activePanel === 'sound') return;

        if (e.key === 'Escape' || e.key === 'Backspace') {
          e.stopPropagation();
          playSound('back');
          setActivePanel(null);
        }
        return;
      }

      e.stopPropagation();
      
      switch (e.key) {
        case 'ArrowUp':
          playSound('focus');
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : settingsItems.length - 1));
          break;
        case 'ArrowDown':
          playSound('focus');
          setSelectedIndex(prev => (prev < settingsItems.length - 1 ? prev + 1 : 0));
          break;
        case 'q': // LB
          playSound('focus');
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : settingsItems.length - 1));
          break;
        case 'e': // RB
          playSound('focus');
          setSelectedIndex(prev => (prev < settingsItems.length - 1 ? prev + 1 : 0));
          break;
        case 'x':
          handleSave();
          break;
        case 'y':
          handleDefault();
          break;
        case 'Enter':
          playSound('select');
          if (settingsItems[selectedIndex].id === 'country') {
            setActivePanel('country');
          } else if (settingsItems[selectedIndex].id === 'sound') {
            setActivePanel('sound');
          } else if (settingsItems[selectedIndex].id === 'core') {
            setActivePanel('core');
          } else if (settingsItems[selectedIndex].id === 'color') {
            setActivePanel('color');
          }
          break;
        case 'Escape':
        case 'Backspace':
          playSound('back');
          onBack();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : settingsItems.length - 1));
      }
      if (event.button === 'dpadDown' || event.button === 'stickDown') {
        playSound('focus');
        setSelectedIndex(prev => (prev < settingsItems.length - 1 ? prev + 1 : 0));
      }
      if (event.button === 'lb') {
        playSound('focus');
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : settingsItems.length - 1));
      }
      if (event.button === 'rb') {
        playSound('focus');
        setSelectedIndex(prev => (prev < settingsItems.length - 1 ? prev + 1 : 0));
      }
      if (event.button === 'x') {
        handleSave();
      }
      if (event.button === 'y') {
        handleDefault();
      }
      if (event.button === 'a') {
        playSound('select');
        const currentItem = settingsItems[selectedRef.current];
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

  const currentItem = settingsItems[selectedIndex];
  // const CurrentIcon = currentItem.icon; // Unused variable

  return (
    <div className="nxe-settings-container" data-testid="nxe-settings">
      <div className="nxe-settings-title">Settings</div>

      <div className="nxe-settings-body">
        {/* Saving Overlay */}
        {isSaving && (
            <div className="nxe-loading-overlay">
                {saveStatus === 'saving' ? (
                    <>
                        <div className="nxe-spinner"></div>
                        <div className="nxe-saving-text">Saving Settings...</div>
                        <div className="nxe-saving-subtext">Please wait. Do not turn off your console.</div>
                    </>
                ) : (
                    <>
                         <div className="nxe-saving-text" style={{ color: '#91C300' }}>Saved!</div>
                    </>
                )}
            </div>
        )}

        {/* Left: Sidebar */}
        <div className="nxe-sidebar" ref={listRef}>
          {settingsItems.map((item, index) => (
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

        {/* Right: Content Pane (Now renders active panel as a Modal Overlay) */}
        {activePanel && (
            <div className="nxe-modal-overlay">
                <div className="nxe-modal-content">
                    {/* Header inside modal if needed, or rely on component headers */}
                    {activePanel === 'country' ? (
                        <LanguageSettings isActive={true} onBack={() => { playSound('back'); setActivePanel(null); }} />
                    ) : activePanel === 'sound' ? (
                        <SoundSettings isActive={true} onBack={() => { playSound('back'); setActivePanel(null); }} />
                    ) : activePanel === 'color' ? (
                        <ColorSettings isActive={true} onBack={() => { playSound('back'); setActivePanel(null); }} />
                    ) : (
                        <CoreSettings isActive={true} onBack={() => { playSound('back'); setActivePanel(null); }} />
                    )}
                </div>
            </div>
        )}
        
        {/* If no active panel, we can show a placeholder or description in the right pane if we want to keep the 2-pane look for the main menu */}
        {!activePanel && (
             <div className="nxe-content-pane" data-testid="settings-content-pane">
                 <div className="nxe-content-inner">
                    <h2 className="nxe-content-title">{settingsItems[selectedIndex].label}</h2>
                    <p className="nxe-content-desc">{settingsItems[selectedIndex].description}</p>
                    <div className="nxe-enter-hint">Press A to configure</div>
                 </div>
             </div>
        )}

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
          if (settingsItems[selectedIndex].id === 'country') {
            setActivePanel('country');
          } else if (settingsItems[selectedIndex].id === 'sound') {
            setActivePanel('sound');
          } else if (settingsItems[selectedIndex].id === 'core') {
            setActivePanel('core');
          } else if (settingsItems[selectedIndex].id === 'color') {
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

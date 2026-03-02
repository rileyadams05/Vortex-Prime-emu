import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGamepad } from '../context/GamepadContext';
import playSound from '../utils/soundManager';
import { Settings, Monitor, Wifi, HardDrive, Globe, Gamepad2, Info } from 'lucide-react';
import GamepadDiagnostic from './GamepadDiagnostic';
import '../styles/NXESettings.css';

const NXESettings = ({ isActive, onBack }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activePanel, setActivePanel] = useState(null); // null = list, 'controller' = diagnostic
  const listRef = useRef(null);
  const { onPress: onGamepadPress } = useGamepad();

  const settingsItems = [
    { id: 'console', label: 'Console Settings', icon: Settings, description: 'Configure console settings, including audio, language, and locale.' },
    { id: 'display', label: 'Display', icon: Monitor, description: 'Adjust screen resolution, color space, and other display options.' },
    { id: 'network', label: 'Network Settings', icon: Wifi, description: 'Connect to Xbox Live, test your connection, and configure network settings.' },
    { id: 'storage', label: 'Storage', icon: HardDrive, description: 'Manage game saves, profiles, and other data on your storage devices.' },
    { id: 'global', label: 'Global Settings', icon: Globe, description: 'Set system-wide preferences for all users.' },
    { id: 'game', label: 'Game Settings', icon: Gamepad2, description: 'Manage game-specific settings and defaults.' },
    { id: 'controller', label: 'Controller Diagnostic', icon: Gamepad2, description: 'Test and diagnose your controller connection. Supports Gamepad API and WebHID fallback.' },
    { id: 'about', label: 'System Info', icon: Info, description: 'View console serial number, ID, and other system information.' }
  ];

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      // If diagnostic panel is open, let it handle its own input
      if (activePanel === 'controller') {
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
        case 'Enter':
          playSound('select');
          if (settingsItems[selectedIndex].id === 'controller') {
            setActivePanel('controller');
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
  }, [isActive, selectedIndex, onBack, activePanel, settingsItems]);

  // Gamepad input for settings
  const selectedRef = useRef(selectedIndex);
  const activePanelRef = useRef(activePanel);
  useEffect(() => { selectedRef.current = selectedIndex; }, [selectedIndex]);
  useEffect(() => { activePanelRef.current = activePanel; }, [activePanel]);

  useEffect(() => {
    if (!isActive) return;
    const unsub = onGamepadPress((event) => {
      if (event.type !== 'press') return;

      // If diagnostic is open, only handle B to close
      if (activePanelRef.current === 'controller') {
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
      if (event.button === 'a') {
        playSound('select');
        if (settingsItems[selectedRef.current].id === 'controller') {
          setActivePanel('controller');
        }
      }
      if (event.button === 'b') {
        playSound('back');
        onBack();
      }
    });
    return unsub;
  }, [isActive, onGamepadPress, onBack, settingsItems]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeElement = listRef.current.children[selectedIndex];
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isActive) return null;

  const ActiveIcon = settingsItems[selectedIndex].icon;

  return (
    <div className="nxe-settings-container" data-testid="nxe-settings">
      <div className="nxe-aura-background"></div>

      <div className="nxe-content-wrapper">
        {/* Left Side: Preview / Diagnostic Panel */}
        <div className="nxe-preview-pane">
          {activePanel === 'controller' ? (
            <div className="nxe-diagnostic-embed" data-testid="settings-controller-diagnostic">
              <GamepadDiagnostic embedded={true} />
            </div>
          ) : (
            <>
              <div className="nxe-preview-icon-container">
                <ActiveIcon size={200} strokeWidth={1} color="white" />
              </div>
              <div className="nxe-preview-text">
                <h1 className="nxe-setting-title">{settingsItems[selectedIndex].label}</h1>
                <p className="nxe-setting-desc">{settingsItems[selectedIndex].description}</p>
              </div>
            </>
          )}
        </div>

        {/* Right Side: Settings List */}
        <div className="nxe-list-pane">
          <div className="nxe-list-container" ref={listRef}>
            {settingsItems.map((item, index) => (
              <div 
                key={item.id} 
                data-testid={`settings-item-${item.id}`}
                className={`nxe-list-item ${index === selectedIndex ? 'active' : ''}`}
                onClick={() => {
                  playSound('focus');
                  setSelectedIndex(index);
                  if (item.id === 'controller') {
                    playSound('select');
                    setActivePanel('controller');
                  }
                }}
              >
                <span className="nxe-item-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="nxe-footer">
        {activePanel ? (
          <div className="nxe-footer-item">
            <div className="xbox-btn-circle red">B</div>
            <span>Back to Settings</span>
          </div>
        ) : (
          <>
            <div className="nxe-footer-item">
              <div className="xbox-btn-circle green">A</div>
              <span>Select</span>
            </div>
            <div className="nxe-footer-item">
              <div className="xbox-btn-circle red">B</div>
              <span>Back</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NXESettings;

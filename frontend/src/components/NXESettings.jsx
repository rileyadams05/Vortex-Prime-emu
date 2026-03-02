import React, { useState, useEffect, useRef } from 'react';
import { useGamepad } from '../context/GamepadContext';
import playSound from '../utils/soundManager';
import { AlertCircle, Volume2, Globe, Moon } from 'lucide-react';
import GamepadDiagnostic from './GamepadDiagnostic';
import '../styles/NXESettings.css';

const settingsItems = [
  { id: 'core', label: 'Core Configuration', icon: AlertCircle, description: 'Configure core system settings including emulator paths, game folders, and metadata sources. Set up your Xenia installation and scanning preferences.' },
  { id: 'moonlight', label: 'Moonlight', icon: Moon, description: 'Configure game streaming settings. Use Sunshine to host your PC as a streaming server, or use Moonlight to stream games to a console.', hasSubMenu: true },
  { id: 'sound', label: 'Sound Settings', icon: Volume2, description: 'Configure UI sound effects, navigation sounds, and background music volume. Enable or disable individual audio channels.' },
  { id: 'language', label: 'Language', icon: Globe, description: 'Change the display language for the dashboard interface. Currently set to English (EN).', badge: 'EN' },
];

const NXESettings = ({ isActive, onBack }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activePanel, setActivePanel] = useState(null); // null | 'moonlight'
  const [moonlightIndex, setMoonlightIndex] = useState(0);
  const listRef = useRef(null);
  const { onPress: onGamepadPress } = useGamepad();

  const moonlightOptions = [
    { id: 'sunshine', label: 'Sunshine', description: 'Configure Sunshine as a game streaming host on your PC. Allows remote devices to connect and stream games from this machine.' },
    { id: 'moonlight-console', label: 'Moonlight', description: 'Configure Moonlight client for streaming games to a console. Connect to a Sunshine or NVIDIA GameStream host to play PC games remotely.' },
  ];

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      if (activePanel === 'moonlight') {
        e.stopPropagation();
        if (e.key === 'Escape' || e.key === 'Backspace') {
          playSound('back');
          setActivePanel(null);
          return;
        }
        if (e.key === 'ArrowUp') {
          playSound('focus');
          setMoonlightIndex(prev => (prev > 0 ? prev - 1 : moonlightOptions.length - 1));
        }
        if (e.key === 'ArrowDown') {
          playSound('focus');
          setMoonlightIndex(prev => (prev < moonlightOptions.length - 1 ? prev + 1 : 0));
        }
        if (e.key === 'Enter') {
          playSound('select');
        }
        return;
      }

      if (activePanel) {
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
          if (settingsItems[selectedIndex]?.hasSubMenu) {
            setActivePanel(settingsItems[selectedIndex].id);
            setMoonlightIndex(0);
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
  }, [isActive, selectedIndex, onBack, activePanel, moonlightOptions.length]);

  const selectedRef = useRef(selectedIndex);
  const activePanelRef = useRef(activePanel);
  useEffect(() => { selectedRef.current = selectedIndex; }, [selectedIndex]);
  useEffect(() => { activePanelRef.current = activePanel; }, [activePanel]);

  useEffect(() => {
    if (!isActive) return;
    const unsub = onGamepadPress((event) => {
      if (event.type !== 'press') return;

      if (activePanelRef.current === 'moonlight') {
        if (event.button === 'b') { playSound('back'); setActivePanel(null); return; }
        if (event.button === 'dpadUp' || event.button === 'stickUp') {
          playSound('focus');
          setMoonlightIndex(prev => (prev > 0 ? prev - 1 : moonlightOptions.length - 1));
        }
        if (event.button === 'dpadDown' || event.button === 'stickDown') {
          playSound('focus');
          setMoonlightIndex(prev => (prev < moonlightOptions.length - 1 ? prev + 1 : 0));
        }
        if (event.button === 'a') { playSound('select'); }
        return;
      }

      if (activePanelRef.current) {
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
        if (settingsItems[selectedRef.current]?.hasSubMenu) {
          setActivePanel(settingsItems[selectedRef.current].id);
          setMoonlightIndex(0);
        }
      }
      if (event.button === 'b') {
        playSound('back');
        onBack();
      }
    });
    return unsub;
  }, [isActive, onGamepadPress, onBack, moonlightOptions.length]);

  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIndex];
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isActive) return null;

  const currentItem = settingsItems[selectedIndex];
  const CurrentIcon = currentItem.icon;

  return (
    <div className="nxe-settings-container" data-testid="nxe-settings">
      <div className="nxe-settings-title">Settings</div>

      <div className="nxe-settings-body">
        {/* Left: Sidebar */}
        <div className="nxe-sidebar" ref={listRef}>
          {settingsItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div 
                key={item.id} 
                data-testid={`settings-item-${item.id}`}
                className={`nxe-sidebar-item ${index === selectedIndex ? 'active' : ''} ${activePanel === item.id ? 'entered' : ''}`}
                onClick={() => { playSound('focus'); setSelectedIndex(index); }}
              >
                <Icon size={16} strokeWidth={2} />
                <span className="nxe-sidebar-label">{item.label}</span>
                {item.badge && <span className="nxe-sidebar-badge">{item.badge}</span>}
              </div>
            );
          })}
        </div>

        {/* Right: Content Pane */}
        <div className="nxe-content-pane" data-testid="settings-content-pane">
          {activePanel === 'moonlight' ? (
            <div className="nxe-content-inner">
              <h2 className="nxe-content-title">Moonlight</h2>
              <div className="moonlight-options">
                {moonlightOptions.map((opt, i) => (
                  <div
                    key={opt.id}
                    className={`moonlight-option ${moonlightIndex === i ? 'active' : ''}`}
                    data-testid={`moonlight-${opt.id}`}
                    onClick={() => { playSound('select'); setMoonlightIndex(i); }}
                  >
                    <span className="moonlight-option-label">{opt.label}</span>
                    <p className="moonlight-option-desc">{opt.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : activePanel ? (
            <div className="nxe-diagnostic-embed" data-testid="settings-controller-diagnostic">
              <GamepadDiagnostic embedded={true} />
            </div>
          ) : (
            <div className="nxe-content-inner">
              <h2 className="nxe-content-title">{currentItem.label}</h2>
              <p className="nxe-content-desc">{currentItem.description}</p>
              {currentItem.hasSubMenu && (
                <div className="nxe-enter-hint">Press A or Enter to open</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="nxe-footer" data-testid="settings-footer">
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

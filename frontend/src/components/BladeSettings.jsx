// Authentic Xbox 360 Blade System Settings

import React, { useState, useEffect } from 'react';
import { Settings, Palette, Video, Globe, Gamepad, Tv, Wifi, HardDrive, Info, ChevronRight } from 'lucide-react';
import './BladeSettings.css';

const BladeSettings = ({ isOpen, onClose, onApply }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState('default');
  const [selectedStartupVideo, setSelectedStartupVideo] = useState('default');
  const [showThemeBlade, setShowThemeBlade] = useState(false);
  const [showStartupBlade, setShowStartupBlade] = useState(false);

  const mainMenuItems = [
    { id: 'console', label: 'Console Settings', icon: Settings, action: () => {} },
    { id: 'display', label: 'Display', icon: Tv, action: () => {} },
    { id: 'theme', label: 'Personalize', icon: Palette, action: () => setShowThemeBlade(true) },
    { id: 'startup', label: 'Startup', icon: Video, action: () => setShowStartupBlade(true) },
    { id: 'network', label: 'Network Settings', icon: Wifi, action: () => {} },
    { id: 'storage', label: 'Storage', icon: HardDrive, action: () => {} },
    { id: 'global', label: 'Global Settings', icon: Globe, action: () => {} },
    { id: 'game', label: 'Game Settings', icon: Gamepad, action: () => {} },
    { id: 'about', label: 'System Info', icon: Info, action: () => {} }
  ];

  const themes = ['Default Green', 'Dark Carbon', 'Blue Wave', 'Purple Haze', 'Red Ember'];
  const startupVideos = ['Original Xbox 360', 'Kinect Intro', 'Classic Blades', 'Custom'];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      switch(e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(mainMenuItems.length - 1, prev + 1));
          break;
        case 'Enter':
          e.preventDefault();
          mainMenuItems[selectedIndex].action();
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          if (showThemeBlade || showStartupBlade) {
            setShowThemeBlade(false);
            setShowStartupBlade(false);
          } else {
            onClose();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, showThemeBlade, showStartupBlade, mainMenuItems, onClose]);

  if (!isOpen) return null;

  return (
    <div className="blade-overlay">
      <div className="settings-blade blade-active">
        <div className="blade-header">
          <Settings size={32} />
          <h2>System Settings</h2>
        </div>
        
        <div className="blade-content">
          {mainMenuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`blade-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedIndex(index);
                  item.action();
                }}
              >
                <Icon size={24} className="blade-item-icon" />
                <span className="blade-item-label">{item.label}</span>
                <ChevronRight size={20} className="blade-item-arrow" />
              </div>
            );
          })}
        </div>

        <div className="blade-footer">
          <div className="button-hint">
            <span className="xbox-button green">A</span>
            <span>Select</span>
          </div>
          <div className="button-hint">
            <span className="xbox-button red">B</span>
            <span>Back</span>
          </div>
        </div>
      </div>

      {showThemeBlade && (
        <div className="settings-blade blade-sub">
          <div className="blade-header">
            <Palette size={32} />
            <h2>Personalize</h2>
          </div>
          
          <div className="blade-content">
            <div className="blade-section">
              <h3>Theme</h3>
              {themes.map((theme, i) => (
                <div
                  key={i}
                  className={`blade-option ${selectedTheme === theme ? 'active' : ''}`}
                  onClick={() => setSelectedTheme(theme)}
                >
                  <div className="theme-preview"></div>
                  <span>{theme}</span>
                </div>
              ))}
            </div>

            <button className="apply-blade-btn" onClick={() => {
              onApply({ theme: selectedTheme });
              setShowThemeBlade(false);
            }}>
              Apply Changes
            </button>
          </div>
        </div>
      )}

      {showStartupBlade && (
        <div className="settings-blade blade-sub">
          <div className="blade-header">
            <Video size={32} />
            <h2>Startup</h2>
          </div>
          
          <div className="blade-content">
            <div className="blade-section">
              <h3>Startup Video</h3>
              {startupVideos.map((video, i) => (
                <div
                  key={i}
                  className={`blade-option ${selectedStartupVideo === video ? 'active' : ''}`}
                  onClick={() => setSelectedStartupVideo(video)}
                >
                  <Video size={20} />
                  <span>{video}</span>
                </div>
              ))}
            </div>

            <button className="apply-blade-btn" onClick={() => {
              onApply({ startupVideo: selectedStartupVideo });
              setShowStartupBlade(false);
            }}>
              Apply Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BladeSettings;

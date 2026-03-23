// Authentic Xbox 360 Blade System Settings

import React, { useState, useEffect } from 'react';
import { Settings, Palette, Video, Globe, Gamepad, Tv, Wifi, HardDrive, Info, ChevronRight } from 'lucide-react';
import './BladeSettings.css';

const BladeSettings = ({ isOpen, onClose, onApply }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const mainMenuItems = [
    { id: 'console', label: 'Console Settings', icon: Settings, action: () => {} },
    { id: 'display', label: 'Display', icon: Tv, action: () => {} },
    { id: 'network', label: 'Network Settings', icon: Wifi, action: () => {} },
    { id: 'storage', label: 'Storage', icon: HardDrive, action: () => {} },
    { id: 'global', label: 'Global Settings', icon: Globe, action: () => {} },
    { id: 'game', label: 'Game Settings', icon: Gamepad, action: () => {} },
    { id: 'about', label: 'System Info', icon: Info, action: () => {} }
  ];

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
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, mainMenuItems, onClose]);

  if (!isOpen) return null;

  return (
    <div className="blade-overlay">
      <div className="settings-blade blade-active">
        <div className="blade-header">
          <h2 className="header-title">System Settings</h2>
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
                <span className="blade-item-label">{item.label}</span>
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
    </div>
  );
};

export default BladeSettings;

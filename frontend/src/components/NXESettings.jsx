import React, { useState, useEffect, useRef } from 'react';
import { Settings, Monitor, Wifi, HardDrive, Globe, Gamepad2, Info } from 'lucide-react';
import '../styles/NXESettings.css';

const NXESettings = ({ isActive, onBack }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef(null);

  const settingsItems = [
    { id: 'console', label: 'Console Settings', icon: Settings, description: 'Configure console settings, including audio, language, and locale.' },
    { id: 'display', label: 'Display', icon: Monitor, description: 'Adjust screen resolution, color space, and other display options.' },
    { id: 'network', label: 'Network Settings', icon: Wifi, description: 'Connect to Xbox Live, test your connection, and configure network settings.' },
    { id: 'storage', label: 'Storage', icon: HardDrive, description: 'Manage game saves, profiles, and other data on your storage devices.' },
    { id: 'global', label: 'Global Settings', icon: Globe, description: 'Set system-wide preferences for all users.' },
    { id: 'game', label: 'Game Settings', icon: Gamepad2, description: 'Manage game-specific settings and defaults.' },
    { id: 'about', label: 'System Info', icon: Info, description: 'View console serial number, ID, and other system information.' }
  ];

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      e.stopPropagation();
      
      switch (e.key) {
        case 'ArrowUp':
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : settingsItems.length - 1));
          break;
        case 'ArrowDown':
          setSelectedIndex(prev => (prev < settingsItems.length - 1 ? prev + 1 : 0));
          break;
        case 'Enter':
          // Handle selection (future implementation)
          console.log(`Selected: ${settingsItems[selectedIndex].label}`);
          break;
        case 'Escape':
        case 'Backspace':
          onBack();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, selectedIndex, onBack]);

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
    <div className="nxe-settings-container">
      {/* Background Aura */}
      <div className="nxe-aura-background"></div>

      <div className="nxe-content-wrapper">
        {/* Left Side: Dynamic Preview */}
        <div className="nxe-preview-pane">
          <div className="nxe-preview-icon-container">
             <ActiveIcon size={200} strokeWidth={1} color="white" />
          </div>
          <div className="nxe-preview-text">
            <h1 className="nxe-setting-title">{settingsItems[selectedIndex].label}</h1>
            <p className="nxe-setting-desc">{settingsItems[selectedIndex].description}</p>
          </div>
        </div>

        {/* Right Side: Settings List */}
        <div className="nxe-list-pane">
          <div className="nxe-list-container" ref={listRef}>
            {settingsItems.map((item, index) => (
              <div 
                key={item.id} 
                className={`nxe-list-item ${index === selectedIndex ? 'active' : ''}`}
                onClick={() => setSelectedIndex(index)}
              >
                <span className="nxe-item-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Guides */}
      <div className="nxe-footer">
        <div className="nxe-footer-item">
          <div className="xbox-btn-circle green">A</div>
          <span>Select</span>
        </div>
        <div className="nxe-footer-item">
          <div className="xbox-btn-circle red">B</div>
          <span>Back</span>
        </div>
      </div>
    </div>
  );
};

export default NXESettings;

import React, { useState, useEffect, useRef } from 'react';
import '../styles/BladesDashboard.css';

const BladesDashboard = () => {
  const [activeBlade, setActiveBlade] = useState(1); // Start at "Games" (Index 1)
  const [selectedItem, setSelectedItem] = useState(0);

  // Sounds
  const bladeShiftSound = useRef(new Audio('/assets/blades/sounds/ui_blade_shift.wav'));
  const navClickSound = useRef(new Audio('/assets/blades/sounds/ui_nav_click.wav'));
  const selectSound = useRef(new Audio('/assets/blades/sounds/ui_select.wav'));
  const backSound = useRef(new Audio('/assets/blades/sounds/ui_back.wav'));

  const blades = [
    { id: 'xboxlive', label: 'Xbox Live', color: '#107c10', items: ['Friends', 'Messages', 'Parties', 'Spotlight'] },
    { id: 'games', label: 'Games', color: '#5c2e91', items: ['Played Games', 'Achievements', 'Active Downloads', 'Demos'] },
    { id: 'media', label: 'Media', color: '#0072c6', items: ['Music', 'Pictures', 'Videos', 'Media Center'] },
    { id: 'system', label: 'System', color: '#7a7a7a', items: ['Console Settings', 'Family Settings', 'Memory', 'Network Settings'] }
  ];

  const playSound = (soundRef) => {
    if (soundRef.current) {
      soundRef.current.currentTime = 0;
      soundRef.current.play().catch(e => console.error("Sound play failed", e));
    }
  };

  const handleBladeShift = (direction) => {
    let nextIndex = activeBlade + direction;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= blades.length) nextIndex = blades.length - 1;

    if (nextIndex !== activeBlade) {
      setActiveBlade(nextIndex);
      setSelectedItem(0); // Reset item selection
      playSound(bladeShiftSound);
    }
  };

  const handleNav = (direction) => {
    const currentBlade = blades[activeBlade];
    let nextItem = selectedItem + direction;
    if (nextItem < 0) nextItem = 0;
    if (nextItem >= currentBlade.items.length) nextItem = currentBlade.items.length - 1;

    if (nextItem !== selectedItem) {
      setSelectedItem(nextItem);
      playSound(navClickSound);
    }
  };

  // Keyboard / Gamepad Input
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'q':
        case 'Q': // LB
        case 'PageUp':
          handleBladeShift(-1);
          break;
        case 'e':
        case 'E': // RB
        case 'PageDown':
          handleBladeShift(1);
          break;
        case 'ArrowUp':
          handleNav(-1);
          break;
        case 'ArrowDown':
          handleNav(1);
          break;
        case 'Enter':
        case ' ':
          playSound(selectSound);
          console.log(`Selected: ${blades[activeBlade].items[selectedItem]}`);
          break;
        case 'Backspace':
        case 'Escape':
          playSound(backSound);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBlade, selectedItem]);

  // Gamepad Polling Removed - Handled by GlobalControllerListener
  // The component now relies purely on keyboard events dispatched globally.


  // Dynamic Background Style (Active Blade Color + Default Wallpaper)
  // The wallpaper is handled in CSS, but we can add a color overlay if needed.
  // The user requested tracing the "default.png" path, but that requires complex SVG/Canvas.
  // We will approximate with CSS layers and the provided image.

  return (
    <div className="blades-dashboard">
      <div className="blades-background" style={{ backgroundImage: "url(/wallpapers/Play/default.png)" }}></div>
      <div className="glass-overlay"></div>
      
      <div className="blades-container">
        
        {/* Blade Headers */}
        <div 
            className="blade-header-strip" 
            style={{ 
                transform: `translateX(${(2 - activeBlade) * 160}px)`, 
                transition: 'transform 0.25s cubic-bezier(0.2, 0.0, 0.2, 1)' 
            }}
        >
          {blades.map((blade, index) => {
            const isActive = index === activeBlade;
            const diff = index - activeBlade;
            
            // Fanning Logic
            // Active: Scale 1.1, Z-Index 100
            // Inactive: Scale 0.9, Z-Index 10 - distance
            
            const style = {
                zIndex: isActive ? 100 : 10 - Math.abs(diff),
                transform: isActive 
                    ? 'scale(1.1) translateY(0)' 
                    : `scale(0.9) translateY(5px)`,
                filter: isActive ? 'brightness(1.2)' : 'brightness(0.6)',
                background: isActive 
                    ? `linear-gradient(to bottom, ${blade.color}, #000)`
                    : '#2a2a2a'
            };

            // Override specific gradient for active to match design
            if (isActive) {
                 if (blade.id === 'marketplace') style.background = `linear-gradient(to bottom, #d8ab24, #9e7d1a)`;
                 if (blade.id === 'xboxlive') style.background = `linear-gradient(to bottom, #2d8f1e, #1a5c12)`;
                 if (blade.id === 'games') style.background = `linear-gradient(to bottom, #5c2e91, #3b1d5e)`;
                 if (blade.id === 'media') style.background = `linear-gradient(to bottom, #0072c6, #004a80)`;
                 if (blade.id === 'system') style.background = `linear-gradient(to bottom, #7a7a7a, #4a4a4a)`;
            }

            return (
              <div 
                key={blade.id} 
                className={`blade-tab ${isActive ? 'active' : 'inactive'}`}
                data-id={blade.id}
                style={style}
                onClick={() => {
                    if (diff !== 0) handleBladeShift(diff);
                }}
              >
                {blade.label}
              </div>
            );
          })}
        </div>

        {/* Blade Content */}
        <div className="blade-content active">
            <h1 className="blade-title">{blades[activeBlade].label}</h1>
            <div className="blade-menu-list">
                {blades[activeBlade].items.map((item, i) => (
                    <div 
                        key={item} 
                        className={`blade-menu-item ${i === selectedItem ? 'selected' : ''}`}
                        onMouseEnter={() => setSelectedItem(i)}
                        onClick={() => {
                            setSelectedItem(i);
                            playSound(selectSound);
                        }}
                    >
                        {item}
                    </div>
                ))}
            </div>
        </div>

      </div>

      <div className="blades-footer">
        <div className="footer-btn">
          <div className="btn-icon btn-a">A</div> Select
        </div>
        <div className="footer-btn">
          <div className="btn-icon btn-b">B</div> Back
        </div>
      </div>
    </div>
  );
};

export default BladesDashboard;

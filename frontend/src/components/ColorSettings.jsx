import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import iro from '@jaames/iro';

const ColorSettings = ({ isActive, onBack, preview = false, onColorChange }) => {
  const { themeColor, changeTheme } = useTheme();

  const colorPickerRef = useRef(null);
  const colorPickerInstance = useRef(null);

  // Local state for the hex input so it can be typed into smoothly
  const [hexInput, setHexInput] = useState(themeColor.primary || '#107C10');

  useEffect(() => {
    // Initialize iro.js ColorPicker
    if (!colorPickerInstance.current && colorPickerRef.current) {
      colorPickerInstance.current = new iro.ColorPicker(colorPickerRef.current, {
        width: 280,
        color: themeColor.primary || '#107C10',
        borderWidth: 2,
        borderColor: '#ffffff',
        layout: [
          {
            component: iro.ui.Wheel,
            options: {}
          },
          {
            component: iro.ui.Slider,
            options: { sliderType: 'value' }
          }
        ]
      });

      // Bind color:change event
      colorPickerInstance.current.on('color:change', function (color) {
        setHexInput(color.hexString);
        changeTheme(color.hexString); // Sync bi-directionally with CSS var (ThemeContext automatically handles it)
        if (onColorChange) onColorChange();
      });
    }

    return () => {
      // The iro.js picker doesn't have an explicit destroy method, but we clean up DOM dynamically if unmounted via React.
    };
  }, [preview, changeTheme]);

  // Handle external theme color changes 
  // (e.g. if another component updates it, or default is loaded)
  useEffect(() => {
    if (colorPickerInstance.current && themeColor.primary !== colorPickerInstance.current.color.hexString) {
      colorPickerInstance.current.color.hexString = themeColor.primary;
    }
    setHexInput(themeColor.primary);
  }, [themeColor.primary, preview]);

  // Handle Save Event
  useEffect(() => {
    const handleGlobalSave = async () => {
      try {
        const { settingsApi } = await import('../services/apiServices');
        await settingsApi.update({ theme_color: themeColor.primary });
      } catch (e) {
        console.error("ColorSettings: Failed to save theme color:", e);
      }
    };

    window.addEventListener('dashboard-save-settings', handleGlobalSave);
    return () => window.removeEventListener('dashboard-save-settings', handleGlobalSave);
  }, [themeColor.primary]);

  const handleHexInputChange = (e) => {
    const val = e.target.value;
    setHexInput(val);

    // Validate HEX code before applying
    if (/^#[0-9A-F]{6}$/i.test(val) || /^#[0-9A-F]{3}$/i.test(val)) {
      if (colorPickerInstance.current) {
        colorPickerInstance.current.color.hexString = val;
      }
      changeTheme(val);
      if (onColorChange) onColorChange();
    }
  };

  return (
    <div className={preview ? 'preview-mode' : ''} style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', pointerEvents: (!isActive && preview) ? 'none' : 'auto', opacity: (!isActive && preview) ? 0.8 : 1 }}>
      {!preview && (
        <>
          <h2 style={{ fontSize: '24px', marginBottom: '10px', color: '#fff' }}>Hover Color</h2>
          <p style={{ color: '#aaa', marginBottom: '30px' }}>Select an accent color for the dashboard interface.</p>
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
        <div style={{
          background: 'rgba(0,0,0,0.5)',
          padding: '4px 12px',
          borderRadius: '15px',
          marginBottom: '15px',
          border: `1px solid ${themeColor.primary}`,
          color: '#fff',
          fontSize: '12px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          Theme: {themeColor.name || 'Custom'}
        </div>
        {/* Iro.js Interactive Wheel Container */}
        <div ref={colorPickerRef} style={{ marginBottom: '30px', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))' }}></div>

        {/* Direct Hex Code Entry */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(0,0,0,0.4)',
          padding: '10px 20px',
          borderRadius: '8px',
          border: `2px solid ${themeColor.primary}`,
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          transition: 'border-color 0.2s ease-in-out'
        }}>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px' }}>HEX</span>
          <input
            type="text"
            value={hexInput}
            onChange={handleHexInputChange}
            maxLength={7}
            onFocus={(e) => {
              e.target.select();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '20px',
              outline: 'none',
              width: '100px',
              fontFamily: 'monospace',
              textTransform: 'uppercase'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ColorSettings;

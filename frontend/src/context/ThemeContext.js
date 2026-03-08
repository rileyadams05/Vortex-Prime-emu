import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

const darkenHex = (hex, amount = 40) => {
  if (!hex) return '#000000';
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');

  let r = parseInt(hex.substring(0, 2), 16) || 0;
  let g = parseInt(hex.substring(2, 4), 16) || 0;
  let b = parseInt(hex.substring(4, 6), 16) || 0;

  r = Math.max(0, r - amount);
  g = Math.max(0, g - amount);
  b = Math.max(0, b - amount);

  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
};

export const ThemeProvider = ({ children }) => {
  // Default Xbox 360 green theme
  const [themeColor, setThemeColor] = useState({
    name: 'Default',
    primary: '#107C10',
    secondary: darkenHex('#107C10', 40),
    accent: '#107C10',
    gradient: `linear-gradient(135deg, #107C10 0%, ${darkenHex('#107C10', 40)} 100%)`
  });

  // Apply CSS variables to root when theme changes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', themeColor.primary);
    root.style.setProperty('--theme-secondary', themeColor.secondary);
    root.style.setProperty('--theme-accent', themeColor.accent);
    root.style.setProperty('--theme-gradient', themeColor.gradient);
  }, [themeColor]);

  // Load initial theme from settings API
  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const { settingsApi } = await import('../services/apiServices');
        const settings = await settingsApi.get();
        if (settings && settings.theme_color) {
          changeTheme(settings.theme_color);
        }
      } catch (e) {
        console.error("Failed to load saved theme:", e);
      }
    };
    loadSavedTheme();
  }, []);

  const changeTheme = (newColor) => {
    if (typeof newColor === 'string') {
      const secondary = darkenHex(newColor, 40);
      const isDefault = newColor.toUpperCase() === '#107C10';
      setThemeColor({
        name: isDefault ? 'Default' : 'Custom',
        primary: newColor,
        secondary: secondary,
        accent: newColor,
        gradient: `linear-gradient(135deg, ${newColor} 0%, ${secondary} 100%)`
      });
    } else {
      setThemeColor(newColor);
    }
  };

  return (
    <ThemeContext.Provider value={{ themeColor, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

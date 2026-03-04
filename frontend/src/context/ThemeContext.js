import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Default green theme
  const [themeColor, setThemeColor] = useState({
    name: 'Xbox Green',
    primary: '#91C300',      // Main green
    secondary: '#5F8200',    // Darker green for gradients
    accent: '#4CAF50',       // Border/Text accent
    gradient: 'linear-gradient(135deg, #91C300 0%, #5F8200 100%)'
  });

  // Apply CSS variables to root when theme changes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', themeColor.primary);
    root.style.setProperty('--theme-secondary', themeColor.secondary);
    root.style.setProperty('--theme-accent', themeColor.accent);
    root.style.setProperty('--theme-gradient', themeColor.gradient);
  }, [themeColor]);

  const changeTheme = (newColor) => {
    setThemeColor(newColor);
  };

  return (
    <ThemeContext.Provider value={{ themeColor, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

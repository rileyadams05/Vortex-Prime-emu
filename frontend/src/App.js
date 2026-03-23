import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { GamepadProvider } from './context/GamepadContext';
import { ThemeProvider } from './context/ThemeContext';
import XeniaDashboard from './pages/XeniaDashboard';
import OAuthCallback from './pages/OAuthCallback';
import { Toaster } from 'sonner';
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import AchievementToast from './components/AchievementToast';
import { startAchievementListener, stopAchievementListener } from './services/AchievementWatcher';
import './App.css';

// Initialize flag emoji polyfill for Windows
polyfillCountryFlagEmojis();

function App() {
  React.useEffect(() => {
    // Start our universal achievement system engine
    startAchievementListener().catch(console.error);

    // Cleanup function to stop listener when app unmounts
    return () => {
      stopAchievementListener();
    };
  }, []);

  return (
    <GamepadProvider>
      <ThemeProvider>
        <div className="App">
          <Toaster position="top-right" theme="dark" richColors />
          <AchievementToast />
          <Router>
            <Routes>
              <Route path="/" element={<XeniaDashboard />} />
              <Route path="/oauth/callback" element={<OAuthCallback />} />
            </Routes>
          </Router>
        </div>
      </ThemeProvider>
    </GamepadProvider>
  );
}

export default App;

import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { GamepadProvider } from './context/GamepadContext';
import { ThemeProvider } from './context/ThemeContext';
import XeniaDashboard from './pages/XeniaDashboard';
import OAuthCallback from './pages/OAuthCallback';
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import './App.css';

// Initialize flag emoji polyfill for Windows
polyfillCountryFlagEmojis();

function App() {
  return (
    <GamepadProvider>
      <ThemeProvider>
        <div className="App">
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

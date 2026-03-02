import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { GamepadProvider } from './context/GamepadContext';
import XeniaDashboard from './pages/XeniaDashboard';
import OAuthCallback from './pages/OAuthCallback';
import './App.css';

function App() {
  return (
    <GamepadProvider>
      <div className="App">
        <Router>
          <Routes>
            <Route path="/" element={<XeniaDashboard />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
          </Routes>
        </Router>
      </div>
    </GamepadProvider>
  );
}

export default App;

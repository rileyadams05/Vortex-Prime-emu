import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Xbox360Dashboard from './pages/Xbox360Dashboard';
import OAuthCallback from './pages/OAuthCallback';
import './App.css';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Xbox360Dashboard />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
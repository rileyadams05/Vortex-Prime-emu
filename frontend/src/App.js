import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import XeniaDashboard from './pages/XeniaDashboard';
import OAuthCallback from './pages/OAuthCallback';
import GlobalControllerListener from './components/GlobalControllerListener';
import './App.css';

function App() {
  return (
    <div className="App">
      <GlobalControllerListener />
      <Router>
        <Routes>
          <Route path="/" element={<XeniaDashboard />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import XeniaDashboard from './pages/XeniaDashboard';
import './App.css';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<XeniaDashboard />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
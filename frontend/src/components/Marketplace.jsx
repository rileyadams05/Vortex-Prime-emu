import React from 'react';
import { ChevronLeft, Store, Download, Globe } from 'lucide-react';
import playSound from '../utils/soundManager';

const COMMUNITY_THEMES = [
  { id: 1, name: 'Halo Reach Dashboard', author: 'SpartanUI', downloads: 1240, description: 'Halo Reach themed NXE layout' },
  { id: 2, name: 'Gears Ultimate', author: 'COGDesign', downloads: 890, description: 'Gears of War dark steel layout' },
  { id: 3, name: 'Forza Horizon', author: 'RacerX', downloads: 2100, description: 'Racing-inspired wide tile layout' },
  { id: 4, name: 'Classic Blades', author: 'RetroXbox', downloads: 3400, description: 'Original Xbox 360 Blades dashboard recreation' },
  { id: 5, name: 'Fable III Royal', author: 'Albion360', downloads: 560, description: 'Fable-themed golden layout' },
  { id: 6, name: 'Mass Effect N7', author: 'Normandy', downloads: 1890, description: 'Mass Effect sci-fi themed dashboard' },
];

const Marketplace = ({ onBack }) => {
  return (
    <div className="marketplace-view" data-testid="marketplace-view">
      <div className="market-header">
        <button className="back-btn" data-testid="marketplace-back-btn" onClick={() => { playSound('back'); onBack(); }}>
          <ChevronLeft size={20} /> Back
        </button>
        <Store size={20} style={{ color: '#90c31d' }} />
        <h1 className="market-title">MARKETPLACE</h1>
        <span className="market-hint">Community Dashboard Layouts</span>
      </div>

      <div className="market-banner" data-testid="marketplace-banner">
        <Globe size={24} />
        <div>
          <h3>Community Hub</h3>
          <p>Browse and download dashboard layouts shared by the community. All layouts are free.</p>
        </div>
      </div>

      <div className="market-grid" data-testid="marketplace-grid">
        {COMMUNITY_THEMES.map((theme) => (
          <div key={theme.id} className="market-card" data-testid={`market-card-${theme.id}`}>
            <div className="market-card-preview">
              <Store size={32} />
            </div>
            <div className="market-card-info">
              <h3>{theme.name}</h3>
              <p className="market-card-desc">{theme.description}</p>
              <div className="market-card-meta">
                <span className="market-author">by {theme.author}</span>
                <span className="market-downloads">{theme.downloads} downloads</span>
              </div>
              <button
                className="market-download-btn"
                data-testid={`download-${theme.id}`}
                onClick={() => {
                  playSound('select');
                  alert(`Downloaded "${theme.name}" to /Themes/Disabled`);
                }}
              >
                <Download size={14} /> Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Marketplace;

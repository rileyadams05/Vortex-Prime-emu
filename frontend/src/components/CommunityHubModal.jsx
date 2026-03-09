import React, { useEffect } from 'react';
import { Download, Upload, X, Star, Globe } from 'lucide-react';
import playSound from '../utils/soundManager';
import '../styles/CommunityHubModal.css';

const CommunityHubModal = ({ isOpen, onClose, onViewStore, onUpload }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') { playSound('back'); onClose(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="chub-overlay" data-testid="community-hub-modal" onClick={(e) => { if (e.target === e.currentTarget) { playSound('back'); onClose(); } }}>
      <div className="chub-modal">
        {/* Close */}
        <button className="chub-close-btn" onClick={() => { playSound('back'); onClose(); }} title="Close">
          <X size={18} />
        </button>

        {/* Header */}
        <div className="chub-header">
          <div className="chub-star-icon">
            <Star size={28} fill="currentColor" />
          </div>
          <div className="chub-header-text">
            <h2 className="chub-title">Community Hub</h2>
            <p className="chub-subtitle">Browse & share custom dashboard layouts</p>
          </div>
        </div>

        {/* Divider */}
        <div className="chub-divider" />

        {/* Options */}
        <div className="chub-options">
          <button
            className="chub-option chub-option-download"
            data-testid="chub-view-store-btn"
            onClick={() => {
              playSound('select');
              onViewStore();
            }}
          >
            <div className="chub-option-icon-wrap download-wrap">
              <Globe size={32} />
            </div>
            <div className="chub-option-info">
              <span className="chub-option-title">View / Download Dashboards</span>
              <span className="chub-option-desc">Browse the Vortex Prime community store and download free custom dashboard layouts.</span>
            </div>
            <div className="chub-option-arrow">›</div>
          </button>

          <button
            className="chub-option chub-option-upload"
            data-testid="chub-upload-btn"
            onClick={() => {
              playSound('select');
              onUpload();
            }}
          >
            <div className="chub-option-icon-wrap upload-wrap">
              <Upload size={32} />
            </div>
            <div className="chub-option-info">
              <span className="chub-option-title">Upload Dashboard</span>
              <span className="chub-option-desc">Share your custom dashboard layout with the community as a creator.</span>
            </div>
            <div className="chub-option-arrow">›</div>
          </button>
        </div>

        {/* Footer hint */}
        <div className="chub-footer">
          <Download size={12} />
          <span>All community dashboards are free to download and use</span>
        </div>
      </div>
    </div>
  );
};

export default CommunityHubModal;

import React, { useEffect, useState } from 'react';
import { settingsApi } from '../services/apiServices';
import playSound from '../utils/soundManager';

const API = '/api';

const BackgroundSettings = ({ isActive, preview = false, onBack, onDirty }) => {
  const [currentPath, setCurrentPath] = useState('');
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [error, setError] = useState('');

  // Load saved background on mount
  useEffect(() => {
    settingsApi.get()
      .then(s => { if (s.background_image) setCurrentPath(s.background_image); })
      .catch(e => console.error('BackgroundSettings: Failed to load settings:', e));
  }, []);

  // Save on the global save event
  useEffect(() => {
    const handleSave = async () => {
      try {
        await settingsApi.update({ background_image: currentPath });
        window.dispatchEvent(new CustomEvent('background-image-changed', { detail: { path: currentPath } }));
      } catch (e) {
        console.error('BackgroundSettings: Failed to save background image:', e);
      }
    };

    window.addEventListener('dashboard-save-settings', handleSave);
    return () => window.removeEventListener('dashboard-save-settings', handleSave);
  }, [currentPath]);

  const handleBrowse = async () => {
    if (!isActive) return;
    setIsBrowsing(true);
    setError('');
    playSound('select');
    try {
      const result = await settingsApi.browseImage();
      if (result.path) {
        setCurrentPath(result.path);
        if (onDirty) onDirty();
      }
    } catch (e) {
      console.error('BackgroundSettings: Browse failed:', e);
      setError('Could not open file browser.');
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleClear = () => {
    if (!isActive) return;
    playSound('back');
    setCurrentPath('');
    if (onDirty) onDirty();
  };

  const previewUrl = currentPath
    ? `${API}/settings/serve-background?t=${Date.now()}`
    : null;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: (!isActive && preview) ? 'none' : 'auto',
        opacity: (!isActive && preview) ? 0.8 : 1,
      }}
    >
      {!preview && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '28px', marginBottom: '8px', color: '#fff', fontWeight: '700' }}>Background</h2>
          <p style={{ color: '#999', fontSize: '14px', lineHeight: '1.5' }}>Set a custom wallpaper image for your dashboard.</p>
        </div>
      )}

      {/* Main Content Card */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          border: '2px solid #107C10',
          borderRadius: '8px',
          padding: '24px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Press B hint */}
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '20px',
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '12px',
          fontStyle: 'italic',
          userSelect: 'none',
        }}>
          Press B to return to list
        </div>

        {/* Preview Box */}
        <div
          style={{
            flex: 1,
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: previewUrl
              ? `url("${previewUrl}") center/cover no-repeat`
              : 'rgba(0, 0, 0, 0.5)',
            minHeight: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)',
          }}
        >
          {!previewUrl && (
            <div style={{ 
              textAlign: 'center', 
              color: 'rgba(255, 255, 255, 0.4)', 
              userSelect: 'none',
              padding: '20px',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.6 }}>🖼️</div>
              <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>No custom background set</div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.3)' }}>Default wallpaper will be used</div>
            </div>
          )}
          {previewUrl && (
            <div style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              color: '#fff',
              fontSize: '11px',
              padding: '6px 10px',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {currentPath.split(/[\\/]/).pop()}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleBrowse}
            disabled={isBrowsing || (!isActive && preview)}
            style={{
              flex: 1,
              padding: '14px 20px',
              background: '#107C10',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              opacity: isBrowsing ? 0.6 : 1,
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(16, 124, 16, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              if (!isBrowsing && isActive) {
                e.target.style.background = '#0e6b0e';
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 4px 12px rgba(16, 124, 16, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#107C10';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 2px 8px rgba(16, 124, 16, 0.3)';
            }}
          >
            <span style={{ fontSize: '16px' }}>📂</span>
            {isBrowsing ? 'Opening...' : 'Browse Image'}
          </button>

          {currentPath && (
            <button
              onClick={handleClear}
              disabled={!isActive && preview}
              style={{
                padding: '14px 20px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#999',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (isActive) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                  e.target.style.color = '#ccc';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                e.target.style.color = '#999';
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {error && (
          <div style={{ 
            marginTop: '16px',
            padding: '10px 14px',
            background: 'rgba(248, 113, 113, 0.1)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            borderRadius: '4px',
            color: '#f87171',
            fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        <p style={{ 
          color: 'rgba(255, 255, 255, 0.3)', 
          fontSize: '11px', 
          marginTop: '16px',
          textAlign: 'center',
          lineHeight: '1.4',
        }}>
          Supported: PNG, JPG, JPEG, WEBP, BMP • Changes apply after Save &amp; Restart
        </p>
      </div>
    </div>
  );
};

export default BackgroundSettings;

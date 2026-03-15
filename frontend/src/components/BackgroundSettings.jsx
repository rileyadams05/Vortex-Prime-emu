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
        padding: '20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: (!isActive && preview) ? 'none' : 'auto',
        opacity: (!isActive && preview) ? 0.8 : 1,
      }}
    >
      {!preview && (
        <>
          <h2 style={{ fontSize: '24px', marginBottom: '10px', color: '#fff' }}>Background</h2>
          <p style={{ color: '#aaa', marginBottom: '30px' }}>Choose a custom image as your dashboard wallpaper.</p>
        </>
      )}

      {/* Preview Box */}
      <div
        style={{
          flex: 1,
          borderRadius: '12px',
          border: '2px solid rgba(255,255,255,0.08)',
          background: previewUrl
            ? `url("${previewUrl}") center/cover no-repeat`
            : 'rgba(0,0,0,0.4)',
          minHeight: '180px',
          maxHeight: '300px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          position: 'relative',
          overflow: 'hidden',
          transition: 'background-image 0.4s ease',
        }}
      >
        {!previewUrl && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', userSelect: 'none' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🖼️</div>
            <div style={{ fontSize: '13px' }}>No custom background set</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}>Default wallpaper will be used</div>
          </div>
        )}
        {previewUrl && (
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '10px',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '6px',
          }}>
            {currentPath.split(/[\\/]/).pop()}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={handleBrowse}
          disabled={isBrowsing || (!isActive && preview)}
          style={{
            flex: 1,
            padding: '10px 16px',
            background: '#107C10',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            opacity: isBrowsing ? 0.6 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {isBrowsing ? 'Opening...' : '📂 Browse Image'}
        </button>

        {currentPath && (
          <button
            onClick={handleClear}
            disabled={!isActive && preview}
            style={{
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.08)',
              color: '#aaa',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {error && (
        <p style={{ color: '#f87171', fontSize: '12px', marginTop: '10px' }}>{error}</p>
      )}

      <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '14px' }}>
        Supported: PNG, JPG, JPEG, WEBP, BMP • Changes apply after Save &amp; Restart
      </p>
    </div>
  );
};

export default BackgroundSettings;

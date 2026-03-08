import React, { useState, useEffect, useRef } from 'react';
import { useGamepad } from '../context/GamepadContext';
import playSound from '../utils/soundManager';
import '../styles/SoundSettings.css';

// Tauri IPC Bridge
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const SoundSettings = ({ isActive, onBack, preview = false }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Audio State
  const [masterVolume, setMasterVolume] = useState(50);
  const [musicVolume, setMusicVolume] = useState(50);
  const [backgroundMusic, setBackgroundMusic] = useState('None');

  // Sound Effects State (Mocked for now as per screenshot request)
  const [soundEffects, setSoundEffects] = useState({
    select: 'Default',
    back: 'Default',
    nav: 'Default',
    menuOpen: 'Default',
    bladeUp: 'Default',
    bladeDown: 'Default',
    tabLeft: 'Default',
    tabRight: 'Default'
  });

  const soundOptions = ['Default', 'Classic', 'Modern', 'Minimal', 'Silent'];
  const bgmOptions = ['None', 'Ambient', 'Techno', 'Chill', 'Legacy'];

  const settingsItems = [
    { id: 'master', label: 'Master Volume', type: 'slider', value: masterVolume, min: 0, max: 100 },
    { id: 'music', label: 'Music Volume', type: 'slider', value: musicVolume, min: 0, max: 100 },
    { id: 'bgm', label: 'Background Music', type: 'select', value: backgroundMusic, options: bgmOptions },
    { id: 'select', label: 'Select Sound', type: 'select', value: soundEffects.select, options: soundOptions },
    { id: 'back', label: 'Back Sound', type: 'select', value: soundEffects.back, options: soundOptions },
    { id: 'nav', label: 'Navigation Sound', type: 'select', value: soundEffects.nav, options: soundOptions },
    { id: 'menuOpen', label: 'Menu Open', type: 'select', value: soundEffects.menuOpen, options: soundOptions },
    { id: 'bladeUp', label: 'Blade Up', type: 'select', value: soundEffects.bladeUp, options: soundOptions },
    { id: 'bladeDown', label: 'Blade Down', type: 'select', value: soundEffects.bladeDown, options: soundOptions },
    { id: 'tabLeft', label: 'Tab Left', type: 'select', value: soundEffects.tabLeft, options: soundOptions },
    { id: 'tabRight', label: 'Tab Right', type: 'select', value: soundEffects.tabRight, options: soundOptions },
  ];

  const listRef = useRef(null);
  const { onPress: onGamepadPress } = useGamepad();

  // 1. Initialize Audio State (Hardware Sync & Backend Persistence)
  useEffect(() => {
    let isMounted = true;
    let unlisten = null;

    const initAudio = async () => {
      try {
        const { settingsApi } = await import('../services/apiServices');
        const saved = await settingsApi.get();
        if (isMounted && saved) {
          if (saved.master_volume !== undefined) setMasterVolume(saved.master_volume);
          if (saved.music_volume !== undefined) setMusicVolume(saved.music_volume);
          if (saved.bgm) setBackgroundMusic(saved.bgm);
          if (saved.sound_effects) setSoundEffects(prev => ({ ...prev, ...saved.sound_effects }));
        }

        // Hardware Sync (Tauri only)
        if (window.__TAURI_INTERNALS__) {
          const { invoke } = await import('@tauri-apps/api/core');
          const { listen } = await import('@tauri-apps/api/event');

          try {
            const vol = await invoke('get_system_volume_cmd');
            if (isMounted) setMasterVolume(vol);

            unlisten = await listen('system-volume-changed', (event) => {
              if (isMounted) setMasterVolume(event.payload);
            });
          } catch (err) {
            console.warn("Tauri audio commands not available in this build.");
          }
        }
      } catch (e) {
        console.error("Audio Initialization Failed:", e);
      }
    };

    if (isActive) {
      initAudio();
    }

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [isActive]);

  // Handle Global Save
  useEffect(() => {
    const handleGlobalSave = async () => {
      try {
        const { settingsApi } = await import('../services/apiServices');
        await settingsApi.update({
          master_volume: masterVolume,
          music_volume: musicVolume,
          bgm: backgroundMusic,
          sound_effects: soundEffects
        });
      } catch (e) {
        console.error("SoundSettings: Failed to save settings:", e);
      }
    };

    window.addEventListener('dashboard-save-settings', handleGlobalSave);
    return () => window.removeEventListener('dashboard-save-settings', handleGlobalSave);
  }, [masterVolume, musicVolume, backgroundMusic, soundEffects]);

  const updateMasterVolume = async (newVol) => {
    // Clamp volume
    const vol = Math.max(0, Math.min(100, newVol));
    setMasterVolume(vol);

    // Skip if not running in Tauri (e.g. browser mode)
    if (!window.__TAURI_INTERNALS__) return;

    try {
      await invoke('set_system_volume_cmd', { volume: parseInt(vol) });
    } catch (e) {
      console.error("Failed to set hardware volume:", e);
    }
  };

  const handleSettingChange = (direction) => {
    const item = settingsItems[selectedIndex];
    if (!item) return;

    if (item.type === 'slider') {
      if (item.id === 'master') {
        updateMasterVolume(masterVolume + (direction * 5));
      } else if (item.id === 'music') {
        const newVol = Math.max(0, Math.min(100, musicVolume + (direction * 5)));
        setMusicVolume(newVol);
      }
      playSound('focus');
    } else if (item.type === 'select') {
      const options = item.options || soundOptions;
      const currentIndex = options.indexOf(item.value);
      let nextIndex = currentIndex + direction;

      if (nextIndex >= options.length) nextIndex = 0;
      if (nextIndex < 0) nextIndex = options.length - 1;

      const newValue = options[nextIndex];

      if (item.id === 'bgm') {
        setBackgroundMusic(newValue);
      } else {
        setSoundEffects(prev => ({ ...prev, [item.id]: newValue }));
      }
      playSound('select');
    }
  };

  const handleSliderClick = (e, itemId) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.round((x / rect.width) * 100);
    const clamped = Math.max(0, Math.min(100, percentage));

    if (itemId === 'master') {
      updateMasterVolume(clamped);
    } else if (itemId === 'music') {
      setMusicVolume(clamped);
    }
    playSound('select');
  };

  // Keyboard Navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      e.stopPropagation();
      switch (e.key) {
        case 'ArrowUp':
          playSound('focus');
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : settingsItems.length - 1));
          break;
        case 'ArrowDown':
          playSound('focus');
          setSelectedIndex(prev => (prev < settingsItems.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowLeft':
          handleSettingChange(-1);
          break;
        case 'ArrowRight':
          handleSettingChange(1);
          break;
        case 'Escape':
        case 'Backspace':
          playSound('back');
          if (onBack) onBack();
          break;
        case 'y': // Reset defaults
        case 'Y':
          updateMasterVolume(50);
          setMusicVolume(50);
          setBackgroundMusic('None');
          setSoundEffects({
            select: 'Default',
            back: 'Default',
            nav: 'Default',
            menuOpen: 'Default',
            bladeUp: 'Default',
            bladeDown: 'Default',
            tabLeft: 'Default',
            tabRight: 'Default'
          });
          playSound('select');
          break;
        case 'Enter':
        case ' ':
          handleSettingChange(1);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, selectedIndex, masterVolume, musicVolume, backgroundMusic, soundEffects]);

  // Gamepad Navigation
  useEffect(() => {
    if (!isActive) return;

    const unsub = onGamepadPress((event) => {
      if (event.type !== 'press') return;

      if (event.button === 'dpadUp' || event.button === 'stickUp') {
        playSound('focus');
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : settingsItems.length - 1));
      }
      if (event.button === 'dpadDown' || event.button === 'stickDown') {
        playSound('focus');
        setSelectedIndex(prev => (prev < settingsItems.length - 1 ? prev + 1 : 0));
      }
      if (event.button === 'dpadLeft' || event.button === 'stickLeft') {
        handleSettingChange(-1);
      }
      if (event.button === 'dpadRight' || event.button === 'stickRight') {
        handleSettingChange(1);
      }
      if (event.button === 'a') {
        handleSettingChange(1);
      }
      if (event.button === 'b') {
        playSound('back');
        if (onBack) onBack();
      }
      if (event.button === 'y') {
        updateMasterVolume(50);
        setMusicVolume(50);
        setBackgroundMusic('None');
        playSound('select');
      }
    });
    return unsub;
  }, [isActive, onGamepadPress, selectedIndex, masterVolume, musicVolume, backgroundMusic, soundEffects]);

  // Scroll into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIndex];
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  return (
    <div className={`sound-settings-wrapper ${preview ? 'preview-mode' : ''}`} style={{ pointerEvents: (!isActive && preview) ? 'none' : 'auto', opacity: (!isActive && preview) ? 0.8 : 1 }}>
      {!preview && (
        <div className="sound-settings-header">
          <h2>Sound Settings</h2>
        </div>
      )}

      <div className="sound-settings-body">
        {/* Left Panel: Settings List */}
        <div className="sound-list-panel" ref={listRef}>
          {settingsItems.map((item, index) => (
            <div
              key={item.id}
              className={`sound-list-item ${index === selectedIndex ? 'active' : ''}`}
              onClick={() => {
                if (index === selectedIndex) {
                  handleSettingChange(1);
                } else {
                  setSelectedIndex(index);
                  playSound('focus');
                }
              }}
            >
              <span className="sound-label">{item.label}</span>

              {item.type === 'slider' && (
                <div className="sound-value-container">
                  <div className="xbox-slider-track" onClick={(e) => handleSliderClick(e, item.id)}>
                    <div
                      className="xbox-slider-fill"
                      style={{ width: `${item.value}%` }}
                    ></div>
                  </div>
                  <span className="sound-value-text">{item.value}%</span>
                </div>
              )}

              {item.type === 'select' && (
                <span className="sound-select-value">{item.value}</span>
              )}
            </div>
          ))}
        </div>

        {/* Right Panel: Description & Options */}
        <div className="sound-info-panel">
          <h3>Audio Options</h3>
          <p>Customize the dashboard sound effects.</p>

          <div className="sound-info-divider"></div>

          <div className="sound-shortcut">
            <div className="xbox-btn-circle yellow">Y</div>
            <span className="shortcut-label">Reset to Defaults</span>
            <p className="shortcut-desc">Press Y to restore original sounds and volume.</p>
          </div>
        </div>
      </div>

      {/* Footer removed to prevent duplicates with global settings footer */}
    </div>
  );
};

export default SoundSettings;
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGamepad } from '../context/GamepadContext';
import playSound from '../utils/soundManager';
import { countries, getEmojiFlag } from 'countries-list';
import '../styles/LanguageSettings.css';

const LanguageSettings = ({ isActive, onBack, onSelect, preview = false, activeCountry }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const { onPress: onGamepadPress } = useGamepad();

  // 1. Core Data Memoization
  const allCountries = useMemo(() => {
    return Object.entries(countries).map(([code, data]) => ({
      code,
      ...data,
      flag: getEmojiFlag(code)
    })).sort((a, b) => {
      if (a.name === 'Australia') return -1;
      if (b.name === 'Australia') return 1;
      return a.name.localeCompare(b.name);
    });
  }, []);

  const filteredCountries = useMemo(() => {
    if (!searchQuery) return allCountries;

    const query = searchQuery.toLowerCase();
    return allCountries.filter(country =>
      country.name.toLowerCase().includes(query) ||
      country.native.toLowerCase().includes(query) ||
      country.code.toLowerCase().includes(query)
    );
  }, [allCountries, searchQuery]);

  // 2. Effects & Listeners
  useEffect(() => {
    const loadCountry = async () => {
      try {
        let codeToSelect = activeCountry;
        if (!codeToSelect) {
          const { settingsApi } = await import('../services/apiServices');
          const saved = await settingsApi.get();
          if (saved && saved.country) {
            codeToSelect = saved.country;
          }
        }
        
        if (codeToSelect) {
          const idx = filteredCountries.findIndex(c => c.code === codeToSelect);
          if (idx !== -1) setSelectedIndex(idx);
        }
      } catch (e) {
        console.error("LanguageSettings: Failed to load country:", e);
      }
    };
    loadCountry();
  }, [filteredCountries, activeCountry]);

  useEffect(() => {
    const handleGlobalSave = async () => {
      try {
        const { settingsApi } = await import('../services/apiServices');
        const current = filteredCountries[selectedIndex];
        if (current) {
          await settingsApi.update({ country: current.code });
        }
      } catch (e) {
        console.error("LanguageSettings: Failed to save country:", e);
      }
    };

    window.addEventListener('dashboard-save-settings', handleGlobalSave);
    return () => window.removeEventListener('dashboard-save-settings', handleGlobalSave);
  }, [selectedIndex, filteredCountries]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      // Allow typing in search box
      if (inputRef.current && document.activeElement === inputRef.current) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
          // Fall through to navigation logic
          e.preventDefault();
        } else if (e.key === 'Escape') {
          inputRef.current.blur();
          return;
        } else {
          // Let standard input events happen
          return;
        }
      }

      e.stopPropagation();

      switch (e.key) {
        case 'ArrowUp':
          playSound('focus');
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredCountries.length - 1));
          break;
        case 'ArrowDown':
          playSound('focus');
          setSelectedIndex(prev => (prev < filteredCountries.length - 1 ? prev + 1 : 0));
          break;
        case 'Enter':
          if (filteredCountries.length > 0) {
            playSound('select');
            if (onSelect) onSelect(filteredCountries[selectedIndex]);
          }
          break;
        case 'Escape':
        case 'Backspace':
          // If search has text, backspace deletes it (handled by input default if focused)
          // If input is NOT focused, or is empty, Backspace goes back
          if (document.activeElement !== inputRef.current) {
            playSound('back');
            if (onBack) onBack();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, selectedIndex, filteredCountries, onBack, onSelect]);

  // Handle gamepad navigation
  useEffect(() => {
    if (!isActive) return;

    const unsub = onGamepadPress((event) => {
      if (event.type !== 'press') return;

      if (event.button === 'dpadUp' || event.button === 'stickUp') {
        playSound('focus');
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredCountries.length - 1));
      }
      if (event.button === 'dpadDown' || event.button === 'stickDown') {
        playSound('focus');
        setSelectedIndex(prev => (prev < filteredCountries.length - 1 ? prev + 1 : 0));
      }
      if (event.button === 'a') {
        if (filteredCountries.length > 0) {
          playSound('select');
          if (onSelect) onSelect(filteredCountries[selectedIndex]);
        }
      }
      if (event.button === 'b') {
        playSound('back');
        if (onBack) onBack();
      }
    });
    return unsub;
  }, [isActive, onGamepadPress, filteredCountries, selectedIndex, onBack, onSelect]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIndex];
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  return (
    <div className={`language-settings-container ${preview ? 'preview-mode' : ''}`} style={{ pointerEvents: (!isActive && preview) ? 'none' : 'auto', opacity: (!isActive && preview) ? 0.8 : 1 }}>
      {!preview && (
        <div className="language-header">
          <h2 className="nxe-content-title" style={{ margin: 0 }}>Select Country</h2>
          <input
            ref={inputRef}
            type="text"
            className="language-search-input"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
      )}

      <div className="language-list" ref={listRef}>
        {filteredCountries.length > 0 ? (
          filteredCountries.map((country, index) => (
            <div
              key={country.code}
              className={`language-option ${index === selectedIndex ? 'active' : ''}`}
              onClick={() => {
                playSound('select');
                setSelectedIndex(index);
                if (onSelect) onSelect(country);
              }}
            >
              <span className="language-flag">{country.flag}</span>
              <div className="language-info">
                <span className="language-name">{country.name}</span>
                <span className="language-native">{country.native}</span>
              </div>
              <span className="language-code">{country.code}</span>
            </div>
          ))
        ) : (
          <div style={{ padding: '20px', color: '#888', textAlign: 'center' }}>
            No matching countries found
          </div>
        )}
      </div>
    </div>
  );
};

export default LanguageSettings;

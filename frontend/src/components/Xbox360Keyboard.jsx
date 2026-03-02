import React, { useState, useCallback, useEffect } from 'react';
import { useGamepad } from '../context/GamepadContext';
import playSound from '../utils/soundManager';

const LAYOUTS = {
  lower: [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l','\''],
    ['z','x','c','v','b','n','m',',','.','-'],
  ],
  upper: [
    ['!','@','#','$','%','^','&','*','(',')'],
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L','"'],
    ['Z','X','C','V','B','N','M','<','>','_'],
  ],
  symbols: [
    ['~','`','|','\\','{','}','[',']','+','='],
    ['!','@','#','$','%','^','&','*','(',')'],
    [':',';','"','\'','<','>',',','.','/','?'],
    ['1','2','3','4','5','6','7','8','9','0'],
  ],
};

const ACTION_KEYS = [
  { id: 'space', label: 'Space', width: 4 },
  { id: 'backspace', label: 'Backspace', width: 2 },
  { id: 'shift', label: 'Shift', width: 2 },
  { id: 'done', label: 'Done', width: 2 },
];

const Xbox360Keyboard = ({ isOpen, onClose, onSubmit, initialValue = '', placeholder = '' }) => {
  const [value, setValue] = useState(initialValue);
  const [row, setRow] = useState(0);
  const [col, setCol] = useState(0);
  const [layoutMode, setLayoutMode] = useState('lower'); // lower | upper | symbols
  const [onActionRow, setOnActionRow] = useState(false);
  const [actionIndex, setActionIndex] = useState(0);
  const { onPress } = useGamepad();

  useEffect(() => { setValue(initialValue); }, [initialValue]);

  const currentLayout = LAYOUTS[layoutMode];

  const handleKeyPress = useCallback((key) => {
    playSound('focus');
    setValue(prev => prev + key);
  }, []);

  const handleAction = useCallback((actionId) => {
    playSound('select');
    switch (actionId) {
      case 'space': setValue(prev => prev + ' '); break;
      case 'backspace': setValue(prev => prev.slice(0, -1)); break;
      case 'shift':
        setLayoutMode(prev => prev === 'lower' ? 'upper' : prev === 'upper' ? 'symbols' : 'lower');
        break;
      case 'done':
        if (onSubmit) onSubmit(value);
        if (onClose) onClose();
        break;
      default: break;
    }
  }, [value, onSubmit, onClose]);

  // Gamepad navigation
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onPress((button) => {
      if (button === 'B') { onClose?.(); return; }

      if (button === 'A') {
        if (onActionRow) {
          handleAction(ACTION_KEYS[actionIndex].id);
        } else {
          handleKeyPress(currentLayout[row][col]);
        }
        return;
      }

      if (button === 'LB') {
        setLayoutMode(prev => prev === 'lower' ? 'upper' : prev === 'upper' ? 'symbols' : 'lower');
        return;
      }
      if (button === 'RB') {
        setLayoutMode(prev => prev === 'lower' ? 'symbols' : prev === 'symbols' ? 'upper' : 'lower');
        return;
      }
      if (button === 'X') {
        setValue(prev => prev.slice(0, -1));
        playSound('back');
        return;
      }
      if (button === 'Y') {
        setValue(prev => prev + ' ');
        playSound('focus');
        return;
      }

      // D-pad navigation
      if (button === 'DpadUp') {
        if (onActionRow) { setOnActionRow(false); return; }
        setRow(prev => Math.max(0, prev - 1));
      }
      if (button === 'DpadDown') {
        if (!onActionRow && row === currentLayout.length - 1) { setOnActionRow(true); return; }
        setRow(prev => Math.min(currentLayout.length - 1, prev + 1));
      }
      if (button === 'DpadLeft') {
        if (onActionRow) { setActionIndex(prev => Math.max(0, prev - 1)); }
        else { setCol(prev => Math.max(0, prev - 1)); }
      }
      if (button === 'DpadRight') {
        if (onActionRow) { setActionIndex(prev => Math.min(ACTION_KEYS.length - 1, prev + 1)); }
        else { setCol(prev => Math.min(currentLayout[row].length - 1, prev + 1)); }
      }
    });
    return unsub;
  }, [isOpen, onPress, onClose, row, col, onActionRow, actionIndex, currentLayout, handleKeyPress, handleAction]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') { onClose?.(); return; }
      if (e.key === 'Enter') {
        if (onActionRow) handleAction(ACTION_KEYS[actionIndex].id);
        else handleKeyPress(currentLayout[row][col]);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (onActionRow) { setOnActionRow(false); return; }
        setRow(prev => Math.max(0, prev - 1));
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!onActionRow && row === currentLayout.length - 1) { setOnActionRow(true); return; }
        setRow(prev => Math.min(currentLayout.length - 1, prev + 1));
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (onActionRow) setActionIndex(prev => Math.max(0, prev - 1));
        else setCol(prev => Math.max(0, prev - 1));
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (onActionRow) setActionIndex(prev => Math.min(ACTION_KEYS.length - 1, prev + 1));
        else setCol(prev => Math.min(currentLayout[row].length - 1, prev + 1));
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        setValue(prev => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, row, col, onActionRow, actionIndex, currentLayout, handleKeyPress, handleAction]);

  if (!isOpen) return null;

  return (
    <div className="xbox-keyboard-overlay" data-testid="xbox-keyboard-overlay">
      <div className="xbox-keyboard" data-testid="xbox-keyboard">
        <div className="kb-text-display">
          <span className="kb-placeholder">{!value && placeholder}</span>
          <span className="kb-value">{value}</span>
          <span className="kb-cursor">|</span>
        </div>

        <div className="kb-mode-indicator">
          <span className={layoutMode === 'lower' ? 'active' : ''}>abc</span>
          <span className={layoutMode === 'upper' ? 'active' : ''}>ABC</span>
          <span className={layoutMode === 'symbols' ? 'active' : ''}>!@#</span>
        </div>

        <div className="kb-grid">
          {currentLayout.map((rowKeys, ri) => (
            <div key={ri} className="kb-row">
              {rowKeys.map((key, ci) => (
                <button
                  key={ci}
                  className={`kb-key ${!onActionRow && ri === row && ci === col ? 'focused' : ''}`}
                  data-testid={`kb-key-${key}`}
                  onClick={() => { handleKeyPress(key); setRow(ri); setCol(ci); setOnActionRow(false); }}
                >
                  {key}
                </button>
              ))}
            </div>
          ))}

          <div className="kb-row kb-actions">
            {ACTION_KEYS.map((action, i) => (
              <button
                key={action.id}
                className={`kb-key kb-action ${onActionRow && i === actionIndex ? 'focused' : ''}`}
                style={{ flex: action.width }}
                data-testid={`kb-action-${action.id}`}
                onClick={() => { handleAction(action.id); setOnActionRow(true); setActionIndex(i); }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="kb-hints">
          <span><b>A</b> Select</span>
          <span><b>B</b> Close</span>
          <span><b>X</b> Backspace</span>
          <span><b>Y</b> Space</span>
          <span><b>LB/RB</b> Switch Layout</span>
        </div>
      </div>
    </div>
  );
};

export default Xbox360Keyboard;

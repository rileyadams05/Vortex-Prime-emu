import React, { useState, useEffect, useRef } from 'react';
import { useGamepad } from '../context/GamepadContext';
import { useTheme } from '../context/ThemeContext';
import playSound from '../utils/soundManager';
import { AlertCircle, Volume2, Globe, Palette, Cpu, Video, Wrench, User, Image } from 'lucide-react';
import GamepadDiagnostic from './GamepadDiagnostic';
import LanguageSettings from './LanguageSettings';
import SoundSettings from './SoundSettings';
import CoreSettings from './CoreSettings';
import ColorSettings from './ColorSettings';
import BackgroundSettings from './BackgroundSettings';
import AccountSettings from './AccountSettings';
import { invoke } from '@tauri-apps/api/core';
import '../styles/NXESettings.css';

// Master Switch: Set to false to enable live streaming gateway, true for "Coming Soon" shield
const IS_STREAMING_LOCKED = true;

// Custom Sunshine Logo component in Xbox Green (with optional pulsing/red ring states)
const SunshineLogo = ({ size = 24, className, color = '#107C10', style }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    style={style}
  >
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

const NXESettings = ({ isActive, onBack, userProfile, isLoggedIn, onLogout }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activePanel, setActivePanel] = useState(null); // Default to null (Sidebar active)
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // 'saving', 'saved'
  const [countryCode, setCountryCode] = useState('AU');
  const [isSunshineRunning, setIsSunshineRunning] = useState(true); // Assume true initially for smooth visual, updated by polling
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState('');
  const [tunnelUrl, setTunnelUrl] = useState('');
  const listRef = useRef(null);
  const { onPress: onGamepadPress } = useGamepad();
  const { changeTheme } = useTheme();

  // Poll Sunshine streaming service status for visual indicator
  useEffect(() => {
    let interval;
    if (activePanel === 'sunshine') {
      const checkStatus = async () => {
        try {
          if (window.__TAURI__) {
            const running = await invoke('check_sunshine_status');
            setIsSunshineRunning(running);
            const url = await invoke('get_tunnel_url');
            if (url) setTunnelUrl(url);
          }
        } catch (e) {
          console.error("Failed to check Sunshine status:", e);
          setIsSunshineRunning(false);
        }
      };
      checkStatus();
      interval = setInterval(checkStatus, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activePanel]);

  const handleSendMagicLink = async () => {
    if (!magicLinkEmail || !magicLinkEmail.includes('@')) {
      setEmailStatus('Please enter a valid email address.');
      return;
    }
    
    setSendingEmail(true);
    setEmailStatus('Sending...');
    
    try {
      if (window.__TAURI__) {
            const result = await invoke('send_magic_link_email', { toEmail: magicLinkEmail, portalUrl: tunnelUrl || 'http://localhost:47990' });
        setEmailStatus(result);
        setMagicLinkEmail('');
        setTimeout(() => setEmailStatus(''), 5000);
      } else {
        // Fallback for dev mode
        setTimeout(() => {
          setEmailStatus('Magic Link sent (Dev Mode)!');
          setMagicLinkEmail('');
          setTimeout(() => setEmailStatus(''), 5000);
        }, 1500);
      }
    } catch (error) {
      console.error("Failed to send magic link:", error);
      setEmailStatus('Failed to send magic link.');
    } finally {
      setSendingEmail(false);
    }
  };

  // Load initial country code
  useEffect(() => {
    const loadCountry = async () => {
      try {
        const { settingsApi } = await import('../services/apiServices');
        const saved = await settingsApi.get();
        if (saved && saved.country) setCountryCode(saved.country);
      } catch (e) {
        console.error("NXESettings: Failed to load country:", e);
      }
    };
    loadCountry();
  }, []);

  const dynamicSettingsItems = [
    { id: 'account', label: 'Account Settings', icon: User, description: 'Manage your primary Discord profile, security tokens, and session status.' },
    { id: 'core', label: 'Core Configuration', icon: AlertCircle, description: 'Configure core system settings including emulator paths, game folders, and metadata sources. Set up your Xenia installation and scanning preferences.' },
    { id: 'sunshine', label: 'Remote Streaming', icon: SunshineLogo, description: 'Play your Xbox 360 games anywhere. Stream Xenia to your phone, tablet, or another PC using the built-in zero-latency streaming portal.' },
    { id: 'sound', label: 'Sound Settings', icon: Volume2, description: 'Configure UI sound effects, navigation sounds, and background music volume. Enable or disable individual audio channels.' },
    { id: 'country', label: 'Country', icon: Globe, description: 'Change the display country/region for the dashboard interface.', badge: countryCode },
    { id: 'color', label: 'Hover Color', icon: Palette, description: 'Change the global accent color for the dashboard interface.' },
    { id: 'background', label: 'Background', icon: Image, description: 'Set a custom wallpaper image for your dashboard.' },
  ];

  const handleSave = () => {
    playSound('select');
    setIsSaving(true);
    setSaveStatus('saving');

    // Trigger save on active sub-components
    window.dispatchEvent(new Event('dashboard-save-settings'));

    // Sequence: Saving (2s) -> Ready to Restart
    setTimeout(() => {
      setSaveStatus('saved');
      setIsDirty(false);
      playSound('panelUnfold'); // Success sound
    }, 2000);
  };

  const executeBackout = () => {
    playSound('back');
    onBack();
  };

  const attemptExit = () => {
    if (activePanel) {
      playSound('back');
      setActivePanel(null);
    } else {
      if (isDirty) {
        playSound('error');
        setShowExitPrompt(true);
      } else {
        executeBackout();
      }
    }
  };

  const handleRestart = async () => {
    playSound('select');
    try {
      if (window.__TAURI__) {
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      } else {
        console.log("Web Preview: App restart simulated.");
        window.location.reload();
      }
    } catch (e) {
      console.error("Restart failed:", e);
      setIsSaving(false);
      setSaveStatus('');
    }
  };

  const handleDefault = () => {
    playSound('select');
    const currentId = activePanel || dynamicSettingsItems[selectedIndex].id;
    if (currentId === 'color') {
      changeTheme('#107C10');
      setIsDirty(true);
    } else if (currentId === 'country') {
      setCountryCode('AU');
      setIsDirty(true);
    } else {
      console.log("Restored to default");
      // Could add a similar overlay for restore if desired
    }
  };

  useEffect(() => {
    if (!isActive) {
      setActivePanel(null);
    }
  }, [isActive]);

  useEffect(() => {
    if (activePanel === null) {
      // ...
    }
  }, [activePanel]);

  useEffect(() => {
    if (!isActive || isSaving) return; // Block input during saving

    const handleKeyDown = (e) => {
      // If saving or prompting to exit, block background keys
      if (isSaving || showExitPrompt) {
        e.preventDefault();
        e.stopImmediatePropagation();
        
        // Handle Exit Prompt Keys using generic letters instead of just xbox keys
        if (showExitPrompt) {
          if (e.key === 'a' || e.key === 'A' || e.key === 'Enter') {
            setShowExitPrompt(false);
            handleSave();
          } else if (e.key === 'b' || e.key === 'B' || e.key === 'x' || e.key === 'X' || e.key === 'Escape' || e.key === 'Backspace') {
            setShowExitPrompt(false);
            executeBackout();
          }
        }
        return;
      }

      // Handle Ctrl+S globally
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
        return;
      }

      // Ignore standard key bindings if user is focused on an input or textarea
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') {
          document.activeElement.blur();
        }
        return; // Let the input type naturally
      }

      e.stopPropagation();

      switch (e.key) {
        case 'ArrowUp':
          playSound('focus');
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : dynamicSettingsItems.length - 1));
          break;
        case 'ArrowDown':
          playSound('focus');
          setSelectedIndex(prev => (prev < dynamicSettingsItems.length - 1 ? prev + 1 : 0));
          break;
        case 'q': // LB
          playSound('focus');
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : dynamicSettingsItems.length - 1));
          break;
        case 'e': // RB
          playSound('focus');
          setSelectedIndex(prev => (prev < dynamicSettingsItems.length - 1 ? prev + 1 : 0));
          break;
        case 'x':
          handleSave();
          break;
        case 'y':
          handleDefault();
          break;
        case 'Enter':
          playSound('select');
          if (dynamicSettingsItems[selectedIndex].id === 'country') {
            setActivePanel('country');
          } else if (dynamicSettingsItems[selectedIndex].id === 'sound') {
            setActivePanel('sound');
          } else if (dynamicSettingsItems[selectedIndex].id === 'core') {
            setActivePanel('core');
          } else if (dynamicSettingsItems[selectedIndex].id === 'color') {
            setActivePanel('color');
          } else if (dynamicSettingsItems[selectedIndex].id === 'account') {
            setActivePanel('account');
          }
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          e.stopImmediatePropagation(); // Prevent dashboard from seeing this
          attemptExit();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isActive, selectedIndex, onBack, activePanel, isSaving, isDirty, showExitPrompt]);

  const selectedRef = useRef(selectedIndex);
  const activePanelRef = useRef(activePanel);
  useEffect(() => { selectedRef.current = selectedIndex; }, [selectedIndex]);
  useEffect(() => { activePanelRef.current = activePanel; }, [activePanel]);

  useEffect(() => {
    if (!isActive || isSaving || showExitPrompt) {
      if (showExitPrompt) {
        const unsub = onGamepadPress((event) => {
          if (event.type !== 'press') return;
          if (event.button === 'a') {
            setShowExitPrompt(false);
            handleSave();
          } else if (event.button === 'b' || event.button === 'x' || event.button === 'y') {
            setShowExitPrompt(false);
            executeBackout();
          }
        });
        return unsub;
      }
      return;
    }
    
    const unsub = onGamepadPress((event) => {
      if (event.type !== 'press') return;

      if (activePanelRef.current) {
        if (activePanelRef.current === 'country' || activePanelRef.current === 'sound' || activePanelRef.current === 'core' || activePanelRef.current === 'color') return;

        if (event.button === 'b') {
          playSound('back');
          setActivePanel(null);
        }
        return;
      }

      if (event.button === 'dpadUp' || event.button === 'stickUp') {
        playSound('focus');
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : dynamicSettingsItems.length - 1));
      }
      if (event.button === 'dpadDown' || event.button === 'stickDown') {
        playSound('focus');
        setSelectedIndex(prev => (prev < dynamicSettingsItems.length - 1 ? prev + 1 : 0));
      }
      if (event.button === 'lb') {
        playSound('focus');
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : dynamicSettingsItems.length - 1));
      }
      if (event.button === 'rb') {
        playSound('focus');
        setSelectedIndex(prev => (prev < dynamicSettingsItems.length - 1 ? prev + 1 : 0));
      }
      if (event.button === 'x') {
        handleSave();
      }
      if (event.button === 'y') {
        handleDefault();
      }
      if (event.button === 'a') {
        playSound('select');
        const currentItem = dynamicSettingsItems[selectedRef.current];
        if (currentItem && currentItem.id === 'country') {
          setActivePanel('country');
        } else if (currentItem && currentItem.id === 'sound') {
          setActivePanel('sound');
        } else if (currentItem && currentItem.id === 'core') {
          setActivePanel('core');
        } else if (currentItem && currentItem.id === 'color') {
          setActivePanel('color');
        } else if (currentItem && currentItem.id === 'account') {
          setActivePanel('account');
        }
      }
      if (event.button === 'b') {
        attemptExit();
      }
    });
    return unsub;
  }, [isActive, onGamepadPress, onBack, isSaving, isDirty, showExitPrompt]);

  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIndex];
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isActive) return null;

  const currentItem = dynamicSettingsItems[selectedIndex];

  return (
    <div className="nxe-settings-container" data-testid="nxe-settings">
      <div className="nxe-settings-title">Settings</div>

      <div className="nxe-settings-body">
        {/* Saving Overlay */}
        {isSaving && (
          <div className="nxe-loading-overlay">
            {saveStatus === 'saving' ? (
              <div className="nxe-dialog-box animate-scale-in">
                <div className="nxe-spinner"></div>
                <div className="nxe-saving-text">Please Wait... Saving</div>
                <div className="nxe-saving-subtext">Do not turn off your console.</div>
              </div>
            ) : (
              <div className="nxe-dialog-box animate-scale-in">
                <div className="nxe-saving-text" style={{ color: '#107C10' }}>Done Saving!</div>
                <div className="nxe-saving-subtext" style={{ marginBottom: '20px' }}>The settings have been applied successfully.</div>

                <button
                  className="nxe-confirm-btn"
                  onClick={handleRestart}
                  autoFocus
                >
                  OK (RESTART)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Exit Prompt Overlay */}
        {showExitPrompt && (
          <div className="nxe-loading-overlay animate-scale-in" style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
            <div className="nxe-dialog-box" style={{ 
              width: '460px', 
              background: '#252526', 
              border: '1px solid #454545',
              boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
              padding: '24px',
              borderRadius: '4px',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '24px' }}>
                <AlertCircle size={32} color="#007acc" style={{ marginRight: '16px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '18px', fontWeight: '500', color: '#ffffff', marginBottom: '8px', fontFamily: '"Segoe UI", system-ui, sans-serif' }}>
                    Unsaved Settings
                  </div>
                  <div style={{ fontSize: '14px', color: '#cccccc', lineHeight: '1.5', fontFamily: '"Segoe UI", system-ui, sans-serif' }}>
                    You have modified configurations that have not been applied. Do you want to apply your changes before exiting?
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  className="nxe-confirm-btn"
                  style={{ background: '#007acc', color: '#ffffff', minWidth: '90px', padding: '6px 16px', fontSize: '14px', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => { setShowExitPrompt(false); handleSave(); }}
                >
                  <div className="xbox-btn-circle green" style={{ marginRight: '8px', transform: 'scale(0.8)' }}>A</div> Apply
                </button>
                <button
                  className="nxe-confirm-btn"
                  style={{ background: '#3e3e42', color: '#ffffff', minWidth: '90px', padding: '6px 16px', fontSize: '14px', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => { setShowExitPrompt(false); executeBackout(); }}
                >
                  <div className="xbox-btn-circle red" style={{ marginRight: '8px', transform: 'scale(0.8)' }}>B</div> Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Left: Sidebar */}
        <div className="nxe-sidebar" ref={listRef}>
          {dynamicSettingsItems.map((item, index) => (
            <div
              key={item.id}
              className={`nxe-sidebar-item ${selectedIndex === index ? 'active' : ''} ${activePanel === item.id ? 'entered' : ''}`}
              onClick={() => {
                playSound('select');
                setSelectedIndex(index);
                setActivePanel(item.id);
              }}
              onMouseEnter={() => {
                if (!activePanel) setSelectedIndex(index);
              }}
            >
              <item.icon size={20} className="nxe-sidebar-icon" />
              <span className="nxe-sidebar-label">{item.label}</span>
              {item.badge && <span className="nxe-sidebar-badge">{item.badge}</span>}
            </div>
          ))}
        </div>

        {/* Right: Content Pane */}
        <div className="nxe-content-pane" data-testid="settings-content-pane" style={{ padding: (currentItem.id === 'sunshine' && IS_STREAMING_LOCKED) ? '0' : '30px 36px', overflow: 'hidden' }}>
          {(currentItem.id === 'sunshine' && IS_STREAMING_LOCKED) ? (
             /* Professional Warning Shield - Filling Entire Right Panel */
             <div className="nxe-streaming-locked-overlay" style={{ height: '100%', borderRadius: '0', border: 'none' }}>
                <div className="hazard-border"></div>
                
                <div className="nxe-locked-content">
                  <Wrench 
                    size={80} 
                    color="#FFD700" 
                    className="warning-yellow-pulse"
                    style={{ marginBottom: '40px' }}
                  />
                  
                  <div style={{ 
                    background: '#FFD700', 
                    color: '#fff', 
                    padding: '12px 32px', 
                    borderRadius: '4px', 
                    fontWeight: '900', 
                    fontSize: '1.2rem',
                    letterSpacing: '1px',
                    marginBottom: '10px',
                    textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
                  }}>
                    REMOTE STREAMING: COMING SOON
                  </div>
                  
                  <div style={{ color: '#FFD700', fontSize: '0.8rem', fontWeight: 900, letterSpacing: '2px', marginBottom: '30px' }}>
                    SYSTEM STATUS: UNDER CONSTRUCTION
                  </div>
                  
                  <p className="warning-description" style={{ fontSize: '1.05rem', maxWidth: '600px', lineHeight: '1.8' }}>
                    Vortex Prime is currently migrating to an official Cloudflare-backed infrastructure. 
                    This upgrade will provide global access via a dedicated domain and guaranteed 
                    zero-latency performance for all console browsers.
                    <br/><br/>
                    <span style={{ color: '#FFD700', fontWeight: 900, letterSpacing: '1px' }}>STAY TUNED...</span>
                  </p>
                </div>

                <div className="hazard-border"></div>
             </div>
          ) : (
            <div className="nxe-content-inner">
              <h2 className="nxe-content-title">{dynamicSettingsItems[selectedIndex].label}</h2>
              <p className="nxe-content-desc">{dynamicSettingsItems[selectedIndex].description}</p>

              <div className={`settings-preview-mount ${activePanel ? 'deep-focus' : ''}`}>
                {dynamicSettingsItems[selectedIndex].id === 'account' && (
                  <AccountSettings 
                    isActive={activePanel === 'account'} 
                    userProfile={userProfile} 
                    isLoggedIn={isLoggedIn} 
                    onLogout={onLogout} 
                    onBack={() => { playSound('back'); setActivePanel(null); }} 
                  />
                )}
                {dynamicSettingsItems[selectedIndex].id === 'core' && (
                  <CoreSettings preview={true} isActive={activePanel === 'core'} onBack={() => { playSound('back'); setActivePanel(null); }} />
                )}
                {dynamicSettingsItems[selectedIndex].id === 'country' && (
                  <LanguageSettings
                    preview={true}
                    isActive={activePanel === 'country'}
                    activeCountry={countryCode}
                    onBack={() => { playSound('back'); setActivePanel(null); }}
                    onSelect={(v) => {
                      setCountryCode(v.code);
                      setIsDirty(true);
                    }}
                  />
                )}
                {dynamicSettingsItems[selectedIndex].id === 'sound' && (
                  <SoundSettings preview={true} isActive={activePanel === 'sound'} onBack={() => { playSound('back'); setActivePanel(null); }} />
                )}
                {dynamicSettingsItems[selectedIndex].id === 'color' && (
                  <ColorSettings 
                    preview={true} 
                    isActive={activePanel === 'color'} 
                    onBack={() => { playSound('back'); setActivePanel(null); }}
                    onColorChange={() => setIsDirty(true)}
                  />
                )}
                {dynamicSettingsItems[selectedIndex].id === 'background' && (
                  <BackgroundSettings
                    preview={true}
                    isActive={activePanel === 'background'}
                    onBack={() => { playSound('back'); setActivePanel(null); }}
                    onDirty={() => setIsDirty(true)}
                  />
                )}
                {dynamicSettingsItems[selectedIndex].id === 'sunshine' && (
                  <div style={{ padding: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                      <div style={{ 
                        background: isSunshineRunning ? '#107C10' : '#4a0d0d', 
                        padding: '12px', 
                        borderRadius: '50%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        transition: 'background-color 0.5s ease',
                        boxShadow: isSunshineRunning ? '0 0 15px rgba(16, 124, 16, 0.4)' : '0 0 15px rgba(220, 20, 60, 0.4)'
                      }}>
                        <SunshineLogo 
                          size={32} 
                          color={isSunshineRunning ? '#fff' : '#DC143C'} 
                          className={isSunshineRunning ? 'sunshine-pulse' : ''} 
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.4rem' }}>Vortex Prime Streaming Portal</h3>
                          <div className={`sunshine-indicator ${isSunshineRunning ? 'active' : 'inactive'}`} title={isSunshineRunning ? "Streaming Gateway Active" : "Streaming Gateway Offline"} style={{ marginTop: 0, marginBottom: 0 }}>
                            <Video size={14} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{isSunshineRunning ? "GATEWAY ACTIVE" : "GATEWAY OFFLINE"}</span>
                          </div>
                        </div>
                        <p style={{ margin: '4px 0 0 0', color: isSunshineRunning ? '#90C31D' : '#DC143C', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.5s ease' }}>
                          {isSunshineRunning ? 'Zero-Latency Remote Play Powered by Sunshine & Moonlight' : 'Streaming Service Not Reachable - Restart Core'}
                        </p>
                      </div>
                    </div>
                    
                    <div style={{ flex: 1, position: 'relative', background: '#000', borderRadius: '12px', overflow: 'hidden', border: `2px solid ${isSunshineRunning ? 'rgba(144, 195, 29, 0.4)' : 'rgba(220, 20, 60, 0.4)'}`, transition: 'border-color 0.5s ease' }}>
                      {/* Embedded Secure Stream Viewer */}
                      <iframe 
                        src={tunnelUrl || 'http://localhost:47990'}
                        title="Vortex Prime Streaming Portal"
                        allow="gamepad; autoplay; fullscreen"
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        // Fallback overlay when the server isn't running
                        onError={(e) => e.target.style.display = 'none'}
                      ></iframe>
                      
                      {/* Instructions Overlay (Shows behind iframe or if iframe fails) */}
                      <div style={{ position: 'absolute', inset: 0, zIndex: -1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px' }}>
                        <SunshineLogo size={48} style={{ opacity: 0.2, marginBottom: '24px' }} />
                        <h4 style={{ color: '#fff', margin: '0 0 12px 0' }}>Streaming Service Not Reachable</h4>
                        <p style={{ color: '#aaa', fontSize: '0.9rem', lineHeight: 1.5, maxWidth: '400px' }}>
                          Ensure the background streaming services (Sunshine & Web Portal) are running. 
                          You can access your portal directly from any device at <br/>
                          <code style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px', marginTop: '12px', display: 'inline-block', color: '#90C31D' }}>{tunnelUrl || 'http://localhost:47990'}</code>
                        </p>
                      </div>
                    </div>
                    
                    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '12px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <label style={{ fontSize: '0.85rem', color: '#ccc', fontWeight: 600 }}>Send Magic Link to Console/Phone</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="email" 
                            placeholder="your.email@example.com"
                            value={magicLinkEmail}
                            onChange={(e) => setMagicLinkEmail(e.target.value)}
                            style={{ flex: 1, padding: '10px 14px', borderRadius: '4px', border: '1px solid rgba(144, 195, 29, 0.4)', background: 'rgba(255,255,255,0.05)', color: '#fff', outline: 'none' }}
                          />
                          <button 
                            onClick={handleSendMagicLink}
                            disabled={sendingEmail}
                            style={{ background: '#107C10', color: '#fff', border: 'none', padding: '0 16px', borderRadius: '4px', fontWeight: 'bold', cursor: sendingEmail ? 'wait' : 'pointer', opacity: sendingEmail ? 0.7 : 1 }}
                          >
                            Send
                          </button>
                        </div>
                        {emailStatus && (
                          <span style={{ fontSize: '0.8rem', color: emailStatus.includes('Failed') ? '#DC143C' : '#90C31D' }}>
                            {emailStatus}
                          </span>
                        )}
                      </div>
                      
                      <button 
                        onClick={() => window.open(tunnelUrl || 'http://localhost:47990', '_blank')}
                        style={{ background: '#107C10', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '24px', fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}
                      >
                        <Globe size={18} /> Open in Browser
                      </button>
                      {!tunnelUrl && (
                        <p style={{ fontSize: '0.78rem', color: '#888', textAlign: 'center', marginTop: '4px' }}>
                          Cloudflare tunnel starting… check back in a few seconds.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Footer */}
      <div className="nxe-footer" data-testid="settings-footer">
        <div className="nxe-footer-item" style={{ cursor: 'default' }}>
          <div className="xbox-btn-bumper">LB</div>
          <div className="xbox-btn-bumper">RB</div>
          <span>Tabs</span>
        </div>
        <div className="nxe-footer-item" onClick={handleSave} style={{ cursor: 'pointer', opacity: (currentItem.id === 'sunshine' && IS_STREAMING_LOCKED) ? 0.3 : 1, pointerEvents: (currentItem.id === 'sunshine' && IS_STREAMING_LOCKED) ? 'none' : 'auto' }}>
          <div className="xbox-btn-circle blue">X</div>
          <span>Save</span>
        </div>
        <div className="nxe-footer-item" onClick={handleDefault} style={{ cursor: 'pointer', opacity: (currentItem.id === 'sunshine' && IS_STREAMING_LOCKED) ? 0.3 : 1, pointerEvents: (currentItem.id === 'sunshine' && IS_STREAMING_LOCKED) ? 'none' : 'auto' }}>
          <div className="xbox-btn-circle yellow">Y</div>
          <span>Default</span>
        </div>
        <div className="nxe-footer-item" onClick={() => {
          if (currentItem.id === 'sunshine' && IS_STREAMING_LOCKED) return;
          playSound('select');
          if (dynamicSettingsItems[selectedIndex].id === 'country') {
            setActivePanel('country');
          } else if (dynamicSettingsItems[selectedIndex].id === 'sound') {
            setActivePanel('sound');
          } else if (dynamicSettingsItems[selectedIndex].id === 'core') {
            setActivePanel('core');
          } else if (dynamicSettingsItems[selectedIndex].id === 'color') {
            setActivePanel('color');
          } else if (dynamicSettingsItems[selectedIndex].id === 'account') {
            setActivePanel('account');
          }
        }} style={{ cursor: 'pointer', opacity: (currentItem.id === 'sunshine' && IS_STREAMING_LOCKED) ? 0.3 : 1, pointerEvents: (currentItem.id === 'sunshine' && IS_STREAMING_LOCKED) ? 'none' : 'auto' }}>
          <div className="xbox-btn-circle green">A</div>
          <span>Select</span>
        </div>
        <div className="nxe-footer-item" onClick={attemptExit} style={{ cursor: 'pointer' }}>
          <div className="xbox-btn-circle red">B</div>
          <span>{activePanel ? 'Back to Settings' : 'Back to Dashboard'}</span>
        </div>
      </div>
    </div>
  );
};

export default NXESettings;

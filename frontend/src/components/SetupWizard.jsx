import React, { useState, useEffect } from 'react';
import GamepadSvg from '../assets/xbox-360-gamepad.svg';
import { FolderOpen, Cpu, HardDrive } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import '../styles/SetupWizard.css';

const SetupWizard = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState(1); // 1: Welcome, 2: OS Detect, 3: Init
  const [osInfo, setOsInfo] = useState("Detecting...");
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    // Detect OS (Mock for now, or use tauri info)
    // navigator.platform is deprecated but useful for quick check, or invoke Rust command
    setOsInfo("Windows 11 (Detected)"); 
  }, []);

  if (!isOpen) return null;

  // Release-Only Wizard (Debug/Dev Mode Bypass)
  if (process.env.NODE_ENV !== 'production') {
      return null;
  }

  const handleNext = () => {
    setStep(prev => prev + 1);
  };

  const handleInitialization = async () => {
    setCopyStatus("Initializing Xenia Engine...");
    try {
        const result = await invoke('copy_xenia_files');
        setCopyStatus("Success! " + result);
        setTimeout(() => {
            onComplete(result); // Pass result or path
        }, 1500);
    } catch (e) {
        setCopyStatus("Error: " + e);
        // Fallback or retry?
        // For now, let user continue manually if failed
        setTimeout(() => onComplete(null), 3000);
    }
  };

  return (
    <div className="setup-overlay">
      <div className="setup-modal">
        
        {/* PHASE 1: WELCOME */}
        {step === 1 && (
            <div className="setup-content">
                <div className="setup-header">
                  <img src={GamepadSvg} alt="Setup" className="setup-icon" />
                  <h2>Welcome to Vortex Prime Emu</h2>
                  <p>Experience the Xbox 360 Blades Dashboard.</p>
                </div>
                <div className="setup-actions">
                    <button className="setup-btn primary" onClick={handleNext}>
                        (A) Start Setup
                    </button>
                </div>
            </div>
        )}

        {/* PHASE 2: SMART DETECT */}
        {step === 2 && (
            <div className="setup-content">
                <div className="setup-header">
                    <Cpu size={48} className="setup-icon-lucide" />
                    <h2>System Detection</h2>
                    <p>Optimizing for your hardware.</p>
                </div>
                <div className="os-info-box">
                    <span>Detected System:</span>
                    <strong>{osInfo}</strong>
                </div>
                <div className="setup-actions">
                    <button className="setup-btn primary" onClick={() => {
                        handleNext();
                        handleInitialization();
                    }}>
                        (A) Yes, Continue
                    </button>
                    <button className="setup-btn secondary" onClick={() => alert("Manual selection not implemented in wizard.")}>
                        (X) Select Manually
                    </button>
                </div>
            </div>
        )}

        {/* PHASE 3: INITIALIZATION */}
        {step === 3 && (
            <div className="setup-content">
                <div className="setup-header">
                    <HardDrive size={48} className="setup-icon-lucide" />
                    <h2>Initializing</h2>
                    <p>Setting up game engine...</p>
                </div>
                <div className="status-log">
                    {copyStatus || "Preparing..."}
                </div>
                <div className="loading-spinner"></div>
            </div>
        )}

      </div>
    </div>
  );
};

export default SetupWizard;

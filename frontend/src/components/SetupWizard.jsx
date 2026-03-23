import React, { useState, useEffect } from 'react';
import GamepadSvg from '../assets/xbox-360-gamepad.svg';
import { FolderOpen, Cpu, HardDrive } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { gpuApi } from '../services/apiServices';
import '../styles/SetupWizard.css';

const SetupWizard = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState(1); // 1: Welcome, 2: Hardware, 3: OS Detect, 4: Init
  const [osInfo, setOsInfo] = useState("Detecting...");
  const [gpuType, setGpuType] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    // Detect OS using standard platform string
    const platform = window.navigator.platform;
    if (platform.includes('Win')) setOsInfo("Windows PC (Detected)");
    else if (platform.includes('Mac')) setOsInfo("macOS (Detected)");
    else if (platform.includes('Linux')) setOsInfo("Linux (Detected)");
    else setOsInfo("Unknown System");
  }, []);

  if (!isOpen) return null;

  // Release-Only Wizard (Debug/Dev Mode Bypass)
  if (process.env.NODE_ENV !== 'production') {
      return null;
  }

  const handleNext = () => {
    setStep(prev => prev + 1);
  };

  const handleGpuSelection = async (type) => {
    setGpuType(type);
    try {
        await gpuApi.configure(type);
        setStep(3); // Go to OS Detect
    } catch (e) {
        console.error("GPU Config Error:", e);
        // Continue anyway or show error?
        // For now, assume it worked or failed non-critically
        setStep(3);
    }
  };

  const handleInitialization = async () => {
    setCopyStatus("Initializing Xenia Engine...");
    
    // Ensure portable.txt exists (handled by Python backend now, but good to have redundant check if possible)
    
    if (!window.__TAURI_INTERNALS__) {
        setCopyStatus("Error: Tauri API not available (Browser Mode)");
        setTimeout(() => onComplete(null), 3000);
        return;
    }

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

        {/* PHASE 2: HARDWARE SELECTION */}
        {step === 2 && (
            <div className="setup-content">
                <div className="setup-header">
                    <Cpu size={48} className="setup-icon-lucide" />
                    <h2>Hardware Detection</h2>
                    <p>Select your GPU for optimization.</p>
                </div>
                <div className="setup-actions" style={{ flexDirection: 'column', gap: '10px' }}>
                    <button className="setup-btn primary" onClick={() => handleGpuSelection('nvidia')}>
                        (A) NVIDIA (High Performance)
                    </button>
                    <button className="setup-btn secondary" onClick={() => handleGpuSelection('amd')}>
                        (X) AMD (Vulkan Optimized)
                    </button>
                </div>
            </div>
        )}

        {/* PHASE 3: SMART DETECT */}
        {step === 3 && (
            <div className="setup-content">
                <div className="setup-header">
                    <HardDrive size={48} className="setup-icon-lucide" />
                    <h2>System Confirmation</h2>
                    <p>Ready to initialize.</p>
                </div>
                <div className="os-info-box">
                    <span>Detected System:</span>
                    <strong>{osInfo}</strong>
                    <br/>
                    <span>GPU Mode:</span>
                    <strong>{gpuType ? gpuType.toUpperCase() : "Standard"}</strong>
                </div>
                <div className="setup-actions">
                    <button className="setup-btn primary" onClick={() => {
                        setStep(4);
                        handleInitialization();
                    }}>
                        (A) Install Engine
                    </button>
                </div>
            </div>
        )}

        {/* PHASE 4: INITIALIZATION */}
        {step === 4 && (
            <div className="setup-content">
                <div className="setup-header">
                    <FolderOpen size={48} className="setup-icon-lucide" />
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

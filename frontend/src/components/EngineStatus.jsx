import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = '/api';

/**
 * EngineStatus - Shows the internal Xenia engine status and provides
 * a "Migrate Engine" button that performs the hot-swap from M:\ drive.
 */
const EngineStatus = () => {
    const [status, setStatus] = useState(null);
    const [migrating, setMigrating] = useState(false);
    const [migrateResult, setMigrateResult] = useState(null);
    const [gpuInfo, setGpuInfo] = useState(null);
    const [applyingProfile, setApplyingProfile] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const [engineRes, gpuRes] = await Promise.all([
                axios.get(`${API}/engine/status`),
                axios.get(`${API}/gpu/detect`),
            ]);
            setStatus(engineRes.data);
            setGpuInfo(gpuRes.data);
        } catch (err) {
            console.error('Failed to fetch engine/GPU status:', err);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleMigrate = async () => {
        if (!window.confirm(
            'This will MOVE the engine from M:\\my project\\For xenia\\dashbroad\\xenia-canary ' +
            'to the project internal storage, wiping any existing engine there first.\n\nProceed?'
        )) return;

        setMigrating(true);
        setMigrateResult(null);
        try {
            const res = await axios.post(`${API}/engine/migrate`, {});
            setMigrateResult({ success: true, message: res.data.message });
            await fetchStatus();
        } catch (err) {
            setMigrateResult({
                success: false,
                message: err.response?.data?.detail || err.message,
            });
        } finally {
            setMigrating(false);
        }
    };

    const handleApplyGpuProfile = async () => {
        setApplyingProfile(true);
        try {
            const res = await axios.post(`${API}/gpu/apply-profile`, {});
            setMigrateResult({
                success: true,
                message: `Applied ${res.data.vendor?.toUpperCase()} GPU profile successfully.`,
            });
        } catch (err) {
            setMigrateResult({
                success: false,
                message: err.response?.data?.detail || 'Failed to apply GPU profile',
            });
        } finally {
            setApplyingProfile(false);
        }
    };

    if (!status) {
        return (
            <div className="engine-status-panel">
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Loading engine status…</p>
            </div>
        );
    }

    return (
        <div className="engine-status-panel" style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '16px 20px',
            marginBottom: 16,
        }}>
            <h4 style={{ margin: '0 0 12px', color: '#fff', fontSize: '0.9rem', letterSpacing: 2, textTransform: 'uppercase' }}>
                🎮 Vortex Engine Status
            </h4>

            {/* Engine presence */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <StatusRow
                    label="Engine"
                    value={status.present ? (status.exe_found ? '✓ Ready' : '⚠ Folder exists, exe missing') : '✗ Not installed'}
                    color={status.exe_found ? '#00c853' : status.present ? '#ff9800' : '#f44336'}
                />
                <StatusRow
                    label="Portable Mode"
                    value={status.portable_mode ? '✓ Enabled' : '✗ Disabled'}
                    color={status.portable_mode ? '#00c853' : '#f44336'}
                />
                <StatusRow
                    label="Engine Path"
                    value={status.engine_dir}
                    mono
                />
                <StatusRow
                    label="Source Available"
                    value={status.source_available ? '✓ Found on M:\\ drive' : '✗ Not found (already migrated?)'}
                    color={status.source_available ? '#00c853' : '#888'}
                />
            </div>

            {/* GPU Info */}
            {gpuInfo && (
                <div style={{ marginBottom: 16 }}>
                    <StatusRow
                        label="GPU Vendor"
                        value={gpuInfo.vendor?.toUpperCase() || 'Unknown'}
                        color={gpuInfo.vendor === 'nvidia' ? '#76b900' : gpuInfo.vendor === 'amd' ? '#ed1c24' : '#888'}
                    />
                    <StatusRow
                        label="Backend"
                        value={gpuInfo.vendor === 'nvidia' ? 'D3D12 (EDRAM ROV enabled)' : gpuInfo.vendor === 'amd' ? 'Vulkan (EDRAM ROV disabled)' : 'D3D12 (safe defaults)'}
                        color="rgba(255,255,255,0.7)"
                    />
                </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                    onClick={handleMigrate}
                    disabled={migrating || !status.source_available}
                    style={{
                        background: status.source_available ? 'linear-gradient(135deg, #107C10, #0b550b)' : 'rgba(255,255,255,0.1)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '8px 16px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        letterSpacing: 1,
                        cursor: status.source_available ? 'pointer' : 'not-allowed',
                        opacity: migrating ? 0.7 : 1,
                        textTransform: 'uppercase',
                    }}
                >
                    {migrating ? '⏳ Migrating…' : '🔄 Migrate Engine'}
                </button>

                <button
                    onClick={fetchStatus}
                    style={{
                        background: 'rgba(255,255,255,0.1)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 4,
                        padding: '8px 12px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                    }}
                >
                    ↻ Refresh
                </button>

                {gpuInfo && (
                    <button
                        onClick={handleApplyGpuProfile}
                        disabled={applyingProfile}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: 4,
                            padding: '8px 12px',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            opacity: applyingProfile ? 0.7 : 1,
                        }}
                    >
                        {applyingProfile ? '⏳ Applying…' : '🖥 Apply GPU Profile'}
                    </button>
                )}
            </div>

            {/* Migration result message */}
            {migrateResult && (
                <div style={{
                    marginTop: 12,
                    padding: '8px 12px',
                    borderRadius: 4,
                    background: migrateResult.success ? 'rgba(0,200,83,0.15)' : 'rgba(244,67,54,0.15)',
                    border: `1px solid ${migrateResult.success ? '#00c853' : '#f44336'}`,
                    fontSize: '0.78rem',
                    color: migrateResult.success ? '#00c853' : '#f44336',
                }}>
                    {migrateResult.message}
                </div>
            )}
        </div>
    );
};

/**
 * Small helper row for key → value display
 */
const StatusRow = ({ label, value, color, mono }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.75rem',
            letterSpacing: 1,
            textTransform: 'uppercase',
            minWidth: 110,
            flexShrink: 0,
            paddingTop: 2,
        }}>
            {label}
        </span>
        <span style={{
            color: color || 'rgba(255,255,255,0.85)',
            fontSize: '0.8rem',
            fontFamily: mono ? 'monospace' : 'inherit',
            wordBreak: 'break-all',
        }}>
            {value}
        </span>
    </div>
);

export default EngineStatus;

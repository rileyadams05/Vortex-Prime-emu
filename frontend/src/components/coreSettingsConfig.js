/**
 * Curated Xenia Canary config whitelist.
 * Only the settings that matter for end users are shown in the UI.
 * Keeping this in a separate file avoids the Babel visual-edits plugin
 * from trying to traverse the data through JSX .map() calls.
 */

export const SECTION_ORDER = [
    'GLOBAL', 'GAME'
];

export const CURATED_SECTIONS = {
    GLOBAL: {
        label: 'Global Config',
        settings: [
            // --- GPU (Performance & Visuals) ---
            { section: 'GPU', key: 'd3d12_edram_rov', label: 'Use EDRAM ROV (D3D12)', type: 'select', options: [false, true] },
            { section: 'GPU', key: 'draw_resolution_scale_x', label: 'Internal Resolution X', type: 'select', options: [1, 2, 3] },
            { section: 'GPU', key: 'draw_resolution_scale_y', label: 'Internal Resolution Y', type: 'select', options: [1, 2, 3] },
            { section: 'GPU', key: 'native_2x_msaa', label: 'Enable 2x MSAA', type: 'select', options: [false, true] },
            { section: 'GPU', key: 'framerate_limit', label: 'Max Framerate (FPS)', type: 'select', options: [0, 30, 60] },
            { section: 'GPU', key: 'vsync', label: 'Vertical Sync (V-Sync)', type: 'select', options: [false, true] },
            { section: 'GPU', key: 'gpu_allow_invalid_fetch_constants', label: 'Fix AMD Geometry', type: 'select', options: [true, false] },
            
            // --- CPU (Core Engine) ---
            { section: 'CPU', key: 'break_on_unimplemented_instructions', label: 'Crash on Unimplemented', type: 'select', options: [false, true] },
            { section: 'CPU', key: 'enable_early_precompilation', label: 'Precompile Shaders', type: 'select', options: [true, false] },
            
            // --- Display (Post-Processing) ---
            { section: 'Display', key: 'postprocess_antialiasing', label: 'Post-Process AA', type: 'select', options: ['', 'fxaa', 'fxaa_extreme'] },
            { section: 'Display', key: 'postprocess_scaling_and_sharpening', label: 'FSR / Upscaling', type: 'select', options: ['', 'fsr', 'cas'] },
            { section: 'Display', key: 'fullscreen', label: 'Start in Fullscreen', type: 'select', options: [true, false] },
        ]
    },
    GAME: {
        label: 'Game Config',
        settings: [
            // Game specific usually inherits same useful toggles
            { section: 'GPU', key: 'draw_resolution_scale_x', label: 'Internal Resolution X', type: 'select', options: [1, 2, 3] },
            { section: 'GPU', key: 'draw_resolution_scale_y', label: 'Internal Resolution Y', type: 'select', options: [1, 2, 3] },
            { section: 'Display', key: 'postprocess_scaling_and_sharpening', label: 'FSR / Upscaling', type: 'select', options: ['', 'fsr', 'cas'] },
            { section: 'General', key: 'apply_patches', label: 'Enable 60FPS/Widescreen Patches', type: 'select', options: [true, false] },
        ] // Special section for management dashboard
    }
};

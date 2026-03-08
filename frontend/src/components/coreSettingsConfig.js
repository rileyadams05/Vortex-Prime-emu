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
            { section: 'GPU', key: 'd3d12_edram_rov', label: 'DirectX 12 Optimization (Nvidia)', type: 'select', options: [false, true] },
            { section: 'GPU', key: 'draw_resolution_scale_x', label: 'Resolution Upscale (Width)', type: 'select', options: [1, 2, 3] },
            { section: 'GPU', key: 'draw_resolution_scale_y', label: 'Resolution Upscale (Height)', type: 'select', options: [1, 2, 3] },
            { section: 'GPU', key: 'native_2x_msaa', label: 'Smooth Edges (2x MSAA)', type: 'select', options: [false, true] },
            { section: 'GPU', key: 'framerate_limit', label: 'Framerate Cap (FPS Limit)', type: 'select', options: [0, 30, 60] },
            { section: 'GPU', key: 'vsync', label: 'V-Sync (Prevent Screen Tearing)', type: 'select', options: [false, true] },
            { section: 'GPU', key: 'gpu_allow_invalid_fetch_constants', label: 'AMD GPU Glitch Fix', type: 'select', options: [true, false] },
            
            // --- CPU (Core Engine) ---
            { section: 'CPU', key: 'enable_early_precompilation', label: 'Preload Shaders (Reduce Stutter)', type: 'select', options: [true, false] },
            
            // --- Display (Post-Processing) ---
            { section: 'Display', key: 'postprocess_antialiasing', label: 'Post-Process Anti-Aliasing', type: 'select', options: ['', 'fxaa', 'fxaa_extreme'] },
            { section: 'Display', key: 'postprocess_scaling_and_sharpening', label: 'Image Upscaling Method', type: 'select', options: ['', 'fsr', 'cas'] },
            { section: 'Display', key: 'fullscreen', label: 'Launch in Fullscreen', type: 'select', options: [true, false] },
        ]
    },
    GAME: {
        label: 'Game Config',
        settings: [
            // Game specific usually inherits same useful toggles
            { section: 'GPU', key: 'draw_resolution_scale_x', label: 'Resolution Upscale (Width)', type: 'select', options: [1, 2, 3] },
            { section: 'GPU', key: 'draw_resolution_scale_y', label: 'Resolution Upscale (Height)', type: 'select', options: [1, 2, 3] },
            { section: 'Display', key: 'postprocess_scaling_and_sharpening', label: 'Image Upscaling Method', type: 'select', options: ['', 'fsr', 'cas'] },
            { section: 'General', key: 'apply_patches', label: 'Enable Game Mods (60FPS / Widescreen)', type: 'select', options: [true, false] },
        ] // Special section for management dashboard
    }
};

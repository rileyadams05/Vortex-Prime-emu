/**
 * Curated Xenia Canary config whitelist.
 * Only the settings that matter for end users are shown in the UI.
 * Keeping this in a separate file avoids the Babel visual-edits plugin
 * from trying to traverse the data through JSX .map() calls.
 */

export const SECTION_ORDER = [
    'GAME', 'APU', 'CPU', 'Display', 'GPU', 'General', 'Content',
];

export const CURATED_SECTIONS = {
    GAME: {
        label: 'Game Config',
        settings: [] // Special section for management dashboard
    },
    APU: {
        label: 'APU',
        settings: [
            { key: 'apu', label: 'Audio Backend', type: 'select', options: ['any', 'nop', 'sdl', 'xaudio2'] },
            { key: 'apu_max_queued_frames', label: 'Max Queued Frames', type: 'select', options: [8, 16, 32, 48, 64] },
            { key: 'enable_xmp', label: 'Enable XMP', type: 'select', options: [true, false] },
            { key: 'mute', label: 'Mute', type: 'select', options: [false, true] },
            { key: 'use_dedicated_xma_thread', label: 'Dedicated XMA Thread', type: 'select', options: [true, false] },
            { key: 'ffmpeg_verbose', label: 'FFmpeg Verbose', type: 'select', options: [false, true] },
        ],
    },
    CPU: {
        label: 'CPU',
        settings: [
            { key: 'cpu', label: 'CPU Backend', type: 'select', options: ['any', 'x64'] },
            { key: 'break_on_unimplemented_instructions', label: 'Break on Unimplemented', type: 'select', options: [false, true] },
            { key: 'clock_no_scaling', label: 'No Clock Scaling', type: 'select', options: [false, true] },
            { key: 'inline_mmio_access', label: 'Inline MMIO Access', type: 'select', options: [false, true] },
            { key: 'enable_early_precompilation', label: 'Early Precompilation', type: 'select', options: [true, false] },
            { key: 'use_fast_dot_product', label: 'Fast Dot Product', type: 'select', options: [true, false] },
        ],
    },
    Display: {
        label: 'Display',
        settings: [
            { key: 'fullscreen', label: 'Fullscreen', type: 'select', options: [true, false] },
            { key: 'postprocess_antialiasing', label: 'Anti-Aliasing', type: 'select', options: ['', 'fxaa', 'fxaa_extreme', 'fxaa_ultra'] },
            { key: 'postprocess_scaling_and_sharpening', label: 'Scaling & Sharpening', type: 'select', options: ['', 'bilinear', 'cas', 'fsr'] },
            { key: 'postprocess_dither', label: 'Dithering', type: 'select', options: [true, false] },
            { key: 'present_letterbox', label: 'Letterbox', type: 'select', options: [true, false] },
            { key: 'present_safe_area_x', label: 'Safe Area X (%)', type: 'select', options: [100, 95, 90, 85, 80] },
            { key: 'present_safe_area_y', label: 'Safe Area Y (%)', type: 'select', options: [100, 95, 90, 85, 80] },
            // Video output (merged from Video section)
            { key: 'widescreen', label: 'Widescreen', type: 'select', options: [true, false] },
            { key: 'internal_display_resolution', label: 'Internal Resolution', type: 'select', options: ['720p', '1080p', '1440p', '4k'] },
            { key: 'video_standard', label: 'Video Standard', type: 'select', options: ['ntsc-m', 'ntsc-j', 'pal-i'] },
            { key: 'avpack', label: 'AV Pack', type: 'select', options: ['hdmi', 'component', 'composite', 'vga'] },
            { key: 'use_50Hz_mode', label: '50Hz Mode (PAL)', type: 'select', options: [false, true] },
        ],
    },
    GPU: {
        label: 'GPU',
        settings: [
            { key: 'gpu', label: 'GPU Backend', type: 'select', options: ['any', 'd3d12', 'vulkan'] },
            { key: 'vsync', label: 'V-Sync', type: 'select', options: [true, false] },
            { key: 'gpu_allow_invalid_fetch_constants', label: 'Allow Invalid Fetch Consts', type: 'select', options: [true, false] },
            { key: 'd3d12_edram_rov', label: 'EDRAM ROV (D3D12)', type: 'select', options: [true, false] },
            { key: 'draw_resolution_scale_x', label: 'Resolution Scale X', type: 'select', options: [1, 2, 3] },
            { key: 'draw_resolution_scale_y', label: 'Resolution Scale Y', type: 'select', options: [1, 2, 3] },
            { key: 'framerate_limit', label: 'Framerate Limit (FPS)', type: 'select', options: [60, 30, 0] },
            { key: 'native_2x_msaa', label: 'Native 2× MSAA', type: 'select', options: [false, true] },
            { key: 'anisotropic_override', label: 'Anisotropic Override', type: 'select', options: [0, 2, 4, 8, 16] },
        ],
    },
    General: {
        label: 'General',
        settings: [
            { key: 'apply_patches', label: 'Apply Patches', type: 'select', options: [true, false] },
            { key: 'discord', label: 'Discord Rich Presence', type: 'select', options: [true, false] },
            { key: 'controller_hotkeys', label: 'Controller Hotkeys', type: 'select', options: [true, false] },
            { key: 'allow_plugins', label: 'Allow Plugins', type: 'select', options: [true, false] },
            { key: 'priority_class', label: 'Process Priority', type: 'select', options: [2, 1, 0] },
        ],
    },
    Content: {
        label: 'Content',
        settings: [
            { key: 'license_mask', label: 'License Mask', type: 'select', options: [0, 1, -1] },
        ],
    },
};


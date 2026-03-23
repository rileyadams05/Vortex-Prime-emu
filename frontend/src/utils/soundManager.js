// Sound Manager - Uses exact sounds from ALHROOBIX/Xenia-Dashboard
const audioCache = {};
const PUBLIC_BASE = process.env.PUBLIC_URL || '';
const withPublicPath = (path) => `${PUBLIC_BASE}${path}`;

const SOUND_MAP = {
  focus: withPublicPath('/assets/audio/focus.wav'),
  select: withPublicPath('/assets/audio/select.wav'),
  back: withPublicPath('/assets/audio/back.wav'),
  panelUnfold: withPublicPath('/assets/audio/panel-unfold.wav'),
  panelLeft: withPublicPath('/assets/audio/panel-left.wav'),
  panelRight: withPublicPath('/assets/audio/panel-right.wav'),
  channelUp: withPublicPath('/assets/audio/channel-up.wav'),
  channelDown: withPublicPath('/assets/audio/channel-down.wav'),
};

export const playSound = (soundName) => {
  const path = SOUND_MAP[soundName];
  if (!path) return;

  try {
    // Clone and play for overlapping sounds
    if (!audioCache[soundName]) {
      audioCache[soundName] = new Audio(path);
      audioCache[soundName].preload = 'auto';
    }
    const audio = audioCache[soundName].cloneNode();
    audio.volume = 0.7;
    audio.play().catch(() => { });
  } catch (e) {
    // Silent fail
  }
};

// Preload all sounds on first import
Object.entries(SOUND_MAP).forEach(([key, path]) => {
  const audio = new Audio(path);
  audio.preload = 'auto';
  audioCache[key] = audio;
});

export default playSound;

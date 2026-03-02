// Sound Manager - Uses exact sounds from ALHROOBIX/Xenia-Dashboard
const audioCache = {};

const SOUND_MAP = {
  focus: '/audio/focus.wav',
  select: '/audio/select.wav',
  back: '/audio/back.wav',
  panelUnfold: '/audio/panel-unfold.wav',
  panelLeft: '/audio/panel-left.wav',
  panelRight: '/audio/panel-right.wav',
  channelUp: '/audio/channel-up.wav',
  channelDown: '/audio/channel-down.wav',
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
    audio.play().catch(() => {});
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

import { invoke } from '@tauri-apps/api/core';

const TWITCH_RTMPS_BASE = 'rtmps://live.twitch.tv/app/';
const YOUTUBE_RTMPS_BASE = 'rtmps://a.rtmp.youtube.com/live2/';

function requireKey(value, name) {
  const key = String(value || '').trim();
  if (!key) {
    throw new Error(`${name} stream key is required.`);
  }
  return key;
}

export function buildStreamTargets({ twitchStreamKey, youtubeStreamKey }) {
  const targets = [];

  if (twitchStreamKey) {
    targets.push(`${TWITCH_RTMPS_BASE}${encodeURIComponent(requireKey(twitchStreamKey, 'Twitch'))}`);
  }

  if (youtubeStreamKey) {
    targets.push(`${YOUTUBE_RTMPS_BASE}${encodeURIComponent(requireKey(youtubeStreamKey, 'YouTube'))}`);
  }

  if (targets.length === 0) {
    throw new Error('At least one Twitch or YouTube stream key is required.');
  }

  return targets;
}

export async function startStreamRelay(credentials) {
  try {
    const targets = buildStreamTargets(credentials);
    await invoke('start_ffmpeg_relay', { targets });
    return { ok: true, targets: targets.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to start Streamz relay: ${message}`);
  }
}

export async function stopStreamRelay() {
  try {
    await invoke('stop_ffmpeg_relay');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to stop Streamz relay: ${message}`);
  }
}

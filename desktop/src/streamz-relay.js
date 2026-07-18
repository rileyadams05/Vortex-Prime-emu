import { invoke } from '@tauri-apps/api/core';

const TWITCH_RTMPS_BASE = 'rtmps://live.twitch.tv/app/';
const YOUTUBE_RTMPS_BASE = 'rtmps://a.rtmp.youtube.com/live2/';
const KICK_RTMPS_BASE = 'rtmps://fa7ae5a97aa4.global-contribute.live-video.net/app/';

function requireKey(value, name) {
  const key = String(value || '').trim();
  if (!key) {
    throw new Error(`${name} stream key is required.`);
  }
  return key;
}

export function buildStreamTargets({ twitchStreamKey, youtubeStreamKey, kickStreamKey }) {
  const targets = [
    `${TWITCH_RTMPS_BASE}${encodeURIComponent(requireKey(twitchStreamKey, 'Twitch'))}`,
    `${YOUTUBE_RTMPS_BASE}${encodeURIComponent(requireKey(youtubeStreamKey, 'YouTube'))}`,
    `${KICK_RTMPS_BASE}${encodeURIComponent(requireKey(kickStreamKey, 'Kick'))}`,
  ];

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

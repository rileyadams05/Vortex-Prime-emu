function getTauriInvoke() {
  return window.__TAURI__?.core?.invoke || null;
}

export function isRunningInsideTauri() {
  return Boolean(getTauriInvoke());
}

function requireStreamKey(value, name) {
  const key = String(value || '').trim();
  if (!key) {
    throw new Error(`${name} stream key is required.`);
  }
  return key;
}

export function buildStreamTargets({ twitchStreamKey, youtubeStreamKey, kickStreamKey }) {
  return [
    `rtmps://live.twitch.tv/app/${encodeURIComponent(requireStreamKey(twitchStreamKey, 'Twitch'))}`,
    `rtmps://a.rtmp.youtube.com/live2/${encodeURIComponent(requireStreamKey(youtubeStreamKey, 'YouTube'))}`,
    `rtmps://fa7ae5a97aa4.global-contribute.live-video.net/app/${encodeURIComponent(requireStreamKey(kickStreamKey, 'Kick'))}`,
  ];
}

export async function startStreamRelay(credentials) {
  const invoke = getTauriInvoke();
  if (!invoke) {
    return { ok: false, available: false };
  }

  const targets = buildStreamTargets(credentials);
  await invoke('start_ffmpeg_relay', { targets });
  return { ok: true, available: true, targetCount: targets.length };
}

export async function stopStreamRelay() {
  const invoke = getTauriInvoke();
  if (!invoke) {
    return { ok: false, available: false };
  }

  await invoke('stop_ffmpeg_relay');
  return { ok: true, available: true };
}

export async function autoStartStreamRelay(loadCredentials) {
  if (!isRunningInsideTauri()) {
    return { ok: false, available: false };
  }

  const credentials = await loadCredentials();
  if (!credentials) {
    return { ok: false, available: true, reason: 'No linked stream accounts found.' };
  }

  return startStreamRelay(credentials);
}

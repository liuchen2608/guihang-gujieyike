export const DEFAULT_AUDIO_VOLUME = 0.35;

export function parseStoredAudioVolume(value: string | null) {
  if (value === null) return DEFAULT_AUDIO_VOLUME;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : DEFAULT_AUDIO_VOLUME;
}

export function clampAudioVolume(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_AUDIO_VOLUME;
  return Math.min(1, Math.max(0, value));
}

export function resolvePlaybackVolume(value: number) {
  const normalized = clampAudioVolume(value);
  return normalized === 0 ? DEFAULT_AUDIO_VOLUME : normalized;
}

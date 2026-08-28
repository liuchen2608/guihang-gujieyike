import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_AUDIO_VOLUME,
  clampAudioVolume,
  parseStoredAudioVolume,
  resolvePlaybackVolume,
} from "../lib/audio-settings.ts";

test("missing or invalid saved volume falls back to an audible default", () => {
  assert.equal(parseStoredAudioVolume(null), DEFAULT_AUDIO_VOLUME);
  assert.equal(parseStoredAudioVolume("not-a-number"), DEFAULT_AUDIO_VOLUME);
  assert.equal(parseStoredAudioVolume("2"), DEFAULT_AUDIO_VOLUME);
});

test("a valid saved volume is preserved, including intentional mute", () => {
  assert.equal(parseStoredAudioVolume("0"), 0);
  assert.equal(parseStoredAudioVolume("0.62"), 0.62);
});

test("range input values are clamped to the media element range", () => {
  assert.equal(clampAudioVolume(-0.2), 0);
  assert.equal(clampAudioVolume(0.48), 0.48);
  assert.equal(clampAudioVolume(1.2), 1);
});

test("pressing play at zero volume restores an audible volume", () => {
  assert.equal(resolvePlaybackVolume(0), DEFAULT_AUDIO_VOLUME);
  assert.equal(resolvePlaybackVolume(0.7), 0.7);
});

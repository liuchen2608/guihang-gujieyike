"use client";

import { useEffect, useRef, useState } from "react";
import {
  clampAudioVolume,
  parseStoredAudioVolume,
  resolvePlaybackVolume,
} from "@/lib/audio-settings";

const ENABLED_KEY = "guihang_music_enabled";
const VOLUME_KEY = "guihang_music_volume";
const COLLAPSED_KEY = "guihang_music_collapsed";

type PlaybackState = "idle" | "loading" | "playing" | "blocked" | "error";

export default function AudioSpace() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(() => parseStoredAudioVolume(null));
  const [ready, setReady] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVolume(parseStoredAudioVolume(window.localStorage.getItem(VOLUME_KEY)));
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "true");
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !ready) return;

    audio.volume = volume;
    audio.muted = false;
    window.localStorage.setItem(VOLUME_KEY, String(volume));

    if (window.localStorage.getItem(ENABLED_KEY) === "true") {
      void startPlayback(volume);
    }
  // Restore the saved preference once; later volume changes update the element directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handlePlaying = () => {
      setPlaybackState("playing");
      window.localStorage.setItem(ENABLED_KEY, "true");
    };
    const handlePause = () => {
      setPlaybackState("idle");
      window.localStorage.setItem(ENABLED_KEY, "false");
    };
    const handleError = () => {
      setPlaybackState("error");
      window.localStorage.setItem(ENABLED_KEY, "false");
    };

    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);
    return () => {
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  async function startPlayback(requestedVolume = volume) {
    const audio = audioRef.current;
    if (!audio) return;

    const nextVolume = resolvePlaybackVolume(requestedVolume);
    if (nextVolume !== volume) setVolume(nextVolume);
    audio.volume = nextVolume;
    audio.muted = false;
    window.localStorage.setItem(VOLUME_KEY, String(nextVolume));
    setPlaybackState("loading");

    try {
      await audio.play();
    } catch {
      setPlaybackState("blocked");
      window.localStorage.setItem(ENABLED_KEY, "false");
    }
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused && !audio.ended) {
      audio.pause();
      return;
    }

    void startPlayback();
  }

  function changeVolume(nextVolume: number) {
    const normalizedVolume = clampAudioVolume(nextVolume);
    setVolume(normalizedVolume);
    window.localStorage.setItem(VOLUME_KEY, String(normalizedVolume));

    const audio = audioRef.current;
    if (audio) {
      audio.volume = normalizedVolume;
      audio.muted = false;
    }
  }

  function adjustVolume(delta: number) {
    changeVolume(volume + delta);
  }

  function toggleCollapsed() {
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    window.localStorage.setItem(COLLAPSED_KEY, String(nextCollapsed));
  }

  const isPlaying = playbackState === "playing";
  const isAudible = isPlaying && volume > 0;
  const statusText = playbackState === "blocked"
    ? "播放被拦截 · 请重试"
    : playbackState === "error"
      ? "音乐资源加载失败"
      : playbackState === "loading"
        ? "正在开启背景音乐…"
        : isPlaying && volume === 0
          ? "播放中 · 当前静音"
          : isPlaying
            ? "DARK SCORE · 播放中"
            : "背景音乐 · 已关闭";

  return (
    <aside className={`audio-space ${isAudible ? "is-on" : "is-off"} ${collapsed ? "is-collapsed" : ""}`} aria-label="背景音乐控制">
      <audio
        ref={audioRef}
        src="/audio/dark-score-cinematic-orchestra-154708.mp3"
        loop
        preload="metadata"
      />
      <div className="audio-space-heading">
        {!collapsed && (
          <>
            <span className="audio-space-signal" aria-hidden="true"><i /><i /><i /></span>
            <span><strong>音空间</strong><small aria-live="polite">{statusText}</small></span>
          </>
        )}
        <button
          type="button"
          className="audio-space-collapse"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "展开音乐操控台" : "收起音乐操控台"}
          title={collapsed ? "展开音乐操控台" : "收起音乐操控台"}
        >
          <span aria-hidden="true">{collapsed ? "♫" : "‹"}</span>
        </button>
      </div>
      {!collapsed && <div className="audio-space-controls">
        <button
          type="button"
          className="audio-space-toggle"
          onClick={togglePlayback}
          aria-pressed={isPlaying}
          aria-label={playbackState === "blocked" ? "重新开启背景音乐" : isPlaying ? "关闭背景音乐" : "开启背景音乐"}
          disabled={!ready || playbackState === "loading"}
        >
          <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
        </button>
        <div className="audio-space-volume" role="group" aria-label="背景音乐音量">
          <button
            type="button"
            onClick={() => adjustVolume(-0.1)}
            disabled={!ready || volume === 0}
            aria-label="减小背景音乐音量"
          >−</button>
          <label>
            <span className="sr-only">背景音乐音量滑杆</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round(volume * 100)}
              onInput={(event) => changeVolume(Number(event.currentTarget.value) / 100)}
              onChange={(event) => changeVolume(Number(event.currentTarget.value) / 100)}
              disabled={!ready}
              aria-valuetext={`${Math.round(volume * 100)}%`}
            />
          </label>
          <button
            type="button"
            onClick={() => adjustVolume(0.1)}
            disabled={!ready || volume === 1}
            aria-label="增大背景音乐音量"
          >+</button>
          <output>{Math.round(volume * 100)}%</output>
        </div>
      </div>}
    </aside>
  );
}

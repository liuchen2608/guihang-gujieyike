"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { clampAudioVolume, parseStoredAudioVolume, resolvePlaybackVolume } from "@/lib/audio-settings";
import { COMPACT_QUERY } from "@/lib/mobile-ui";
import { useGameUI, useMediaQuery } from "@/components/game-ui-provider";
import Dialog from "@/components/dialog";

type PlaybackState = "idle" | "loading" | "playing" | "blocked" | "error";
export default function AudioSpace() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(() => parseStoredAudioVolume(null));
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [collapsed, setCollapsed] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  const { panel, setPanel } = useGameUI();
  const compact = useMediaQuery(COMPACT_QUERY);
  const pathname = usePathname();
  const inGame = /^\/game\/[^/]+\/?$/.test(pathname);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = parseStoredAudioVolume(window.localStorage.getItem("guihang_music_volume"));
        setVolume(saved);
        if (audioRef.current) audioRef.current.volume = saved;
        setCollapsed(window.localStorage.getItem("guihang_music_collapsed") === "true");
      } catch { setStorageNotice("本次可播放音乐，但浏览器无法记住音量设置。"); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  function persist(key: string, value: string) {
    try { window.localStorage.setItem(key, value); }
    catch { setStorageNotice("本次可播放音乐，但浏览器无法记住音量设置。"); }
  }
  function changeVolume(value: number) {
    const next = clampAudioVolume(value);
    setVolume(next);
    persist("guihang_music_volume", String(next));
    if (audioRef.current) audioRef.current.volume = next;
  }
  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); return; }
    const next = resolvePlaybackVolume(volume);
    changeVolume(next);
    audio.muted = false;
    setPlaybackState("loading");
    try { await audio.play(); }
    catch { setPlaybackState("blocked"); }
  }
  const playing = playbackState === "playing";
  const status = playbackState === "blocked" ? "播放受限，请点击重试" : playbackState === "error" ? "音乐加载失败，可点击重试" : playbackState === "loading" ? "正在加载音乐…" : playing ? volume ? "背景音乐 · 播放中" : "播放中 · 当前静音" : "背景音乐 · 已关闭";
  const controls = <>
    <p className="audio-status" role="status">{status}</p>
    <div className="audio-space-controls">
      <button type="button" className="audio-space-toggle" onClick={() => void togglePlayback()} aria-label={playing ? "暂停背景音乐" : "播放背景音乐"} aria-pressed={playing} disabled={playbackState === "loading"}>{playing ? "Ⅱ" : "▶"}</button>
      <div className="audio-space-volume" role="group" aria-label="背景音乐音量">
        <button type="button" aria-label="降低音量" disabled={volume <= 0} onClick={() => changeVolume(volume - 0.1)}>−</button>
        <label><span className="sr-only">音量</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => changeVolume(Number(event.target.value))} /></label>
        <button type="button" aria-label="提高音量" disabled={volume >= 1} onClick={() => changeVolume(volume + 0.1)}>+</button>
        <output>{Math.round(volume * 100)}%</output>
      </div>
    </div>
    {storageNotice && <p className="storage-note">{storageNotice}</p>}
  </>;
  return <>
    <audio ref={audioRef} src="/audio/dark-score-cinematic-orchestra-154708.mp3" loop preload="none" onPlaying={() => setPlaybackState("playing")} onPause={() => setPlaybackState("idle")} onError={() => setPlaybackState("error")} />
    {!compact && <aside className={`audio-space ${playing ? "is-on" : "is-off"} ${collapsed ? "is-collapsed" : ""}`} aria-label="背景音乐控制">
      <div className="audio-space-heading">{!collapsed && <strong>音空间</strong>}<button type="button" className="audio-space-collapse" aria-expanded={!collapsed} aria-label={collapsed ? "展开音乐操控台" : "收起音乐操控台"} onClick={() => { setCollapsed(!collapsed); persist("guihang_music_collapsed", String(!collapsed)); }}>{collapsed ? "♫" : "‹"}</button></div>
      {!collapsed && controls}
    </aside>}
    {compact && !inGame && <div className="mobile-audio-footer"><button className="ghost-button" onClick={() => setPanel("audio")}>♫ 音乐设置 · {playing ? "播放中" : "已关闭"}</button></div>}
    {panel === "audio" && <Dialog title="音空间" onClose={() => setPanel(null)} className="audio-dialog">{controls}<p className="storage-note">点击播放后开启音乐。部分手机的音量由系统音量键控制；音乐不可用不影响游戏。</p>{inGame && <button className="secondary-button" onClick={() => setPanel("status")}>返回游戏菜单</button>}</Dialog>}
  </>;
}

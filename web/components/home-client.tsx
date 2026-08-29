"use client";

import Link from "next/link";
import { PointerEvent, useEffect, useRef, useState } from "react";
import { githubLoginHref, loadHomeSession } from "@/lib/home-session";
import { requireStorage } from "@/lib/client-storage";
import { useInviteAccess } from "@/components/invite-provider";

const systemSignals = [
  { quote: "先活下去。这个世界的空间异常，是我们目前唯一可以追踪的归乡线索。", status: "空间扰动持续", scan: "12.4 km" },
  { quote: "检测到不属于机甲能源体系的生命反应。建议保持距离，并记录其能量路径。", status: "未知能量接近", scan: "7.8 km" },
  { quote: "记忆锚点完整。她的声纹仍在离线存储中——我不会让你忘记为何回去。", status: "记忆锚点稳定", scan: "LOCKED" },
];

export default function HomeClient() {
  const invitation = useInviteAccess();
  const pageRef = useRef<HTMLElement>(null);
  const [saveId, setSaveId] = useState<string | null>(null);
  const [signalIndex, setSignalIndex] = useState(0);
  const [user, setUser] = useState<{ login: string; avatarUrl: string | null } | null>(null);
  const [anonymousId, setAnonymousId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void Promise.resolve().then(() => loadHomeSession(requireStorage(), (input) => fetch(input, { cache: "no-store", signal: AbortSignal.timeout(15000) })))
        .then((session) => {
          if (cancelled) return;
          setAnonymousId(session.anonymousId);
          setSaveId(session.saveId);
          setUser(session.user);
        })
        .catch((reason: unknown) => { if (!cancelled) setStorageNotice(reason instanceof Error ? reason.message : "无法读取本机身份，请允许网站存储。"); })
        .finally(() => { if (!cancelled) setAuthReady(true); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [invitation.authorized]);
  useEffect(() => {
    const timer = window.setInterval(() => setSignalIndex((current) => (current + 1) % systemSignals.length), 4200);
    return () => window.clearInterval(timer);
  }, []);
  function moveAtmosphere(event: PointerEvent<HTMLElement>) {
    if (!pageRef.current || event.pointerType === "touch") return;
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;
    pageRef.current.style.setProperty("--pointer-x", x.toFixed(3));
    pageRef.current.style.setProperty("--pointer-y", y.toFixed(3));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  return (
    <main ref={pageRef} className="landing-page" onPointerMove={moveAtmosphere}>
      <div className="ambient" aria-hidden="true"><span className="orb orb-one" /><span className="orb orb-two" /><span className="grid-fade" /><span className="scan-beam" /><span className="dust-field" /></div>
      <header className="site-header">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Use the same native home navigation as the game header. */}
        <a className="brand" href="/" aria-label="归航，返回首页" title="返回首页"><span className="brand-mark"><span>归</span></span><span><strong>归航</strong><small>蛊界异客</small></span></a>
        <div className="header-actions">{user ? <div className="account-chip">{user.avatarUrl && <span className="account-avatar" aria-hidden="true" style={{ backgroundImage: `url(${user.avatarUrl})` }} />}<span>@{user.login}</span><button onClick={logout}>退出</button></div> : authReady && <a className="ghost-button" href={githubLoginHref(anonymousId)}>GitHub 登录</a>}</div>
      </header>
      {storageNotice && <p className="storage-warning" role="alert">{storageNotice}</p>}
      <section className="hero-shell">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-pulse" />单人 AI 情景 RPG · 实时叙事系统</p>
          <h1>机甲坠毁于异界，<br />而她还在原来的世界等你。</h1>
          <p className="hero-lead">与受损机甲 AI“归航”对话，分析未知力量，承担每一次选择的代价，并寻找回到爱人身边的方法。</p>
          <div className="hero-actions">
            <a className="primary-button start-journey-button" href="/intro" onClick={(event) => { if (!invitation.authorized) { event.preventDefault(); invitation.requestAccess("/intro"); } }} aria-label="开始穿越，进入开场介绍">开始穿越 <span aria-hidden="true">→</span></a>
            {saveId && <a className="secondary-button" href={`/game/${encodeURIComponent(saveId)}`}>继续上次存档</a>}
          </div>
          <p className="storage-note">{invitation.authorized ? "试玩资格已验证 · 欢迎继续你的归途" : "邀请试玩中 · 输入邀请码后即可开始，无需强制注册"}</p>
          <div className="hero-facts"><span>三幕剧情可推进</span><span>NPC 关系会记忆</span><span>手机与电脑可玩</span></div>
        </div>
        <aside className="mission-card" aria-live="polite">
          <div className="mission-top"><span>归航系统 · 动态遥测</span><i><b /> ONLINE</i></div>
          <div className="signal-ring"><span className="ring-orbit" /><div><strong>3.0%</strong><span>剩余能源</span></div></div>
          <blockquote key={signalIndex}>“{systemSignals[signalIndex].quote}”</blockquote>
          <div className="mission-data"><span>系统判断 <b>{systemSignals[signalIndex].status}</b></span><span>扫描距离 <b>{systemSignals[signalIndex].scan}</b></span><span>归乡线索 <b>0 / 5</b></span></div>
          <div className="signal-selector" aria-label="切换归航系统记录">{systemSignals.map((_, index) => <button key={index} className={index === signalIndex ? "active" : ""} onClick={() => setSignalIndex(index)} aria-label={`查看系统记录 ${index + 1}`} />)}</div>
        </aside>
      </section>
      <section className="promise-grid">
        <article tabIndex={0}><span>01 · 对话</span><h2>自由提出方案</h2><p>快捷选项只是参考。你可以询问、谈判，或描述任何合理行动。</p><i>开放输入 →</i></article>
        <article tabIndex={0}><span>02 · 规则</span><h2>选择会留下痕迹</h2><p>生命、能源、物品和关系由规则结算，NPC 会记住你的善意与冒犯。</p><i>持续记忆 →</i></article>
        <article tabIndex={0}><span>03 · 归乡</span><h2>建立自己的路线</h2><p>正道合作或魔道夺取都能推进，但每条路都会改变后续可用的人与资源。</p><i>多路线推进 →</i></article>
      </section>
      <footer className="site-footer"><span>非官方非商业同人试玩；GitHub 登录后可跨设备续玩</span><Link href="/feedback">试玩反馈</Link><span>版本 0.2</span></footer>
    </main>
  );
}

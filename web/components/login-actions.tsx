"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { githubLoginHref, loadHomeSession, type HomeSession } from "@/lib/home-session";
import { requireStorage, STORAGE_WARNING } from "@/lib/client-storage";

export default function LoginActions({ returnTo }: { returnTo: string }) {
  const [session, setSession] = useState<HomeSession | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await loadHomeSession(requireStorage(), (input) => fetch(input, { cache: "no-store", signal: AbortSignal.timeout(15000) }));
        if (!cancelled) setSession(result);
      } catch { if (!cancelled) setNotice(STORAGE_WARNING); }
    };
    void load();
    return () => { cancelled = true; };
  }, []);
  return <>
    {session && <a className="github-button" href={githubLoginHref(session.anonymousId, returnTo)}><span>GH</span> 使用 GitHub 登录</a>}
    {!session && !notice && <p role="status">正在确认本机身份…</p>}
    {notice && <p className="error-banner" role="alert">{notice}</p>}
    <div className="login-fallback">{session?.saveId && <Link className="primary-button" href={`/game/${encodeURIComponent(session.saveId)}`}>返回游戏 · 继续存档</Link>}<Link className="secondary-button" href="/intro">不登录，开始匿名试玩</Link><Link className="secondary-button" href="/">返回首页</Link></div>
    <p className="storage-note">微信内可直接匿名试玩。微信和其他浏览器不共享匿名存档；只有成功绑定同一 GitHub 账号后才可跨设备续玩。授权受限时，可以返回游戏继续，不必切换浏览器。</p>
  </>;
}

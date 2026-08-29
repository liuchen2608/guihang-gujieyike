"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, FormEvent, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import Dialog from "@/components/dialog";
import { requestJson } from "@/lib/client-requests";
import { playerIdentity, requireStorage } from "@/lib/client-storage";
import { githubLoginHref } from "@/lib/home-session";
import { INVITE_EVENT, normalizeInviteCode } from "@/lib/invite-policy";

type AccessState = { authorized: boolean; configured: boolean; playerId: string | null; accountLinked: boolean; expiresAt: string | null };
const InviteContext = createContext<{ authorized: boolean; requestAccess: (target?: string) => void }>({ authorized: false, requestAccess: () => {} });
export const useInviteAccess = () => useContext(InviteContext);

export default function InviteProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [access, setAccess] = useState<AccessState | null>(null);
  const [checked, setChecked] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const checking = useRef<Promise<AccessState> | null>(null);
  const protectedPage = pathname === "/intro" || pathname.startsWith("/game/") || pathname === "/feedback";

  const refreshAccess = useCallback(() => {
    if (checking.current) return checking.current;
    const task = (async () => {
      const { response, data } = await requestJson<AccessState & { error?: string }>("/api/access");
      if (!response.ok || typeof data?.authorized !== "boolean") throw new Error(data?.error || "暂时无法核验试玩资格，请重试。");
      if (data.authorized && data.playerId) {
        const storage = requireStorage();
        const oldId = storage.getItem("guihang_player_id");
        if (oldId && oldId !== data.playerId && !storage.getItem("guihang_legacy_player_id")) {
          storage.setItem("guihang_legacy_player_id", oldId);
          const oldSave = storage.getItem("guihang_save_id");
          if (oldSave) storage.setItem("guihang_legacy_save_id", oldSave);
        }
        storage.setItem("guihang_player_id", data.playerId);
      }
      setAccess(data); setChecked(true);
      return data;
    })();
    checking.current = task;
    void task.then(() => { checking.current = null; }, () => { checking.current = null; });
    return task;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => { void refreshAccess().catch((reason: unknown) => { if (!cancelled) { setChecked(true); setError(reason instanceof Error ? reason.message : "连接暂时中断，请重试。"); } }); }, 0);
    function expired() { setAccess(null); setChecked(true); setError("试玩凭证已失效，请重新验证，或登录已绑定的 GitHub 账号。"); }
    window.addEventListener(INVITE_EVENT, expired);
    return () => { cancelled = true; window.clearTimeout(timer); window.removeEventListener(INVITE_EVENT, expired); };
  }, [refreshAccess]);

  const requestAccess = useCallback((destination = "/intro") => {
    setTarget(destination); setError("");
    void refreshAccess().then((state) => {
      if (state.authorized) { setTarget(null); if (destination !== pathname) router.push(destination); }
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "连接暂时中断，请重试。"));
  }, [pathname, refreshAccess, router]);

  function close() {
    if (busy.current) return;
    setTarget(null); setError("");
    if (protectedPage && !access?.authorized) router.replace("/");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    if (!normalizeInviteCode(code)) { setError("请输入完整的邀请码，可直接粘贴，空格与大小写不影响验证。"); return; }
    busy.current = true; setPending(true); setError("");
    try {
      playerIdentity(); // Check storage before consuming a code; never submit an ownership claim.
      const before = await refreshAccess(); // Ensures the preflight cookie was issued.
      if (!before.authorized) {
        let requestError = "";
        try {
          const { response, data } = await requestJson<{ error?: string }>("/api/access/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
          if (!response.ok) requestError = data?.error || "验证失败，请稍后重试。";
        } catch { requestError = "连接中断，尚未确认兑换结果，请稍后重试。"; }
        // Read, never auto-redeem again after an uncertain response.
        const confirmed = await refreshAccess();
        if (!confirmed.authorized) throw new Error(requestError || "浏览器未保存通行凭证，请允许 Cookie 后重试。");
      }
      const destination = target || pathname;
      setCode(""); setTarget(null);
      if (destination !== pathname) router.push(destination);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "验证暂时中断，请稍后重试。"); }
    finally { busy.current = false; setPending(false); }
  }

  const blocked = protectedPage && !access?.authorized;
  const showDialog = Boolean(target) || (blocked && checked);
  return <InviteContext.Provider value={{ authorized: Boolean(access?.authorized), requestAccess }}>
    {blocked ? <main className="invite-wait-page"><div className="invite-wait-card"><span className="invite-emblem" aria-hidden="true">归</span><p className="eyebrow">GUIHANG · PRIVATE PLAYTEST</p><h1>你的归途，<br />从一份邀请开始。</h1><p>{checked ? "验证试玩资格后，继续你未完成的旅程。" : "正在核验试玩资格…"}</p><Link className="secondary-button" href="/">返回首页</Link></div></main> : children}
    {showDialog && <Dialog title="归航 · 试玩邀请" onClose={close} className="invite-dialog">
      <div className="invite-card-art" aria-hidden="true"><span className="invite-orbit" /><span className="invite-emblem">归</span><span className="invite-coordinates">UNKNOWN COORDINATES<br />SECURE CHANNEL / 01</span><i /></div>
      <p className="eyebrow invite-eyebrow">一份邀请，一段归途</p>
      <h3 className="invite-title">我们为你<br /><em>留了一束信号。</em></h3>
      <p className="invite-description">《归航》正在进行邀请试玩。输入邀请人发给你的通行码，进入蛊界，开启属于你的故事。</p>
      <form onSubmit={submit} className="invite-form">
        <label htmlFor="invite-code">你的邀请码 <span>INVITATION CODE</span></label>
        <input id="invite-code" name="inviteCode" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={100} value={code} onChange={(event) => setCode(event.target.value)} placeholder="粘贴 GH- 开头的完整通行码" disabled={pending} aria-describedby="invite-help invite-error" aria-invalid={Boolean(error)} />
        <p id="invite-help" className="invite-input-help">支持粘贴 · 不区分大小写 · 同一浏览器记住资格</p>
        <div id="invite-error" className="invite-error" role="alert">{error || (access?.configured === false ? "通行码暂未开放，请联系邀请人。" : "")}</div>
        <button type="submit" className="primary-button invite-submit" disabled={pending || !code.trim() || access?.configured === false}>{pending ? "正在连接你的归途…" : "验证邀请码 · 开始旅程"}<span aria-hidden="true">→</span></button>
      </form>
      <div className="invite-footer"><span>没有邀请码？请向邀请人申请。</span><button type="button" disabled={pending} onClick={() => { setError(""); void refreshAccess().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "请稍后重试")); }}>重新检查资格</button></div>
      <p className="invite-account-note">已绑定过 GitHub？<a href={githubLoginHref(null, target || pathname)}>登录恢复试玩资格</a>。旧匿名存档仍保留，请联系邀请人验证恢复；新邀请码不会自动认领旧编号。未绑定的匿名资格仅保留在当前浏览器，请勿清除 Cookie；GitHub 登录本身不等于获得邀请。</p>
    </Dialog>}
  </InviteContext.Provider>;
}

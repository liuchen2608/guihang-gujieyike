"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SaveView, resultCopy } from "@/lib/game";

export default function ResultClient({ saveId }: { saveId: string }) {
  const router = useRouter();
  const [save, setSave] = useState<SaveView | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => { const playerId = window.localStorage.getItem("guihang_player_id"); fetch(`/api/saves/${saveId}${playerId ? `?playerId=${encodeURIComponent(playerId)}` : ""}`).then(async (response) => { const data = await response.json() as SaveView & { error?: string }; if (!response.ok) throw new Error(data.error || "读取失败"); return data; }).then((data) => setSave(data)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "读取失败")); }, [saveId]);
  if (!save) return <main className="loading-page"><div className="loading-card"><h1>{error || "正在整理航行记录…"}</h1><Link className="secondary-button" href="/">返回首页</Link></div></main>;
  if (!save.state.ended) return <main className="loading-page"><div className="loading-card"><h1>这一章还没有结束</h1><p>继续完成当前情景后，结局会自动记录。</p><Link className="primary-button" href={`/game/${saveId}`}>返回游戏</Link></div></main>;
  const copy = resultCopy(save.state.ending);

  const continueToActThree = async () => {
    if (pending) return;
    setPending(true); setError("");
    try {
      const playerId = window.localStorage.getItem("guihang_player_id");
      const response = await fetch(`/api/saves/${saveId}/turns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, mode: "act", text: "继续进入第三幕", version: save.state.version, confirmed: true }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "暂时无法续接第三幕");
      router.push(`/game/${saveId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法续接第三幕");
      setPending(false);
    }
  };

  const canContinue = save.state.ending === "beacon";
  return <main className="result-page"><div className="ambient"><span className="orb orb-two" /><span className="grid-fade" /></div><section className="result-shell"><p className="eyebrow">{canContinue ? "第二幕 · 盗天梦境" : "第三幕 · 蛊机初铸"}</p><h1>{copy.title}</h1><p className="result-lead">{copy.text}</p>{error && <div className="error-banner">{error}</div>}<div className="result-stats"><span><small>生命</small><b>{save.state.health}/10</b></span><span><small>能源</small><b>{save.state.energy.toFixed(1)}%</b></span><span><small>道标</small><b>{save.state.clues}/5</b></span><span><small>{canContinue ? "自我侵蚀" : "蛊机完成度"}</small><b>{canContinue ? save.state.dreamCorruption : `${save.state.guMechProgress}%`}</b></span></div><div className="action-log"><h2>你的关键行为</h2>{save.state.keyActions.slice(-6).map((action, index) => <p key={`${action}-${index}`}><i>{String(index + 1).padStart(2, "0")}</i>{action}</p>)}</div><div className="hero-actions">{canContinue ? <button className="primary-button" disabled={pending} onClick={() => void continueToActThree()}>{pending ? "正在续接…" : "继续第三幕 →"}</button> : <Link className="primary-button" href={`/feedback?saveId=${saveId}`}>填写试玩反馈</Link>}<Link className="secondary-button" href={canContinue ? `/feedback?saveId=${saveId}` : "/intro"}>{canContinue ? "填写阶段反馈" : "重新开始"}</Link></div></section></main>;
}

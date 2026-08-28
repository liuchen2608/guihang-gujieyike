"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const scenes = [
  { number: "01", title: "约定", kicker: "原世界 · 出发之前", text: "她是强大机甲家族的长女，你却没有显赫姓氏。你们从小相识，一起扛过质疑、禁令与漫长分离，终于约定在这次勘探任务后完成婚礼。", quote: "任务结束就回来。这次不准再推迟。" },
  { number: "02", title: "异常协议", kicker: "地下洞穴 · 深度 4,200 米", text: "你驾驶探索机甲进入未标记洞穴。岩壁后的空间信号正在主动匹配神经接口；它的协议比归航早至少三百年，却来自同一个机甲文明。", quote: "无法解释。信号源正在绕过隔离层。" },
  { number: "03", title: "归乡锚点", kicker: "任务时间 · 19:43", text: "银蓝色光芒照亮洞穴。你在噪点中看见黄沙、陌生蛊虫和一架古老机甲。空间结构开始闭合，洞穴将在七秒后完全坍塌。", quote: "通讯即将中断。请留下最后信息。" },
  { number: "04", title: "黄沙苏醒", kicker: "西漠 · 未知年代", text: "机甲损毁，通讯与空间坐标全部丢失。陌生太阳升起，十二公里外存在水源与人类信号。受损的归航在备用能源中重新上线。", quote: "主能源离线。驾驶员，先活下去。" },
];

export default function IntroFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [codename, setCodename] = useState("");
  const [homeAnchor, setHomeAnchor] = useState("等我回来");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const scene = scenes[step];

  async function startGame() {
    if (pending) return;
    setPending(true); setError("");
    try {
      let playerId = window.localStorage.getItem("guihang_player_id");
      if (!playerId) { playerId = crypto.randomUUID(); window.localStorage.setItem("guihang_player_id", playerId); }
      const response = await fetch("/api/saves", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerId, codename, homeAnchor }) });
      const data = await response.json() as { state?: { saveId: string }; error?: string };
      if (!response.ok || !data.state) throw new Error(data.error || "创建失败");
      window.localStorage.setItem("guihang_save_id", data.state.saveId);
      router.push(`/game/${data.state.saveId}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "暂时无法创建存档"); setPending(false); }
  }

  return (
    <main className="intro-page">
      <div className="ambient" aria-hidden="true"><span className="orb orb-one" /><span className="grid-fade" /></div>
      <header className="site-header"><Link className="brand" href="/"><span className="brand-mark"><span>归</span></span><strong>归航</strong></Link><button className="ghost-button" onClick={() => setStep(3)}>跳过</button></header>
      <section className="intro-shell">
        <div className="scene-index"><span>{scene.number}</span><i /><small>04</small></div>
        <article className="scene-card" key={scene.number}>
          <p className="eyebrow">{scene.kicker}</p><h1>{scene.title}</h1><p>{scene.text}</p><blockquote>{scene.quote}</blockquote>
        </article>
        {step === 3 && <div className="intro-fields">
          <label className="codename-field"><span>试玩代号（选填）</span><input value={codename} maxLength={20} onChange={(event) => setCodename(event.target.value)} placeholder="例如：远星" /></label>
          <label className="codename-field"><span>坍塌前，你最后对她说</span><input value={homeAnchor} maxLength={120} onChange={(event) => setHomeAnchor(event.target.value)} placeholder="例如：等我回来" /></label>
        </div>}
        {error && <p className="error-banner">{error}</p>}
        <nav className="intro-nav">
          <button className="secondary-button" disabled={step === 0 || pending} onClick={() => setStep(step - 1)}>上一步</button>
          {step < 3 ? <button className="primary-button" onClick={() => setStep(step + 1)}>下一幕</button> : <button className="primary-button" disabled={pending} onClick={startGame}>{pending ? "正在建立连接…" : "开始穿越 →"}</button>}
        </nav>
        <div className="progress-dots">{scenes.map((item, index) => <button key={item.number} aria-label={`第 ${index + 1} 幕`} className={index === step ? "active" : ""} onClick={() => setStep(index)} />)}</div>
      </section>
    </main>
  );
}

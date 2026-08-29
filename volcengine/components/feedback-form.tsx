"use client";
import { ensureGuestSession } from "@/lib/guest-client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function FeedbackForm() {
  const params = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ understoodGoal: "", trustedGuihang: "", continueChapterTwo: "", rating: "", detail: "", contact: "" });

  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const playerId = await ensureGuestSession();
      const response = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ saveId: params.get("saveId") || undefined, playerId, understoodGoal: form.understoodGoal === "yes", trustedGuihang: form.trustedGuihang === "yes", continueChapterTwo: form.continueChapterTwo === "yes", rating: Number(form.rating), detail: form.detail, contact: form.contact }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "提交失败");
      setSubmitted(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "提交失败"); } finally { setPending(false); }
  }

  if (submitted) return <main className="feedback-page"><section className="feedback-card thanks-card"><span className="brand-mark"><span>归</span></span><p className="eyebrow">记录已送达</p><h1>谢谢你走完这段路。</h1><p>你的反馈会直接用于调整归航的可信度、行动代价和第一章节奏。</p><Link className="primary-button" href="/">返回首页</Link></section></main>;

  return <main className="feedback-page"><section className="feedback-card"><Link className="brand" href="/"><span className="brand-mark"><span>归</span></span><strong>归航</strong></Link><p className="eyebrow">P1 封闭试玩反馈</p><h1>告诉我们，归航是否值得信任。</h1><p className="form-lead">约 2 分钟。联系方式完全选填，其他答案只用于改进这个单人试玩。</p><form onSubmit={submit}>
    <Question legend="1. 你是否理解主角要寻找回到现实的方法？" name="understoodGoal" value={form.understoodGoal} onChange={(value) => setForm({ ...form, understoodGoal: value })} />
    <Question legend="2. 你愿意相信归航提供的分析吗？" name="trustedGuihang" value={form.trustedGuihang} onChange={(value) => setForm({ ...form, trustedGuihang: value })} />
    <fieldset><legend>3. 这次试玩的整体体验</legend><div className="rating-row">{[1,2,3,4,5].map((score) => <label key={score}><input required type="radio" name="rating" value={score} checked={form.rating === String(score)} onChange={(event) => setForm({ ...form, rating: event.target.value })} /><span>{score}</span></label>)}</div><small>1 = 很难进入状态，5 = 非常想继续</small></fieldset>
    <label className="long-field"><span>4. 哪个选择最让你纠结？是否遇到剧情或状态矛盾？</span><textarea required minLength={8} maxLength={2000} value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} placeholder="也可以写下被错误理解的合理行动…" /></label>
    <Question legend="5. 你愿意继续第二章吗？" name="continueChapterTwo" value={form.continueChapterTwo} onChange={(value) => setForm({ ...form, continueChapterTwo: value })} />
    <label className="long-field"><span>联系方式（选填）</span><input maxLength={100} value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} placeholder="微信、邮箱或其他方便的方式" /><small>仅在你愿意参加后续试玩时填写。</small></label>
    {error && <p className="error-banner">{error}</p>}<button className="primary-button submit-feedback" disabled={pending}>{pending ? "正在提交…" : "提交反馈"}</button>
  </form></section></main>;
}

function Question({ legend, name, value, onChange }: { legend: string; name: string; value: string; onChange: (value: string) => void }) { return <fieldset><legend>{legend}</legend><div className="binary-row"><label><input required type="radio" name={name} value="yes" checked={value === "yes"} onChange={(event) => onChange(event.target.value)} /><span>是</span></label><label><input required type="radio" name={name} value="no" checked={value === "no"} onChange={(event) => onChange(event.target.value)} /><span>否</span></label></div></fieldset>; }

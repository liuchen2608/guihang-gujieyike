"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { activeNpcFor, activeNpcNameFor, canTalkFor, GameMessage, InputMode, NPC_NAMES, SaveView, stageInfo, suggestionsFor } from "@/lib/game";
import { sceneImageFor } from "@/lib/scene-images";

type AiMeta = { provider: "deepseek" | "local"; model: string; fallback: boolean; npcName?: string; intent?: string; hostilityLevel?: number; retrievalCount: number; sources: string[] };
type TurnFeedback = { id: number; tone: "good" | "danger" | "neutral"; items: string[] };

const modeLabels: Record<InputMode, string> = { ask: "询问归航", act: "执行行动", talk: "与 NPC 交流" };
const actPhases = {
  1: ["desert_wake", "oasis_route", "clan_gate", "waterworks", "hope_well", "first_gu", "wolf_attack", "well_fragment"],
  2: ["dream_entry", "thief_past", "waiting_people", "thief_fall", "young_thief", "dream_battle", "return_cost", "identity_test", "thief_will", "dream_wake"],
  3: ["forge_council", "gu_mech_blueprint", "material_bargain", "first_forging", "resonance_test", "signal_choice"],
} as const;

function signed(value: number, digits = 0) {
  const formatted = digits ? Math.abs(value).toFixed(digits) : Math.abs(value).toString();
  return `${value > 0 ? "+" : "−"}${formatted}`;
}

export default function GameClient({ saveId }: { saveId: string }) {
  const router = useRouter();
  const pageRef = useRef<HTMLElement>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const [save, setSave] = useState<SaveView | null>(null);
  const [mode, setMode] = useState<InputMode>("ask");
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [aiMeta, setAiMeta] = useState<AiMeta | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ mode: InputMode; text: string; warning: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [turnFeedback, setTurnFeedback] = useState<TurnFeedback | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadSave = useCallback(async () => {
    setError("");
    try {
      const playerId = window.localStorage.getItem("guihang_player_id");
      const response = await fetch(`/api/saves/${saveId}${playerId ? `?playerId=${encodeURIComponent(playerId)}` : ""}`);
      const data = await response.json() as SaveView & { error?: string };
      if (!response.ok) throw new Error(data.error || "读取失败");
      setSave(data);
      window.localStorage.setItem("guihang_save_id", saveId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "读取存档失败"); }
  }, [saveId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSave(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSave]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [save?.messages.length, pending]);
  useEffect(() => () => { if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current); }, []);
  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if (!save || pending || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("textarea, input, button, a")) return;
      const choice = Number(event.key) - 1;
      const choices = suggestionsFor(save.state);
      if (choice >= 0 && choice < choices.length) {
        setDraft(choices[choice]);
        setMode("act");
      }
      if (event.key === "Escape") { setDrawerOpen(false); setArchiveOpen(false); }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [pending, save]);
  const placeholder = useMemo(() => mode === "ask" ? "向归航询问情报或分析方案…" : mode === "act" ? "描述你准备执行的行动…" : "写下你准备说的话…", [mode]);

  function moveAtmosphere(event: PointerEvent<HTMLElement>) {
    if (!pageRef.current || event.pointerType === "touch") return;
    pageRef.current.style.setProperty("--pointer-x", (event.clientX / window.innerWidth - 0.5).toFixed(3));
    pageRef.current.style.setProperty("--pointer-y", (event.clientY / window.innerHeight - 0.5).toFixed(3));
  }

  function revealFeedback(previous: SaveView["state"], next: SaveView["state"]) {
    const items: string[] = [];
    const health = next.health - previous.health;
    const stamina = next.stamina - previous.stamina;
    const energy = next.energy - previous.energy;
    const essence = next.primevalEssence - previous.primevalEssence;
    const clues = next.clues - previous.clues;
    if (health) items.push(`生命 ${signed(health)}`);
    if (stamina) items.push(`体力 ${signed(stamina)}`);
    if (energy) items.push(`能源 ${signed(energy, 1)}%`);
    if (essence) items.push(`真元 ${signed(essence)}%`);
    if (clues) items.push(`道标 ${signed(clues)}`);
    if (!items.length) items.push("状态稳定 · 记忆已写入");
    const feedback = { id: Date.now(), tone: health < 0 ? "danger" : health > 0 || clues > 0 ? "good" : "neutral", items } as TurnFeedback;
    setTurnFeedback(feedback);
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setTurnFeedback(null), 3600);
  }

  async function send(modeToSend: InputMode, text: string, confirmed = false) {
    if (!save || pending) return;
    setPending(true); setError("");
    try {
      const playerId = window.localStorage.getItem("guihang_player_id");
      const response = await fetch(`/api/saves/${saveId}/turns`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerId, mode: modeToSend, text, version: save.state.version, confirmed }) });
      const data = await response.json() as { state?: SaveView["state"]; messages?: GameMessage[]; ai?: AiMeta; requiresConfirmation?: boolean; warning?: string; error?: string; resultUrl?: string };
      if (data.requiresConfirmation) { setConfirmAction({ mode: modeToSend, text, warning: data.warning || "这项行动不可逆。" }); return; }
      if (!response.ok || !data.state || !data.messages) { if (data.resultUrl) router.push(data.resultUrl); throw new Error(data.error || "行动未能完成"); }
      revealFeedback(save.state, data.state);
      setSave((current) => current ? { ...current, state: data.state!, messages: [...current.messages, ...data.messages!], updatedAt: new Date().toISOString() } : current);
      if (data.ai) setAiMeta(data.ai);
      if (modeToSend === "talk" && !canTalkFor(data.state)) setMode("act");
      setDraft(""); setConfirmAction(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "连接中断，本次行动没有结算"); }
    finally { setPending(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); const text = draft.trim(); if (text) send(mode, text); }

  if (!save) return <main className="loading-page"><div className="ambient"><span className="grid-fade" /></div><div className="loading-card"><span className="live-dot" /><h1>{error ? "无法打开存档" : "正在恢复归航记录"}</h1><p>{error || "校验匿名身份，并读取最近一个完整回合…"}</p>{error && <div className="hero-actions"><button className="secondary-button" onClick={loadSave}>重试</button><Link className="primary-button" href="/intro">新游戏</Link></div>}</div></main>;

  const { state } = save;
  const suggestions = suggestionsFor(state);
  const stage = stageInfo(state.phase);
  const sceneImage = sceneImageFor(state.phase);
  const talkAvailable = canTalkFor(state);
  const activeNpcId = activeNpcFor(state);
  const activeNpcName = activeNpcNameFor(state);
  const activeRelation = activeNpcId ? state.npcRelations[activeNpcId] : null;
  const npcMood = !activeRelation ? "智能通道" : !activeRelation.alive ? "信号终止" : activeRelation.aid === "hostile" ? "敌对锁定" : activeRelation.aid === "withheld" ? "援助中止" : activeRelation.trust >= 3 ? "愿意协助" : activeRelation.grudge > 0 ? "保持戒备" : "谨慎观察";
  const currentActPhases = actPhases[state.act];
  const phaseIndex = Math.max(0, currentActPhases.indexOf(state.phase as never));
  const actProgress = ((phaseIndex + (state.ended ? 1 : 0.35)) / currentActPhases.length) * 100;
  const actNumeral = state.act === 1 ? "一" : state.act === 2 ? "二" : "三";
  const storyTitle = state.act === 1
    ? <>先在蛊界<br />活下去。</>
    : state.act === 2
      ? <>理解盗天，<br />但别成为他。</>
      : <>铸成蛊机，<br />走自己的路。</>;
  const storyIntro = state.act === 1
    ? `机甲损毁，能源仅剩 ${state.energy.toFixed(1)}%。你必须先在西漠活下去，再寻找回到她身边的方法。`
    : state.act === 2
      ? "盗天与你来自同一个机甲文明。梦境正在混淆你们的记忆，归航是唯一稳定的外部锚点。"
      : "第一枚归乡道标已经保存。现在，你必须让机甲工程、蛊虫和偷道道痕在同一具外骨骼中稳定共存。";

  return (
    <main ref={pageRef} className={`game-page act-${state.act} ${pending ? "is-processing" : ""}`} onPointerMove={moveAtmosphere}>
      <div className="ambient" aria-hidden="true"><span className="orb orb-one" /><span className="orb orb-two" /><span className="grid-fade" /><span className="scan-beam" /><span className="dust-field" /></div>
      <header className="topbar">
        <Link className="brand" href="/"><span className="brand-mark"><span>归</span></span><span><strong>归航</strong><small>蛊界异客 · 第{actNumeral}幕</small></span></Link>
        <div className="chapter-hud"><div className="chapter-chip"><span>{stage.chapter}</span> · <strong>{stage.title}</strong></div><div className="chapter-progress"><i style={{ width: `${actProgress}%` }} /></div><small>{phaseIndex + 1} / {currentActPhases.length}</small></div>
        <button className="status-toggle" onClick={() => setDrawerOpen(!drawerOpen)}>查看状态</button>
      </header>
      <section className="game-layout">
        <aside className="story-rail"><p className="eyebrow"><span className="eyebrow-pulse" />{stage.log}</p><h1>{storyTitle}</h1><p className="story-intro">{storyIntro}</p><div className="objective"><span>当前目标</span><strong>{state.objective}</strong><i><b style={{ width: `${actProgress}%` }} /></i></div><div className="story-radar" aria-hidden="true"><span /><div><b>空间信号</b><small>{pending ? "正在演算" : state.clues ? `${state.clues} 枚道标已锁定` : "弱 · 不稳定"}</small></div></div><p className="privacy-note">单人世界 · 独立存档 · 自动保存</p></aside>
        <section className="chat-panel" aria-label="游戏对话">
          <div className="chat-heading"><div><span className="live-dot" />{activeNpcName ? `当前交谈对象 · ${activeNpcName}` : "归航智能通道"}<em className={`npc-mood ${activeRelation?.aid || "stable"}`}>{npcMood}</em></div><span>{aiMeta ? `${aiMeta.provider === "deepseek" ? "DeepSeek" : "本地降级"} · 检索 ${aiMeta.retrievalCount} 条` : `状态版本 ${state.version}`}</span></div>
          <div
            className={`messages${sceneImage ? " has-scene-image" : ""}`}
            aria-live="polite"
            style={sceneImage ? {
              backgroundImage: `linear-gradient(180deg, rgba(4, 8, 9, .38) 0%, rgba(4, 8, 9, .62) 48%, rgba(4, 8, 9, .9) 100%), linear-gradient(90deg, rgba(4, 8, 9, .5), transparent 45%, rgba(4, 8, 9, .28)), url("${sceneImage.src}")`,
              backgroundPosition: `center, center, ${sceneImage.position}`,
            } : undefined}
          ><div className="time-marker"><span />穿越后 · 未知时间<span /></div>{save.messages.map((message) => <Message key={message.id} message={message} />)}{pending && <div className="thinking-card"><span className="thinking-core" /><div><strong>归航正在演算</strong><small>{mode === "talk" ? "解析语气 · 调取人物记忆 · 生成回应" : mode === "act" ? "校验规则 · 计算代价 · 推进时间" : "改写问题 · 检索世界观 · 核验证据"}</small></div><i><b /><b /><b /></i></div>}<div ref={endRef} /></div>
          {error && <div className="stream-banner"><span>{error}</span><button onClick={() => setError("")}>关闭</button></div>}
          {turnFeedback && <div key={turnFeedback.id} className={`turn-feedback ${turnFeedback.tone}`}>{turnFeedback.items.map((item) => <span key={item}>{item}</span>)}</div>}
          {state.ended ? <div className="chapter-end-bar"><span>{state.ending === "beacon" ? "第二幕已完成，可以从当前存档进入第三幕。" : "第三幕已完成，进度已保存。"}</span>{state.ending === "beacon" ? <button className="primary-button" disabled={pending} onClick={() => void send("act", "继续进入第三幕")}>{pending ? "正在续接…" : "进入第三幕 →"}</button> : <Link className="primary-button" href={`/game/${saveId}/result`}>查看阶段结算 →</Link>}</div> : <>
            <div className="suggestions">{suggestions.map((item, index) => <button key={item} className={draft === item ? "selected" : ""} onClick={() => { setDraft(item); setMode("act"); }}><kbd>{index + 1}</kbd>{item}</button>)}</div>
            <form className="composer" onSubmit={submit}>
              <div className="mode-tabs">{(Object.keys(modeLabels) as InputMode[]).map((item) => <button type="button" key={item} className={mode === item ? "active" : ""} disabled={item === "talk" && !talkAvailable} onClick={() => setMode(item)}>{modeLabels[item]}</button>)}</div>
              <div className="composer-row"><textarea value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 500))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (draft.trim() && !pending) void send(mode, draft.trim()); } }} placeholder={placeholder} rows={2} /><button className="send-button" disabled={!draft.trim() || pending}>{pending ? "等待" : "发送"}</button></div>
              <div className="composer-foot"><span>{draft.length}/500</span><span>数字键 1—3 选择方案 · Enter 发送</span><span>行动会推进时间并产生真实代价</span></div>
            </form>
          </>}
        </section>
        <aside className={`status-panel ${drawerOpen ? "open" : ""}`}><button className="drawer-close" onClick={() => setDrawerOpen(false)}>关闭</button><p className="eyebrow"><span className="eyebrow-pulse" />驾驶员状态</p><div className="vitals"><Status label="生命" value={`${state.health} / 10`} width={state.health * 10} tone="red" /><Status label="体力" value={`${state.stamina} / 10`} width={state.stamina * 10} tone="amber" /><Status label="终端能源" value={`${state.energy.toFixed(1)}%`} width={Math.min(100, state.energy * 10)} tone="cyan" />{state.apertureAwakened && <Status label="真元" value={`${state.primevalEssence}%`} width={state.primevalEssence} tone="cyan" />}{state.act === 3 && <Status label="蛊机完成度" value={`${state.guMechProgress}%`} width={state.guMechProgress} tone="cyan" />}</div><div className="status-block"><h3>身体状况</h3><p>{state.conditions.join(" · ") || "暂无异常"}</p></div><div className="status-block"><h3>治疗物资 · 可直接使用</h3><div className="treatment-actions"><button disabled={pending || state.health >= 10 || state.healingSupplies.firstAidGel < 1} onClick={() => void send("act", "使用机甲急救凝胶治疗自己")}><span>急救凝胶</span><b>×{state.healingSupplies.firstAidGel}</b></button><button disabled={pending || state.health >= 10 || state.healingSupplies.clanMedicine < 1} onClick={() => void send("act", "使用青砂伤药治疗自己")}><span>青砂伤药</span><b>×{state.healingSupplies.clanMedicine}</b></button><button disabled={pending || state.health >= 10 || state.healingSupplies.healingGu < 1} onClick={() => void send("act", "催动治疗蛊治疗自己")}><span>治疗蛊</span><b>×{state.healingSupplies.healingGu}</b></button></div></div><div className="status-block"><h3>归乡计划</h3><p>归乡道标 {state.clues} / 5</p></div>{activeNpcId && activeRelation && <div className="status-block"><h3>{NPC_NAMES[activeNpcId]}关系 · {npcMood}</h3><p>信任 {activeRelation.trust} · 敬重 {activeRelation.respect} · 畏惧 {activeRelation.fear} · 仇恨 {activeRelation.grudge}</p><p>援助：{activeRelation.aid === "helping" ? "正常" : activeRelation.aid === "withheld" ? "已中止" : "敌对"}{activeRelation.alive ? "" : " · 已死亡"}</p></div>}<div className="status-block"><h3>{state.act === 1 ? "青砂部族" : state.act === 2 ? "梦境状态" : "蛊机工程"}</h3><p>{state.act === 1 ? `${state.clanTrust >= 4 ? "初步接纳" : state.clanTrust < 0 ? "高度警惕" : "谨慎观察"} · ${state.moralRoute === "demonic" ? `魔道恶名 ${state.notoriety}` : "路线未定"}` : state.act === 2 ? `侵蚀 ${state.dreamCorruption} · 偷道感悟 ${state.theftInsight}` : `完成度 ${state.guMechProgress}% · ${state.moralRoute === "demonic" ? `魔道恶名 ${state.notoriety}` : "部族协作路线"}`}</p></div><div className="status-block"><h3>重要物品</h3><div className="inventory">{state.inventory.map((item, index) => <div key={item}><span>{item}</span><b>{String(index + 1).padStart(2, "0")}</b></div>)}</div></div><button className="archive-button" aria-expanded={archiveOpen} onClick={() => setArchiveOpen(!archiveOpen)}>归航档案 · {archiveOpen ? "收起" : "展开"}<span>{archiveOpen ? "−" : "+"}</span></button>{archiveOpen && <div className="archive-log">{state.keyActions.length ? state.keyActions.slice(-6).reverse().map((item, index) => <p key={`${item}-${index}`}><b>{String(state.keyActions.length - index).padStart(2, "0")}</b>{item}</p>) : <p><b>00</b>尚无关键行动记录</p>}</div>}</aside>
      </section>
      {confirmAction && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="confirm-card"><p className="eyebrow">不可逆行动确认</p><h2>确定执行这个方案？</h2><p>{confirmAction.warning}</p><blockquote>{confirmAction.text}</blockquote><div><button className="secondary-button" onClick={() => setConfirmAction(null)}>再想想</button><button className="danger-button" onClick={() => send(confirmAction.mode, confirmAction.text, true)}>确认并承担代价</button></div></div></div>}
    </main>
  );
}

function Message({ message }: { message: GameMessage }) { return <article className={`message ${message.kind}`}><div className="message-meta">{(message.kind === "guihang" || message.kind === "npc") && <span className="avatar">{message.kind === "guihang" ? "G" : message.label.slice(0, 1)}</span>}<span>{message.label}</span></div><p>{message.text}</p></article>; }
function Status({ label, value, width, tone }: { label: string; value: string; width: number; tone: string }) { return <div className="vital"><div className="vital-head"><span>{label}</span><strong>{value}</strong></div><div className={`meter ${tone}`}><i style={{ width: `${width}%` }} /></div></div>; }

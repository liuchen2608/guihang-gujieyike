"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CSSProperties, FormEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { activeNpcFor, activeNpcNameFor, canTalkFor, GameMessage, InputMode, NPC_NAMES, SaveView, stageInfo, suggestionsFor } from "@/lib/game";
import { sceneImageFor } from "@/lib/scene-images";

import { AiMeta, postGameTurn, readGameSave, UncertainTurnError } from "@/lib/client-requests";
import { playerIdentity, rememberSave } from "@/lib/client-storage";
import { COMPACT_QUERY, MOBILE_QUERY, shouldSendOnEnter } from "@/lib/mobile-ui";
import { useGameUI, useMediaQuery } from "@/components/game-ui-provider";
import { useMessageScroll } from "@/components/use-message-scroll";
import Dialog from "@/components/dialog";
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
  const { panel, setPanel } = useGameUI();
  const compact = useMediaQuery(COMPACT_QUERY);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [syncing, setSyncing] = useState(false);
  const [syncRequired, setSyncRequired] = useState(false);
  const [notice, setNotice] = useState("");
  const busyRef = useRef(false);
  const needsSyncRef = useRef(true);
  const resumeRef = useRef(false);
  const saveRef = useRef<SaveView | null>(null);
  const mountedRef = useRef(true);
  const blocked = pending || syncing || syncRequired;
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [turnFeedback, setTurnFeedback] = useState<TurnFeedback | null>(null);
  const { messagesRef, onScroll, hasNewMessages, scrollToLatest } = useMessageScroll(save?.messages.at(-1)?.id, pending);

  const loadSave = useCallback(async () => {
    if (busyRef.current) { resumeRef.current = true; return; }
    busyRef.current = true;
    needsSyncRef.current = true;
    setSyncing(true);
    setSyncRequired(true);
    setError("");
    try {
      const data = await readGameSave(saveId, playerIdentity());
      if (!mountedRef.current) return;
      rememberSave(saveId);
      saveRef.current = data;
      setSave(data);
      setConfirmAction(null);
      if (!canTalkFor(data.state)) setMode((current) => current === "talk" ? "act" : current);
      needsSyncRef.current = false;
      setSyncRequired(false);
      setNotice("已核对服务端存档 · 自动保存");
    } catch (reason) {
      if (mountedRef.current) setError(reason instanceof Error ? reason.message : "暂时无法核对存档，请重试。");
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setSyncing(false);
    }
  }, [saveId]);

  useEffect(() => {
    mountedRef.current = true;
    const timer = window.setTimeout(() => void loadSave(), 0);
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      needsSyncRef.current = true;
      setSyncRequired(true);
      if (busyRef.current) resumeRef.current = true;
      else void loadSave();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", resume);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
    };
  }, [loadSave]);
  useEffect(() => () => { if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current); }, []);
  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if (!save || blocked || panel || confirmAction || event.isComposing || event.keyCode === 229 || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("textarea, input, button, a")) return;
      const choice = Number(event.key) - 1;
      const choices = suggestionsFor(save.state);
      if (choice >= 0 && choice < choices.length) {
        setDraft(choices[choice]);
        setMode("act");
      }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [blocked, save, panel, confirmAction]);
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
    const current = saveRef.current;
    if (!current || busyRef.current || needsSyncRef.current) return;
    busyRef.current = true;
    setPending(true); setError(""); setNotice("");
    setPanel(null);
    let reconcile = false;
    try {
      const data = await postGameTurn(saveId, { playerId: playerIdentity(), mode: modeToSend, text, version: current.state.version, confirmed });
      if (!mountedRef.current) return;
      if (data.requiresConfirmation) {
        setPanel(null);
        setConfirmAction({ mode: modeToSend, text, warning: data.warning || "这项行动不可逆。" });
        return;
      }
      if (data.resultUrl) { router.push(data.resultUrl); return; }
      if (!data.state || !data.messages) throw new UncertainTurnError();
      revealFeedback(current.state, data.state);
      const next = { ...current, state: data.state, messages: [...current.messages, ...data.messages], updatedAt: new Date().toISOString() };
      saveRef.current = next;
      setSave(next);
      if (data.ai) setAiMeta(data.ai);
      if (modeToSend === "talk" && !canTalkFor(data.state)) setMode("act");
      // Do not erase a new draft the player typed while waiting for a response.
      setDraft((value) => value.trim() === text ? "" : value);
      setConfirmAction(null);
    } catch (reason) {
      if (!mountedRef.current) return;
      setError(reason instanceof Error ? reason.message : "暂时无法连接");
      reconcile = reason instanceof UncertainTurnError;
      if (reconcile) {
        needsSyncRef.current = true;
        setSyncRequired(true);
        setConfirmAction(null);
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setPending(false);
        if (reconcile || resumeRef.current) {
          resumeRef.current = false;
          await loadSave();
          if (reconcile && !needsSyncRef.current) setNotice("已读取最新存档，原输入仍保留。请核对最新对话，确认行动是否已完成，再决定下一步。");
        }
      }
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); const text = draft.trim(); if (text) send(mode, text); }

  if (!save) return <main className="loading-page"><div className="ambient"><span className="grid-fade" /></div><div className="loading-card"><span className="live-dot" /><h1>{error ? "无法打开存档" : "正在恢复归航记录"}</h1><p>{error || "校验匿名身份，并读取最近一个完整回合…"}</p>{error && <div className="hero-actions"><button className="secondary-button" disabled={syncing} onClick={() => void loadSave()}>{syncing ? "正在核对…" : "重试"}</button><Link className="primary-button" href="/intro">新游戏</Link></div>}</div></main>;

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

  const statusContent = <><p className="eyebrow"><span className="eyebrow-pulse" />驾驶员状态</p><div className="vitals"><Status label="生命" value={`${state.health} / 10`} width={state.health * 10} tone="red" /><Status label="体力" value={`${state.stamina} / 10`} width={state.stamina * 10} tone="amber" /><Status label="终端能源" value={`${state.energy.toFixed(1)}%`} width={Math.min(100, state.energy * 10)} tone="cyan" />{state.apertureAwakened && <Status label="真元" value={`${state.primevalEssence}%`} width={state.primevalEssence} tone="cyan" />}{state.act === 3 && <Status label="蛊机完成度" value={`${state.guMechProgress}%`} width={state.guMechProgress} tone="cyan" />}</div><div className="status-block"><h3>身体状况</h3><p>{state.conditions.join(" · ") || "暂无异常"}</p></div><div className="status-block"><h3>治疗物资 · 可直接使用</h3><div className="treatment-actions"><button disabled={blocked || state.health >= 10 || state.healingSupplies.firstAidGel < 1} onClick={() => void send("act", "使用机甲急救凝胶治疗自己")}><span>急救凝胶</span><b>×{state.healingSupplies.firstAidGel}</b></button><button disabled={blocked || state.health >= 10 || state.healingSupplies.clanMedicine < 1} onClick={() => void send("act", "使用青砂伤药治疗自己")}><span>青砂伤药</span><b>×{state.healingSupplies.clanMedicine}</b></button><button disabled={blocked || state.health >= 10 || state.healingSupplies.healingGu < 1} onClick={() => void send("act", "催动治疗蛊治疗自己")}><span>治疗蛊</span><b>×{state.healingSupplies.healingGu}</b></button></div></div><div className="status-block"><h3>归乡计划</h3><p>归乡道标 {state.clues} / 5</p></div>{activeNpcId && activeRelation && <div className="status-block"><h3>{NPC_NAMES[activeNpcId]}关系 · {npcMood}</h3><p>信任 {activeRelation.trust} · 敬重 {activeRelation.respect} · 畏惧 {activeRelation.fear} · 仇恨 {activeRelation.grudge}</p><p>援助：{activeRelation.aid === "helping" ? "正常" : activeRelation.aid === "withheld" ? "已中止" : "敌对"}{activeRelation.alive ? "" : " · 已死亡"}</p></div>}<div className="status-block"><h3>{state.act === 1 ? "青砂部族" : state.act === 2 ? "梦境状态" : "蛊机工程"}</h3><p>{state.act === 1 ? `${state.clanTrust >= 4 ? "初步接纳" : state.clanTrust < 0 ? "高度警惕" : "谨慎观察"} · ${state.moralRoute === "demonic" ? `魔道恶名 ${state.notoriety}` : "路线未定"}` : state.act === 2 ? `侵蚀 ${state.dreamCorruption} · 偷道感悟 ${state.theftInsight}` : `完成度 ${state.guMechProgress}% · ${state.moralRoute === "demonic" ? `魔道恶名 ${state.notoriety}` : "部族协作路线"}`}</p></div><div className="status-block"><h3>重要物品</h3><div className="inventory">{state.inventory.map((item, index) => <div key={item}><span>{item}</span><b>{String(index + 1).padStart(2, "0")}</b></div>)}</div></div><button className="archive-button" aria-expanded={archiveOpen} onClick={() => setArchiveOpen(!archiveOpen)}>归航档案 · {archiveOpen ? "收起" : "展开"}<span>{archiveOpen ? "−" : "+"}</span></button>{archiveOpen && <div className="archive-log">{state.keyActions.length ? state.keyActions.slice(-6).reverse().map((item, index) => <p key={`${item}-${index}`}><b>{String(state.keyActions.length - index).padStart(2, "0")}</b>{item}</p>) : <p><b>00</b>尚无关键行动记录</p>}</div>}</>;

  return (
    <main ref={pageRef} className={`game-page act-${state.act} ${pending ? "is-processing" : ""}`} onPointerMove={moveAtmosphere}>
      <div className="ambient" aria-hidden="true"><span className="orb orb-one" /><span className="orb orb-two" /><span className="grid-fade" /><span className="scan-beam" /><span className="dust-field" /></div>
      <header className="topbar">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Keep the home exit usable before hydration or if client routing fails. */}
        <a className="brand" href="/" aria-label="归航，返回首页" title="返回首页"><span className="brand-mark"><span>归</span></span><span><strong>归航</strong><small>蛊界异客 · 第{actNumeral}幕</small></span></a>
        <div className="chapter-hud"><div className="chapter-chip"><span>第{actNumeral}幕 · {stage.chapter}</span><strong> · {stage.title}</strong></div><div className="chapter-progress"><i style={{ width: `${actProgress}%` }} /></div><small>{phaseIndex + 1} / {currentActPhases.length}</small></div>
        <button className="status-toggle" aria-haspopup="dialog" aria-expanded={panel === "status"} onClick={() => setPanel("status")}>菜单 ☰</button>
      </header>
      <div className="mobile-objective"><span>当前目标</span><strong>{state.objective}</strong></div>
      <section className="game-layout">
        <aside className="story-rail"><p className="eyebrow"><span className="eyebrow-pulse" />{stage.log}</p><h1>{storyTitle}</h1><p className="story-intro">{storyIntro}</p><div className="objective"><span>当前目标</span><strong>{state.objective}</strong><i><b style={{ width: `${actProgress}%` }} /></i></div><div className="story-radar" aria-hidden="true"><span /><div><b>空间信号</b><small>{pending ? "正在演算" : state.clues ? `${state.clues} 枚道标已锁定` : "弱 · 不稳定"}</small></div></div><p className="privacy-note">单人世界 · 独立存档 · 自动保存</p></aside>
        <section className="chat-panel" aria-label="游戏对话">
          <div className="chat-heading"><div><span className="live-dot" />{activeNpcName ? `当前交谈对象 · ${activeNpcName}` : "归航智能通道"}<em className={`npc-mood ${activeRelation?.aid || "stable"}`}>{npcMood}</em></div><span>{aiMeta ? `${aiMeta.provider === "deepseek" ? "DeepSeek" : "本地降级"} · 检索 ${aiMeta.retrievalCount} 条` : `状态版本 ${state.version}`}</span></div>
          <div
            className={`messages${sceneImage ? " has-scene-image" : ""}`}
            ref={messagesRef}
            onScroll={onScroll}
            role="log"
            aria-label="对话记录"
            aria-live="polite"
            aria-relevant="additions"
            style={{
              "--scene-desktop": `url("${sceneImage.src}")`,
              "--scene-mobile": `url("${sceneImage.mobileSrc || sceneImage.src}")`,
              "--scene-position": sceneImage.position,
              "--scene-mobile-position": sceneImage.mobilePosition || sceneImage.position,
            } as CSSProperties}
          ><div className="time-marker"><span />穿越后 · 未知时间<span /></div>{save.messages.map((message) => <Message key={message.id} message={message} />)}{pending && <div className="thinking-card"><span className="thinking-core" /><div><strong>归航正在演算</strong><small>{mode === "talk" ? "解析语气 · 调取人物记忆 · 生成回应" : mode === "act" ? "校验规则 · 计算代价 · 推进时间" : "改写问题 · 检索世界观 · 核验证据"}</small></div><i><b /><b /><b /></i></div>}</div>
          {hasNewMessages && <button className="new-message-button" onClick={scrollToLatest}>有新消息 · 回到底部 ↓</button>}
          {(error || syncing || syncRequired) && <div className="stream-banner" role="status"><span>{syncing ? "正在核对服务端进度…" : error || "请先核对存档后继续"}</span>{syncRequired ? <button disabled={syncing || pending} onClick={() => void loadSave()}>核对存档</button> : <button onClick={() => setError("")}>关闭</button>}</div>}
          {notice && <p className="sync-notice" role="status">{notice}</p>}
          {turnFeedback && <div key={turnFeedback.id} className={`turn-feedback ${turnFeedback.tone}`}>{turnFeedback.items.map((item) => <span key={item}>{item}</span>)}</div>}
          {state.ended ? <div className="chapter-end-bar"><span>{state.ending === "beacon" ? "第二幕已完成，可以从当前存档进入第三幕。" : "第三幕已完成，进度已保存。"}</span>{state.ending === "beacon" ? <button className="primary-button" disabled={blocked} onClick={() => void send("act", "继续进入第三幕")}>{pending ? "正在续接…" : "进入第三幕 →"}</button> : <Link className="primary-button" href={`/game/${saveId}/result`}>查看阶段结算 →</Link>}</div> : <>
            <div className="suggestions">{suggestions.map((item, index) => <button key={item} className={draft === item ? "selected" : ""} onClick={() => { setDraft(item); setMode("act"); }}><kbd>{index + 1}</kbd>{item}</button>)}</div>
            <form className="composer" onSubmit={submit}>
              <div className="mode-tabs">{(Object.keys(modeLabels) as InputMode[]).map((item) => <button type="button" key={item} className={mode === item ? "active" : ""} disabled={item === "talk" && !talkAvailable} onClick={() => setMode(item)}>{modeLabels[item]}</button>)}</div>
              <div className="composer-row"><textarea aria-label="对话输入" value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 500))} onKeyDown={(event) => { if (shouldSendOnEnter({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing, keyCode: event.keyCode }, mobile || window.matchMedia("(pointer: coarse)").matches)) { event.preventDefault(); if (draft.trim() && !blocked) void send(mode, draft.trim()); } }} placeholder={placeholder} rows={2} /><button className="send-button" disabled={!draft.trim() || blocked}>{pending ? "等待" : "发送"}</button></div>
              <div className="composer-foot"><span>{draft.length}/500</span><span>数字键 1—3 选择方案 · Enter 发送</span><span>行动会推进时间并产生真实代价</span></div>
            </form>
          </>}
        </section>
        {!compact && <aside className="status-panel desktop-status">{statusContent}</aside>}
      </section>
      {compact && panel === "status" && <Dialog title="归航 · 游戏菜单" onClose={() => setPanel(null)} className="status-dialog">
        <div className="menu-summary"><span>{stage.chapter} · {stage.title}</span><p>{state.objective}</p></div>
        <div className="menu-actions"><button className="secondary-button" onClick={() => setPanel("audio")}>♫ 音乐设置</button><Link className="secondary-button" href="/">返回首页</Link></div>
        <p className="storage-note">匿名存档只可在当前浏览器续玩。微信与外部浏览器不共享匿名身份；绑定同一 GitHub 账号后才可跨设备续玩。</p>
        {statusContent}
      </Dialog>}
      {confirmAction && <Dialog title="不可逆行动确认" onClose={() => { if (!pending) setConfirmAction(null); }} className="confirmation-dialog">
        <p>{confirmAction.warning}</p><blockquote>{confirmAction.text}</blockquote><div className="confirmation-actions"><button className="secondary-button" disabled={pending} onClick={() => setConfirmAction(null)}>再想想</button><button className="danger-button" disabled={blocked} onClick={() => void send(confirmAction.mode, confirmAction.text, true)}>{pending ? "正在执行…" : "确认并承担代价"}</button></div>
      </Dialog>}
    </main>
  );
}

function Message({ message }: { message: GameMessage }) { return <article className={`message ${message.kind}`}><div className="message-meta">{(message.kind === "guihang" || message.kind === "npc") && <span className="avatar">{message.kind === "guihang" ? "G" : message.label.slice(0, 1)}</span>}<span>{message.label}</span></div><p>{message.text}</p></article>; }
function Status({ label, value, width, tone }: { label: string; value: string; width: number; tone: string }) { return <div className="vital"><div className="vital-head"><span>{label}</span><strong>{value}</strong></div><div className={`meter ${tone}`}><i style={{ width: `${width}%` }} /></div></div>; }

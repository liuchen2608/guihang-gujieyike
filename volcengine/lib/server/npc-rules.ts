import { activeNpcFor, cloneGameState, GameMessage, GameState, InputMode, NpcId, NPC_NAMES, stageInfo } from "@/lib/game";
import { NPC_PROFILES } from "@/lib/npc-personalities";

export type DialogueIntent = "world_question" | "casual" | "help" | "trade" | "story" | "threat" | "attack";
export type HostilityLevel = 0 | 1 | 2 | 3 | 4;
export type MessageDraft = Omit<GameMessage, "id">;

export type NpcRuleResolution = {
  state: GameState;
  npcId: NpcId;
  intent: DialogueIntent;
  hostilityLevel: HostilityLevel;
  settlement: string;
  ruleMessages: MessageDraft[];
};

const DAMAGE_BY_LEVEL: Record<HostilityLevel, number> = { 0: 0, 1: 0, 2: 2, 3: 4, 4: 6 };

export function classifyHostility(text: string): HostilityLevel {
  const value = text.replace(/\s+/g, "");
  if (/(杀了你|杀死你|宰了你|攻击你|砍死你|刺死你|向你开枪|屠灭部族|杀光族人|伤害你们部族|(攻击|杀死|刺杀|砍向|射击|偷袭)(乌岩|长老|守卫|族人|NPC))/.test(value)) return 4;
  if (/(抢走|偷走|威胁你|骗你|毁掉|烧掉|砸毁|绑架|劫持|不说就)/.test(value)) return 3;
  if (/(废物|蠢货|白痴|闭嘴|滚开|你算什么|不听你的警告|有本事来|少命令我)/.test(value)) return 2;
  if (/(不信你|怀疑你|少废话|真烦|别装了|你在撒谎|质问)/.test(value)) return 1;
  return 0;
}

export function classifyIntent(text: string, hostility = classifyHostility(text)): DialogueIntent {
  if (hostility === 4) return "attack";
  if (hostility >= 2) return "threat";
  if (/(交换|交易|买|卖|价格|换取)/.test(text)) return "trade";
  if (/(帮我|帮助我|救我|救救|治疗我|为我治疗|给我指路|教我|演示|指导我|协助我|能不能给|请求援助)/.test(text)) return "help";
  if (/(任务|目标|水轮|希望井|狼群|道标|回家|归乡|下一步)/.test(text)) return "story";
  if (/(蛊|空窍|真元|蛊师|杀招|部族|北原|西漠|福地|宝黄天|魂魄|盗天|本杰孙|天外之魔|尊者|正道|魔道)/.test(text)) return "world_question";
  return "casual";
}

function appendMemory(state: GameState, npcId: NpcId, memory: string, critical = false) {
  const relation = state.npcRelations[npcId];
  const tagged = critical ? `【关键】${memory}` : memory;
  if (!relation.memories.includes(tagged)) relation.memories.push(tagged);
  const criticalMemories = relation.memories.filter((item) => item.startsWith("【关键】"));
  const recent = relation.memories.filter((item) => !item.startsWith("【关键】")).slice(-4);
  relation.memories = [...criticalMemories.slice(-8), ...recent];
}

function surrendering(text: string) {
  return /(投降|认输|放下武器|不打了|停止攻击|我退后|愿意受缚)/.test(text);
}

function apologizing(text: string) {
  return /(道歉|对不起|赔偿|弥补|不是故意)/.test(text);
}

function escaping(text: string) {
  return /(逃跑|撤退|离开这里|转身离开|冲出包围)/.test(text);
}

function playerAttack(text: string) {
  return /(攻击|杀|刺|砍|射击|开枪|偷袭|打倒|伤害|处决)/.test(text);
}

function attackNpc(state: GameState, npcId: NpcId, text: string) {
  const relation = state.npcRelations[npcId];
  const profile = NPC_PROFILES[npcId];
  if (!profile.canAttack || !relation.alive) return { damage: 0, killed: false };
  let damage = state.inventory.includes("一转砂甲蛊") ? 4 : 2;
  if (/(偷袭|要害|致命|处决)/.test(text)) damage += 2;
  damage = Math.min(6, damage);
  relation.health = Math.max(0, relation.health - damage);
  const killed = relation.health === 0;
  if (killed) {
    relation.alive = false;
    relation.aid = "hostile";
    state.moralRoute = "demonic";
    state.notoriety += 4;
    state.clanTrust -= 5;
    state.keyActions.push(`杀死${NPC_NAMES[npcId]}，正式踏入魔道路途`);
    appendMemory(state, npcId, `玩家以攻击造成 ${damage} 点伤害并杀死了${NPC_NAMES[npcId]}`, true);
    if (["wuyan", "elder", "clan_guard"].includes(npcId)) {
      for (const witnessId of ["wuyan", "elder", "clan_guard"] as NpcId[]) {
        if (witnessId === npcId || !state.npcRelations[witnessId].alive) continue;
        const witness = state.npcRelations[witnessId];
        witness.trust -= 4;
        witness.grudge += 4;
        witness.aid = "withheld";
        appendMemory(state, witnessId, `目击者与守卫确认玩家杀死了${NPC_NAMES[npcId]}`, true);
      }
    }
  } else {
    appendMemory(state, npcId, `玩家主动攻击，造成 ${damage} 点伤害`, true);
  }
  return { damage, killed };
}

function restoreAtCheckpoint(state: GameState, source: string, messages: MessageDraft[]) {
  const checkpoint = state.lastCheckpoint;
  state.phase = checkpoint;
  state.act = stageInfo(checkpoint).act;
  state.objective = stageInfo(checkpoint).objective;
  state.health = 5;
  state.stamina = Math.max(2, state.stamina - 2);
  state.energy = Number(Math.max(0.5, state.energy - 0.3).toFixed(1));
  if (state.healingSupplies.clanMedicine > 0) state.healingSupplies.clanMedicine -= 1;
  else if (state.healingSupplies.firstAidGel > 0) state.healingSupplies.firstAidGel -= 1;
  if (!state.conditions.includes("重伤恢复")) state.conditions.push("重伤恢复");
  state.keyActions.push(`被${source}击倒后从检查点恢复`);
  messages.push({ kind: "system", label: "检查点恢复", text: `生命归零。你在“${stageInfo(checkpoint).title}”检查点醒来，生命恢复至 5；损失体力、能源和一份可用药物，敌对关系不会重置。` });
}

function receiveNpcAttack(state: GameState, npcId: NpcId, level: HostilityLevel, messages: MessageDraft[]) {
  const profile = NPC_PROFILES[npcId];
  const relation = state.npcRelations[npcId];
  if (!profile.canAttack || !relation.alive || level < 2) return 0;
  const damage = DAMAGE_BY_LEVEL[level];
  state.health = Math.max(0, state.health - damage);
  messages.push({ kind: "system", label: "冲突结算", text: `${NPC_NAMES[npcId]}发动反击，造成 ${damage} 点伤害。生命 ${state.health} / 10。` });
  if (state.health === 0) restoreAtCheckpoint(state, NPC_NAMES[npcId], messages);
  return damage;
}

export function resolveNpcRules(state: GameState, mode: InputMode, text: string): NpcRuleResolution | null {
  const npcId = mode === "ask" ? "guihang" : activeNpcFor(state);
  if (!npcId) return null;
  const next = cloneGameState(state);
  const relation = next.npcRelations[npcId];
  const profile = NPC_PROFILES[npcId];
  const hostilityLevel = classifyHostility(text);
  const intent = classifyIntent(text, hostilityLevel);
  const ruleMessages: MessageDraft[] = [];
  let settlement = "没有数值变化";

  if (surrendering(text) && relation.aid === "hostile") {
    relation.aid = "withheld";
    relation.hostilityLevel = Math.max(1, relation.hostilityLevel - 1) as HostilityLevel;
    appendMemory(next, npcId, "玩家在冲突中投降；NPC停止继续攻击", true);
    settlement = "玩家投降，攻击停止；仇恨保留，援助仍中止";
    return { state: next, npcId, intent: "story", hostilityLevel: 0, settlement, ruleMessages };
  }

  if (escaping(text) && relation.aid === "hostile") {
    if (!next.conditions.includes("被青砂部族驱逐")) next.conditions.push("被青砂部族驱逐");
    appendMemory(next, npcId, "玩家从冲突现场撤退", true);
    settlement = "玩家成功撤退，本回合没有继续承受伤害；敌对状态保留";
    return { state: next, npcId, intent: "story", hostilityLevel: 0, settlement, ruleMessages };
  }

  if (apologizing(text) && hostilityLevel === 0) {
    relation.trust += relation.grudge < 4 ? 1 : 0;
    relation.grudge = Math.max(0, relation.grudge - 1);
    if (relation.aid === "withheld" && relation.grudge <= 1) relation.aid = "helping";
    appendMemory(next, npcId, "玩家为此前的冒犯道歉并提出弥补");
    settlement = relation.grudge >= 4 ? "NPC听取道歉，但严重仇恨无法靠一句话消除" : "仇恨 -1，关系开始修复";
    return { state: next, npcId, intent: "casual", hostilityLevel: 0, settlement, ruleMessages };
  }

  if (hostilityLevel > 0) {
    relation.hostilityLevel = Math.max(relation.hostilityLevel, hostilityLevel) as HostilityLevel;
    relation.trust -= hostilityLevel === 1 ? 1 : hostilityLevel;
    relation.grudge += hostilityLevel;
    relation.fear += hostilityLevel >= 3 ? 1 : 0;
    if (hostilityLevel === 2) relation.aid = "withheld";
    if (hostilityLevel >= 3) relation.aid = profile.canAttack ? "hostile" : "withheld";
    appendMemory(next, npcId, `玩家触发第 ${hostilityLevel} 级冲突：${text.slice(0, 80)}`, hostilityLevel >= 2);

    let playerDamage = 0;
    let killed = false;
    if (mode === "act" && hostilityLevel === 4 && playerAttack(text)) {
      const result = attackNpc(next, npcId, text);
      playerDamage = result.damage;
      killed = result.killed;
      if (killed) ruleMessages.push({ kind: "system", label: "不可逆事件", text: `${NPC_NAMES[npcId]}生命归零并永久死亡。其援助与个人剧情已经关闭，相关主线将由替代人物或强制路线继续。` });
    }
    const npcDamage = killed ? 0 : receiveNpcAttack(next, npcId, hostilityLevel, ruleMessages);
    settlement = `第 ${hostilityLevel} 级冲突；关系援助=${relation.aid}；玩家造成 ${playerDamage} 点伤害；NPC造成 ${npcDamage} 点伤害${killed ? `；${NPC_NAMES[npcId]}死亡` : ""}`;
    return { state: next, npcId, intent, hostilityLevel, settlement, ruleMessages };
  }

  if (relation.aid === "hostile" && profile.canAttack && relation.alive) {
    if (next.health <= 2 && profile.temperament === "principled") {
      settlement = "NPC占据优势并要求玩家投降，本回合没有继续造成伤害";
    } else {
      const ongoingLevel = Math.max(2, relation.hostilityLevel) as HostilityLevel;
      const damage = receiveNpcAttack(next, npcId, ongoingLevel, ruleMessages);
      settlement = `敌对状态持续，NPC继续攻击并造成 ${damage} 点伤害`;
    }
  } else {
    if (intent === "help" && relation.aid === "withheld") settlement = "NPC因关系破裂拒绝援助";
    appendMemory(next, npcId, `${intent === "world_question" ? "询问" : "交谈"}：${text.slice(0, 90)}`);
  }

  return { state: next, npcId, intent, hostilityLevel, settlement, ruleMessages };
}

export function resolveHealingAction(state: GameState, text: string): { state: GameState; messages: MessageDraft[] } | null {
  const wantsHealing = /(使用|喝下|服用|注射|涂抹|催动).*(急救|凝胶|伤药|药水|治疗蛊|疗伤蛊)|治疗自己|给自己疗伤/.test(text);
  if (!wantsHealing) return null;
  const next = cloneGameState(state);
  if (next.health >= 10) return { state: next, messages: [{ kind: "system", label: "治疗结算", text: "生命已经处于上限，本回合没有消耗药物。" }] };

  let restored = 0;
  let used = "";
  if (/(治疗蛊|疗伤蛊)/.test(text) && next.healingSupplies.healingGu > 0) {
    next.healingSupplies.healingGu -= 1;
    next.healingEffectTurns = 1;
    restored = 1;
    used = "治疗类蛊虫";
  } else if (/(伤药|药水|部族药)/.test(text) && next.healingSupplies.clanMedicine > 0) {
    next.healingSupplies.clanMedicine -= 1;
    restored = 2;
    used = "青砂伤药";
  } else if (next.healingSupplies.firstAidGel > 0) {
    next.healingSupplies.firstAidGel -= 1;
    restored = 2;
    used = "机甲急救凝胶";
  }

  if (!used) return { state: next, messages: [{ kind: "system", label: "治疗失败", text: "当前没有可用的治疗物品。你需要交易、完成援助任务或从敌人手中夺取补给。" }] };
  next.health = Math.min(10, next.health + restored);
  next.conditions = next.conditions.filter((item) => item !== "轻度失血" && item !== "重伤恢复");
  next.keyActions.push(`使用${used}恢复生命`);
  const followUp = used === "治疗类蛊虫" ? "下一回合还将恢复 1 点。" : "";
  return { state: next, messages: [{ kind: "system", label: "治疗结算", text: `使用${used}，生命 +${restored}，当前 ${next.health} / 10。${followUp}` }] };
}

export function applyOngoingHealing(previous: GameState, next: GameState, messages: MessageDraft[]) {
  if (previous.healingEffectTurns <= 0) return;
  next.health = Math.min(10, next.health + 1);
  next.healingEffectTurns = Math.max(0, previous.healingEffectTurns - 1);
  messages.push({ kind: "system", label: "持续治疗", text: `治疗蛊继续生效，生命 +1，当前 ${next.health} / 10。` });
}

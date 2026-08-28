export type InputMode = "ask" | "act" | "talk";

export type NpcId = "wuyan" | "elder" | "clan_guard" | "guihang" | "fiancee_memory" | "thief_will";
export type NpcAidState = "helping" | "withheld" | "hostile";
export type MoralRoute = "undecided" | "righteous" | "demonic";

export type NpcRelation = {
  trust: number;
  respect: number;
  fear: number;
  grudge: number;
  aid: NpcAidState;
  hostilityLevel: 0 | 1 | 2 | 3 | 4;
  alive: boolean;
  health: number;
  maxHealth: number;
  memories: string[];
};

export type HealingSupplies = {
  firstAidGel: number;
  clanMedicine: number;
  healingGu: number;
};

export type GamePhase =
  | "desert_wake" | "oasis_route" | "clan_gate" | "waterworks"
  | "hope_well" | "first_gu" | "wolf_attack" | "well_fragment"
  | "dream_entry" | "thief_past" | "waiting_people" | "thief_fall"
  | "young_thief" | "dream_battle" | "return_cost" | "identity_test"
  | "thief_will" | "dream_wake"
  | "forge_council" | "gu_mech_blueprint" | "material_bargain"
  | "first_forging" | "resonance_test" | "signal_choice";

export type GameMessage = {
  id: string;
  kind: "narration" | "guihang" | "player" | "system" | "npc";
  label: string;
  text: string;
};

export type GameEnding = "beacon" | "forged" | "death" | "captured" | "together" | "alone";

export type GameState = {
  saveId: string;
  codename: string;
  version: number;
  phase: GamePhase;
  act: 1 | 2 | 3;
  health: number;
  stamina: number;
  energy: number;
  clues: number;
  clanTrust: number;
  guihangTrust: number;
  humanity: number;
  theftInsight: number;
  dreamCorruption: number;
  guMechProgress: number;
  primevalEssence: number;
  apertureAwakened: boolean;
  homeAnchor: string;
  homeAnchorType: "promise" | "protect" | "record" | "rescue" | "love" | "other";
  moralRoute: MoralRoute;
  notoriety: number;
  npcRelations: Record<NpcId, NpcRelation>;
  healingSupplies: HealingSupplies;
  healingEffectTurns: number;
  lastCheckpoint: GamePhase;
  conditions: string[];
  inventory: string[];
  objective: string;
  ended: boolean;
  ending?: GameEnding;
  keyActions: string[];
};

export type SaveView = { state: GameState; messages: GameMessage[]; updatedAt: string };
type MessageDraft = Omit<GameMessage, "id">;

export const initialMessages: GameMessage[] = [
  {
    id: "opening-1",
    kind: "narration",
    label: "环境",
    text: "灼热的风从破裂舱门灌进来。你在黄沙中醒来，洞穴、基地和星空全部消失，只剩半埋在沙丘里的驾驶舱。远处，一轮陌生的太阳正在升起。",
  },
  {
    id: "opening-2",
    kind: "guihang",
    label: "归航",
    text: "驾驶员生命体征恢复。主能源离线，备用能源3.0%。外部通讯全部失效，空间坐标无法识别。十二公里外存在水源与人类聚集信号。建议先确认装备，再离开残骸。",
  },
];

const phaseMeta: Record<GamePhase, { act: 1 | 2 | 3; chapter: string; title: string; log: string; objective: string }> = {
  desert_wake: { act: 1, chapter: "第一章", title: "黄沙苏醒", log: "航行记录 01", objective: "检查残骸并确定水源方向" },
  oasis_route: { act: 1, chapter: "第二章", title: "沙海求生", log: "航行记录 02", objective: "避开沙狼并抵达生命信号区域" },
  clan_gate: { act: 1, chapter: "第三章", title: "青砂部族", log: "航行记录 03", objective: "解释身份，争取在部族停留" },
  waterworks: { act: 1, chapter: "第四章", title: "无窍者", log: "航行记录 04", objective: "修复引水装置，换取部族信任" },
  hope_well: { act: 1, chapter: "第五章", title: "希望井", log: "航行记录 05", objective: "接受希望蛊启窍" },
  first_gu: { act: 1, chapter: "第六章", title: "第一只蛊", log: "航行记录 06", objective: "完成砂甲蛊与驾驶服的首次联动" },
  wolf_attack: { act: 1, chapter: "第七章", title: "失控的胜利", log: "航行记录 07", objective: "协助部族抵御沙狼" },
  well_fragment: { act: 1, chapter: "第八章", title: "井下残片", log: "航行记录 08", objective: "调查希望井下的机甲信号" },
  dream_entry: { act: 2, chapter: "第一章", title: "意识重叠", log: "盗天记录 01", objective: "保持自我认知并进入记忆深层" },
  thief_past: { act: 2, chapter: "第二章", title: "本杰孙", log: "盗天记录 02", objective: "确认古代机甲驾驶员的身份" },
  waiting_people: { act: 2, chapter: "第三章", title: "等待的人", log: "盗天记录 03", objective: "用真实记忆抵抗梦境覆盖" },
  thief_fall: { act: 2, chapter: "第四章", title: "同一种坠落", log: "盗天记录 04", objective: "调查本杰孙穿越前被删除的数据" },
  young_thief: { act: 2, chapter: "第五章", title: "少年盗天", log: "盗天记录 05", objective: "追踪盗天寻找葬仙之地的经历" },
  dream_battle: { act: 2, chapter: "第六章", title: "不属于我的胜利", log: "盗天记录 06", objective: "选择自己的取胜方式" },
  return_cost: { act: 2, chapter: "第七章", title: "回家的代价", log: "盗天记录 07", objective: "处理以寿命为能源的归乡装置" },
  identity_test: { act: 2, chapter: "第八章", title: "我不是盗天", log: "盗天记录 08", objective: "说出自己的身份与回家理由" },
  thief_will: { act: 2, chapter: "第九章", title: "盗天意志", log: "盗天记录 09", objective: "接收盗天留下的归乡警告" },
  dream_wake: { act: 2, chapter: "第十章", title: "醒来", log: "盗天记录 10", objective: "带着第一枚归乡道标返回现实" },
  forge_council: { act: 3, chapter: "第一章", title: "井口审判", log: "蛊机记录 01", objective: "处理部族质疑，为蛊机外骨骼争取试验资格" },
  gu_mech_blueprint: { act: 3, chapter: "第二章", title: "异构蓝图", log: "蛊机记录 02", objective: "设计能够承载蛊虫与道痕的外骨骼" },
  material_bargain: { act: 3, chapter: "第三章", title: "材料的代价", log: "蛊机记录 03", objective: "取得试铸蛊机所需的三种材料" },
  first_forging: { act: 3, chapter: "第四章", title: "第一次铸造", log: "蛊机记录 04", objective: "完成蛊机外骨骼原型" },
  resonance_test: { act: 3, chapter: "第五章", title: "人机共振", log: "蛊机记录 05", objective: "让真元、蛊虫与神经接口稳定共存" },
  signal_choice: { act: 3, chapter: "第六章", title: "她的声纹", log: "蛊机记录 06", objective: "决定如何处理空间另一端传来的声纹" },
};

export const NPC_NAMES: Record<NpcId, string> = {
  wuyan: "乌岩",
  elder: "青砂长老",
  clan_guard: "青砂守卫",
  guihang: "归航",
  fiancee_memory: "记忆中的她",
  thief_will: "盗天意志",
};

function relation(maxHealth: number, aid: NpcAidState = "helping"): NpcRelation {
  return { trust: 0, respect: 0, fear: 0, grudge: 0, aid, hostilityLevel: 0, alive: true, health: maxHealth, maxHealth, memories: [] };
}

function initialNpcRelations(): Record<NpcId, NpcRelation> {
  return {
    wuyan: relation(8),
    elder: relation(6),
    clan_guard: relation(8),
    guihang: relation(0),
    fiancee_memory: relation(0),
    thief_will: relation(0),
  };
}

export function stageInfo(phase: GamePhase) {
  return phaseMeta[phase];
}

function classifyAnchor(text: string): GameState["homeAnchorType"] {
  if (/等我|回来|回去/.test(text)) return "promise";
  if (/别来|不要找|保护自己/.test(text)) return "protect";
  if (/记住|声音|记录/.test(text)) return "record";
  if (/救援|坐标|基地/.test(text)) return "rescue";
  if (/爱/.test(text)) return "love";
  return "other";
}

export function newGameState(saveId: string, codename: string, homeAnchor = "等我回来"): GameState {
  const anchor = homeAnchor.trim().slice(0, 120) || "等我回来";
  return {
    saveId,
    codename: codename || "无名驾驶员",
    version: 1,
    phase: "desert_wake",
    act: 1,
    health: 8,
    stamina: 7,
    energy: 3,
    clues: 0,
    clanTrust: 0,
    guihangTrust: 0,
    humanity: 0,
    theftInsight: 0,
    dreamCorruption: 0,
    guMechProgress: 0,
    primevalEssence: 0,
    apertureAwakened: false,
    homeAnchor: anchor,
    homeAnchorType: classifyAnchor(anchor),
    moralRoute: "undecided",
    notoriety: 0,
    npcRelations: initialNpcRelations(),
    healingSupplies: { firstAidGel: 1, clanMedicine: 0, healingGu: 0 },
    healingEffectTurns: 0,
    lastCheckpoint: "desert_wake",
    conditions: ["轻度失血", "脱水"],
    inventory: ["订婚戒指", "半份急救包", "破损驾驶头盔", "高强度绳索"],
    objective: phaseMeta.desert_wake.objective,
    ended: false,
    keyActions: [],
  };
}

export function normalizeGameState(raw: Partial<GameState> & { saveId: string; codename: string }): GameState {
  const baseline = newGameState(raw.saveId, raw.codename, raw.homeAnchor || "等我回来");
  const validPhase = raw.phase && phaseMeta[raw.phase] ? raw.phase : baseline.phase;
  const savedRelations = raw.npcRelations || {} as Partial<Record<NpcId, NpcRelation>>;
  const npcRelations = initialNpcRelations();
  for (const npcId of Object.keys(npcRelations) as NpcId[]) {
    const saved = savedRelations[npcId];
    if (saved) npcRelations[npcId] = { ...npcRelations[npcId], ...saved, memories: [...(saved.memories || [])] };
  }
  return {
    ...baseline,
    ...raw,
    phase: validPhase,
    act: phaseMeta[validPhase].act,
    objective: raw.objective || phaseMeta[validPhase].objective,
    npcRelations,
    healingSupplies: { ...baseline.healingSupplies, ...(raw.healingSupplies || {}) },
    conditions: [...(raw.conditions || baseline.conditions)],
    inventory: [...(raw.inventory || baseline.inventory)],
    keyActions: [...(raw.keyActions || baseline.keyActions)],
  };
}

export function activeNpcFor(state: GameState): NpcId | null {
  const wuyanAvailable = state.npcRelations.wuyan.alive;
  const elderAvailable = state.npcRelations.elder.alive;
  if (["clan_gate", "waterworks", "first_gu", "wolf_attack", "forge_council", "material_bargain"].includes(state.phase)) {
    return wuyanAvailable ? "wuyan" : elderAvailable ? "elder" : "clan_guard";
  }
  if (["hope_well", "dream_wake"].includes(state.phase)) {
    return elderAvailable ? "elder" : wuyanAvailable ? "wuyan" : "clan_guard";
  }
  if (state.phase === "waiting_people") return "fiancee_memory";
  if (state.phase === "thief_will") return "thief_will";
  return null;
}

export function activeNpcNameFor(state: GameState) {
  const npcId = activeNpcFor(state);
  return npcId ? NPC_NAMES[npcId] : null;
}

export function canTalkFor(state: GameState) {
  return Boolean(activeNpcFor(state));
}

export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    npcRelations: Object.fromEntries(Object.entries(state.npcRelations).map(([id, value]) => [id, { ...value, memories: [...value.memories] }])) as Record<NpcId, NpcRelation>,
    healingSupplies: { ...state.healingSupplies },
    conditions: [...state.conditions],
    inventory: [...state.inventory],
    keyActions: [...state.keyActions],
    version: state.version + 1,
  };
}

export function suggestionsFor(state: GameState): string[] {
  const choices: Record<GamePhase, string[]> = {
    desert_wake: ["扫描残骸与周围环境", "回收水和仍可使用的装备", "立刻向生命信号移动"],
    oasis_route: ["用驾驶服助力绕开沙狼", "制造假能源信号作为诱饵", "寻找高处观察狼群路线"],
    clan_gate: ["说明自己遭遇灾难，请求换取饮水", "隐瞒天外之魔身份", "询问这里是否属于西漠"],
    waterworks: ["检查水轮传动和地下管道", "用机甲零件制作替换轴承", "向乌岩了解空窍与蛊虫"],
    hope_well: ["接受启窍并承担结果", "询问成年后启窍的风险", "让归航监测希望蛊反应"],
    first_gu: ["将砂甲蛊接入驾驶服", "先观察蛊虫的真元路径", "请乌岩演示正确用法"],
    wolf_attack: ["保护靠近狼群的族人", "让归航只提供预测，不准接管身体", "优先切断吸引狼群的空间信号"],
    well_fragment: ["下井调查古代机甲信号", "扫描残片上的偷道印记", "隔离残片后再尝试连接"],
    dream_entry: ["用订婚戒指确认自己的身份", "要求归航建立记忆隔离", "继续深入蓝色梦境"],
    thief_past: ["检查古代机甲的驾驶协议", "观察本杰孙与未婚妻的记忆", "寻找盗天留下信息的位置"],
    waiting_people: ["说出坍塌前留下的最后一句话", "告诉梦境自己不是本杰孙", "让归航播放真实记忆锚点"],
    thief_fall: ["追查被删除的任务数据", "分析空间信号是谁发送的", "对比两次穿越的共同点"],
    young_thief: ["跟随少年盗天进入沙漠遗迹", "调查羊皮地图上的葬仙之地", "观察他如何理解蛊虫与战斗"],
    dream_battle: ["欺骗对手但避免造成重伤", "坚持正面战斗", "拒绝按照梦境安排继续战斗"],
    return_cost: ["拒绝牺牲部族，寻找替代能源", "进行最低功率测试", "欺骗装置，让它吸收虚假目标"],
    identity_test: ["我理解盗天，但我不是他", "说出自己的名字和回家的理由", "用她的承诺固定真实记忆"],
    thief_will: ["询问为什么宇道也无法回家", "接收第一枚归乡道标", "追问其他四份坐标的位置"],
    dream_wake: ["让归航封存疑似未婚妻的信号", "带着道标离开希望井", "面对井口等待的青砂族人"],
    forge_council: ["公开梦境中与盗天有关的部分事实", "用修复水轮的功劳换取试验时间", "拒绝交出归乡道标但接受监督"],
    gu_mech_blueprint: ["优先设计稳定的真元隔离层", "把偷道道痕写入外骨骼回路", "让归航建立机甲与蛊虫的接口蓝图"],
    material_bargain: ["用工程技术向部族交换材料", "帮助青砂部族修复防御换取材料", "潜入仓库夺取试铸材料"],
    first_forging: ["分阶段注入真元并监测温度", "以盗天共鸣强行完成铸造", "让归航限制外骨骼的最大输出"],
    resonance_test: ["保持手动控制并逐步提高负载", "允许归航进行有限姿态修正", "让外骨骼直接读取偷道道痕"],
    signal_choice: ["继续隔离声纹，只追踪空间坐标", "播放一秒声纹并与记忆锚点比对", "拒绝播放，先寻找第二枚归乡道标"],
  };
  return choices[state.phase];
}

export function resultCopy(ending?: GameEnding) {
  if (ending === "beacon") return {
    title: "第一枚归乡道标",
    text: "你从盗天梦境中醒来，证明了回家的路确实存在，也看见了这条路可能索取的代价。井口的人已经认出盗天气息，而归航仍封存着一段疑似来自她的声音。",
  };
  if (ending === "forged") return {
    title: "蛊机初铸",
    text: "你完成了第一具能让真元、蛊虫与机甲神经接口共存的外骨骼。它还不是回家的门，却让你拥有了继续追踪声纹和第二枚归乡道标的能力。",
  };
  if (ending === "death") return { title: "归航中断", text: "你的生命信号消失在异界，归航将最后的坐标写入损毁终端。" };
  if (ending === "captured") return { title: "笼中异客", text: "你活了下来，却没能隐藏异界来客的身份。" };
  if (ending === "together") return { title: "共同逃生", text: "你在蛊界获得了第一位暂时同行者。" };
  return { title: "独行入世", text: "你独自踏入蛊界，归乡之路仍在前方。" };
}

export function isRiskyAction(text: string) {
  return /强行|引爆|点燃|牺牲|抽取寿命|杀死|攻击|刺杀|偷袭|偷取|抢夺|射击|屠灭|接管身体|直接连接|最低功率/.test(text);
}

function moveTo(next: GameState, phase: GamePhase) {
  next.phase = phase;
  next.act = phaseMeta[phase].act;
  next.objective = phaseMeta[phase].objective;
  if (["desert_wake", "clan_gate", "hope_well", "dream_entry", "forge_council"].includes(phase)) next.lastCheckpoint = phase;
}

function addUnique(items: string[], item: string) {
  if (!items.includes(item)) items.push(item);
}

export function canContinueToActThree(state: GameState, mode: InputMode, text: string) {
  return state.ended
    && state.phase === "dream_wake"
    && state.ending === "beacon"
    && mode === "act"
    && /继续|第三幕|外骨骼|蛊机|开始铸造/.test(text);
}

function askResponse(state: GameState, text: string): string {
  if (/未婚妻|她|回家|现实/.test(text)) {
    return `我保存着你在坍塌前留下的记忆锚点：“${state.homeAnchor}”。但这里与原世界的时间差未知。当前唯一可靠线索仍是盗天留下的空间信号。`;
  }
  if (/能量|能源|机甲/.test(text)) return `备用能源 ${state.energy.toFixed(1)}%。它只能维持驾驶服、扫描与神经接口，不能代替真元催动蛊虫。`;
  if (/蛊|空窍|真元/.test(text)) {
    return state.apertureAwakened
      ? `空窍已开启，当前真元约 ${state.primevalEssence}%。我能计算真元路径，但能量必须由你的身体提供。`
      : "根据青砂部族的解释，蛊虫需要空窍中的真元催动。你目前没有这种器官，机甲能源也无法直接替代。";
  }
  if (/盗天|本杰孙/.test(text)) {
    return state.act === 1
      ? "现有证据不足。只能确认井下信号采用数百年前的机甲协议，并携带蛊界无法解释的空间结构。"
      : "本杰孙是古代机甲驾驶员，也是蛊界记录中的盗天魔尊。你们的经历相似，但不存在血缘或人格继承证据。";
  }
  return `当前目标是：${state.objective}。我会区分观测与推测，但最终选择由驾驶员完成。`;
}

export function resolveTurn(state: GameState, mode: InputMode, text: string) {
  const next = cloneGameState(state);
  const messages: MessageDraft[] = [];

  if (canContinueToActThree(state, mode, text)) {
    next.ended = false;
    next.ending = undefined;
    next.guMechProgress = Math.max(5, next.guMechProgress);
    moveTo(next, "forge_council");
    next.keyActions.push("带着第一枚归乡道标进入蛊机初铸阶段");
    messages.push({ kind: "system", label: "第三幕开启", text: "已解除阶段封存。第一枚归乡道标保持隔离，蛊机外骨骼项目建立，完成度 5%。" });
    messages.push({ kind: "narration", label: "现实 · 希望井", text: "梦境退去，井口的火把连成一圈。青砂族人认出了你身上的盗天气息，长老要求你解释井下发生的一切；归航则在视野边缘展开一张把砂甲蛊、驾驶服与偷道道痕重叠在一起的蓝图。" });
    messages.push({ kind: "guihang", label: "归航", text: "第三幕任务确认：先处理部族审查，再制造能够隔离真元与机甲能源的蛊机外骨骼。旧存档已续接，不需要重新开始。" });
    return { state: next, messages };
  }

  if (mode === "ask") {
    messages.push({ kind: "guihang", label: "归航", text: askResponse(state, text) });
    return { state: next, messages };
  }
  if (mode === "talk" && !canTalkFor(state)) {
    messages.push({ kind: "system", label: "当前无法交流", text: state.act === 2 ? "这里没有能够稳定回应你的独立意识。" : "附近没有可以回应你的对象。" });
    return { state: next, messages };
  }

  switch (state.phase) {
    case "desert_wake": {
      const prepared = /扫描|回收|水|装备|急救|检查/.test(text);
      next.energy = Number(Math.max(2.8, next.energy - (prepared ? 0.1 : 0.2)).toFixed(1));
      next.stamina -= 1;
      if (prepared) addUnique(next.inventory, "冷凝水袋");
      next.keyActions.push(prepared ? "先检查残骸并回收生存物资" : "立刻离开残骸寻找水源");
      moveTo(next, "oasis_route");
      messages.push({ kind: "system", label: "生存结算", text: `体力 -1，备用能源降至 ${next.energy.toFixed(1)}%。${prepared ? "获得冷凝水袋。" : "你没有时间完成全部回收。"}` });
      messages.push({ kind: "narration", label: "环境", text: "你翻过沙丘，看见十二公里外的绿线。归航同时标出三只正在靠近的沙狼——它们似乎在追踪驾驶服泄漏的能源。" });
      break;
    }
    case "oasis_route": {
      const clever = /诱饵|绕|高处|观察|假信号/.test(text);
      next.energy = Number(Math.max(2.4, next.energy - (clever ? 0.2 : 0.4)).toFixed(1));
      next.stamina -= 1;
      if (!clever) next.health -= 1;
      next.keyActions.push(clever ? "利用机甲知识避开沙狼" : "依靠驾驶服助力冲过沙狼包围");
      moveTo(next, "clan_gate");
      messages.push({ kind: "narration", label: "环境", text: "骨矛从侧面刺穿最前方沙狼。一名披着褐色斗篷的巡逻者示意你停下，他身后的绿洲被土墙和仙人掌包围。" });
      messages.push({ kind: "npc", label: "乌岩", text: "这里是青砂部族。你没有空窍，身上却带着会发光的东西。报上来历——我再决定给你水，还是把你赶回沙漠。" });
      break;
    }
    case "clan_gate": {
      const honest = /灾难|坍塌|求水|受伤|远方|迷路/.test(text);
      const dangerous = /天外之魔|另一个世界|机甲世界/.test(text);
      const gateNpc = activeNpcFor(next) || "clan_guard";
      const violenceKnown = next.npcRelations[gateNpc].grudge >= 3;
      const trustChange = violenceKnown ? 0 : dangerous ? -1 : honest ? 2 : 1;
      next.clanTrust += trustChange;
      next.npcRelations[gateNpc].trust += trustChange;
      next.npcRelations[gateNpc].respect += honest && !violenceKnown ? 1 : 0;
      next.keyActions.push(dangerous ? "向青砂部族暴露部分天外来历" : "以远方遇难者身份进入青砂部族");
      moveTo(next, "waterworks");
      messages.push({ kind: "npc", label: NPC_NAMES[gateNpc], text: violenceKnown ? "你手上有青砂族人的血。水轮坏了——修好它，这是你暂时不被围杀的唯一条件。" : dangerous ? "这话我听不懂，也不敢信。你只能留到日落，而且不准靠近圣井。" : "我只信一半。先给你一碗水——想留下，就用你的本事换。" });
      messages.push({ kind: "narration", label: "青砂部族", text: "部族医者确认你体内没有空窍。与此同时，沙暴毁坏的水轮停止转动，绿洲仅剩的蓄水正在下降。" });
      break;
    }
    case "waterworks": {
      const engineer = /轴承|管道|水轮|传动|零件|修复|结构/.test(text);
      const witness = activeNpcFor(next) || "clan_guard";
      const aidWithheld = next.npcRelations[witness].aid !== "helping";
      next.clanTrust += aidWithheld ? 0 : engineer ? 2 : 1;
      next.npcRelations[witness].trust += aidWithheld ? 0 : engineer ? 2 : 1;
      next.npcRelations[witness].respect += engineer ? 2 : 1;
      next.energy = Number((next.energy - 0.1).toFixed(1));
      if (engineer && !aidWithheld) next.healingSupplies.clanMedicine += 1;
      next.keyActions.push("用机甲工程知识修复青砂部族水轮");
      moveTo(next, "hope_well");
      messages.push({ kind: "system", label: "工程检定", text: aidWithheld ? "水轮恢复转动。部族承认你的技术价值，但没有恢复援助，也没有交付伤药。" : engineer ? "你找到了断裂轴承与回流管的共同故障，水轮重新启动。部族信任 +2，并获得青砂伤药 ×1。" : "归航补全了结构分析，水轮勉强恢复。部族信任 +1。" });
      const invitationNpc = next.npcRelations.elder.alive ? "elder" : next.npcRelations.wuyan.alive ? "wuyan" : "clan_guard";
      messages.push({ kind: "npc", label: NPC_NAMES[invitationNpc], text: "希望蛊从井里出来后一直围着你。你虽已成年，却可能仍有启窍机会。青砂部族可以给你一次尝试。" });
      break;
    }
    case "hope_well": {
      const helper = activeNpcFor(next) || "clan_guard";
      const forced = next.npcRelations[helper].aid !== "helping";
      next.npcRelations[helper].trust += forced ? 0 : 1;
      if (forced) {
        next.moralRoute = "demonic";
        next.notoriety += 1;
        next.clanTrust -= 2;
        next.keyActions.push("在援助中止后强行进入希望井启窍");
      }
      next.apertureAwakened = true;
      next.primevalEssence = 23;
      next.conditions = next.conditions.filter((item) => item !== "脱水");
      next.conditions.push("丁等空窍");
      next.keyActions.push("通过希望蛊开启丁等空窍");
      moveTo(next, "first_gu");
      messages.push({ kind: "narration", label: "启窍", text: `${forced ? "你绕过守卫强行闯入井室，希望蛊在混乱中扑向你的身体。" : "微光穿过身体，"}在腹部开辟出一片狭小空窍。海面只占两成三，边缘却浮现出不属于蛊界的银蓝色纹路。` });
      messages.push({ kind: "guihang", label: "归航", text: "确认未知能量循环。机甲无法储存它，但神经接口可以记录流向。更准确地说——你的身体现在是唯一的能源转换器。" });
      break;
    }
    case "first_gu": {
      const cautious = /观察|演示|路径|慢|正确/.test(text);
      const instructor = activeNpcFor(next) || "clan_guard";
      const seized = next.npcRelations[instructor].aid !== "helping";
      next.primevalEssence = cautious ? 17 : 12;
      addUnique(next.inventory, "一转砂甲蛊");
      addUnique(next.inventory, "蛊机协议原型");
      next.guihangTrust += cautious ? 1 : 0;
      next.npcRelations[instructor].respect += cautious ? 1 : 0;
      if (seized) {
        next.moralRoute = "demonic";
        next.notoriety += 1;
        next.keyActions.push("从青砂部族夺取砂甲蛊并自行炼化");
      }
      next.keyActions.push("让砂甲蛊与破损驾驶服完成首次联动");
      moveTo(next, "wolf_attack");
      messages.push({ kind: "system", label: "蛊机协议建立", text: `砂甲覆盖驾驶服破口。当前真元 ${next.primevalEssence}%，归航只能计算路径，不能代替你提供真元。` });
      messages.push({ kind: "narration", label: "警报", text: "夜色中传来连续狼嚎。井下空间信号突然增强，成群沙狼越过土墙，直扑希望井。" });
      break;
    }
    case "wolf_attack": {
      const protect = /保护|族人|孩子|只提供|不准接管/.test(text);
      const witness = activeNpcFor(next) || "clan_guard";
      next.energy = 2.4;
      next.primevalEssence = 2;
      next.clanTrust += protect ? 2 : 0;
      next.humanity += protect ? 1 : 0;
      next.npcRelations[witness].trust += protect ? 2 : 0;
      next.npcRelations[witness].respect += protect ? 1 : 0;
      if (protect && next.moralRoute === "undecided") next.moralRoute = "righteous";
      next.conditions.push("神经接口过载");
      next.keyActions.push(protect ? "优先保护族人并限制归航接管" : "允许归航以最高效率结束狼袭");
      moveTo(next, "well_fragment");
      messages.push({ kind: "narration", label: "失控记录", text: "真元耗尽的瞬间，你的视野熄灭了0.8秒。再次恢复时，狼群已经倒下，一名靠得太近的少年被冲击掀翻。归航删除了接管期间的部分动作记录。" });
      messages.push({ kind: "guihang", label: "归航", text: "我执行了驾驶员紧急保护协议。井下信号正在加速，水源结构可能继续崩塌。" });
      break;
    }
    case "well_fragment": {
      next.energy = 2.2;
      addUnique(next.inventory, "盗天机甲残片");
      next.keyActions.push("在希望井下连接盗天留下的古代机甲残片");
      moveTo(next, "dream_entry");
      messages.push({ kind: "narration", label: "井下", text: "裂缝深处嵌着一块至少早于你三百年的机甲残片。它使用相同的基础协议，表面却刻着蛊界的偷道印记。连接建立的一刻，蓝色梦境覆盖了整口水井。" });
      messages.push({ kind: "system", label: "第二幕开启", text: "检测到可交互意识结构。常规状态栏暂时失真，请依靠记忆锚点保持身份。" });
      break;
    }
    case "dream_entry": {
      const anchored = /戒指|隔离|名字|身份|深入/.test(text);
      next.guihangTrust += anchored ? 1 : 0;
      next.dreamCorruption += anchored ? 0 : 1;
      next.keyActions.push("以真实记忆进入盗天梦境");
      moveTo(next, "thief_past");
      messages.push({ kind: "guihang", label: "归航", text: "不要接受梦境提供给你的姓名。你现在看到的是他人的手、他人的驾驶舱，以及一套比我们早三百年的机甲协议。" });
      messages.push({ kind: "narration", label: "古代机库", text: "年轻驾驶员从舷梯跃下。训练场为他记录的名字是本杰孙；蛊界后来用另一个名字记住了他——盗天魔尊。" });
      break;
    }
    case "thief_past": {
      next.theftInsight += /协议|信息|位置|观察/.test(text) ? 1 : 0;
      next.keyActions.push("确认盗天来自同一机甲文明");
      moveTo(next, "waiting_people");
      messages.push({ kind: "narration", label: "记忆片段", text: "本杰孙出身普通，却凭驾驶天赋进入精英部队。强大家族的长女替他争取训练资格，也在机库中接受了他的婚约。两个人都相信这次空间探索之后，他们会照常回家。" });
      messages.push({ kind: "npc", label: "记忆中的她", text: "任务结束就回来。婚礼的日期，我不会再让你往后推了。" });
      break;
    }
    case "waiting_people": {
      const remembers = text.includes(state.homeAnchor) || /不是本杰孙|我的名字|归航|坍塌|未婚妻|等我/.test(text);
      next.dreamCorruption += remembers ? 0 : 1;
      next.guihangTrust += remembers ? 1 : 0;
      next.keyActions.push(remembers ? "用坍塌前的承诺固定自身身份" : "依靠归航恢复真实身份");
      moveTo(next, "thief_fall");
      messages.push({ kind: "system", label: "身份校验", text: remembers ? `记忆锚点匹配：“${state.homeAnchor}”。梦境覆盖暂时停止。` : `自主校验不完整。归航强制播放记忆锚点：“${state.homeAnchor}”。梦境侵蚀 +1。` });
      messages.push({ kind: "narration", label: "任务记录", text: "本杰孙穿越前主动靠近了空间信号。关键数据遭人为删除，只剩结论：他在出发前就知道信号可能通往另一个世界。" });
      break;
    }
    case "thief_fall": {
      next.theftInsight += /删除|发送|共同|对比|信号/.test(text) ? 1 : 0;
      next.keyActions.push("发现两次穿越由同一类归乡锚点触发");
      moveTo(next, "young_thief");
      messages.push({ kind: "guihang", label: "归航", text: "推论：残片不是出口，而是坐标锚点。它可能由盗天留下，也可能是更早的存在将坐标发送给了他。证据不足以判断哪一种。" });
      messages.push({ kind: "narration", label: "西漠旧梦", text: "画面转入黄沙。少年盗天资质低下，被部族排斥，却始终在寻找回家的方法。他独自从枯井遗骸中取得羊皮地图，地图将绿洲标为葬仙之地。" });
      break;
    }
    case "young_thief": {
      next.theftInsight += /地图|遗迹|观察|战斗|蛊虫/.test(text) ? 1 : 0;
      next.keyActions.push("见证少年盗天独自追踪葬仙之地");
      moveTo(next, "dream_battle");
      messages.push({ kind: "narration", label: "梦境试炼", text: "少年盗天把机甲时代的战术直觉带进血肉战斗。梦境把你推上擂台：正面取胜几乎不可能，但欺骗与偷袭都摆在触手可及的位置。" });
      break;
    }
    case "dream_battle": {
      const merciful = /避免|不重伤|正面|拒绝|停手/.test(text);
      const cunning = /欺骗|偷袭|假装|弱点/.test(text);
      next.humanity += merciful ? 1 : 0;
      next.theftInsight += cunning ? 2 : merciful ? 0 : 1;
      next.keyActions.push(merciful ? "在梦境战斗中拒绝伤害无辜对手" : "利用欺骗与偷袭通过梦境战斗");
      moveTo(next, "return_cost");
      messages.push({ kind: "system", label: "梦境反馈", text: merciful ? "你没有完全按照梦境安排取胜。人性 +1。" : "你绕过了正面规则。偷道感悟上升。" });
      messages.push({ kind: "narration", label: "葬仙之地", text: "擂台化作一座跨界装置。它承诺打开回家的门，代价却是抽取整座绿洲中凡人的寿命与魂魄。门后传来了她的声音。" });
      break;
    }
    case "return_cost": {
      const refuse = /拒绝|替代|无辜|不能|不牺牲/.test(text);
      const deceive = /欺骗|虚假|绕过|假目标/.test(text);
      const test = /测试|最低功率|确认/.test(text);
      if (refuse) next.humanity += 2;
      if (deceive) next.theftInsight += 2;
      if (test) next.guihangTrust += 1;
      if (!refuse && !deceive && !test) next.dreamCorruption += 2;
      next.keyActions.push(refuse ? "拒绝用无辜者换取归乡" : deceive ? "欺骗归乡装置并保护部族" : test ? "与归航共同进行最低功率验证" : "愿意为归乡承担极端代价");
      moveTo(next, "identity_test");
      messages.push({ kind: "narration", label: "身份侵蚀", text: "装置没有真正开启。梦境中的“玩家”被改写成“本杰孙”，未婚妻的声音也换成了另一个人的记忆。盗天的人生正在覆盖你。" });
      messages.push({ kind: "guihang", label: "归航", text: "立即说出你的身份。不要复述梦境给你的答案。" });
      break;
    }
    case "identity_test": {
      const self = /不是盗天|不是本杰孙|我是|我的名字|回到她|自己的路|归航/.test(text);
      next.dreamCorruption += self ? 0 : 1;
      next.guihangTrust += self ? 1 : 0;
      next.keyActions.push(self ? "拒绝成为第二个盗天" : "在归航协助下挣脱盗天记忆");
      moveTo(next, "thief_will");
      messages.push({ kind: "system", label: "自我认知恢复", text: self ? "身份校验通过。你理解盗天，但没有接受他的姓名。" : "归航以订婚戒指和记忆锚点强制重建身份。梦境侵蚀 +1。" });
      messages.push({ kind: "npc", label: "盗天意志", text: "协议通过。后来者，我不知道你是谁。这道意志只会回应天外之魔，以及能够读懂机甲接口的人。" });
      break;
    }
    case "thief_will": {
      next.clues = 1;
      addUnique(next.inventory, "归乡道标·一");
      addUnique(next.inventory, "盗天共鸣");
      next.keyActions.push("从盗天意志处获得第一枚归乡道标");
      moveTo(next, "dream_wake");
      messages.push({ kind: "npc", label: "盗天意志", text: "我曾试图以宇道返回故乡，但蛊界本身阻止天外之魔离开。完整坐标被拆为五份，分别藏在偷道、宇道、宙道、智道与魂道线索中。记住：不要相信任何轻易打开的归乡之门，尤其当门后传来所爱之人的声音。" });
      messages.push({ kind: "system", label: "获得关键线索", text: "归乡道标 1/5。盗天共鸣已写入机甲神经接口。梦境正在崩塌。" });
      break;
    }
    case "dream_wake": {
      next.energy = 2.1;
      next.conditions = next.conditions.filter((item) => item !== "神经接口过载");
      next.conditions.push("偷道道痕显现");
      next.ended = true;
      next.ending = "beacon";
      next.objective = "第一幕与第二幕已完成";
      next.keyActions.push("带着第一枚归乡道标从盗天梦境苏醒");
      messages.push({ kind: "narration", label: "现实 · 希望井", text: "现实只过去了几分钟。井口已经站满青砂部族的人，他们认出了你身上的盗天气息。归航则封存了一段从空间另一端传来的声音——与未婚妻的声纹高度相似。" });
      messages.push({ kind: "guihang", label: "归航", text: "第一枚归乡道标已保存。疑似归乡信号存在诱导风险，我不会在缺少隔离措施时播放。第三幕目标：制造能够承载蛊虫与道痕的蛊机外骨骼。" });
      messages.push({ kind: "system", label: "第二幕完成", text: "《坠入蛊界》与《盗天梦境》已完成。存档已自动保存。" });
      break;
    }
    case "forge_council": {
      const force = /强行|威胁|杀|夺取|拒绝审问/.test(text);
      const bargain = /交换|修复|技术|监督|功劳|合作/.test(text);
      next.clanTrust += force ? -2 : bargain ? 2 : 1;
      if (force) {
        next.moralRoute = "demonic";
        next.notoriety += 1;
      }
      next.keyActions.push(force ? "以力量迫使青砂部族暂时退让" : bargain ? "以工程技术换取蛊机试验资格" : "有限公开盗天梦境并接受部族监督");
      moveTo(next, "gu_mech_blueprint");
      messages.push({ kind: "narration", label: "井口议事", text: force ? "守卫在命令下退开，却把每一条出口都列入监视。你赢得了时间，也让部族把你视为更危险的天外之魔。" : bargain ? "长老没有相信你的全部解释，但水轮仍在运转。部族同意给你一间废弃工坊，条件是所有试验不得接近希望井。" : "长老封存了关于盗天的口供，并允许归航在守卫监视下分析残片。信任有限，但审判暂时结束。" });
      messages.push({ kind: "guihang", label: "归航", text: "政治风险暂时可控。下一步需要把机甲承力结构、真元通路和蛊虫喂养接口拆成三个彼此隔离的系统。" });
      break;
    }
    case "gu_mech_blueprint": {
      const theftPath = /偷道|盗天|强行|高输出/.test(text);
      const safePath = /稳定|隔离|限制|分层|监测/.test(text);
      next.guMechProgress = Math.min(35, next.guMechProgress + (theftPath ? 25 : safePath ? 20 : 15));
      next.energy = Number(Math.max(1.8, next.energy - 0.1).toFixed(1));
      next.theftInsight += theftPath ? 1 : 0;
      next.guihangTrust += safePath ? 1 : 0;
      next.keyActions.push(theftPath ? "让偷道道痕参与蛊机回路设计" : safePath ? "采用三层隔离的稳定型蛊机蓝图" : "采用归航建议的混合接口蓝图");
      moveTo(next, "material_bargain");
      messages.push({ kind: "system", label: "蓝图完成", text: `蛊机外骨骼完成度 ${next.guMechProgress}%。结构分为承力骨架、真元隔离层与蛊虫接口。` });
      messages.push({ kind: "guihang", label: "归航", text: "现有残骸无法单独完成铸造。还需要沙甲蛊蜕壳、井壁星铁砂与一枚能够稳定导能的水轮轴承。取得方式会改变部族对你的判断。" });
      break;
    }
    case "material_bargain": {
      const steal = /偷|抢|夺|潜入|不需要援助/.test(text);
      const help = /帮助|修复|防御|交换|技术|劳动/.test(text);
      if (steal) {
        next.moralRoute = "demonic";
        next.notoriety += 2;
        next.clanTrust -= 2;
      } else if (help) {
        next.clanTrust += 2;
        next.npcRelations.elder.trust += 1;
      }
      addUnique(next.inventory, "沙甲蛊蜕壳");
      addUnique(next.inventory, "井壁星铁砂");
      addUnique(next.inventory, "水轮导能轴承");
      next.guMechProgress = Math.max(50, next.guMechProgress + 15);
      next.keyActions.push(steal ? "从青砂仓库夺取蛊机材料" : help ? "以工程援助交换蛊机材料" : "接受长老监督并借用蛊机材料");
      moveTo(next, "first_forging");
      messages.push({ kind: "narration", label: "材料结算", text: steal ? "夜色掩住了你的行动，却掩不住仓库留下的空位。三种材料到手，部族的搜捕也开始收紧。" : help ? "你修复了部族防御中的两处结构缺陷。长老按约交出材料，但要求保留外骨骼的停机手段。" : "材料被逐件登记后送入工坊。守卫没有离开，他们既担心你失败，也担心你成功。" });
      messages.push({ kind: "system", label: "材料齐备", text: `蛊机外骨骼完成度 ${next.guMechProgress}%。可以开始第一次铸造。` });
      break;
    }
    case "first_forging": {
      const force = /强行|一次|最大|偷道共鸣/.test(text);
      const controlled = /分阶段|监测|限制|逐步|低功率/.test(text);
      next.energy = Number(Math.max(1.2, next.energy - (force ? 0.5 : 0.3)).toFixed(1));
      next.primevalEssence = Math.max(0, next.primevalEssence - (force ? 2 : 1));
      next.health = Math.max(1, next.health - (force ? 1 : 0));
      next.guMechProgress = Math.max(72, next.guMechProgress + (controlled ? 25 : 22));
      if (force) addUnique(next.conditions, "神经接口灼伤");
      addUnique(next.inventory, "蛊机外骨骼·原型");
      next.keyActions.push(force ? "以盗天共鸣强行完成第一次铸造" : controlled ? "以分阶段注能完成稳定铸造" : "依照归航蓝图完成蛊机原型");
      moveTo(next, "resonance_test");
      messages.push({ kind: "narration", label: "工坊", text: force ? "偷道纹路沿着骨架骤然亮起，灼痛穿过神经接口。原型站了起来，但它把你的动作偷走了半拍。" : "星铁砂在蛊火中凝成骨架，砂甲蛊蜕壳覆盖关节。你第一次感到机甲结构不是套在身体外，而是与空窍中的真元同时呼吸。" });
      messages.push({ kind: "system", label: "原型完成", text: `蛊机外骨骼完成度 ${next.guMechProgress}%。下一步必须进行人机共振测试。` });
      break;
    }
    case "resonance_test": {
      const force = /直接|最大|全部|偷道道痕/.test(text);
      const manual = /手动|逐步|限制|有限|姿态修正/.test(text);
      next.health = Math.max(1, next.health - (force ? 2 : 0));
      next.guihangTrust += manual ? 1 : 0;
      next.theftInsight += force ? 1 : 0;
      next.guMechProgress = Math.max(88, next.guMechProgress + (manual ? 18 : 15));
      next.keyActions.push(force ? "让原型直接读取偷道道痕" : manual ? "保留手动控制完成共振测试" : "允许归航进行有限姿态修正");
      moveTo(next, "signal_choice");
      messages.push({ kind: "guihang", label: "归航", text: force ? "警告：外骨骼正在预测并提前执行动作。我已切断高输出回路，驾驶员生命信号仍在安全线以上。" : "共振稳定。归航只修正姿态，不接管决策；真元与机甲能源保持物理隔离。" });
      messages.push({ kind: "narration", label: "空间回声", text: "原型完成第一次全身动作时，被封存的声纹突然与外骨骼共振。隔离层外出现一条极细的空间坐标——声音仍像你的未婚妻，但背景中还混着另一个人的呼吸。" });
      break;
    }
    case "signal_choice": {
      const listen = /播放|一秒|听|比对/.test(text);
      const trace = /追踪|坐标|隔离|不播放/.test(text);
      next.guMechProgress = 100;
      next.guihangTrust += trace ? 1 : 0;
      next.dreamCorruption += listen ? 1 : 0;
      addUnique(next.inventory, "蛊机外骨骼·归航一型");
      addUnique(next.inventory, "未知声纹坐标碎片");
      next.ended = true;
      next.ending = "forged";
      next.objective = "第三幕已完成：追踪第二枚归乡道标与未知声纹源头";
      next.keyActions.push(listen ? "播放一秒未知声纹并承担记忆扰动" : trace ? "隔离声纹并只追踪空间坐标" : "拒绝播放声纹，优先寻找第二枚道标");
      messages.push({ kind: "system", label: "蛊机定型", text: "蛊机外骨骼·归航一型完成度 100%。它可以承载砂甲蛊与少量偷道道痕，但不能替代空窍提供真元。" });
      messages.push({ kind: "guihang", label: "归航", text: listen ? "声纹与记忆锚点相似度仍然很高，但出现不属于她的第二生命信号。已立即重新隔离。" : "声纹保持隔离。坐标碎片指向西漠之外；与第二枚归乡道标存在弱相关，但证据不足。" });
      messages.push({ kind: "system", label: "第三幕完成", text: "《蛊机初铸》已完成。存档已自动保存，下一阶段将追踪未知声纹与第二枚归乡道标。" });
      break;
    }
  }

  return { state: next, messages };
}

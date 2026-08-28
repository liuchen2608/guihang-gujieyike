import { NextResponse } from "next/server";
import { activeNpcFor, canContinueToActThree, GameMessage, InputMode, isRiskyAction, resolveTurn } from "@/lib/game";
import { ownerIdentity } from "@/lib/server/auth";
import { localTurnMeta, resolveNpcDialogue } from "@/lib/server/npc-dialogue";
import { applyOngoingHealing, classifyHostility, resolveHealingAction } from "@/lib/server/npc-rules";
import { readSave, saveTurn } from "@/lib/server/storage";
import { actionRequiresNpcAid } from "@/lib/turn-routing";

const labels: Record<InputMode, string> = { ask: "询问归航", act: "执行行动", talk: "与 NPC 交流" };

export async function POST(request: Request, context: { params: Promise<{ saveId: string }> }) {
  try {
    const { saveId } = await context.params;
    const body = await request.json() as { playerId?: string; mode?: InputMode; text?: string; version?: number; confirmed?: boolean };
    const identity = await ownerIdentity(request, body.playerId);
    if (!identity) return NextResponse.json({ error: "缺少玩家身份" }, { status: 401 });
    const text = body.text?.trim() || "";
    if (!body.mode || !["ask", "act", "talk"].includes(body.mode)) return NextResponse.json({ error: "请求无效" }, { status: 400 });
    if (!text || text.length > 500) return NextResponse.json({ error: "请输入 1～500 个字符" }, { status: 400 });

    const save = await readSave(saveId, identity.id);
    if (!save) return NextResponse.json({ error: "存档不存在或无权访问" }, { status: 404 });
    if (save.state.ended && !canContinueToActThree(save.state, body.mode, text)) {
      return NextResponse.json({ error: "本阶段已经结束", resultUrl: `/game/${saveId}/result` }, { status: 409 });
    }
    if (body.version !== save.state.version) return NextResponse.json({ error: "存档已在别处更新，请刷新后继续", code: "VERSION_CONFLICT" }, { status: 409 });
    if (body.mode === "act" && isRiskyAction(text) && !body.confirmed) {
      return NextResponse.json({ requiresConfirmation: true, warning: "这项行动可能造成生命或能源的永久损失，确认后才会结算。" });
    }

    let resolved: Awaited<ReturnType<typeof resolveNpcDialogue>>;
    if (body.mode === "act") {
      const healing = resolveHealingAction(save.state, text);
      const activeNpc = activeNpcFor(save.state);
      const activeRelation = activeNpc ? save.state.npcRelations[activeNpc] : null;
      const isNpcConflict = Boolean(activeNpc && (classifyHostility(text) > 0 || activeRelation?.aid === "hostile"));
      const requiresWithheldAid = actionRequiresNpcAid(save.state.phase, activeRelation?.aid, text);
      if (healing) {
        resolved = { ...healing, ai: localTurnMeta() };
      } else if (isNpcConflict || requiresWithheldAid) {
        resolved = await resolveNpcDialogue(save.state, body.mode, text);
      } else {
        const local = resolveTurn(save.state, body.mode, text);
        resolved = { ...local, ai: localTurnMeta() };
      }
    } else {
      resolved = await resolveNpcDialogue(save.state, body.mode, text);
    }
    applyOngoingHealing(save.state, resolved.state, resolved.messages);
    const timestamp = Date.now();
    const playerMessage: GameMessage = { id: crypto.randomUUID(), kind: "player", label: labels[body.mode], text };
    const responseMessages: GameMessage[] = resolved.messages.map((message, index) => ({ ...message, id: `${timestamp}-${index}-${crypto.randomUUID()}` }));
    const status = await saveTurn(saveId, identity.id, save.state.version, playerMessage, responseMessages, resolved.state);
    if (status === "conflict") return NextResponse.json({ error: "状态刚刚发生变化，请重新载入", code: "VERSION_CONFLICT" }, { status: 409 });
    if (status === "not_found") return NextResponse.json({ error: "存档不存在或无权访问" }, { status: 404 });
    return NextResponse.json({ state: resolved.state, messages: [playerMessage, ...responseMessages], ai: resolved.ai });
  } catch (error) {
    console.error("turn_failed", error);
    return NextResponse.json({ error: "归航暂时失去连接，本次行动没有结算，请重试" }, { status: 500 });
  }
}

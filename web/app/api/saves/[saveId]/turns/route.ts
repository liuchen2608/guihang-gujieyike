import { NextResponse } from "next/server";
import { activeNpcFor, canContinueToActThree, GameMessage, InputMode, isRiskyAction, resolveTurn } from "@/lib/game";
import { invitationRequired, ownerIdentity } from "@/lib/server/invite-access";
import { readSmallJson, RequestError, requireSameOrigin, protectionResponse } from "@/lib/server/request-security";
import { protection, protectWrite } from "@/lib/server/protection";
import { localTurnMeta, resolveNpcDialogue } from "@/lib/server/npc-dialogue";
import { applyOngoingHealing, classifyHostility, resolveHealingAction } from "@/lib/server/npc-rules";
import { readSave, saveTurn } from "@/lib/server/storage";
import { actionRequiresNpcAid } from "@/lib/turn-routing";

const labels: Record<InputMode, string> = { ask: "询问归航", act: "执行行动", talk: "与 NPC 交流" };

export async function POST(request: Request, context: { params: Promise<{ saveId: string }> }) {
  try {
    const { saveId } = await context.params;
    requireSameOrigin(request);
    const identity = await ownerIdentity(request);
    if (!identity) return invitationRequired();
    const body = await readSmallJson(request) as { mode?: InputMode; text?: string; version?: number; confirmed?: boolean };
    if (typeof body.text !== "string" || !Number.isInteger(body.version) || (body.confirmed !== undefined && typeof body.confirmed !== "boolean")) throw new RequestError("行动内容格式无效。");
    const text = body.text?.trim() || "";
    if (!body.mode || !["ask", "act", "talk"].includes(body.mode)) return NextResponse.json({ error: "请求无效" }, { status: 400 });
    if (!text || text.length > 500) return NextResponse.json({ error: "请输入 1～500 个字符" }, { status: 400 });
    const mode = body.mode;
    await protectWrite(request, identity.id, "turn");

    const save = await readSave(saveId, identity.id);
    if (!save) return NextResponse.json({ error: "存档不存在或无权访问" }, { status: 404 });
    if (save.state.ended && !canContinueToActThree(save.state, body.mode, text)) {
      return NextResponse.json({ error: "本阶段已经结束", resultUrl: `/game/${saveId}/result` }, { status: 409 });
    }
    if (body.version !== save.state.version) return NextResponse.json({ error: "存档已在别处更新，请刷新后继续", code: "VERSION_CONFLICT" }, { status: 409 });
    if (body.mode === "act" && isRiskyAction(text) && !body.confirmed) {
      return NextResponse.json({ requiresConfirmation: true, warning: "这项行动可能造成生命或能源的永久损失，确认后才会结算。" });
    }

    return await protection.runTurn(identity.id, saveId, save.state.version, async (assertActive) => {
      let resolved: Awaited<ReturnType<typeof resolveNpcDialogue>>;
      if (mode === "act") {
        const healing = resolveHealingAction(save.state, text);
        const activeNpc = activeNpcFor(save.state);
        const activeRelation = activeNpc ? save.state.npcRelations[activeNpc] : null;
        const isNpcConflict = Boolean(activeNpc && (classifyHostility(text) > 0 || activeRelation?.aid === "hostile"));
        const requiresWithheldAid = actionRequiresNpcAid(save.state.phase, activeRelation?.aid, text);
        if (healing) {
          resolved = { ...healing, ai: localTurnMeta() };
        } else if (isNpcConflict || requiresWithheldAid) {
          resolved = await resolveNpcDialogue(save.state, mode, text, identity.id);
        } else {
          const local = resolveTurn(save.state, mode, text);
          resolved = { ...local, ai: localTurnMeta() };
        }
      } else {
        resolved = await resolveNpcDialogue(save.state, mode, text, identity.id);
      }
      applyOngoingHealing(save.state, resolved.state, resolved.messages);
      const timestamp = Date.now();
      const playerMessage: GameMessage = { id: crypto.randomUUID(), kind: "player", label: labels[mode], text };
      const responseMessages: GameMessage[] = resolved.messages.map((message, index) => ({ ...message, id: `${timestamp}-${index}-${crypto.randomUUID()}` }));
      await assertActive();
      const status = await saveTurn(saveId, identity.id, save.state.version, playerMessage, responseMessages, resolved.state);
      if (status === "conflict") return NextResponse.json({ error: "状态刚刚发生变化，请重新载入", code: "VERSION_CONFLICT" }, { status: 409 });
      if (status === "not_found") return NextResponse.json({ error: "存档不存在或无权访问" }, { status: 404 });
      return NextResponse.json({ state: resolved.state, messages: [playerMessage, ...responseMessages], ai: resolved.ai }, { headers: { "cache-control": "no-store" } });
    });
  } catch (error) {
    const blocked = protectionResponse(error); if (blocked) return blocked;
    console.error("turn_failed");
    return NextResponse.json({ error: "暂时无法确认行动结果，请先核对存档，勿重复提交。", code: "TURN_UNCERTAIN" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

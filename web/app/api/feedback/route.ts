import { NextResponse } from "next/server";
import { invitationRequired, ownerIdentity } from "@/lib/server/invite-access";
import { readSmallJson, requireSameOrigin, protectionResponse } from "@/lib/server/request-security";
import { protectWrite } from "@/lib/server/protection";
import { readSave, submitFeedback } from "@/lib/server/storage";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const identity = await ownerIdentity(request);
    if (!identity) return invitationRequired();
    const body = await readSmallJson(request, 12000) as { saveId?: string; understoodGoal?: boolean; trustedGuihang?: boolean; continueChapterTwo?: boolean; rating?: number; detail?: string; contact?: string };
    if (typeof body.understoodGoal !== "boolean" || typeof body.trustedGuihang !== "boolean" || typeof body.continueChapterTwo !== "boolean" || typeof body.rating !== "number" || !Number.isFinite(body.rating) || typeof body.detail !== "string" || !body.detail.trim() || (body.contact !== undefined && typeof body.contact !== "string")) {
      return NextResponse.json({ error: "请完成所有必填项" }, { status: 400 });
    }
    if (body.saveId && (typeof body.saveId !== "string" || !await readSave(body.saveId, identity.id))) return NextResponse.json({ error: "存档不存在或无权访问" }, { status: 404 });
    await protectWrite(request, identity.id, "feedback");
    await submitFeedback({
      saveId: body.saveId,
      playerId: identity.id,
      understoodGoal: body.understoodGoal,
      trustedGuihang: body.trustedGuihang,
      continueChapterTwo: body.continueChapterTwo,
      rating: Math.max(1, Math.min(5, body.rating)),
      detail: body.detail,
      contact: body.contact,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const blocked = protectionResponse(error); if (blocked) return blocked;
    console.error("feedback_failed", error);
    const message = error instanceof Error && /UNIQUE/.test(error.message) ? "你已经提交过这份反馈，谢谢参与" : "反馈暂时无法提交，请稍后重试";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

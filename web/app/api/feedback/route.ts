import { NextResponse } from "next/server";
import { ownerIdentity } from "@/lib/server/auth";
import { submitFeedback } from "@/lib/server/storage";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { saveId?: string; playerId?: string; understoodGoal?: boolean; trustedGuihang?: boolean; continueChapterTwo?: boolean; rating?: number; detail?: string; contact?: string };
    const identity = await ownerIdentity(request, body.playerId);
    if (!identity) return NextResponse.json({ error: "缺少玩家身份" }, { status: 401 });
    if (typeof body.understoodGoal !== "boolean" || typeof body.trustedGuihang !== "boolean" || typeof body.continueChapterTwo !== "boolean" || !body.rating || !body.detail?.trim()) {
      return NextResponse.json({ error: "请完成所有必填项" }, { status: 400 });
    }
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
    console.error("feedback_failed", error);
    const message = error instanceof Error && /UNIQUE/.test(error.message) ? "你已经提交过这份反馈，谢谢参与" : "反馈暂时无法提交，请稍后重试";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

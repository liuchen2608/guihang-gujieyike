import { NextResponse } from "next/server";
import { invitationRequired, ownerIdentity } from "@/lib/server/invite-access";
import { readSave } from "@/lib/server/storage";

export async function GET(request: Request, context: { params: Promise<{ saveId: string }> }) {
  try {
    const { saveId } = await context.params;
    const identity = await ownerIdentity(request);
    if (!identity) return invitationRequired();
    const save = await readSave(saveId, identity.id);
    if (!save) return NextResponse.json({ error: "未找到这个存档，或它不属于当前浏览器" }, { status: 404 });
    return NextResponse.json(save, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("read_save_failed", error);
    return NextResponse.json({ error: "读取存档失败，请重试" }, { status: 500 });
  }
}

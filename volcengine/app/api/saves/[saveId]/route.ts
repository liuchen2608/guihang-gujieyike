import { NextResponse } from "next/server";
import { ownerIdentity } from "@/lib/server/auth";
import { readSave } from "@/lib/server/storage";

export async function GET(request: Request, context: { params: Promise<{ saveId: string }> }) {
  try {
    const { saveId } = await context.params;
    const anonymousId = new URL(request.url).searchParams.get("playerId");
    const identity = await ownerIdentity(request, anonymousId);
    if (!identity) return NextResponse.json({ error: "缺少玩家身份" }, { status: 401 });
    const save = await readSave(saveId, identity.id);
    if (!save) return NextResponse.json({ error: "未找到这个存档，或它不属于当前浏览器" }, { status: 404 });
    return NextResponse.json(save);
  } catch (error) {
    console.error("read_save_failed", error);
    return NextResponse.json({ error: "读取存档失败，请重试" }, { status: 500 });
  }
}

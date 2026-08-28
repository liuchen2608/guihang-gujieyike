import { NextResponse } from "next/server";
import { ownerIdentity } from "@/lib/server/auth";
import { createSave, readLatestSave } from "@/lib/server/storage";

export async function GET(request: Request) {
  try {
    const anonymousId = new URL(request.url).searchParams.get("playerId");
    const identity = await ownerIdentity(request, anonymousId);
    if (!identity) return NextResponse.json({ error: "缺少玩家身份" }, { status: 401 });
    return NextResponse.json({ save: await readLatestSave(identity.id) });
  } catch (error) {
    console.error("read_latest_save_failed", error);
    return NextResponse.json({ error: "暂时无法读取存档" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { codename?: string; playerId?: string; homeAnchor?: string };
    const identity = await ownerIdentity(request, body.playerId);
    if (!identity) return NextResponse.json({ error: "匿名身份无效" }, { status: 400 });
    const save = await createSave(
      identity.id,
      body.codename || identity.user?.name || identity.user?.login || "",
      body.homeAnchor?.slice(0, 120),
    );
    return NextResponse.json(save, { status: 201 });
  } catch (error) {
    console.error("create_save_failed", error);
    return NextResponse.json({ error: "暂时无法创建存档，请重试" }, { status: 500 });
  }
}

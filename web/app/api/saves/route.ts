import { NextResponse } from "next/server";
import { invitationRequired, ownerIdentity } from "@/lib/server/invite-access";
import { readSmallJson, RequestError, requireSameOrigin, protectionResponse } from "@/lib/server/request-security";
import { protectWrite } from "@/lib/server/protection";
import { createSave, readLatestSave } from "@/lib/server/storage";

export async function GET(request: Request) {
  try {
    const identity = await ownerIdentity(request);
    if (!identity) return invitationRequired();
    return NextResponse.json({ save: await readLatestSave(identity.id) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("read_latest_save_failed", error);
    return NextResponse.json({ error: "暂时无法读取存档" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const identity = await ownerIdentity(request);
    if (!identity) return invitationRequired();
    const body = await readSmallJson(request);
    if ((body.codename !== undefined && typeof body.codename !== "string") || (body.homeAnchor !== undefined && typeof body.homeAnchor !== "string")) throw new RequestError("角色信息格式无效。");
    await protectWrite(request, identity.id, "create");
    const save = await createSave(
      identity.id,
      (typeof body.codename === "string" && body.codename) || identity.user?.name || identity.user?.login || "",
      typeof body.homeAnchor === "string" ? body.homeAnchor.slice(0, 120) : undefined,
    );
    return NextResponse.json(save, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const blocked = protectionResponse(error); if (blocked) return blocked;
    console.error("create_save_failed", error);
    return NextResponse.json({ error: "暂时无法创建存档，请重试" }, { status: 500 });
  }
}

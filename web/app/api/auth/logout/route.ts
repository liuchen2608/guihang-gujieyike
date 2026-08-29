import { NextResponse } from "next/server";
import { revokeSession, SESSION_COOKIE } from "@/lib/server/auth";
import { INVITE_COOKIE } from "@/lib/server/invite-access";
import { RequestError, requireSameOrigin } from "@/lib/server/request-security";

export async function POST(request: Request) {
  try { requireSameOrigin(request); } catch (error) { return NextResponse.json({ error: "请求来源无效" }, { status: error instanceof RequestError ? error.status : 403 }); }
  await revokeSession(request);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(INVITE_COOKIE);
  return response;
}

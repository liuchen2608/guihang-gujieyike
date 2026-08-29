import { NextResponse } from "next/server";
import { inviteCookieToken, newInviteToken, publicAccess, readInviteAccess, setInviteCookie } from "@/lib/server/invite-access";

export async function GET(request: Request) {
  try {
    const access = await readInviteAccess(request);
    const response = NextResponse.json(publicAccess(access), { headers: { "cache-control": "no-store" } });
    if (!access && !inviteCookieToken(request)) setInviteCookie(response, newInviteToken(), request);
    // Extend the preflight cookie to the grant expiry even if the POST response was lost.
    if (access && inviteCookieToken(request)) setInviteCookie(response, inviteCookieToken(request)!, request, access.grant.expires_at);
    return response;
  } catch {
    return NextResponse.json({ error: "暂时无法核验试玩资格，请稍后重试。" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

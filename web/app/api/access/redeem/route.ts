import { NextResponse } from "next/server";
import { publicAccess, redeemInvitation, setInviteCookie } from "@/lib/server/invite-access";
import { readSmallJson, RequestError, requireSameOrigin } from "@/lib/server/request-security";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const result = await redeemInvitation(request, await readSmallJson(request));
    const response = NextResponse.json(publicAccess(result.access), { headers: { "cache-control": "no-store" } });
    if (result.token) setInviteCookie(response, result.token, request, result.access.grant.expires_at);
    return response;
  } catch (error) {
    const status = error instanceof RequestError ? error.status : 503;
    return NextResponse.json({ error: error instanceof RequestError ? error.message : "验证暂时中断，请重试；若已兑换成功，不会重复消耗名额。" }, { status, headers: { "cache-control": "no-store", ...(status === 429 ? { "retry-after": "600" } : {}) } });
  }
}

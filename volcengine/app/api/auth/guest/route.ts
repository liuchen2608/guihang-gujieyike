import { NextResponse } from "next/server";
import { GUEST_COOKIE, guestSessions, ownerIdentity } from "@/lib/server/auth";
import { protection } from "@/lib/server/protection";
import { digest } from "@/lib/server/protection-core";
import { requireSameOrigin, protectionResponse } from "@/lib/server/request-security";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const existing = await ownerIdentity(request);
    if (existing) return NextResponse.json({ playerId: existing.id }, { headers: { "cache-control": "no-store" } });
    const header = process.env.TRUSTED_CLIENT_IP_HEADER?.trim();
    const network = (header ? request.headers.get(header) : null) || "shared-unknown";
    await protection.consume("guest-network:" + await digest(network), 10, 600_000);
    await protection.consume("guest-total-day", 50, 86400_000);
    const { token, guest } = await guestSessions.create();
    const response = NextResponse.json({ playerId: guest.owner }, { status: 201, headers: { "cache-control": "no-store" } });
    response.cookies.set(GUEST_COOKIE, token, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", expires: new Date(guest.expires) });
    return response;
  } catch (error) {
    return protectionResponse(error) || NextResponse.json({ error: "暂时无法建立安全会话，请稍后重试。" }, { status: 503 });
  }
}

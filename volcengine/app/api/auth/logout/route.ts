import { NextResponse } from "next/server";
import { revokeSession, SESSION_COOKIE } from "@/lib/server/auth";
import { requireSameOrigin, protectionResponse } from "@/lib/server/request-security";

export async function POST(request: Request) {
  try { requireSameOrigin(request); } catch (error) { return protectionResponse(error)!; }
  await revokeSession(request);
  const response = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

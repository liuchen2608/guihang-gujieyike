import { NextResponse } from "next/server";
import { revokeSession, SESSION_COOKIE } from "@/lib/server/auth";

export async function POST(request: Request) {
  await revokeSession(request);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

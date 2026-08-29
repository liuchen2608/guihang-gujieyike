import { NextResponse } from "next/server";
import { safeReturnTo, guestSessions, readCookie, hashToken, GUEST_COOKIE } from "@/lib/server/auth";

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/login?error=not_configured", request.url));

  const requestUrl = new URL(request.url);
  const state = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
  const returnTo = safeReturnTo(requestUrl.searchParams.get("returnTo"));
  const token = readCookie(request, GUEST_COOKIE);
  const guest = await guestSessions.read(token);
  const callbackUrl = `${requestUrl.origin}/api/auth/github/callback`;
  const githubUrl = new URL("https://github.com/login/oauth/authorize");
  githubUrl.searchParams.set("client_id", clientId);
  githubUrl.searchParams.set("redirect_uri", callbackUrl);
  githubUrl.searchParams.set("scope", "read:user");
  githubUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(githubUrl);
  const secure = requestUrl.protocol === "https:";
  response.cookies.set("guihang_oauth_state", state, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
  response.cookies.set("guihang_oauth_return", returnTo, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
  if (guest && token) response.cookies.set("guihang_oauth_guest", await hashToken(token), { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
  else response.cookies.delete("guihang_oauth_guest");
  response.cookies.delete("guihang_oauth_anonymous");
  return response;
}

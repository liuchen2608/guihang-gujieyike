import { NextResponse } from "next/server";
import { safeReturnTo, validAnonymousId } from "@/lib/server/auth";

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/login?error=not_configured", request.url));

  const requestUrl = new URL(request.url);
  const state = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
  const returnTo = safeReturnTo(requestUrl.searchParams.get("returnTo"));
  const anonymousId = requestUrl.searchParams.get("anonymousId");
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
  if (validAnonymousId(anonymousId)) response.cookies.set("guihang_oauth_anonymous", anonymousId!, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}

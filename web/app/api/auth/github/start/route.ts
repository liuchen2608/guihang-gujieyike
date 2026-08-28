import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { safeReturnTo, validAnonymousId } from "@/lib/server/auth";

export async function GET(request: Request) {
  const clientId = env.GITHUB_CLIENT_ID;
  const requestUrl = new URL(request.url);
  if (!clientId) {
    const errorUrl = new URL("/login", request.url);
    errorUrl.searchParams.set("error", "not_configured");
    errorUrl.searchParams.set("returnTo", safeReturnTo(requestUrl.searchParams.get("returnTo")));
    return NextResponse.redirect(errorUrl);
  }
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

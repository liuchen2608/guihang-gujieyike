import { NextResponse } from "next/server";
import { establishSession, readCookie, safeReturnTo, SESSION_COOKIE, GUEST_COOKIE, guestSessions } from "@/lib/server/auth";
import { adoptAnonymousData } from "@/lib/server/storage";

type GitHubProfile = { id: number; login: string; name?: string | null; avatar_url?: string | null };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = readCookie(request, "guihang_oauth_state");
  const returnTo = safeReturnTo(readCookie(request, "guihang_oauth_return"));
  const errorUrl = new URL("/login", url.origin);

  if (!code || !state || !storedState || state !== storedState) {
    errorUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(errorUrl);
  }
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    errorUrl.searchParams.set("error", "not_configured");
    return NextResponse.redirect(errorUrl);
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${url.origin}/api/auth/github/callback` }),
    });
    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error(tokenData.error || "token_exchange_failed");

    const profileResponse = await fetch("https://api.github.com/user", {
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${tokenData.access_token}`, "user-agent": "Guihang-RPG", "x-github-api-version": "2022-11-28" },
    });
    const profile = await profileResponse.json() as GitHubProfile;
    if (!profileResponse.ok || !profile.id || !profile.login) throw new Error("profile_fetch_failed");

    const session = await establishSession(profile);
    const anonymousId = await guestSessions.claim(readCookie(request, GUEST_COOKIE), readCookie(request, "guihang_oauth_guest"), session.user.id);
    if (anonymousId) await adoptAnonymousData(anonymousId, session.user.id);
    const response = NextResponse.redirect(new URL(returnTo, url.origin));
    response.cookies.set(SESSION_COOKIE, session.token, { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/", expires: session.expires });
    response.cookies.delete("guihang_oauth_state");
    response.cookies.delete("guihang_oauth_return");
    response.cookies.delete("guihang_oauth_anonymous");
    response.cookies.delete("guihang_oauth_guest");
    if (anonymousId) response.cookies.delete(GUEST_COOKIE);
    return response;
  } catch (error) {
    console.error("github_oauth_failed", error);
    errorUrl.searchParams.set("error", "github_failed");
    return NextResponse.redirect(errorUrl);
  }
}

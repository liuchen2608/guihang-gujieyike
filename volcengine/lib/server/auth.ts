import { createAuthSession, deleteAuthSession, readAuthUser, upsertGitHubUser } from "@/lib/server/storage";
import { safeLocalPath } from "./protection-core";
import { securityStore } from "./protection";
import { createGuestSessions } from "./guest-sessions";

export const GUEST_COOKIE = "guihang_guest";
export const guestSessions = createGuestSessions(securityStore);

export const SESSION_COOKIE = "guihang_session";

export function readCookie(request: Request, name: string) {
  const source = request.headers.get("cookie") || "";
  for (const part of source.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) { try { return decodeURIComponent(value.join("=")); } catch { return null; } }
  }
  return null;
}

export async function hashToken(token: string) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function safeReturnTo(value: string | null) {
  return safeLocalPath(value);
}

export function validAnonymousId(value: string | null | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export async function currentUser(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  return token && /^[a-f0-9]{64}$/.test(token) ? readAuthUser(await hashToken(token)) : null;
}

export async function ownerIdentity(request: Request) {
  const user = await currentUser(request);
  if (user) return { id: user.id, user };
  const guest = await guestSessions.read(readCookie(request, GUEST_COOKIE));
  return guest ? { id: guest.owner, user: null } : null;
}

export function identityRequired() {
  return Response.json({ error: "试玩会话已失效，请返回开始页面重新连接。旧存档仍保留，请勿清除浏览器数据。", code: "IDENTITY_REQUIRED" }, { status: 401, headers: { "cache-control": "no-store" } });
}

export async function establishSession(profile: { id: number; login: string; name?: string | null; avatar_url?: string | null }) {
  const user = await upsertGitHubUser(profile);
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await createAuthSession(user.id, await hashToken(token), expires.toISOString());
  return { user, token, expires };
}

export async function revokeSession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await deleteAuthSession(await hashToken(token));
}

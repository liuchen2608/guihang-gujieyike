import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { activeInvite, grantUsable, invitationBindingStatements, InviteGrant, INVITE_RATE_SQL, INVITE_REQUIRED, inviteSessionExpiry, normalizeInviteCode, parseInviteDefinitions, REDEEM_INVITE_SQL } from "@/lib/invite-policy";
import { currentUser, hashToken, readCookie } from "@/lib/server/auth";
import { AuthUser, database, ensureSchema } from "@/lib/server/storage";
import { RequestError } from "@/lib/server/request-security";

export const INVITE_COOKIE = "guihang_invite";
type Grant = InviteGrant;
type Access = { grant: Grant; user: AuthUser | null };
const definitions = () => parseInviteDefinitions(env.INVITE_CODES_JSON);
export const invitesConfigured = () => definitions().some((entry) => Date.parse(entry.expiresAt) > Date.now());
export const newInviteToken = () => `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");

export function inviteCookieToken(request: Request) {
  const token = readCookie(request, INVITE_COOKIE);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export function setInviteCookie(response: NextResponse, token: string, request: Request, expires?: string) {
  response.cookies.set(INVITE_COOKIE, token, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: expires ? Math.max(1, Math.floor((Date.parse(expires) - Date.now()) / 1000)) : 1800 });
}

function grantActive(grant: Grant) {
  return Date.parse(grant.expires_at) > Date.now() && Boolean(activeInvite(definitions(), grant.invite_hash));
}

export async function readInviteAccess(request: Request): Promise<Access | null> {
  if (!invitesConfigured()) return null; // Fail closed, including invalid configuration.
  await ensureSchema();
  const user = await currentUser(request);
  if (user) {
    const rows = await database().prepare("SELECT * FROM invite_grants WHERE account_id = ? AND owner_id = ? AND expires_at > ? ORDER BY expires_at DESC").bind(user.id, user.id, new Date().toISOString()).all<Grant>();
    const grant = rows.results.find((entry) => grantUsable(entry, definitions(), user.id));
    if (grant) return { grant, user };
  }
  const token = inviteCookieToken(request);
  if (!token) return null;
  const grant = await database().prepare("SELECT * FROM invite_grants WHERE token_hash = ?").bind(await hashToken(token)).first<Grant>();
  // Bound grants cannot be used anonymously or by a different signed-in account.
  return grant && grantUsable(grant, definitions(), user?.id || null) ? { grant, user } : null;
}

export async function ownerIdentity(request: Request) {
  const access = await readInviteAccess(request);
  return access ? { id: access.grant.owner_id, user: access.user } : null;
}

export function invitationRequired() {
  return NextResponse.json({ error: "请先验证邀请码，再继续这段旅程。", code: INVITE_REQUIRED }, { status: 403, headers: { "cache-control": "no-store" } });
}

export function publicAccess(access: Access | null) {
  return { authorized: Boolean(access), configured: invitesConfigured(), playerId: access && !access.user ? access.grant.owner_id : null, accountLinked: Boolean(access?.user), expiresAt: access?.grant.expires_at || null };
}

async function checkRedemptionRate(request: Request, token: string) {
  const now = Date.now();
  const bucket = Math.floor(now / 600_000);
  const expires = new Date((bucket + 1) * 600_000).toISOString();
  const db = database();
  const sessionKey = await hashToken(`invite-session:${token}:${bucket}`);
  // Cloudflare populates CF-Connecting-IP at the trusted hosting edge. Missing
  // headers share a conservative bucket; never trust X-Forwarded-For here.
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const salt = definitions()[0]?.hash || "unconfigured";
  const ipKey = await hashToken(`invite-ip:${salt}:${ip}:${bucket}`);
  const results = await db.batch([
    db.prepare(INVITE_RATE_SQL).bind(sessionKey, expires, 5),
    db.prepare(INVITE_RATE_SQL).bind(ipKey, expires, 30),
    db.prepare("DELETE FROM invite_attempts WHERE expires_at <= ?").bind(new Date(now).toISOString()),
  ]);
  if (!results[0].results.length || !results[1].results.length) throw new RequestError("尝试次数较多，请在 10 分钟后重试。", 429);
}

export async function redeemInvitation(request: Request, input: Record<string, unknown>) {
  const existing = await readInviteAccess(request);
  if (existing) return { access: existing, token: null }; // Retry after a lost response consumes nothing.
  if (!invitesConfigured()) throw new RequestError("试玩通行码暂未开放，请联系邀请人。", 503);
  const token = inviteCookieToken(request);
  if (!token) throw new RequestError("浏览器未保存验证凭证，请允许 Cookie 后重新打开验证窗口。", 400);
  await ensureSchema();
  await checkRedemptionRate(request, token);
  const code = normalizeInviteCode(input.code);
  const invite = code && activeInvite(definitions(), await hashToken(code));
  if (!invite) throw new RequestError("邀请码无效、已到期或已被使用，请核对后重试。");
  const user = await currentUser(request);
  // A legacy browser UUID is not proof of ownership. Never adopt it on redemption.
  // Existing grants still work; pre-grant data is retained for verified recovery.
  const ownerId = user?.id || crypto.randomUUID();
  const now = new Date().toISOString();
  // The preflight cookie survives a lost redemption response, making retries safe.
  // Account renewals can recover through the verified account if the cookie changes.
  const oldToken = await database().prepare("SELECT token_hash FROM invite_grants WHERE token_hash = ?").bind(await hashToken(token)).first();
  const sessionToken = oldToken && user ? newInviteToken() : token;
  const expiresAt = inviteSessionExpiry(invite);
  const tokenHash = await hashToken(sessionToken);
  const result = await database().prepare(REDEEM_INVITE_SQL).bind(tokenHash, invite.hash, ownerId, user?.id || null, now, expiresAt, invite.hash, invite.maxUses, user?.id || null, ownerId, user?.id || null, ownerId).run();
  if (!result.meta.changes) {
    const retry = await readInviteAccess(request);
    if (retry) return { access: retry, token: null };
    throw new RequestError("邀请码已使用，或原匿名身份已绑定其他凭证。请在原浏览器续玩，或联系邀请人。", 409);
  }
  return { access: { grant: { token_hash: tokenHash, invite_hash: invite.hash, owner_id: ownerId, account_id: user?.id || null, expires_at: expiresAt }, user }, token: sessionToken };
}

// Only a verified guest grant, tied to the OAuth initiation, may be adopted.
export async function bindInvitationToAccount(request: Request, userId: string, expectedTokenHash: string | null) {
  const token = inviteCookieToken(request);
  if (!token || !expectedTokenHash || await hashToken(token) !== expectedTokenHash) return;
  await ensureSchema();
  const grant = await database().prepare("SELECT * FROM invite_grants WHERE token_hash = ? AND account_id IS NULL").bind(expectedTokenHash).first<Grant>();
  if (!grant || !grantActive(grant)) return;
  await database().batch(invitationBindingStatements(grant.owner_id, expectedTokenHash, userId).map(({ sql, values }) => database().prepare(sql).bind(...values)));
}

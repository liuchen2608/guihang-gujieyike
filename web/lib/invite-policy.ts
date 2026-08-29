export type InviteDefinition = { hash: string; maxUses: number; expiresAt: string };

export function normalizeInviteCode(value: unknown) {
  if (typeof value !== "string" || value.length > 100) return null;
  const code = value.toUpperCase().replace(/[\s-]/g, "");
  return /^GH[0-9A-F]{24}$/.test(code) ? code : null;
}

export function parseInviteDefinitions(raw?: string): InviteDefinition[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || data.length > 500) return [];
    const result: InviteDefinition[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object" || typeof item.hash !== "string" || !/^[a-f0-9]{64}$/.test(item.hash)
        || !Number.isInteger(item.maxUses) || item.maxUses < 1 || item.maxUses > 100
        || typeof item.expiresAt !== "string" || !Number.isFinite(Date.parse(item.expiresAt))) return [];
      if (result.some((entry) => entry.hash === item.hash)) return [];
      result.push({ hash: item.hash, maxUses: item.maxUses, expiresAt: new Date(item.expiresAt).toISOString() });
    }
    return result;
  } catch { return []; }
}

export function activeInvite(definitions: InviteDefinition[], hash: string, now = Date.now()) {
  return definitions.find((entry) => entry.hash === hash && Date.parse(entry.expiresAt) > now);
}

export function inviteSessionExpiry(invite: InviteDefinition, now = Date.now()) {
  return new Date(Math.min(now + 30 * 86400_000, Date.parse(invite.expiresAt))).toISOString();
}

export type InviteGrant = { token_hash: string; invite_hash: string; owner_id: string; account_id: string | null; expires_at: string };
export function grantUsable(grant: InviteGrant, definitions: InviteDefinition[], accountId: string | null, now = Date.now()) {
  if (!(Date.parse(grant.expires_at) > now) || !activeInvite(definitions, grant.invite_hash, now)) return false;
  return grant.account_id ? grant.account_id === accountId && grant.owner_id === accountId : accountId === null;
}

export function invitationBindingStatements(ownerId: string, tokenHash: string, userId: string) {
  const condition = "EXISTS (SELECT 1 FROM invite_grants WHERE token_hash = ? AND account_id IS NULL AND owner_id = ?) AND NOT EXISTS (SELECT 1 FROM users WHERE id = ?)";
  return [
    { sql: `UPDATE game_saves SET player_id = ? WHERE player_id = ? AND ${condition}`, values: [userId, ownerId, tokenHash, ownerId, ownerId] },
    { sql: `UPDATE feedback SET player_id = ? WHERE player_id = ? AND ${condition}`, values: [userId, ownerId, tokenHash, ownerId, ownerId] },
    { sql: "UPDATE invite_grants SET account_id = ?, owner_id = ? WHERE token_hash = ? AND account_id IS NULL AND owner_id = ? AND NOT EXISTS (SELECT 1 FROM users WHERE id = ?)", values: [userId, userId, tokenHash, ownerId, ownerId] },
  ];
}

export const INVITE_REQUIRED = "INVITE_REQUIRED";
export const INVITE_EVENT = "guihang:invite-required";

// One INSERT holds the usagelimit check and ownership claim inside SQLite's write lock.
export const REDEEM_INVITE_SQL = `INSERT INTO invite_grants
  (token_hash, invite_hash, owner_id, account_id, created_at, expires_at)
  SELECT ?, ?, ?, ?, ?, ?
  WHERE (SELECT COUNT(*) FROM invite_grants WHERE invite_hash = ?) < ?
    AND (? IS NOT NULL OR NOT EXISTS (SELECT 1 FROM invite_grants WHERE owner_id = ?))
    AND (? IS NOT NULL OR NOT EXISTS (SELECT 1 FROM users WHERE id = ?))
  ON CONFLICT DO NOTHING`;

export const INVITE_RATE_SQL = `INSERT INTO invite_attempts (bucket_key, attempts, expires_at) VALUES (?, 1, ?)
  ON CONFLICT(bucket_key) DO UPDATE SET attempts = attempts + 1 WHERE attempts < ?
  RETURNING attempts`;

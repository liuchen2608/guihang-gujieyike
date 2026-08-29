import { env } from "cloudflare:workers";
import { GameMessage, GameState, SaveView, initialMessages, newGameState, normalizeGameState } from "@/lib/game";
import { sanitizeNpcReply } from "@/lib/server/npc-reply";
import { turnWriteStatements } from "@/lib/server/turn-write";

let schemaReady: Promise<void> | undefined;

export function database() {
  if (!env.DB) throw new Error("D1 数据库暂不可用");
  return env.DB;
}

export async function ensureSchema() {
  if (!schemaReady) {
    const db = database();
    schemaReady = db.batch([
      db.prepare("CREATE TABLE IF NOT EXISTS game_saves (id TEXT PRIMARY KEY, player_id TEXT NOT NULL, codename TEXT NOT NULL, version INTEGER NOT NULL, state_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, ended_at TEXT)"),
      db.prepare("CREATE TABLE IF NOT EXISTS game_messages (id TEXT PRIMARY KEY, save_id TEXT NOT NULL, kind TEXT NOT NULL, label TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL)"),
      db.prepare("CREATE INDEX IF NOT EXISTS game_messages_save_id_idx ON game_messages(save_id)"),
      db.prepare("CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, save_id TEXT, player_id TEXT NOT NULL, understood_goal INTEGER NOT NULL, trusted_guihang INTEGER NOT NULL, continue_chapter_two INTEGER NOT NULL, rating REAL NOT NULL, detail TEXT NOT NULL, contact TEXT, created_at TEXT NOT NULL)"),
      db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS feedback_player_save_idx ON feedback(player_id, save_id)"),
      db.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, github_id TEXT NOT NULL UNIQUE, github_login TEXT NOT NULL, display_name TEXT, avatar_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
      db.prepare("CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_game_saves_player_updated ON game_saves(player_id, updated_at DESC)"),
      db.prepare("CREATE TABLE IF NOT EXISTS security_records (key TEXT PRIMARY KEY, revision INTEGER NOT NULL, value_json TEXT NOT NULL)"),
      db.prepare("CREATE TABLE IF NOT EXISTS invite_grants (token_hash TEXT PRIMARY KEY, invite_hash TEXT NOT NULL, owner_id TEXT NOT NULL, account_id TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)"),
      db.prepare("CREATE INDEX IF NOT EXISTS invite_grants_owner_idx ON invite_grants(owner_id)"),
      db.prepare("CREATE INDEX IF NOT EXISTS invite_grants_code_idx ON invite_grants(invite_hash)"),
      db.prepare("CREATE INDEX IF NOT EXISTS invite_grants_account_idx ON invite_grants(account_id)"),
      db.prepare("CREATE TABLE IF NOT EXISTS invite_attempts (bucket_key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at TEXT NOT NULL)"),
      db.prepare("CREATE INDEX IF NOT EXISTS invite_attempts_expiry_idx ON invite_attempts(expires_at)"),
    ]).then(() => undefined).catch((error) => { schemaReady = undefined; throw error; });
  }
  return schemaReady;
}

type SaveRow = { id: string; player_id: string; state_json: string; updated_at: string };
type MessageRow = { id: string; kind: GameMessage["kind"]; label: string; body: string };

export async function createSave(playerId: string, codename: string, homeAnchor?: string): Promise<SaveView> {
  await ensureSchema();
  const db = database();
  const saveId = crypto.randomUUID();
  const now = new Date().toISOString();
  const state = newGameState(saveId, codename.trim().slice(0, 20), homeAnchor);
  await db.batch([
    db.prepare("INSERT INTO game_saves (id, player_id, codename, version, state_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(saveId, playerId, state.codename, state.version, JSON.stringify(state), now, now),
    ...initialMessages.map((message) => db.prepare("INSERT INTO game_messages (id, save_id, kind, label, body, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(message.id + saveId, saveId, message.kind, message.label, message.text, now)),
  ]);
  return { state, messages: initialMessages, updatedAt: now };
}

export async function readSave(saveId: string, playerId: string): Promise<SaveView | null> {
  await ensureSchema();
  const db = database();
  const row = await db.prepare("SELECT id, player_id, state_json, updated_at FROM game_saves WHERE id = ? AND player_id = ?").bind(saveId, playerId).first<SaveRow>();
  if (!row) return null;
  const result = await db.prepare("SELECT id, kind, label, body FROM game_messages WHERE save_id = ? ORDER BY created_at ASC, rowid ASC").bind(saveId).all<MessageRow>();
  return {
    state: normalizeGameState(JSON.parse(row.state_json) as GameState),
    messages: result.results.map((message) => ({
      id: message.id,
      kind: message.kind,
      label: message.label,
      text: message.kind === "npc" || message.kind === "guihang" ? sanitizeNpcReply(message.body) : message.body,
    })),
    updatedAt: row.updated_at,
  };
}

export async function readLatestSave(playerId: string): Promise<SaveView | null> {
  await ensureSchema();
  const row = await database().prepare("SELECT id FROM game_saves WHERE player_id = ? ORDER BY updated_at DESC LIMIT 1").bind(playerId).first<{ id: string }>();
  return row ? readSave(row.id, playerId) : null;
}

export async function saveTurn(saveId: string, playerId: string, expectedVersion: number, playerMessage: GameMessage, responseMessages: GameMessage[], nextState: GameState) {
  await ensureSchema();
  const db = database();
  const current = await db.prepare("SELECT version FROM game_saves WHERE id = ? AND player_id = ?").bind(saveId, playerId).first<{ version: number }>();
  if (!current) return "not_found" as const;
  if (current.version !== expectedVersion) return "conflict" as const;
  const now = new Date().toISOString();
  const results = await db.batch(turnWriteStatements(saveId, playerId, expectedVersion, [playerMessage, ...responseMessages], nextState, now).map(({ sql, values }) => db.prepare(sql).bind(...values)));
  return results.at(-1)?.meta.changes === 1 ? "ok" as const : "conflict" as const;
}

export async function submitFeedback(input: { saveId?: string; playerId: string; understoodGoal: boolean; trustedGuihang: boolean; continueChapterTwo: boolean; rating: number; detail: string; contact?: string }) {
  await ensureSchema();
  const db = database();
  await db.prepare("INSERT INTO feedback (id, save_id, player_id, understood_goal, trusted_guihang, continue_chapter_two, rating, detail, contact, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), input.saveId || null, input.playerId, input.understoodGoal ? 1 : 0, input.trustedGuihang ? 1 : 0, input.continueChapterTwo ? 1 : 0, input.rating, input.detail.slice(0, 2000), input.contact?.slice(0, 100) || null, new Date().toISOString()).run();
}

export type AuthUser = { id: string; githubId: string; login: string; name: string | null; avatarUrl: string | null };

export async function upsertGitHubUser(profile: { id: number; login: string; name?: string | null; avatar_url?: string | null }): Promise<AuthUser> {
  await ensureSchema();
  const db = database();
  const now = new Date().toISOString();
  const githubId = String(profile.id);
  const existing = await db.prepare("SELECT id FROM users WHERE github_id = ?").bind(githubId).first<{ id: string }>();
  const id = existing?.id || crypto.randomUUID();
  await db.prepare("INSERT INTO users (id, github_id, github_login, display_name, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(github_id) DO UPDATE SET github_login = excluded.github_login, display_name = excluded.display_name, avatar_url = excluded.avatar_url, updated_at = excluded.updated_at")
    .bind(id, githubId, profile.login, profile.name || null, profile.avatar_url || null, now, now).run();
  return { id, githubId, login: profile.login, name: profile.name || null, avatarUrl: profile.avatar_url || null };
}

export async function createAuthSession(userId: string, tokenHash: string, expiresAt: string) {
  await ensureSchema();
  const db = database();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").bind(now),
    db.prepare("INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(tokenHash, userId, expiresAt, now),
  ]);
}

export async function readAuthUser(tokenHash: string): Promise<AuthUser | null> {
  await ensureSchema();
  const row = await database().prepare("SELECT users.id, users.github_id, users.github_login, users.display_name, users.avatar_url FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?")
    .bind(tokenHash, new Date().toISOString()).first<{ id: string; github_id: string; github_login: string; display_name: string | null; avatar_url: string | null }>();
  return row ? { id: row.id, githubId: row.github_id, login: row.github_login, name: row.display_name, avatarUrl: row.avatar_url } : null;
}

export async function deleteAuthSession(tokenHash: string) {
  await ensureSchema();
  await database().prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(tokenHash).run();
}

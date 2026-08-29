import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { activeInvite, grantUsable, invitationBindingStatements, INVITE_RATE_SQL, inviteSessionExpiry, normalizeInviteCode, parseInviteDefinitions, REDEEM_INVITE_SQL } from "../lib/invite-policy.ts";
import { readSmallJson, RequestError, requireSameOrigin } from "../lib/server/request-security.ts";

const hash = "a".repeat(64);
const definition = { hash, maxUses: 1, expiresAt: "2030-01-01T00:00:00.000Z" };
test("invite code normalization only accepts complete, high-entropy codes", () => {
  assert.equal(normalizeInviteCode(" gh-abcd-1234-abcd-1234-abcd-1234 \n"), "GHABCD1234ABCD1234ABCD1234");
  for (const code of [null, {}, "admin", "GH-1234", "GH" + "1".repeat(25), "GH" + "Z".repeat(24)]) assert.equal(normalizeInviteCode(code), null);
});
test("missing, malformed, duplicate, expired invite configuration fails closed", () => {
  for (const raw of [undefined, "invalid", "{}", JSON.stringify([{ ...definition, maxUses: 0 }]), JSON.stringify([definition, definition])]) assert.deepEqual(parseInviteDefinitions(raw), []);
  assert.equal(activeInvite([definition], hash, Date.parse("2031-01-01")), undefined);
  assert.equal(activeInvite([definition], "b".repeat(64)), undefined);
  const now = Date.parse("2029-12-25");
  assert.equal(inviteSessionExpiry(definition, now), definition.expiresAt);
  assert.equal(inviteSessionExpiry(definition, Date.parse("2029-01-01")), "2029-01-31T00:00:00.000Z");
});

test("atomic redemption enforces capacity, retries and legacy ownership isolation", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE invite_grants (token_hash TEXT PRIMARY KEY, invite_hash TEXT, owner_id TEXT, account_id TEXT, created_at TEXT, expires_at TEXT)");
    db.exec("CREATE TABLE users (id TEXT PRIMARY KEY)");
    db.prepare("INSERT INTO users VALUES (?)").run("github-owner");
    const redeem = (token: string, owner: string, invite = hash, account: string | null = null) => db.prepare(REDEEM_INVITE_SQL).run(token, invite, owner, account, "now", "later", invite, 1, account, owner, account, owner).changes;
    assert.equal(redeem("forged", "github-owner"), 0, "anonymous client cannot claim registered user IDs");
    assert.equal(redeem("first", "guest"), 1);
    assert.equal(redeem("first", "guest"), 0, "duplicate token cannot consume again");
    assert.equal(redeem("second", "other-guest"), 0, "second browser cannot redeem used code");
    assert.equal(redeem("third", "guest", "other-invite"), 0, "a different cookie cannot re-claim migrated guest ID");
    assert.equal(redeem("account", "github-owner", "other-invite", "github-owner"), 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM invite_grants").get()?.total, 2);
  } finally { db.close(); }
});
test("redemption rate limit is persistent and cannot exceed its atomic counter", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE invite_attempts (bucket_key TEXT PRIMARY KEY, attempts INTEGER, expires_at TEXT)");
    const statement = db.prepare(INVITE_RATE_SQL);
    for (let i = 1; i <= 5; i++) assert.equal(statement.get("bucket", "later", 5)?.attempts, i);
    assert.equal(statement.get("bucket", "later", 5), undefined);
    assert.equal(statement.get("next-bucket", "later", 5)?.attempts, 1);
  } finally { db.close(); }
});
test("expired/revoked grants and uninvited GitHub identities cannot bypass the gate", () => {
  const grant = { token_hash: "token", invite_hash: hash, owner_id: "guest", account_id: null, expires_at: definition.expiresAt };
  const now = Date.parse("2029-01-01");
  assert.equal(grantUsable(grant, [definition], null, now), true);
  assert.equal(grantUsable(grant, [], null, now), false);
  assert.equal(grantUsable(grant, [definition], "uninvited-account", now), false);
  assert.equal(grantUsable(grant, [definition], null, Date.parse("2031-01-01")), false);
  assert.equal(grantUsable({ ...grant, expires_at: "invalid" }, [definition], null, now), false);
  const bound = { ...grant, owner_id: "account", account_id: "account" };
  assert.equal(grantUsable(bound, [definition], null, now), false, "logout closes bound grant");
  assert.equal(grantUsable(bound, [definition], "other-account", now), false);
  assert.equal(grantUsable(bound, [definition], "account", now), true);
});
test("OAuth adoption requires the matching verified guest grant and cannot steal account saves", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE invite_grants (token_hash TEXT PRIMARY KEY, owner_id TEXT, account_id TEXT); CREATE TABLE users (id TEXT PRIMARY KEY); CREATE TABLE game_saves (id TEXT PRIMARY KEY, player_id TEXT); CREATE TABLE feedback (id TEXT PRIMARY KEY, player_id TEXT)");
    db.exec("INSERT INTO users VALUES ('account'); INSERT INTO users VALUES ('other-account'); INSERT INTO invite_grants VALUES ('token','guest',NULL); INSERT INTO game_saves VALUES ('save','guest'); INSERT INTO game_saves VALUES ('other-save','other-account')");
    const bind = (owner: string, token: string) => {
      db.exec("BEGIN");
      for (const { sql, values } of invitationBindingStatements(owner, token, "account")) db.prepare(sql).run(...values);
      db.exec("COMMIT");
    };
    bind("guest", "wrong-token");
    assert.equal(db.prepare("SELECT player_id FROM game_saves WHERE id='save'").get()?.player_id, "guest");
    bind("other-account", "token");
    assert.equal(db.prepare("SELECT player_id FROM game_saves WHERE id='other-save'").get()?.player_id, "other-account");
    bind("guest", "token");
    assert.equal(db.prepare("SELECT player_id FROM game_saves WHERE id='save'").get()?.player_id, "account");
    assert.equal(db.prepare("SELECT account_id FROM invite_grants WHERE token_hash='token'").get()?.account_id, "account");
    bind("guest", "token");
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM game_saves").get()?.total, 2);
  } finally { db.close(); }
});
test("mutations require same-origin JSON with a bounded body", async () => {
  const url = "https://game.example/api/access/redeem";
  const make = (body: string, origin = "https://game.example", type = "application/json") => new Request(url, { method: "POST", headers: { origin, "content-type": type }, body });
  requireSameOrigin(make("{}"));
  assert.throws(() => requireSameOrigin(make("{}", "https://other.example")), RequestError);
  assert.throws(() => requireSameOrigin(make("{}", "")), RequestError);
  assert.deepEqual(await readSmallJson(make('{"code":"value"}')), { code: "value" });
  await assert.rejects(readSmallJson(make("{}", "https://game.example", "text/plain")), { status: 415 });
  await assert.rejects(readSmallJson(make("[1]")), { status: 400 });
  await assert.rejects(readSmallJson(make("{")), { status: 400 });
  await assert.rejects(readSmallJson(make(JSON.stringify({ code: "x".repeat(5000) }))), { status: 413 });
});

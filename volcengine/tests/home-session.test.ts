import assert from "node:assert/strict";
import test from "node:test";
import { githubLoginHref, HOME_PLAYER_KEY, HOME_SAVE_KEY, loadHomeSession } from "../lib/home-session.ts";

function memoryStorage(initial: Record<string, string>) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
    removeItem(key: string) { values.delete(key); },
  };
}

test("an anonymous stale save is hidden when the server no longer has it", async () => {
  const storage = memoryStorage({
    [HOME_PLAYER_KEY]: "11111111-1111-4111-8111-111111111111",
    [HOME_SAVE_KEY]: "stale-save-id",
  });
  const requested: string[] = [];
  const session = await loadHomeSession(storage, async (input) => {
    requested.push(input);
    if (input === "/api/auth/me") return Response.json({ error: "未登录" }, { status: 401 });
    if (input.includes("/api/saves?playerId=")) return Response.json({ save: null });
    throw new Error(`unexpected request: ${input}`);
  });

  assert.equal(session.saveId, null);
  assert.equal(storage.getItem(HOME_SAVE_KEY), null);
  assert.deepEqual(requested, [
    "/api/auth/me",
    "/api/saves?playerId=11111111-1111-4111-8111-111111111111",
  ]);
});

test("a server-validated anonymous save replaces a stale local id", async () => {
  const playerId = "11111111-1111-4111-8111-111111111111";
  const storage = memoryStorage({ [HOME_PLAYER_KEY]: playerId, [HOME_SAVE_KEY]: "old-save" });
  const session = await loadHomeSession(storage, async (input) => {
    if (input === "/api/auth/me") return Response.json({ error: "未登录" }, { status: 401 });
    return Response.json({ save: { state: { saveId: "verified-save" } } });
  });

  assert.equal(session.saveId, "verified-save");
  assert.equal(storage.getItem(HOME_SAVE_KEY), "verified-save");
});

test("GitHub login keeps returnTo and anonymousId as separate query parameters", () => {
  assert.equal(
    githubLoginHref("11111111-1111-4111-8111-111111111111"),
    "/api/auth/github/start?returnTo=%2F&anonymousId=11111111-1111-4111-8111-111111111111",
  );
});

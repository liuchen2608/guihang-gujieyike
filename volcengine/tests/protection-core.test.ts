import test from "node:test";
import assert from "node:assert/strict";
import { createProtection, modelEnabled, limitValue, safeLocalPath, type SecurityStore } from "../lib/server/protection-core.ts";

class MemoryStore implements SecurityStore {
  rows = new Map<string, {value: unknown; etag: string}>();
  revision = 0;
  async get<T>(key: string) { return structuredClone(this.rows.get(key) as {value: T; etag: string} | undefined) ?? null; }
  async put<T>(key: string, value: T, expected: string | null) {
    if ((this.rows.get(key)?.etag ?? null) !== expected) return false;
    this.rows.set(key, {value: structuredClone(value), etag: String(++this.revision)}); return true;
  }
}
test("rate limits are atomic, per-owner, persistent and recover after a window", async () => {
  const store = new MemoryStore(); let now = 1000;
  const p = createProtection(store, () => now);
  const results = await Promise.allSettled(Array.from({length: 12}, () => p.consume("owner-a", 3, 60000)));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 3);
  await assert.rejects(createProtection(store, () => now).consume("owner-a", 3, 60000));
  await p.consume("owner-b", 3, 60000);
  now = 60000; await p.consume("owner-a", 3, 60000);
});
test("concurrent requests for a save version invoke work once, including after restart", async () => {
  const store = new MemoryStore(); const p = createProtection(store); let calls = 0;
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  let entered!: () => void; const started = new Promise<void>(resolve => { entered = resolve; });
  const first = p.runTurn("a", "save-a", 1, async guard => { calls++; entered(); await held; await guard(); return "committed"; });
  await started;
  const others = await Promise.allSettled(Array.from({length: 10}, () => createProtection(store).runTurn("a", "save-a", 1, async () => { calls++; })));
  assert.ok(others.every(result => result.status === "rejected"));
  await assert.rejects(p.runTurn("a", "another-save", 1, async () => { calls++; }));
  release(); assert.equal(await first, "committed"); assert.equal(calls, 1);
  await assert.rejects(createProtection(store).runTurn("a", "save-a", 1, async () => { calls++; }));
  await p.runTurn("a", "save-a", 2, async () => { calls++; });
  assert.equal(calls, 2);
});
test("uncertain provider/storage failures are never blindly retried at the same version", async () => {
  const store = new MemoryStore(); let now = 0, calls = 0; const p = createProtection(store, () => now);
  await assert.rejects(p.runTurn("a", "s", 1, async () => { calls++; throw new Error("lost response"); }));
  now = 600000;
  await assert.rejects(createProtection(store, () => now).runTurn("a", "s", 1, async () => { calls++; }));
  assert.equal(calls, 1);
  await p.runTurn("b", "different-save", 1, async () => "ok");
});
test("expired leases cannot commit, while their turn marker survives", async () => {
  const store = new MemoryStore(); let now = 0; const p = createProtection(store, () => now);
  await assert.rejects(p.runTurn("a", "s", 1, async guard => { now = 300001; await guard(); }));
  await assert.rejects(p.runTurn("a", "s", 1, async () => "no"));
});
test("global daily/monthly limits survive fresh instances and malformed config fails closed", async () => {
  const store = new MemoryStore(); let now = Date.parse("2026-08-28T12:00:00Z");
  const p = createProtection(store, () => now);
  const results = await Promise.all(Array.from({length: 8}, () => p.reserveGlobal(2, 3)));
  assert.equal(results.filter(Boolean).length, 2);
  assert.equal(await createProtection(store, () => now).reserveGlobal(2, 3), false);
  now += 86400000; assert.equal(await p.reserveGlobal(2, 3), true);
  assert.equal(await p.reserveGlobal(2, 3), false);
  assert.equal(await p.reserveGlobal(NaN, 3), false);
  assert.equal(limitValue("oops", 50), 0); assert.equal(limitValue("", 50), 0);
  assert.equal(limitValue(undefined, 50), 50);
  assert.equal(modelEnabled("false"), false); assert.equal(modelEnabled("oops"), false);
  assert.equal(modelEnabled("true"), true);
});
test("storage failure blocks work instead of reverting to a local counter", async () => {
  const store: SecurityStore = { get: async () => { throw new Error("offline"); }, put: async () => false };
  let calls = 0;
  await assert.rejects(createProtection(store).runTurn("a", "s", 1, async () => { calls++; }));
  await assert.rejects(createProtection(store).consume("a", 3, 60000));
  assert.equal(calls, 0);
});
test("return paths stay local even with encoded separators and controls", () => {
  for (const value of ["//outside.test", "/\\outside.test", "/%5coutside.test", "/%2foutside.test", "/%0a/outside.test", "https://outside.test", "/%"]) assert.equal(safeLocalPath(value), "/");
  assert.equal(safeLocalPath("/game/abc?mode=talk"), "/game/abc?mode=talk");
});


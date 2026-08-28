import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../lib/server/storage-core.ts';
import type { Document, JsonStore } from '../lib/server/json-store.ts';
import type { GameMessage } from '../lib/game.ts';

class MemoryStore implements JsonStore {
  docs = new Map<string, Document<unknown>>();
  revision = 0;
  fail = false;
  async get<T>(key: string) { return structuredClone(this.docs.get(key) as Document<T> | undefined) ?? null; }
  async put<T>(key: string, value: T, etag: string | null) {
    if (this.fail) throw new Error('network failure');
    if ((this.docs.get(key)?.etag ?? null) !== etag) return false;
    this.docs.set(key, { value: structuredClone(value), etag: String(++this.revision) });
    return true;
  }
  async remove(key: string) { this.docs.delete(key); }
}
const message = (id: string): GameMessage => ({ id, kind: 'player', label: '执行行动', text: '查看四周' });

test('a fresh storage instance can load persisted saves, but other players cannot', async () => {
  const store = new MemoryStore();
  const a = createStorage(store);
  const save = await a.createSave('guest-a', '冒险者');
  const b = createStorage(store);
  assert.equal((await b.readSave(save.state.saveId, 'guest-a'))?.state.codename, '冒险者');
  assert.equal(await b.readSave(save.state.saveId, 'guest-b'), null);
  assert.equal((await b.readLatestSave('guest-a'))?.state.saveId, save.state.saveId);
});

test('two concurrent turns settle once and never append the losing messages', async () => {
  const store = new MemoryStore(); const storage = createStorage(store);
  const save = await storage.createSave('a', 'a');
  const next = { ...save.state, version: save.state.version + 1, hp: 4 };
  const results = await Promise.all(['one', 'two'].map(id => storage.saveTurn(save.state.saveId, 'a', save.state.version, message(id), [], next)));
  assert.deepEqual(results.sort(), ['conflict', 'ok']);
  const loaded = await storage.readSave(save.state.saveId, 'a');
  assert.equal(loaded?.state.version, next.version);
  assert.equal(loaded?.messages.length, save.messages.length + 1);
});

test('concurrent new saves merge rather than overwrite each other', async () => {
  const store = new MemoryStore(); const storage = createStorage(store);
  const saves = await Promise.all(['a', 'b', 'c'].map(name => storage.createSave('player', name)));
  for (const save of saves) assert.ok(await storage.readSave(save.state.saveId, 'player'));
});

test('failed writes leave both state and messages unchanged', async () => {
  const store = new MemoryStore(); const storage = createStorage(store);
  const save = await storage.createSave('a', 'a');
  store.fail = true;
  await assert.rejects(storage.saveTurn(save.state.saveId, 'a', save.state.version, message('bad'), [], { ...save.state, version: save.state.version + 1 }));
  const loaded = await storage.readSave(save.state.saveId, 'a');
  assert.equal(loaded?.state.version, save.state.version);
  assert.equal(loaded?.messages.length, save.messages.length);
});

test('adoption is idempotent, revokes guest access, and preserves account-owned saves', async () => {
  const storage = createStorage(new MemoryStore());
  const guest = await storage.createSave('guest', 'g');
  const own = await storage.createSave('account', 'u');
  await storage.adoptAnonymousData('guest', 'account');
  await storage.adoptAnonymousData('guest', 'account');
  assert.equal(await storage.readSave(guest.state.saveId, 'guest'), null);
  assert.ok(await storage.readSave(guest.state.saveId, 'account'));
  assert.ok(await storage.readSave(own.state.saveId, 'account'));
  await assert.rejects(storage.adoptAnonymousData('guest', 'attacker'));
  assert.equal(await storage.saveTurn(guest.state.saveId, 'guest', guest.state.version, message('bad'), [], { ...guest.state, version: guest.state.version + 1 }), 'not_found');
});

test('sessions expire and logout invalidates them', async () => {
  const storage = createStorage(new MemoryStore());
  const user = await storage.upsertGitHubUser({ id: 123, login: 'pilot' });
  await storage.createAuthSession(user.id, 'valid', new Date(Date.now() + 60000).toISOString());
  assert.equal((await storage.readAuthUser('valid'))?.login, 'pilot');
  await storage.deleteAuthSession('valid');
  assert.equal(await storage.readAuthUser('valid'), null);
  await storage.createAuthSession(user.id, 'expired', '2020-01-01T00:00:00Z');
  assert.equal(await storage.readAuthUser('expired'), null);
});

test('monthly/day AI quotas are atomic and survive service restarts', async () => {
  const store = new MemoryStore(); const storage = createStorage(store);
  const today = new Date('2026-08-27T12:00:00Z');
  const results = await Promise.all([1, 2, 3, 4].map(() => storage.reserveModelCall(3, 2, today)));
  assert.equal(results.filter(Boolean).length, 2);
  const fresh = createStorage(store);
  assert.equal(await fresh.reserveModelCall(3, 2, today), false);
  assert.equal(await fresh.reserveModelCall(3, 2, new Date('2026-08-28T12:00:00Z')), true);
  assert.equal(await fresh.reserveModelCall(3, 2, new Date('2026-08-29T12:00:00Z')), false);
  assert.equal(await fresh.reserveModelCall(3, 2, new Date('2026-09-01T12:00:00Z')), true);
  assert.equal(await fresh.reserveModelCall(0, 2, today), false);
  await assert.rejects(fresh.reserveModelCall(NaN, 2, today));
});

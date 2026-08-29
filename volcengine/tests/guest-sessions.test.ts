import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuestSessions } from '../lib/server/guest-sessions.ts';
import { digest, type SecurityStore } from '../lib/server/protection-core.ts';

function memory(): SecurityStore {
  const rows = new Map<string, {value: unknown; etag: string}>(); let n = 0;
  return {
    async get<T>(key: string) { return structuredClone(rows.get(key) as {value: T; etag: string} | undefined) ?? null; },
    async put(key, value, expected) {
      if ((rows.get(key)?.etag ?? null) !== expected) return false;
      rows.set(key, {value: structuredClone(value), etag: String(++n)}); return true;
    },
  };
}
test('guest sessions cannot be fabricated from player identifiers; expiration is server-side', async () => {
  const store = memory(); let now = 1000; const sessions = createGuestSessions(store, () => now);
  const a = await sessions.create(), b = await sessions.create();
  assert.notEqual(a.guest.owner, b.guest.owner);
  assert.equal(await sessions.read(a.guest.owner), null);
  assert.equal(await sessions.read('a'.repeat(64)), null);
  assert.equal((await createGuestSessions(store, () => now).read(a.token))?.owner, a.guest.owner);
  now = a.guest.expires; assert.equal(await sessions.read(a.token), null);
});
test('OAuth adoption requires the original cookie and cannot be claimed by a second account', async () => {
  const sessions = createGuestSessions(memory()); const a = await sessions.create(), b = await sessions.create();
  assert.equal(await sessions.claim(a.token, await digest(b.token), '1'), null);
  assert.equal(await sessions.claim(a.token, await digest(a.token), '1'), a.guest.owner);
  assert.equal(await sessions.read(a.token), null);
  assert.equal(await sessions.claim(a.token, await digest(a.token), '2'), null);
  assert.equal(await sessions.claim(a.token, await digest(a.token), '1'), a.guest.owner);
});

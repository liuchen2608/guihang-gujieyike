import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { TosClient } from '@volcengine/tos-sdk';
import { createTosStore } from '../lib/server/tos-store.ts';

test('real SDK adapter preserves CAS headers, rejects versioning and hides signed errors', async t => {
  const docs = new Map<string, { body: string; etag: string }>();
  let versioning = false;
  let unavailable = false;
  const server = createServer(async (req, res) => {
    res.setHeader('x-tos-request-id', 'synthetic-test-request');
    if (unavailable) {
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ Code: 'AccessDenied', Message: 'secret-should-never-escape' })); return;
    }
    if (req.url?.includes('versioning')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(versioning ? { Status: 'Enabled' } : {})); return;
    }
    const key = req.url!;
    const existing = docs.get(key);
    if (req.method === 'PUT') {
      const chunks: Buffer[] = [];
      for await (const part of req) chunks.push(Buffer.from(part));
      if ((req.headers['x-tos-forbid-overwrite'] === 'true' && existing) || (req.headers['if-match'] && existing?.etag !== req.headers['if-match'])) {
        res.writeHead(412, { 'content-type': 'application/json' }); res.end(JSON.stringify({ Code: 'PreconditionFailed' })); return;
      }
      const body = Buffer.concat(chunks).toString();
      const etag = `"${createHash('md5').update(body).digest('hex')}"`;
      docs.set(key, { body, etag }); res.writeHead(200, { etag }); res.end(); return;
    }
    if (req.method === 'DELETE') { docs.delete(key); res.writeHead(204); res.end(); return; }
    if (!existing) { res.writeHead(404, { 'content-type': 'application/json' }); res.end(JSON.stringify({ Code: 'NoSuchKey' })); return; }
    res.writeHead(200, { etag: existing.etag, 'content-type': 'application/json' }); res.end(existing.body);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const client = new TosClient({ accessKeyId: 'test', accessKeySecret: 'test', region: 'cn-beijing',
    endpoint: `127.0.0.1:${address.port}`, secure: false, isCustomDomain: true, maxRetryCount: 0, enableCRC: false });
  const store = createTosStore(client, 'test-bucket', 'guihang/');
  assert.equal(await store.get('save.json'), null);
  assert.equal(await store.put('save.json', { version: 1 }, null), true);
  assert.equal(await store.put('save.json', { version: 99 }, null), false);
  const current = await store.get<{ version: number }>('save.json');
  assert.ok(current);
  assert.equal(await store.put('save.json', { version: 2 }, current.etag), true);
  assert.equal(await store.put('save.json', { version: 3 }, current.etag), false);
  assert.equal((await store.get<{ version: number }>('save.json'))?.value.version, 2);
  versioning = true;
  await assert.rejects(store.put('new.json', {}, null));
  versioning = false; unavailable = true;
  await assert.rejects(store.get('save.json'), error => error instanceof Error && error.message === 'STORAGE_UNAVAILABLE_403');
  unavailable = false;
  await store.remove('save.json');
  assert.equal(await store.get('save.json'), null);
});

import { randomUUID } from 'node:crypto';
import { TosClient } from '@volcengine/tos-sdk';
import { createTosStore } from '../lib/server/tos-store.ts';
import { loadRuntimeCredentials } from './runtime-credentials.mjs';

const bucket = 'guihang-saves-20260827-7d43';
const prefix = 'guihang/';
const checkId = randomUUID();
const key = `sessions/migration-check-${checkId}.json`;
const report = [];
let store;
let created = false;
function check(condition, name) {
  if (!condition) throw new Error(name);
  report.push(name);
}
try {
  const credentials = await loadRuntimeCredentials(process.argv[2]);
  const options = { ...credentials, region: 'cn-beijing', endpoint: 'tos-cn-beijing.volces.com',
    requestTimeout: 10000, connectionTimeout: 5000, maxRetryCount: 0, enableCRC: false };
  const client = new TosClient(options);
  const versioning = await client.getBucketVersioning(bucket);
  check(!versioning.data.Status, 'VERSIONING_NEVER_ENABLED');
  store = createTosStore(client, bucket, prefix);
  check(await store.get(key) === null, 'MISSING_OBJECT_HANDLED');
  created = await store.put(key, { synthetic: true, version: 1 }, null);
  check(created, 'CREATE_OK');
  check(!await store.put(key, { synthetic: true, version: 99 }, null), 'DUPLICATE_CREATE_REJECTED');
  const first = await store.get(key);
  check(first?.value.version === 1, 'READ_OK');
  check(await store.put(key, { synthetic: true, version: 2 }, first.etag), 'CONDITIONAL_UPDATE_OK');
  check(!await store.put(key, { synthetic: true, version: 99 }, first.etag), 'STALE_UPDATE_REJECTED');
  const independent = createTosStore(new TosClient(options), bucket, prefix);
  check((await independent.get(key))?.value.version === 2, 'INDEPENDENT_CLIENT_READ_OK');
  let outsideStatus = 0;
  try { await client.getObjectV2({ bucket, key: `outside-game-check-${checkId}.json`, dataType: 'buffer' }); }
  catch (error) { outsideStatus = Number(error?.statusCode) || 0; }
  check(outsideStatus === 403, 'OUTSIDE_PREFIX_READ_DENIED');
} catch (error) {
  const message = /^[A-Z][A-Z0-9_]+$/.test(error?.message || '') ? error.message : 'TOS_VERIFICATION_FAILED';
  console.log(JSON.stringify({ ok: false, checks: report, error: message, status: Number(error?.statusCode) || undefined }));
  process.exitCode = 1;
} finally {
  if (created && store) {
    try {
      await store.remove(key);
      check(await store.get(key) === null, 'SYNTHETIC_OBJECT_REMOVED');
    } catch {
      console.log(JSON.stringify({ ok: false, error: 'SYNTHETIC_CLEANUP_FAILED', object: prefix + key }));
      process.exitCode = 1;
    }
  }
}
if (!process.exitCode) console.log(JSON.stringify({ ok: true, checks: report }));

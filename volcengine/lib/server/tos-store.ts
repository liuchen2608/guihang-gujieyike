import { TosClient } from '@volcengine/tos-sdk';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import type { JsonStore } from './json-store';

const MAX_BYTES = 2 * 1024 * 1024;
function statusOf(error: unknown) {
  return error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 0;
}
function safeError(error: unknown): Error {
  // SDK errors can contain signed headers. Never propagate or log them.
  return new Error(`STORAGE_UNAVAILABLE_${statusOf(error) || 'NETWORK'}`);
}
async function errorCode(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  if ('code' in error && typeof error.code === 'string') return error.code;
  // getObjectV2 uses streaming HTTP. Some SDK/Axios combinations leave the
  // error body as a stream instead of decoding the provider's JSON error.
  if ('data' in error && error.data instanceof Readable) {
    const chunks: Buffer[] = []; let bytes = 0;
    try {
      for await (const chunk of error.data) {
        const data = Buffer.from(chunk); bytes += data.length;
        if (bytes > 65536) { error.data.destroy(); return undefined; }
        chunks.push(data);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')).Code;
    } catch { return undefined; }
  }
}
export function createTosStore(client: TosClient, bucket: string, prefix: string): JsonStore {
  return {
    async get<T>(key: string) {
      try {
        const response = await client.getObjectV2({ bucket, key: prefix + key, dataType: 'buffer' });
        if (!response.data.etag || response.data.content.length > MAX_BYTES) throw new Error('INVALID_DOCUMENT');
        return { value: JSON.parse(response.data.content.toString('utf8')) as T, etag: response.data.etag };
      } catch (error) {
        if (statusOf(error) === 404 && await errorCode(error) === 'NoSuchKey') return null;
        throw safeError(error);
      }
    },
    async put<T>(key: string, value: T, expectedEtag: string | null) {
      const body = JSON.stringify(value);
      if (Buffer.byteLength(body) > MAX_BYTES) throw new Error('TRIAL_STORAGE_LIMIT');
      try {
        // ForbidOverwrite is ignored for buckets with enabled/suspended versioning.
        // Fail closed so a misconfigured bucket cannot silently lose concurrent writes.
        const versioning = await client.getBucketVersioning(bucket);
        if (versioning.data.Status) throw new Error('VERSIONING_MUST_BE_OFF');
        await client.putObject({ bucket, key: prefix + key, body: Buffer.from(body),
          contentType: 'application/json; charset=utf-8', cacheControl: 'no-store',
          contentSHA256: createHash('sha256').update(body).digest('hex'),
          ...(expectedEtag === null ? { forbidOverwrite: true } : { ifMatch: expectedEtag }),
        });
        return true;
      } catch (error) {
        if (statusOf(error) === 409 || statusOf(error) === 412) return false;
        throw safeError(error);
      }
    },
    async remove(key: string) {
      try { await client.deleteObject({ bucket, key: prefix + key }); }
      catch (error) { throw safeError(error); }
    },
  };
}

let backend: JsonStore | undefined;
export function storageConfigured() {
  return ['TOS_ACCESS_KEY_ID', 'TOS_SECRET_ACCESS_KEY', 'TOS_BUCKET'].every(key => Boolean(process.env[key]?.trim()));
}
function getBackend() {
  if (backend) return backend;
  if (!storageConfigured()) throw new Error('STORAGE_NOT_CONFIGURED');
  const region = process.env.TOS_REGION || 'cn-beijing';
  const endpoint = process.env.TOS_ENDPOINT || `tos-${region}.volces.com`;
  const bucket = process.env.TOS_BUCKET!;
  const prefix = process.env.TOS_PREFIX || 'guihang/';
  if (!/^[a-z0-9-]+$/.test(region) || !new Set([`tos-${region}.volces.com`, `tos-${region}.ivolces.com`]).has(endpoint)) throw new Error('INVALID_STORAGE_ENDPOINT');
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) || !/^[a-zA-Z0-9_-]+\/$/.test(prefix)) throw new Error('INVALID_STORAGE_CONFIG');
  backend = createTosStore(new TosClient({ accessKeyId: process.env.TOS_ACCESS_KEY_ID!, accessKeySecret: process.env.TOS_SECRET_ACCESS_KEY!, region, endpoint,
    requestTimeout: 10000, connectionTimeout: 5000, maxRetryCount: 0, enableCRC: false,
  }), bucket, prefix);
  return backend;
}
export const tosStore: JsonStore = {
  get: key => getBackend().get(key),
  put: (key, value, etag) => getBackend().put(key, value, etag),
  remove: key => getBackend().remove(key),
};

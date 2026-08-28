import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRuntimeCredentials } from './runtime-credentials.mjs';

const header = '用户名,登录密码,登录地址,所属主账号ID,Access Key ID,Secret Access Key';
const fakeId = 'AKLT' + 'A'.repeat(43);
const fakeSecret = 'dummy-secret-not-a-real-key';
const csv = `${header}\r\nguihang-runtime,,,123,${fakeId},${fakeSecret}\r\n`;
test('only returns the dedicated runtime credentials', () => {
  assert.deepEqual(parseRuntimeCredentials('\uFEFF' + csv), {accessKeyId:fakeId, accessKeySecret:fakeSecret});
});
test('rejects a different user without disclosing input', () => {
  assert.throws(() => parseRuntimeCredentials(csv.replace('guihang-runtime','admin')), /^Error: CREDENTIAL_USER_MISMATCH$/);
});
test('rejects missing, masked, malformed or multiple credentials', () => {
  for (const value of [csv.replace(fakeSecret,'********'), header, csv+csv, csv+'"', csv.replace(fakeId,'not-an-access-key')]) {
    assert.throws(() => parseRuntimeCredentials(value), /CREDENTIAL_/);
  }
});

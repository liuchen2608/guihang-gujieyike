import { readFile, mkdir, mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { loadRuntimeCredentials } from './runtime-credentials.mjs';

// Explicitly scoped to the new migration application, never the old site.
const appId = '325f1b891909';
let file, directory;
try {
  const config = JSON.parse(await readFile('.vefaas/config.json', 'utf8'));
  if (config.modules?.application?.id !== appId) throw new Error('APPLICATION_TARGET_MISMATCH');
  const credentials = await loadRuntimeCredentials(process.argv[2]);
  const previous = parseEnv(await readFile('../web/.env.local', 'utf8'));
  if (!previous.DEEPSEEK_API_KEY?.trim()) throw new Error('DEEPSEEK_KEY_MISSING');
  if ((previous.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '') !== 'https://api.deepseek.com') {
    throw new Error('DEEPSEEK_ENDPOINT_MISMATCH');
  }
  const env = {
    HOSTNAME: '0.0.0.0', PORT: '3000', NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
    TOS_ACCESS_KEY_ID: credentials.accessKeyId, TOS_SECRET_ACCESS_KEY: credentials.accessKeySecret,
    TOS_REGION: 'cn-beijing', TOS_ENDPOINT: 'tos-cn-beijing.volces.com',
    TOS_BUCKET: 'guihang-saves-20260827-7d43', TOS_PREFIX: 'guihang/',
    DEEPSEEK_API_KEY: previous.DEEPSEEK_API_KEY.trim(), DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
    DEEPSEEK_MODEL: previous.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    MODEL_DAILY_CALL_LIMIT: '50', MODEL_MONTHLY_CALL_LIMIT: '500',
  };
  if (previous.GITHUB_CLIENT_ID && previous.GITHUB_CLIENT_SECRET) {
    env.GITHUB_CLIENT_ID = previous.GITHUB_CLIENT_ID;
    env.GITHUB_CLIENT_SECRET = previous.GITHUB_CLIENT_SECRET;
  }
  if (Object.values(env).some(value=>/[\r\n]/.test(value))) throw new Error('INVALID_ENV_VALUE');
  const root = resolve('private-migration');
  await mkdir(root, { recursive: true, mode: 0o700 });
  directory = await mkdtemp(join(root, 'runtime-'));
  file = join(directory, 'runtime.env');
  await writeFile(file, Object.entries(env).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n')+'\n', { flag:'wx', mode:0o600 });
  const result = await new Promise((resolveResult, reject) => {
    const child = spawn('vefaas', ['env','import','--appId',appId,'--file',file,'--keychain','--region','cn-beijing','--yes','-o','json'], {stdio:['ignore','pipe','pipe']});
    let stdout = '';
    child.stdout.on('data',chunk=>{stdout += chunk;});
    child.stderr.on('data',()=>{}); // Never forward provider output with env values.
    child.on('error',()=>reject(new Error('ENV_IMPORT_PROCESS_FAILED')));
    child.on('close',code=>resolveResult({code,stdout}));
  });
  let payload;
  try { payload = JSON.parse(result.stdout); } catch { throw new Error('ENV_IMPORT_RESULT_UNREADABLE'); }
  if (result.code || !payload.ok) throw new Error('ENV_IMPORT_FAILED');
  console.log(JSON.stringify({ok:true,appId,keys:Object.keys(env),githubConfigured:Boolean(env.GITHUB_CLIENT_SECRET)}));
} catch (error) {
  const code = /^[A-Z][A-Z0-9_]+$/.test(error?.message||'') ? error.message : 'RUNTIME_CONFIGURATION_FAILED';
  console.log(JSON.stringify({ok:false,error:code}));
  process.exitCode=1;
} finally {
  if (file) await unlink(file).catch(()=>{process.exitCode=1;});
  if (directory) await rmdir(directory).catch(()=>{process.exitCode=1;});
}

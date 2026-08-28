import { cp, access, readdir } from 'node:fs/promises';
const root = '.next/standalone';
await access(`${root}/server.js`);
await cp('public', `${root}/public`, { recursive: true });
await cp('.next/static', `${root}/.next/static`, { recursive: true });
// A deployment artifact must never contain local credential files.
const files = await readdir(root);
if (files.some(name => name.startsWith('.env') || name === '.dev.vars')) {
  throw new Error('Credential file found in deployment artifact; publishing is blocked.');
}
console.log('Standalone server and static assets packaged (no local env files).');

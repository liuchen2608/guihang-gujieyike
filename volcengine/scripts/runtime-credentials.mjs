import { readFile } from 'node:fs/promises';

// Read only the user-supplied CSV. Never return or log unrelated account fields.
export function parseRuntimeCredentials(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (const char of text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')) {
    if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (char === '\n' && !quoted) { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (quoted) throw new Error('CREDENTIAL_CSV_INVALID');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const nonempty = rows.filter(r => r.some(value => value.trim()));
  if (nonempty.length !== 2) throw new Error('CREDENTIAL_CSV_EXPECT_ONE_USER');
  const [headers, values] = nonempty;
  if (headers.length !== values.length || new Set(headers).size !== headers.length) throw new Error('CREDENTIAL_CSV_INVALID');
  const field = name => values[headers.indexOf(name)]?.trim();
  if (field('用户名') !== 'guihang-runtime') throw new Error('CREDENTIAL_USER_MISMATCH');
  const accessKeyId = field('Access Key ID');
  const accessKeySecret = field('Secret Access Key');
  if (!/^AKLT[A-Za-z0-9]{20,100}$/.test(accessKeyId || '') ||
      !accessKeySecret || accessKeySecret.length < 20 || accessKeySecret.length > 256 ||
      /[\s*]/.test(accessKeySecret)) throw new Error('CREDENTIAL_VALUES_INVALID');
  return { accessKeyId, accessKeySecret };
}

export async function loadRuntimeCredentials(path) {
  const text = await readFile(path, 'utf8').catch(() => { throw new Error('CREDENTIAL_FILE_UNREADABLE'); });
  return parseRuntimeCredentials(text);
}

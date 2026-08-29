import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const count = Number(process.argv[2] || 20);
const days = Number(process.argv[3] || 90);
if (!Number.isInteger(count) || count < 1 || count > 500 || !Number.isInteger(days) || days < 1 || days > 365) throw new Error("Usage: node scripts/create-invites.mjs [count 1..500] [days 1..365]");
const root = resolve("outputs/invitations");
mkdirSync(root, { recursive: true, mode: 0o700 });
const directory = mkdtempSync(`${root}/batch-`);
const expiresAt = new Date(Date.now() + days * 86400_000).toISOString();
const codes = Array.from({ length: count }, (_, index) => {
  const random = randomBytes(12).toString("hex").toUpperCase();
  const code = `GH-${random.match(/.{4}/g).join("-")}`;
  return { number: index + 1, code, hash: createHash("sha256").update(`GH${random}`).digest("hex"), maxUses: 1, expiresAt };
});
writeFileSync(`${directory}/codes.json`, JSON.stringify(codes, null, 2), { mode: 0o600, flag: "wx" });
writeFileSync(`${directory}/manifest.json`, JSON.stringify(codes.map(({ hash, maxUses, expiresAt }) => ({ hash, maxUses, expiresAt }))), { mode: 0o600, flag: "wx" });
writeFileSync(`${directory}/邀请码.md`, `# 归航 · 邀请码（请勿公开）\n\n每码仅兑换一次；兑换有效期至 ${expiresAt.slice(0, 10)}，通行资格最长保留30天。\n匿名资格仅在原浏览器有效；绑定GitHub后可跨设备恢复。请一次只向一位玩家发送一个码，不要发送整个文件。\n\n| 编号 | 邀请码 |\n| --- | --- |\n${codes.map(({number, code}) => `| ${number} | ${code} |`).join("\n")}\n`, { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ directory, manifest: `${directory}/manifest.json`, codes: `${directory}/codes.json`, handoff: `${directory}/邀请码.md`, count, expiresAt }));

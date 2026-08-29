import { readFileSync } from "node:fs";

export function localInviteClient(origin, ip = "127.0.0.1") {
  const base = new URL(origin);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Test requests are limited to localhost.");
  const cookies = new Map();
  return {
    cookies,
    async fetch(path, init = {}) {
      const headers = new Headers(init.headers);
      headers.set("cookie", [...cookies].map(([key, value]) => `${key}=${value}`).join("; "));
      headers.set("origin", base.origin);
      headers.set("cf-connecting-ip", ip);
      const response = await fetch(new URL(String(path), base), { ...init, headers, redirect: "manual" });
      for (const cookie of response.headers.getSetCookie()) {
        const [pair] = cookie.split(";");
        const position = pair.indexOf("=");
        const key = pair.slice(0, position), value = pair.slice(position + 1);
        if (value) cookies.set(key, value); else cookies.delete(key);
      }
      return response;
    },
  };
}

export function readTestCodes(path) {
  if (!path) throw new Error("Pass the local-only codes.json file path; never pass a code on the command line.");
  return JSON.parse(readFileSync(path, "utf8"));
}

export async function redeemTestCode(client, code, legacyPlayerId) {
  await client.fetch("/api/access");
  return client.fetch("/api/access/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, legacyPlayerId }) });
}

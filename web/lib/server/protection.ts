import { env } from "cloudflare:workers";
import { database, ensureSchema } from "./storage";
import { createProtection, digest, limitValue, modelEnabled, type SecurityStore } from "./protection-core";

export const securityStore: SecurityStore = {
  async get<T>(key: string) {
    await ensureSchema();
    const row = await database().prepare("SELECT revision, value_json FROM security_records WHERE key = ?").bind(key).first<{ revision: number; value_json: string }>();
    return row ? { etag: String(row.revision), value: JSON.parse(row.value_json) as T } : null;
  },
  async put<T>(key: string, value: T, etag: string | null) {
    await ensureSchema();
    const result = etag === null
      ? await database().prepare("INSERT INTO security_records (key, revision, value_json) VALUES (?, 1, ?) ON CONFLICT DO NOTHING").bind(key, JSON.stringify(value)).run()
      : await database().prepare("UPDATE security_records SET revision = revision + 1, value_json = ? WHERE key = ? AND revision = ?").bind(JSON.stringify(value), key, Number(etag)).run();
    return result.meta.changes === 1;
  },
};
export const protection = createProtection(securityStore);
export const aiEnabled = () => modelEnabled(env.AI_ENABLED);
export async function reserveAi(owner: string) {
  await protection.reservePersonalAi(owner);
  if (!await protection.reserveGlobal(limitValue(env.MODEL_DAILY_CALL_LIMIT, 50), limitValue(env.MODEL_MONTHLY_CALL_LIMIT, 500))) throw new Error("MODEL_QUOTA_REACHED");
}
export async function protectWrite(request: Request, owner: string, action: "create" | "feedback" | "turn") {
  const limits = { create: [3, 600_000], feedback: [3, 86400_000], turn: [30, 60_000] } as const;
  const [max, period] = limits[action];
  await protection.consume(action + ":owner:" + owner, max, period);
  // Only the hosting edge's canonical client-IP header; never X-Forwarded-For.
  const ip = request.headers.get("cf-connecting-ip") || "shared-unknown";
  await protection.consume(action + ":network:" + await digest(ip), action === "turn" ? 120 : 30, action === "feedback" ? 86400_000 : period);
}

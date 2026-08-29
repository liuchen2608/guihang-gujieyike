// Shared by both deployments. No process-local counters or lock state.
export interface SecurityStore {
  get<T>(key: string): Promise<{ value: T; etag: string } | null>;
  put<T>(key: string, value: T, expectedEtag: string | null): Promise<boolean>;
}
export class ProtectionError extends Error {
  code: string; status: number; retryAfter: number;
  constructor(code: string, message: string, status = 429, retryAfter = 0) {
    super(message); this.code = code; this.status = status; this.retryAfter = retryAfter;
  }
}
export async function digest(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("");
}
export function safeLocalPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20\x7f]/.test(value)) return "/";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\x00-\x20\x7f]/.test(decoded)) return "/";
    const url = new URL(value, "https://game.invalid");
    return url.origin === "https://game.invalid" ? url.pathname + url.search + url.hash : "/";
  } catch { return "/"; }
}
export const modelEnabled = (value?: string) => value === undefined || value.trim().toLowerCase() === "true";
export function limitValue(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback;
  const n = Number(value);
  return value.trim() && Number.isSafeInteger(n) && n >= 0 ? n : 0;
}
export function createProtection(store: SecurityStore, clock = Date.now) {
  async function change<T, R>(key: string, initial: () => T, update: (value: T) => { next?: T; result: R }): Promise<R> {
    for (let attempt = 0; attempt < 16; attempt++) {
      const row = await store.get<T>(key);
      const outcome = update(row ? structuredClone(row.value) : initial());
      if (outcome.next === undefined) return outcome.result;
      if (await store.put(key, outcome.next, row?.etag ?? null)) return outcome.result;
    }
    throw new ProtectionError("SECURITY_BUSY", "安全校验繁忙，请稍后重试。", 503, 5);
  }
  async function consume(subject: string, maximum: number, periodMs: number) {
    const now = clock(), window = Math.floor(now / periodMs);
    if (!Number.isSafeInteger(maximum) || maximum <= 0) throw new ProtectionError("RATE_LIMITED", "当前服务额度已用完，请稍后再试。", 429, Math.ceil(periodMs / 1000));
    const accepted = await change("rate/" + await digest(subject), () => ({ window, count: 0 }), row => {
      if (row.window !== window) row = { window, count: 0 };
      if (row.count >= maximum) return { result: false };
      return { next: { window, count: row.count + 1 }, result: true };
    });
    if (!accepted) throw new ProtectionError("RATE_LIMITED", "操作较频繁或试玩额度已用完，请稍后再试。", 429, Math.ceil(((window + 1) * periodMs - now) / 1000));
  }
  async function reserveGlobal(daily: number, monthly: number) {
    if (![daily, monthly].every(n => Number.isSafeInteger(n) && n > 0)) return false;
    const day = new Date(clock()).toISOString().slice(0, 10), month = day.slice(0, 7);
    return change("model/global", () => ({ day, month, daily: 0, monthly: 0 }), row => {
      if (row.month !== month) row = { day, month, daily: 0, monthly: 0 };
      if (row.day !== day) row = { ...row, day, daily: 0 };
      if (row.daily >= daily || row.monthly >= monthly) return { result: false };
      return { next: { ...row, daily: row.daily + 1, monthly: row.monthly + 1 }, result: true };
    });
  }
  async function reservePersonalAi(owner: string) {
    if (!owner) throw new ProtectionError("IDENTITY_REQUIRED", "请先验证试玩身份。", 401);
    await consume("ai-minute:" + owner, 8, 60_000);
    await consume("ai-day:" + owner, 30, 86400_000);
  }
  // A save version is an idempotency key. Never re-run an uncertain version:
  // provider timeouts do not prove that an upstream call was not billed.
  async function runTurn<T>(owner: string, saveId: string, version: number, work: (assertActive: () => Promise<void>) => Promise<T>): Promise<T> {
    const ownerKey = "lock/" + await digest(owner), turnKey = "turn/" + await digest(saveId);
    const token = crypto.randomUUID(), deadline = clock() + 300_000;
    type Lock = { token: string; until: number };
    type Turn = { version: number; token: string };
    await change<Lock, void>(ownerKey, () => ({ token: "", until: 0 }), row => {
      if (row.until > clock()) throw new ProtectionError("TURN_IN_PROGRESS", "上一项行动仍在处理中，请先核对存档。", 409, 3);
      return { next: { token, until: deadline }, result: undefined };
    });
    const assertActive = async () => {
      const row = await store.get<Lock>(ownerKey);
      if (clock() >= deadline || row?.value.token !== token) throw new ProtectionError("TURN_UNCERTAIN", "行动结果尚未确认，请核对存档并联系邀请人，勿重复提交。", 409);
    };
    try {
      await change<Turn, void>(turnKey, () => ({ version: -1, token: "" }), row => {
        if (row.version >= version) throw new ProtectionError("TURN_UNCERTAIN", "这项行动已受理，结果可能仍在保存。请核对存档；若进度未更新，请联系邀请人恢复。", 409);
        return { next: { version, token }, result: undefined };
      });
      await assertActive();
      return await work(assertActive);
    } finally {
      // A failed release can only delay this player's next operation, never
      // unlock another worker. The durable turn marker is deliberately retained.
      try {
        await change<Lock, void>(ownerKey, () => ({ token: "", until: 0 }), row =>
          row.token === token ? { next: { token: "", until: 0 }, result: undefined } : { result: undefined });
      } catch { /* fail closed until lease expiry */ }
    }
  }
  return { consume, reserveGlobal, reservePersonalAi, runTurn, change };
}


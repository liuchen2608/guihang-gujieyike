import type { GameMessage, InputMode, SaveView } from "./game.ts";

export type AiMeta = { provider: "deepseek" | "local"; model: string; fallback: boolean; npcName?: string; intent?: string; hostilityLevel?: number; retrievalCount: number; sources: string[] };
export type TurnReply = { state?: SaveView["state"]; messages?: GameMessage[]; ai?: AiMeta; requiresConfirmation?: boolean; warning?: string; error?: string; code?: string; resultUrl?: string };

export class UncertainTurnError extends Error {
  constructor() { super("尚未确认行动结果，请先核对存档。不要重复提交，原输入已保留。"); }
}

export async function requestJson<T>(url: string, init: RequestInit = {}, timeoutMs = 15000, fetcher: typeof fetch = fetch): Promise<{ response: Response; data: T }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { ...init, signal: controller.signal, cache: "no-store" });
    const data = await response.json() as T;
    return { response, data };
  } finally { clearTimeout(timeout); }
}

export async function readGameSave(saveId: string, playerId: string | null) {
  const { response, data } = await requestJson<SaveView & { error?: string }>(`/api/saves/${encodeURIComponent(saveId)}${playerId ? `?playerId=${encodeURIComponent(playerId)}` : ""}`);
  if (!response.ok || !data?.state || !Array.isArray(data.messages)) throw new Error(data?.error || "存档读取失败，请重试");
  return data;
}

// Deliberately no retry here: losing the response does not mean the server failed to commit.
export async function postGameTurn(saveId: string, body: { playerId: string | null; mode: InputMode; text: string; version: number; confirmed: boolean }, fetcher: typeof fetch = fetch) {
  let result: { response: Response; data: TurnReply };
  try {
    result = await requestJson<TurnReply>(`/api/saves/${encodeURIComponent(saveId)}/turns`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, 45000, fetcher);
  } catch { throw new UncertainTurnError(); }
  const { response, data } = result;
  if (!data || typeof data !== "object") throw new UncertainTurnError();
  if (response.status >= 500 || data.code === "VERSION_CONFLICT") throw new UncertainTurnError();
  if (!response.ok && !data.resultUrl) throw new Error(data.error || "行动未能完成");
  if (response.ok && !data.requiresConfirmation && (!data.state || data.state.saveId !== saveId || typeof data.state.version !== "number" || !Array.isArray(data.messages))) throw new UncertainTurnError();
  return data;
}

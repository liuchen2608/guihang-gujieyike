import { ProtectionError } from "./protection-core.ts";

export class RequestError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export function protectionResponse(error: unknown): Response | null {
  if (!(error instanceof RequestError) && !(error instanceof ProtectionError)) return null;
  return Response.json({ error: error.message, ...(error instanceof ProtectionError ? { code: error.code } : {}) }, {
    status: error.status,
    headers: { "cache-control": "no-store", ...(error instanceof ProtectionError && error.retryAfter ? { "retry-after": String(error.retryAfter) } : {}) },
  });
}

export function requireSameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new RequestError("请从游戏页面提交请求。", 403);
  }
}

export async function readSmallJson(request: Request, maxBytes = 4096): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new RequestError("请求格式无效。", 415);
  if (Number(request.headers.get("content-length")) > maxBytes) throw new RequestError("请求内容过长。", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("请求内容为空。");
  let bytes = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new RequestError("请求内容过长。", 413); }
      text += decoder.decode(value, { stream: true });
    }
    const result: unknown = JSON.parse(text + decoder.decode());
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("object required");
    return result as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError("请求内容无效。");
  } finally { reader.releaseLock(); }
}

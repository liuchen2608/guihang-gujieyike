import { env } from "cloudflare:workers";

type DeepSeekResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string; type?: string; code?: string };
};

export type DeepSeekCompletion = {
  text: string;
  model: string;
  requestId: string | null;
};

function configuration() {
  const apiKey = env.DEEPSEEK_API_KEY?.trim();
  const baseUrl = (env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash";
  if (!apiKey) return null;
  if (!baseUrl.startsWith("https://")) throw new Error("DeepSeek Base URL 必须使用 HTTPS");
  return { apiKey, baseUrl, model };
}

export function deepSeekStatus() {
  const config = configuration();
  return { configured: Boolean(config), model: config?.model || "deepseek-v4-flash" };
}

export async function completeWithDeepSeek(systemPrompt: string, userPrompt: string): Promise<DeepSeekCompletion> {
  const config = configuration();
  if (!config) throw new Error("DEEPSEEK_NOT_CONFIGURED");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        temperature: 0.72,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });
    const payload = await response.json() as DeepSeekResponse;
    if (!response.ok) {
      const code = payload.error?.code || payload.error?.type || `HTTP_${response.status}`;
      throw new Error(`DEEPSEEK_${code}`);
    }
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("DEEPSEEK_EMPTY_RESPONSE");
    return { text: text.slice(0, 1200), model: config.model, requestId: response.headers.get("x-request-id") };
  } finally {
    clearTimeout(timeout);
  }
}


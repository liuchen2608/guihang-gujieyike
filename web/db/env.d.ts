declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    DEEPSEEK_API_KEY?: string;
    DEEPSEEK_BASE_URL?: string;
    DEEPSEEK_MODEL?: string;
    INVITE_CODES_JSON?: string;
    AI_ENABLED?: string;
    MODEL_DAILY_CALL_LIMIT?: string;
    MODEL_MONTHLY_CALL_LIMIT?: string;
  }
}

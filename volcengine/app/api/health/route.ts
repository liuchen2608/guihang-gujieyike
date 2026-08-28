import { NextResponse } from 'next/server';
import { storageConfigured, tosStore } from '@/lib/server/tos-store';
export const dynamic = 'force-dynamic';
export async function GET() {
  let storage = 'not_configured';
  if (storageConfigured()) {
    try { await tosStore.get('health/readiness.json'); storage = 'ready'; }
    catch { storage = 'unavailable'; }
  }
  return NextResponse.json({ status: storage === 'ready' ? 'ok' : 'not_ready', storage,
    aiConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    githubConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  }, { status: storage === 'ready' ? 200 : 503, headers: { 'cache-control': 'no-store' } });
}

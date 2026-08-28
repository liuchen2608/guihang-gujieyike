import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { suggestionsFor } from '../lib/game.ts';

const origin = 'https://sfp72tv9fql2n20va63iu.apigateway-cn-beijing.volceapi.com';
const playerId = randomUUID();
const report = { checks: [], phases: [], ai: null, syntheticPlayerId: playerId };
let state;
function check(ok, name) { if (!ok) throw new Error(name); report.checks.push(name); }
async function request(path, body) {
  const response = await fetch(origin + path, { method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(45000) });
  const data = await response.json();
  return { status: response.status, data };
}
async function turn(text, mode = 'act') {
  const result = await request(`/api/saves/${state.saveId}/turns`, { playerId, version: state.version, mode, text, confirmed: true });
  check(result.status === 200 && result.data.state, 'TURN_OK');
  state = result.data.state;
  return result.data;
}
try {
  const health = await request('/api/health');
  check(health.status === 200 && health.data.storage === 'ready' && health.data.aiConfigured, 'HEALTH_READY');
  const created = await request('/api/saves', { playerId, codename: '迁移验收驾驶员', homeAnchor: '完成测试后回家' });
  check(created.status === 201 && created.data.state.phase === 'desert_wake', 'GAME_CREATED');
  state = created.data.state;
  report.saveId = state.saveId;
  const denied = await request(`/api/saves/${state.saveId}?playerId=${randomUUID()}`);
  check(denied.status === 404, 'OTHER_PLAYER_DENIED');
  let npcTested = false;
  for (let count = 0; count < 30; count++) {
    report.phases.push(state.phase);
    if (state.ended) {
      if (state.ending === 'beacon') { await turn('继续第三幕，开始铸造蛊机外骨骼'); check(state.act === 3, 'ACT_THREE_CONTINUED'); continue; }
      break;
    }
    if (state.phase === 'clan_gate' && !npcTested) {
      const answer = await turn('真元是什么？', 'talk');
      report.ai = { provider: answer.ai?.provider, fallback: answer.ai?.fallback, retrievalCount: answer.ai?.retrievalCount };
      check(answer.ai?.provider === 'deepseek' && !answer.ai?.fallback, 'DEEPSEEK_NPC_REPLY');
      check(answer.ai?.retrievalCount > 0, 'RAG_RETRIEVAL_OK');
      check(!answer.messages.some(m => /canon_statement|owner_faction_secret|experienced_gu_master|【知识权限】/.test(m.text)), 'NPC_METADATA_NOT_LEAKED');
      npcTested = true;
    }
    const previousVersion = state.version;
    const index = { first_gu: 1, wolf_attack: 1, well_fragment: 2, dream_entry: 1 }[state.phase] || 0;
    await turn(suggestionsFor(state)[index]);
    check(state.version === previousVersion + 1, 'VERSION_ADVANCED');
    if (count === 0) {
      const stale = await request(`/api/saves/${state.saveId}/turns`, { playerId, version: previousVersion, mode:'act', text:'回收水和仍可使用的装备', confirmed:true });
      check(stale.status === 409 && stale.data.code === 'VERSION_CONFLICT', 'STALE_TURN_REJECTED');
    }
  }
  check(state.ended && state.ending === 'forged' && state.act === 3, 'THREE_ACTS_COMPLETED');
  const reload = await request(`/api/saves/${state.saveId}?playerId=${playerId}`);
  check(reload.status === 200 && reload.data.state.version === state.version && reload.data.state.ending === 'forged', 'RELOAD_PRESERVES_PROGRESS');
  const latest = await request(`/api/saves?playerId=${playerId}`);
  check(latest.status === 200 && latest.data.save?.state.saveId === state.saveId, 'LATEST_SAVE_FOUND');
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = /^[A-Z_]+$/.test(error?.message || '') ? error.message : 'LIVE_TEST_NETWORK_OR_RESPONSE_ERROR';
  process.exitCode = 1;
} finally {
  await mkdir('private-migration', { recursive:true, mode:0o700 });
  await writeFile(`private-migration/live-check-${Date.now()}.json`, JSON.stringify(report,null,2), {flag:'wx',mode:0o600});
  // Keep the synthetic save for reproducible inspection; never print its bearer identity.
  console.log(JSON.stringify({ok:report.ok,checks:[...new Set(report.checks)],phases:report.phases,ai:report.ai,error:report.error}));
}

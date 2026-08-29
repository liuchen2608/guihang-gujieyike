import assert from "node:assert/strict";
import { postGameTurn, UncertainTurnError } from "../lib/client-requests.ts";
import { suggestionsFor } from "../lib/game.ts";
import { localInviteClient, readTestCodes, redeemTestCode } from "./local-invite-client.mjs";

const origin = new URL(process.argv[2] || "http://localhost:3001");
if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) throw new Error("This test creates saves. Only a local server is allowed.");
const playerId = crypto.randomUUID();
const client = localInviteClient(origin, "127.0.0.3");
const invite = await redeemTestCode(client, readTestCodes(process.argv[3])[5].code, playerId);
assert.equal(invite.status, 200);
const create = await client.fetch("/api/saves", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerId, codename: "手机接口验收", homeAnchor: "等我回来" }) });
assert.equal(create.status, 201);
let save = await create.json();
const saveId = save.state.saveId;
const fetchLocal = (input, init) => client.fetch(input, init);
const read = async () => {
  const response = await fetchLocal(`/api/saves/${saveId}?playerId=${playerId}`);
  assert.equal(response.status, 200);
  return response.json();
};
const initialVersion = save.state.version;
const body = { playerId, mode: "act", text: "扫描残骸与周围环境", version: initialVersion, confirmed: true };
const concurrent = await Promise.all([0,1].map(() => fetchLocal(`/api/saves/${saveId}/turns`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })));
assert.deepEqual(concurrent.map(r => r.status).sort(), [200,409]);
save = await read();
assert.equal(save.state.version, initialVersion + 1);
assert.equal(save.messages.filter(m => m.kind === "player").length, 1);
console.log("PASS concurrent submissions: one commit, one conflict, no duplicate messages");

const beforeLostResponse = save.state.version;
let sent = 0;
await assert.rejects(postGameTurn(saveId, { ...body, text: "用驾驶服助力绕开沙狼", version: beforeLostResponse }, async (input, init) => {
  sent++;
  const response = await fetchLocal(input, init);
  assert.equal(response.status, 200);
  await response.text();
  throw new TypeError("simulated response lost after commit");
}), UncertainTurnError);
assert.equal(sent, 1);
save = await read();
assert.equal(save.state.version, beforeLostResponse + 1);
assert.equal(save.messages.filter(m => m.kind === "player").length, 2);
console.log("PASS response loss: re-read confirms progress without repeating the action");

const phases = new Set(["desert_wake", "oasis_route"]);
let turns = 0;
while (turns++ < 30) {
  phases.add(save.state.phase);
  if (save.state.ended && save.state.ending !== "beacon") break;
  const text = save.state.ended ? "继续进入第三幕" : suggestionsFor(save.state)[0];
  const reply = await postGameTurn(saveId, { ...body, text, version: save.state.version }, fetchLocal);
  assert.ok(reply.state);
  save = await read();
  assert.equal(save.state.version, reply.state.version);
}
assert.equal(save.state.act, 3);
assert.equal(save.state.ended, true);
assert.equal(save.state.ending, "forged");
assert.equal(phases.size, 24);
console.log("PASS all 24 phases and three-act completion, saved state matches each response");

const assets = await Promise.all(Array.from(phases, async phase => {
  const { sceneImageFor } = await import("../lib/scene-images.ts");
  const response = await fetchLocal(sceneImageFor(phase).mobileSrc);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/webp/);
  assert.ok((await response.arrayBuffer()).byteLength <= 400 * 1024);
  return phase;
}));
console.log(`PASS ${assets.length} mobile images served as WebP within size budget`);

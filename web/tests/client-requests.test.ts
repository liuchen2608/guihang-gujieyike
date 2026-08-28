import assert from "node:assert/strict";
import test from "node:test";
import { postGameTurn, requestJson, UncertainTurnError } from "../lib/client-requests.ts";
import { newGameState } from "../lib/game.ts";

const body = { playerId: "test-player", mode: "act" as const, text: "扫描残骸", version: 1, confirmed: false };
test("a lost response is uncertain and never causes an automatic second POST", async () => {
  let calls = 0;
  await assert.rejects(postGameTurn("save", body, async () => { calls++; throw new TypeError("network lost after commit"); }), UncertainTurnError);
  assert.equal(calls, 1);
  assert.equal(body.text, "扫描残骸");
});
test("version conflicts, server failures and invalid replies require reconciliation", async () => {
  for (const response of [Response.json({ code: "VERSION_CONFLICT" }, { status: 409 }), Response.json({ error: "failed" }, { status: 500 }), Response.json({}), Response.json(null), Response.json({ state: {}, messages: [] })]) {
    await assert.rejects(postGameTurn("save", body, async () => response), UncertainTurnError);
  }
});
test("confirmed replies and risk confirmations preserve their existing contracts", async () => {
  const confirmation = await postGameTurn("save", body, async () => Response.json({ requiresConfirmation: true, warning: "危险" }));
  assert.equal(confirmation.requiresConfirmation, true);
  const state = newGameState("save", "验收", "回家");
  const reply = await postGameTurn("save", body, async (_url, init) => {
    assert.equal(JSON.parse(String(init?.body)).version, 1);
    return Response.json({ state, messages: [] });
  });
  assert.equal(reply.state?.saveId, "save");
});
test("read timeout aborts a stalled request", async () => {
  const fetcher: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  await assert.rejects(requestJson("/slow", {}, 5, fetcher), /aborted/);
});
test("ordinary validation errors do not pretend an action succeeded", async () => {
  await assert.rejects(postGameTurn("save", body, async () => Response.json({ error: "请求无效" }, { status: 400 })), /请求无效/);
});

import assert from "node:assert/strict";
import test from "node:test";

import { newGameState, resolveTurn } from "../lib/game.ts";

test("a completed second-act save can continue into act three", () => {
  const state = newGameState("save-test", "测试驾驶员", "回到未婚妻身边");
  state.phase = "dream_wake";
  state.act = 2;
  state.ended = true;
  state.ending = "beacon";
  state.clues = 1;
  state.objective = "第一幕与第二幕已完成";

  const result = resolveTurn(state, "act", "继续进入第三幕");

  assert.equal(result.state.ended, false);
  assert.equal(result.state.act, 3);
  assert.notEqual(result.state.phase, "dream_wake");
  assert.match(result.state.objective, /蛊机|外骨骼/);
  assert.ok(result.messages.length > 0);
});

test("act three progresses through forging and ends with a completed exoskeleton", () => {
  const initial = newGameState("save-act-three", "测试驾驶员", "回到未婚妻身边");
  initial.phase = "dream_wake";
  initial.act = 2;
  initial.ended = true;
  initial.ending = "beacon";
  initial.clues = 1;

  let state = resolveTurn(initial, "act", "继续进入第三幕").state;
  state = resolveTurn(state, "act", "用修复水轮的功劳换取试验时间").state;
  state = resolveTurn(state, "act", "优先设计稳定的真元隔离层").state;
  state = resolveTurn(state, "act", "用工程技术向部族交换材料").state;
  state = resolveTurn(state, "act", "分阶段注入真元并监测温度").state;
  state = resolveTurn(state, "act", "保持手动控制并逐步提高负载").state;
  const finale = resolveTurn(state, "act", "隔离声纹，只追踪空间坐标");

  assert.equal(finale.state.act, 3);
  assert.equal(finale.state.ended, true);
  assert.equal(finale.state.ending, "forged");
  assert.equal(finale.state.guMechProgress, 100);
  assert.ok(finale.state.inventory.includes("蛊机外骨骼·归航一型"));
  assert.match(finale.messages.at(-1)?.text || "", /第三幕|下一阶段/);
});

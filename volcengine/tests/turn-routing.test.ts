import assert from "node:assert/strict";
import test from "node:test";

import { actionRequiresNpcAid } from "../lib/turn-routing.ts";

test("self-directed gu-mech actions continue locally when NPC aid is withheld", () => {
  assert.equal(actionRequiresNpcAid("first_gu", "withheld", "将砂甲蛊接入驾驶服"), false);
  assert.equal(actionRequiresNpcAid("first_gu", "withheld", "先观察蛊虫的真元路径"), false);
});

test("an explicit request for NPC instruction still respects withheld aid", () => {
  assert.equal(actionRequiresNpcAid("first_gu", "withheld", "请乌岩演示正确用法"), true);
});

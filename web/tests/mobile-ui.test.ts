import assert from "node:assert/strict";
import test from "node:test";
import { isNearBottom, shouldSendOnEnter, visibleViewport } from "../lib/mobile-ui.ts";
import { requireStorage, STORAGE_WARNING } from "../lib/client-storage.ts";

const enter = { key: "Enter", shiftKey: false, isComposing: false, keyCode: 13 };
test("mobile Enter inserts a line; desktop Enter submits except during Chinese composition", () => {
  assert.equal(shouldSendOnEnter(enter, true), false);
  assert.equal(shouldSendOnEnter(enter, false), true);
  assert.equal(shouldSendOnEnter({ ...enter, shiftKey: true }, false), false);
  assert.equal(shouldSendOnEnter({ ...enter, isComposing: true }, false), false);
  assert.equal(shouldSendOnEnter({ ...enter, keyCode: 229 }, false), false);
});
test("history readers are not treated as following the newest message", () => {
  assert.equal(isNearBottom(100, 1400, 500), false);
  assert.equal(isNearBottom(850, 1400, 500), true);
  assert.equal(isNearBottom(0, 300, 500), true);
});
test("keyboard viewport includes its offset, with an innerHeight fallback", () => {
  assert.deepEqual(visibleViewport(844, { height: 420, offsetTop: 24, scale: 1 }), { height: 420, top: 24 });
  assert.deepEqual(visibleViewport(844), { height: 844, top: 0 });
  assert.deepEqual(visibleViewport(844, { height: 300, offsetTop: 0, scale: 2 }), { height: 844, top: 0 });
});
test("blocked storage fails explicitly instead of creating a new temporary identity", () => {
  assert.throws(() => requireStorage(() => { throw new Error("SecurityError"); }), { message: STORAGE_WARNING });
  const values = new Map<string, string>([["guihang_player_id", "existing-player"]]);
  const storage: Storage = { length: 1, clear() {}, key() { return null; }, getItem(key) { return values.get(key) ?? null; }, setItem() { throw new Error("QuotaExceededError"); }, removeItem(key) { values.delete(key); } };
  assert.throws(() => requireStorage(() => storage), { message: STORAGE_WARNING });
  assert.equal(values.get("guihang_player_id"), "existing-player");
});

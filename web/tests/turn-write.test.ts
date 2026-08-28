import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { newGameState } from "../lib/game.ts";
import { turnWriteStatements } from "../lib/server/turn-write.ts";

test("stale/concurrent turn batches cannot append duplicate messages or change another owner's save", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE game_saves (id TEXT PRIMARY KEY, player_id TEXT, version INTEGER, state_json TEXT, updated_at TEXT, ended_at TEXT)");
    db.exec("CREATE TABLE game_messages (id TEXT PRIMARY KEY, save_id TEXT, kind TEXT, label TEXT, body TEXT, created_at TEXT)");
    db.prepare("INSERT INTO game_saves (id, player_id, version) VALUES (?, ?, ?)").run("save", "owner", 1);
    const state = { ...newGameState("save", "验收", "回家"), version: 2 };
    const execute = (id: string, owner = "owner") => {
      db.exec("BEGIN");
      try {
        const statements = turnWriteStatements("save", owner, 1, [{ id, kind: "player", label: "行动", text: "扫描" }], state, "now");
        const results = statements.map(({ sql, values }) => db.prepare(sql).run(...values));
        db.exec("COMMIT");
        return results.at(-1)?.changes;
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    };
    assert.equal(execute("wrong-owner", "someone-else"), 0);
    assert.equal(execute("winner"), 1);
    assert.equal(execute("stale-response"), 0);
    assert.equal(db.prepare("SELECT count(*) AS total FROM game_messages").get()?.total, 1);
    assert.equal(db.prepare("SELECT version FROM game_saves").get()?.version, 2);
  } finally { db.close(); }
});

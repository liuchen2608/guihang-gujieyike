import type { GameMessage, GameState } from "../game.ts";

export function turnWriteStatements(saveId: string, playerId: string, expectedVersion: number, messages: GameMessage[], nextState: GameState, now: string) {
  // D1 batch is transactional. Insert only while the expected version still
  // owns the turn, then advance that version in the final statement.
  return [
    ...messages.map((message) => ({
      sql: "INSERT INTO game_messages (id, save_id, kind, label, body, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM game_saves WHERE id = ? AND player_id = ? AND version = ?)",
      values: [message.id, saveId, message.kind, message.label, message.text, now, saveId, playerId, expectedVersion],
    })),
    {
      sql: "UPDATE game_saves SET version = ?, state_json = ?, updated_at = ?, ended_at = ? WHERE id = ? AND player_id = ? AND version = ?",
      values: [nextState.version, JSON.stringify(nextState), now, nextState.ended ? now : null, saveId, playerId, expectedVersion],
    },
  ];
}

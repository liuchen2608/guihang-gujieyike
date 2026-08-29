import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const securityRecords = sqliteTable("security_records", {
  key: text("key").primaryKey(),
  revision: integer("revision").notNull(),
  valueJson: text("value_json").notNull(),
});

export const gameSaves = sqliteTable("game_saves", {
  id: text("id").primaryKey(),
  playerId: text("player_id").notNull(),
  codename: text("codename").notNull(),
  version: integer("version").notNull(),
  stateJson: text("state_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  endedAt: text("ended_at"),
}, (table) => [index("idx_game_saves_player_updated").on(table.playerId, table.updatedAt)]);

export const gameMessages = sqliteTable("game_messages", {
  id: text("id").primaryKey(),
  saveId: text("save_id").notNull(),
  kind: text("kind").notNull(),
  label: text("label").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("game_messages_save_id_idx").on(table.saveId)]);

export const feedback = sqliteTable("feedback", {
  id: text("id").primaryKey(),
  saveId: text("save_id"),
  playerId: text("player_id").notNull(),
  understoodGoal: integer("understood_goal", { mode: "boolean" }).notNull(),
  trustedGuihang: integer("trusted_guihang", { mode: "boolean" }).notNull(),
  continueChapterTwo: integer("continue_chapter_two", { mode: "boolean" }).notNull(),
  rating: real("rating").notNull(),
  detail: text("detail").notNull(),
  contact: text("contact"),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("feedback_player_save_idx").on(table.playerId, table.saveId)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  githubId: text("github_id").notNull().unique(),
  githubLogin: text("github_login").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const authSessions = sqliteTable("auth_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_auth_sessions_user_id").on(table.userId)]);

export const inviteGrants = sqliteTable("invite_grants", {
  tokenHash: text("token_hash").primaryKey(),
  inviteHash: text("invite_hash").notNull(),
  ownerId: text("owner_id").notNull(),
  accountId: text("account_id"),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => [index("invite_grants_owner_idx").on(table.ownerId), index("invite_grants_code_idx").on(table.inviteHash), index("invite_grants_account_idx").on(table.accountId)]);

export const inviteAttempts = sqliteTable("invite_attempts", {
  bucketKey: text("bucket_key").primaryKey(),
  attempts: integer("attempts").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => [index("invite_attempts_expiry_idx").on(table.expiresAt)]);

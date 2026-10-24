import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Delivery metadata only. Draft content and recipient addresses are never stored.
export const sendAttempts = sqliteTable("send_attempts", {
  key: text("attempt_key").primaryKey(),
  userId: text("user_id").notNull(),
  draftDigest: text("draft_digest").notNull(),
  status: text("status").notNull(),
  providerMessageId: text("provider_message_id"),
  createdAt: integer("created_at").notNull(),
});

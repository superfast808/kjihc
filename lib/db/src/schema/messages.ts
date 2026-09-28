import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messagesTable = pgTable("kjihc_messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  senderStaffId: text("sender_staff_id"),   // Clerk user ID (null if sent by parent)
  senderParentId: text("sender_parent_id"), // parentTokenId text (null if sent by staff)
  senderName: text("sender_name").notNull().default(""), // denormalised for display speed
  content: text("content").notNull().default(""),
  parentMessageId: integer("parent_message_id"), // null = top-level; set = reply in thread
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }), // soft-delete
});

export const messageReactionsTable = pgTable("kjihc_message_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  reactorStaffId: text("reactor_staff_id"),   // Clerk user ID
  reactorParentId: text("reactor_parent_id"), // parentTokenId
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messageAttachmentsTable = pgTable("kjihc_message_attachments", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  objectPath: text("object_path").notNull(), // e.g. /objects/uploads/uuid
  mimeType: text("mime_type").notNull().default(""),
  fileName: text("file_name").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true, editedAt: true, deletedAt: true });
export const insertReactionSchema = createInsertSchema(messageReactionsTable).omit({ id: true, createdAt: true });
export const insertAttachmentSchema = createInsertSchema(messageAttachmentsTable).omit({ id: true, createdAt: true });

export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type MessageReaction = typeof messageReactionsTable.$inferSelect;
export type MessageAttachment = typeof messageAttachmentsTable.$inferSelect;

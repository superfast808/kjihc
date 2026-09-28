import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Channel types:
//  noticeboard – broadcast; all members of an age group (or club-wide) can read; staff post
//  group       – staff-initiated; targets a set of parents (e.g. all parents in an age group)
//  direct      – 1-to-1 between a staff member and a parent
export const channelsTable = pgTable("kjihc_channels", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'noticeboard' | 'group' | 'direct'
  name: text("name").notNull(),
  ageGroup: text("age_group"), // null means club-wide (for noticeboards) or multi-group
  createdByStaffId: text("created_by_staff_id"), // Clerk user ID; null for seeded channels
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const channelMembersTable = pgTable("kjihc_channel_members", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  memberId: text("member_id").notNull(), // staffId (Clerk) or parentTokenId (text)
  memberType: text("member_type").notNull(), // 'staff' | 'parent'
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChannelSchema = createInsertSchema(channelsTable).omit({ id: true, createdAt: true });
export const insertChannelMemberSchema = createInsertSchema(channelMembersTable).omit({ id: true, joinedAt: true });

export type Channel = typeof channelsTable.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type ChannelMember = typeof channelMembersTable.$inferSelect;

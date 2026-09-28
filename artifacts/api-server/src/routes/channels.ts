import { Router } from "express";
import { db } from "@workspace/db";
import {
  channelsTable, channelMembersTable, membersTable, messagesTable, staffTable,
} from "@workspace/db";
import { eq, inArray, and, isNull, sql } from "drizzle-orm";
import { requireStaff , normAgeGroup } from "../middlewares/auth";
import { resolveCaller } from "../lib/messagingAuth";

// ── DM member enrichment ───────────────────────────────────────────────────────

interface DmMember { email: string; playerParent: string | null; children: string[] }

async function enrichWithDmMembers<T extends { id: number; type: string }>(
  channels: T[],
): Promise<(T & { dmMembers?: DmMember[] })[]> {
  const directs = channels.filter(c => c.type === "direct");
  if (directs.length === 0) return channels.map(c => ({ ...c }));

  const directIds = directs.map(c => c.id);
  const memberRows = await db.select()
    .from(channelMembersTable)
    .where(and(
      inArray(channelMembersTable.channelId, directIds),
      eq(channelMembersTable.memberType, "parent"),
    ));

  const emails = [...new Set(memberRows.map(r => r.memberId).filter(Boolean))];
  let playerRows: { playerEmail: string | null; playerName: string; playerParent: string | null }[] = [];
  if (emails.length > 0) {
    playerRows = await db.select({
      playerEmail: membersTable.playerEmail,
      playerName: membersTable.playerName,
      playerParent: membersTable.playerParent,
    }).from(membersTable).where(inArray(sql`lower(${membersTable.playerEmail})`, emails.map(e => e.toLowerCase())));
  }

  const byEmail: Record<string, { playerParent: string | null; children: string[] }> = {};
  for (const p of playerRows) {
    if (!p.playerEmail) continue;
    if (!byEmail[p.playerEmail]) byEmail[p.playerEmail] = { playerParent: p.playerParent, children: [] };
    if (p.playerName) byEmail[p.playerEmail].children.push(p.playerName);
  }

  const dmMap: Record<number, DmMember[]> = {};
  for (const row of memberRows) {
    if (!dmMap[row.channelId]) dmMap[row.channelId] = [];
    const info = byEmail[row.memberId] ?? { playerParent: null, children: [] };
    dmMap[row.channelId].push({ email: row.memberId, playerParent: info.playerParent, children: info.children });
  }

  return channels.map(c => ({ ...c, dmMembers: dmMap[c.id] }));
}

// ─── Helper: attach latest-message metadata to a channel list ─────────────────

async function enrichWithLatestMessage<T extends { id: number }>(
  channels: T[],
): Promise<(T & { latestMessageId: number | null; latestMessageAt: string | null })[]> {
  if (channels.length === 0) return channels.map(c => ({ ...c, latestMessageId: null, latestMessageAt: null }));

  const ids = channels.map(c => c.id);
  const rows = await db
    .select({
      channelId: messagesTable.channelId,
      latestMessageId: sql<number>`MAX(${messagesTable.id})`,
      latestMessageAt: sql<string>`MAX(${messagesTable.createdAt})`,
    })
    .from(messagesTable)
    .where(
      and(
        inArray(messagesTable.channelId, ids),
        isNull(messagesTable.parentMessageId),
        isNull(messagesTable.deletedAt),
      ),
    )
    .groupBy(messagesTable.channelId);

  const byChannel: Record<number, { latestMessageId: number | null; latestMessageAt: string | null }> = {};
  for (const r of rows) {
    byChannel[r.channelId] = {
      latestMessageId: r.latestMessageId ?? null,
      latestMessageAt: r.latestMessageAt ?? null,
    };
  }
  return channels.map(c => ({
    ...c,
    latestMessageId: byChannel[c.id]?.latestMessageId ?? null,
    latestMessageAt: byChannel[c.id]?.latestMessageAt ?? null,
  }));
}

const router = Router();

// ─── GET /api/channels ────────────────────────────────────────────────────────
// Staff: all channels. Parent: noticeboards for their age groups + explicit memberships.

router.get("/channels", async (req, res): Promise<void> => {
  try {
    const caller = await resolveCaller(req);
    if (!caller) { res.status(401).json({ error: "Unauthorized" }); return; }

    if (caller.kind === "staff") {
      const channels = await db.select().from(channelsTable)
        .orderBy(channelsTable.type, channelsTable.name);
      res.json(await enrichWithDmMembers(await enrichWithLatestMessage(channels)));
      return;
    }

    // Parent: find age groups for this parent's children
    const children = await db.select({ ageGroup: membersTable.ageGroup })
      .from(membersTable).where(sql`lower(${membersTable.playerEmail}) = lower(${caller.email})`);
    const ageGroups = [...new Set(children.map(c => c.ageGroup).filter(Boolean))] as string[];

    // Noticeboard channels: club-wide + relevant age groups
    const noticeboards = await db.select().from(channelsTable)
      .where(eq(channelsTable.type, "noticeboard"));
    const relevantNoticeboards = noticeboards.filter(
      c => c.ageGroup === null || ageGroups.map(g => normAgeGroup(g)).includes(normAgeGroup(c.ageGroup))
    );

    // Direct/group channels where parent is an explicit member
    const memberships = await db.select({ channelId: channelMembersTable.channelId })
      .from(channelMembersTable)
      .where(and(
        eq(channelMembersTable.memberId, caller.email),
        eq(channelMembersTable.memberType, "parent"),
      ));
    const memberChannelIds = memberships.map(m => m.channelId);

    let memberChannels: typeof relevantNoticeboards = [];
    if (memberChannelIds.length > 0) {
      memberChannels = await db.select().from(channelsTable)
        .where(inArray(channelsTable.id, memberChannelIds));
    }

    // Merge, dedup
    const seen = new Set<number>();
    const all = [...relevantNoticeboards, ...memberChannels].filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id); return true;
    });
    all.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    res.json(await enrichWithLatestMessage(all));
  } catch (err) {
    console.error("GET /channels error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/channels ───────────────────────────────────────────────────────
// Staff only. Creates a direct or group channel and adds initial members.

router.post("/channels", requireStaff, async (req, res): Promise<void> => {
  try {
    const caller = await resolveCaller(req);
    if (!caller || caller.kind !== "staff") {
      res.status(403).json({ error: "Staff access required" }); return;
    }

    const { type, name, ageGroup, memberEmails } = req.body as {
      type?: string; name?: string; ageGroup?: string; memberEmails?: string[];
    };

    if (!type || !["direct", "group", "staff"].includes(type)) {
      res.status(400).json({ error: "type must be 'direct', 'group', or 'staff'" }); return;
    }
    if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }

    // For direct channels, use the parent's real name (not the email local-part)
    let channelName = name.trim();
    if (type === "direct" && Array.isArray(memberEmails) && memberEmails.length === 1 && memberEmails[0]) {
      const [member] = await db
        .select({ playerParent: membersTable.playerParent })
        .from(membersTable)
        .where(sql`lower(${membersTable.playerEmail}) = lower(${memberEmails[0]})`)
        .limit(1);
      if (member?.playerParent) channelName = member.playerParent;
    }

    const [channel] = await db.insert(channelsTable).values({
      type, name: channelName, ageGroup: ageGroup ?? null, createdByStaffId: caller.userId,
    }).returning();

    // Add staff creator as member
    await db.insert(channelMembersTable).values({
      channelId: channel.id, memberId: String(caller.userId), memberType: "staff",
    });

    // Staff channels: add ALL current staff as members
    if (type === "staff") {
      const allStaff = await db.select({ id: staffTable.id }).from(staffTable);
      for (const s of allStaff) {
        if (String(s.id) !== String(caller.userId)) {
          await db.insert(channelMembersTable).values({
            channelId: channel.id, memberId: String(s.id), memberType: "staff",
          }).onConflictDoNothing();
        }
      }
    }

    // If group channel for an age group, add all parents in that group
    if (type === "group" && ageGroup) {
      const members = await db.select({ playerEmail: membersTable.playerEmail })
        .from(membersTable).where(sql`lower(${membersTable.ageGroup}) = lower(${ageGroup})`);
      const emails = [...new Set(members.map(m => m.playerEmail).filter((e): e is string => !!e))];
      for (const email of emails) {
        await db.insert(channelMembersTable).values({
          channelId: channel.id, memberId: email, memberType: "parent",
        }).onConflictDoNothing();
      }
    }

    // Explicit list of parent emails
    if (Array.isArray(memberEmails) && memberEmails.length > 0) {
      for (const email of memberEmails) {
        if (typeof email === "string" && email) {
          await db.insert(channelMembersTable).values({
            channelId: channel.id, memberId: email, memberType: "parent",
          }).onConflictDoNothing();
        }
      }
    }

    res.status(201).json(channel);
  } catch (err) {
    console.error("POST /channels error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/channels/:id/members ───────────────────────────────────────────

router.get("/channels/:id/members", requireStaff, async (req, res): Promise<void> => {
  try {
    const channelId = parseInt(req.params["id"] as string, 10);
    const members = await db.select().from(channelMembersTable)
      .where(eq(channelMembersTable.channelId, channelId));
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/channels/:id/members ──────────────────────────────────────────

router.post("/channels/:id/members", requireStaff, async (req, res): Promise<void> => {
  try {
    const channelId = parseInt(req.params["id"] as string, 10);
    const { memberId, memberType } = req.body as { memberId?: string; memberType?: string };
    if (!memberId || !memberType) {
      res.status(400).json({ error: "memberId and memberType required" }); return;
    }
    await db.insert(channelMembersTable)
      .values({ channelId, memberId, memberType })
      .onConflictDoNothing();
    res.status(201).json({ channelId, memberId, memberType });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

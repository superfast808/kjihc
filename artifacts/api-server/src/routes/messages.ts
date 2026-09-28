import { Router } from "express";
import { db } from "@workspace/db";
import {
  messagesTable, messageReactionsTable, messageAttachmentsTable, uploadGrantsTable,
  channelsTable, channelMembersTable, membersTable, parentDevicesTable,
} from "@workspace/db";
import { eq, and, lt, desc, asc, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { resolveCaller, canAccessChannel } from "../lib/messagingAuth";
import { pubSub } from "../lib/messagePubSub";
import { sendWebPushToEmail } from "../lib/webPush";
import { sendExpoPushNotifications } from "../lib/expoPush";
import { getAppBaseUrl } from "../lib/appUrl";

// ── Push helper for new messages (web + Expo) ─────────────────────────────────
// Noticeboard channels have no explicit channelMembersTable rows for parents —
// they're open-access by age group — so we fan out to all relevant parents
// directly from the members table.  DM/group channels use explicit membership.

async function notifyChannelParentsNewMessage(
  channelId: number,
  caller: { kind: string; email?: string; name?: string },
  senderName: string,
  content: string,
): Promise<void> {
  const [channel] = await db
    .select({ type: channelsTable.type, ageGroup: channelsTable.ageGroup })
    .from(channelsTable)
    .where(eq(channelsTable.id, channelId));
  if (!channel) return;

  const senderEmail = caller.kind === "parent" ? caller.email : null;
  const body = content.length > 100 ? content.slice(0, 100) + "…" : content || "Sent an attachment";
  const url  = `${getAppBaseUrl()}/kjihc/parent-login`;
  const isNoticeboard = channel.type === "noticeboard";
  const title = isNoticeboard ? `📢 ${senderName}` : `💬 ${senderName}`;
  const tag   = isNoticeboard ? `noticeboard-${channelId}` : `msg-channel-${channelId}`;

  let recipientEmails: string[];

  if (isNoticeboard) {
    // Fan out to all parents whose children belong to this age group (or all parents
    // if the noticeboard is club-wide, i.e. ageGroup is null).
    const rows = await db
      .selectDistinct({ email: membersTable.playerEmail })
      .from(membersTable)
      .where(and(
        sql`${membersTable.playerEmail} <> ''`,
        ...(channel.ageGroup ? [sql`lower(${membersTable.ageGroup}) = lower(${channel.ageGroup})`] : []),
      ));
    recipientEmails = rows.map(r => r.email.toLowerCase()).filter(e => e !== senderEmail?.toLowerCase());
  } else {
    // DM / group channel — use explicit membership list
    const rows = await db
      .select({ memberId: channelMembersTable.memberId })
      .from(channelMembersTable)
      .where(and(
        eq(channelMembersTable.channelId, channelId),
        eq(channelMembersTable.memberType, "parent"),
      ));
    recipientEmails = rows.map(r => r.memberId.toLowerCase()).filter(e => e !== senderEmail?.toLowerCase());
  }

  if (recipientEmails.length === 0) return;

  // Web push
  await Promise.allSettled(
    recipientEmails.map(email => sendWebPushToEmail(email, { title, body, url, tag }))
  );

  // Expo push
  const devices = await db
    .select({ expoPushToken: parentDevicesTable.expoPushToken })
    .from(parentDevicesTable)
    .where(inArray(parentDevicesTable.email, recipientEmails));

  if (devices.length > 0) {
    await sendExpoPushNotifications(devices.map(d => ({
      to: d.expoPushToken,
      title,
      body,
      data: { channelId },
      sound: "default" as const,
    })));
  }
}

const router = Router();

// ─── Reaction summary helper ──────────────────────────────────────────────────

async function getReactionSummary(messageIds: number[]): Promise<Record<number, Record<string, number>>> {
  if (messageIds.length === 0) return {};
  const reactions = await db.select().from(messageReactionsTable)
    .where(inArray(messageReactionsTable.messageId, messageIds));
  const summary: Record<number, Record<string, number>> = {};
  for (const r of reactions) {
    if (!summary[r.messageId]) summary[r.messageId] = {};
    summary[r.messageId][r.emoji] = (summary[r.messageId][r.emoji] ?? 0) + 1;
  }
  return summary;
}

// ─── Attachment helper ────────────────────────────────────────────────────────

async function getAttachmentsByMessage(messageIds: number[]) {
  if (messageIds.length === 0) return {} as Record<number, (typeof messageAttachmentsTable.$inferSelect)[]>;
  const atts = await db.select().from(messageAttachmentsTable)
    .where(inArray(messageAttachmentsTable.messageId, messageIds));
  const byMsg: Record<number, (typeof messageAttachmentsTable.$inferSelect)[]> = {};
  for (const a of atts) {
    if (!byMsg[a.messageId]) byMsg[a.messageId] = [];
    byMsg[a.messageId].push(a);
  }
  return byMsg;
}

// ─── GET /api/channels/:id/messages ──────────────────────────────────────────

router.get("/channels/:id/messages", async (req, res): Promise<void> => {
  try {
    const caller = await resolveCaller(req);
    if (!caller) { res.status(401).json({ error: "Unauthorized" }); return; }

    const channelId = parseInt(req.params["id"] as string, 10);
    if (!await canAccessChannel(channelId, caller)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    const limit = Math.min(parseInt(String(req.query["limit"] ?? 40), 10), 100);
    const beforeRaw = req.query["before"];
    const before = beforeRaw ? parseInt(String(beforeRaw), 10) : null;

    const conditions = [
      eq(messagesTable.channelId, channelId),
      isNull(messagesTable.parentMessageId),
      isNull(messagesTable.deletedAt),
      ...(before ? [lt(messagesTable.id, before)] : []),
    ];

    const msgs = await db.select().from(messagesTable)
      .where(and(...conditions as [any, ...any[]]))
      .orderBy(desc(messagesTable.id))
      .limit(limit);

    const ids = msgs.map(m => m.id);
    const [reactions, attachments] = await Promise.all([
      getReactionSummary(ids),
      getAttachmentsByMessage(ids),
    ]);

    // Reply counts
    const replyCounts: Record<number, number> = {};
    if (ids.length > 0) {
      const replies = await db.select({ parentMessageId: messagesTable.parentMessageId })
        .from(messagesTable)
        .where(and(
          inArray(messagesTable.parentMessageId as any, ids),
          isNull(messagesTable.deletedAt),
        ));
      for (const r of replies) {
        if (r.parentMessageId) replyCounts[r.parentMessageId] = (replyCounts[r.parentMessageId] ?? 0) + 1;
      }
    }

    res.json(msgs.map(m => ({
      ...m,
      reactions: reactions[m.id] ?? {},
      attachments: attachments[m.id] ?? [],
      replyCount: replyCounts[m.id] ?? 0,
    })));
  } catch (err) {
    console.error("GET /channels/:id/messages error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/channels/:id/messages ─────────────────────────────────────────

router.post("/channels/:id/messages", async (req, res): Promise<void> => {
  try {
    const caller = await resolveCaller(req);
    if (!caller) { res.status(401).json({ error: "Unauthorized" }); return; }

    const channelId = parseInt(req.params["id"] as string, 10);
    if (!await canAccessChannel(channelId, caller)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    const { content, parentMessageId, attachments } = req.body as {
      content?: string;
      parentMessageId?: number;
      attachments?: { objectPath: string; mimeType: string; fileName: string }[];
    };

    // Parents may not create top-level posts on noticeboard channels.
    // Replies (parentMessageId set) are allowed on any accessible channel.
    if (caller.kind === "parent" && !parentMessageId) {
      const [channel] = await db
        .select({ type: channelsTable.type })
        .from(channelsTable)
        .where(eq(channelsTable.id, channelId));
      if (channel?.type === "noticeboard") {
        res.status(403).json({
          error: "Parents cannot post top-level messages to notice board channels",
        });
        return;
      }
    }

    if (!content?.trim() && (!attachments || attachments.length === 0)) {
      res.status(400).json({ error: "Message must have content or at least one attachment" });
      return;
    }

    // Validate parentMessageId: must exist, be non-deleted, be a top-level message
    // (no nested threads), and belong to the same channel.
    if (parentMessageId != null) {
      const [parent] = await db.select().from(messagesTable).where(
        and(
          eq(messagesTable.id, parentMessageId),
          isNull(messagesTable.deletedAt),
        ),
      );
      if (!parent) {
        res.status(400).json({ error: "parentMessageId not found or has been deleted" });
        return;
      }
      if (parent.channelId !== channelId) {
        res.status(400).json({ error: "parentMessageId belongs to a different channel" });
        return;
      }
      if (parent.parentMessageId != null) {
        res.status(400).json({ error: "Cannot reply to a reply — only top-level messages may have threads" });
        return;
      }
    }

    const [msg] = await db.insert(messagesTable).values({
      channelId,
      senderStaffId: caller.kind === "staff" ? caller.userId : null,
      senderParentId: caller.kind === "parent" ? caller.email : null,
      senderName: caller.name,
      content: content?.trim() ?? "",
      parentMessageId: parentMessageId ?? null,
    }).returning();

    let savedAttachments: (typeof messageAttachmentsTable.$inferSelect)[] = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
      // Validate each objectPath against an unconsumed upload grant issued to
      // the same caller.  This prevents a caller from referencing paths they
      // never uploaded or from re-using a path from a different upload session.
      for (const a of attachments) {
        const [grant] = await db.select().from(uploadGrantsTable)
          .where(
            and(
              eq(uploadGrantsTable.objectPath, a.objectPath),
              isNull(uploadGrantsTable.consumedAt),              // not already used
              // Caller-ownership check
              caller.kind === "staff"
                ? eq(uploadGrantsTable.uploaderStaffId,  caller.userId)
                : eq(uploadGrantsTable.uploaderParentId, caller.email),
            ),
          );

        if (!grant) {
          // Roll back the message we just inserted so no orphan rows remain
          await db.delete(messagesTable).where(eq(messagesTable.id, msg.id));
          res.status(400).json({
            error: `No valid upload grant found for objectPath: ${a.objectPath}`,
          });
          return;
        }

        if (grant.expiresAt < new Date()) {
          await db.delete(messagesTable).where(eq(messagesTable.id, msg.id));
          res.status(400).json({ error: `Upload grant for ${a.objectPath} has expired` });
          return;
        }
      }

      // All grants valid — consume them and create attachment records atomically
      for (const a of attachments) {
        await db.update(uploadGrantsTable)
          .set({ consumedAt: new Date() })
          .where(eq(uploadGrantsTable.objectPath, a.objectPath));
      }

      savedAttachments = await db.insert(messageAttachmentsTable).values(
        attachments.map(a => ({
          messageId: msg.id,
          objectPath: a.objectPath,
          mimeType: a.mimeType,
          fileName: a.fileName,
        }))
      ).returning();
    }

    const payload = { ...msg, reactions: {}, attachments: savedAttachments, replyCount: 0 };
    pubSub.publish({ type: "message", channelId, data: payload });

    // Fire-and-forget web push to parent members of this channel
    if (!parentMessageId) {
      notifyChannelParentsNewMessage(
        channelId, caller, msg.senderName ?? "Staff", content?.trim() ?? "",
      ).catch(() => {});
    }

    res.status(201).json(payload);
  } catch (err) {
    console.error("POST /channels/:id/messages error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/messages/:id/thread ────────────────────────────────────────────

router.get("/messages/:id/thread", async (req, res): Promise<void> => {
  try {
    const caller = await resolveCaller(req);
    if (!caller) { res.status(401).json({ error: "Unauthorized" }); return; }

    const parentId = parseInt(req.params["id"] as string, 10);
    const [parent] = await db.select().from(messagesTable)
      .where(and(eq(messagesTable.id, parentId), isNull(messagesTable.deletedAt)));
    if (!parent) { res.status(404).json({ error: "Message not found" }); return; }

    if (!await canAccessChannel(parent.channelId, caller)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    const replies = await db.select().from(messagesTable)
      .where(and(eq(messagesTable.parentMessageId, parentId), isNull(messagesTable.deletedAt)))
      .orderBy(asc(messagesTable.createdAt));

    const allIds = [parentId, ...replies.map(r => r.id)];
    const [reactions, attachments] = await Promise.all([
      getReactionSummary(allIds),
      getAttachmentsByMessage(allIds),
    ]);

    const enrich = (m: typeof parent) => ({
      ...m,
      reactions: reactions[m.id] ?? {},
      attachments: attachments[m.id] ?? [],
    });

    res.json({ parent: enrich(parent), replies: replies.map(enrich) });
  } catch (err) {
    console.error("GET /messages/:id/thread error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/messages/:id/reactions  (toggle — same endpoint adds or removes) ───

router.post("/messages/:id/reactions", async (req, res): Promise<void> => {
  try {
    const caller = await resolveCaller(req);
    if (!caller) { res.status(401).json({ error: "Unauthorized" }); return; }

    const messageId = parseInt(req.params["id"] as string, 10);
    const { emoji } = req.body as { emoji?: string };
    if (!emoji) { res.status(400).json({ error: "emoji is required" }); return; }

    const [msg] = await db.select().from(messagesTable)
      .where(and(eq(messagesTable.id, messageId), isNull(messagesTable.deletedAt)));
    if (!msg) { res.status(404).json({ error: "Message not found" }); return; }

    if (!await canAccessChannel(msg.channelId, caller)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    const staffId  = caller.kind === "staff"  ? caller.userId : null;
    const parentId = caller.kind === "parent" ? caller.email  : null;

    const matchCondition = staffId
      ? and(
          eq(messageReactionsTable.messageId, messageId),
          eq(messageReactionsTable.emoji, emoji),
          eq(messageReactionsTable.reactorStaffId, staffId),
        )
      : and(
          eq(messageReactionsTable.messageId, messageId),
          eq(messageReactionsTable.emoji, emoji),
          eq(messageReactionsTable.reactorParentId, parentId!),
        );

    const [existing] = await db.select().from(messageReactionsTable).where(matchCondition);

    if (existing) {
      await db.delete(messageReactionsTable).where(eq(messageReactionsTable.id, existing.id));
      pubSub.publish({
        type: "reaction_removed",
        channelId: msg.channelId,
        data: { messageId, emoji, reactorStaffId: staffId, reactorParentId: parentId },
      });
      res.json({ toggled: "off" });
    } else {
      const [reaction] = await db.insert(messageReactionsTable).values({
        messageId, emoji, reactorStaffId: staffId, reactorParentId: parentId,
      }).returning();
      pubSub.publish({ type: "reaction", channelId: msg.channelId, data: reaction });
      res.status(201).json(reaction);
    }
  } catch (err) {
    console.error("POST /messages/:id/reactions error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /api/messages/:id/reactions/:emoji ────────────────────────────────

router.delete("/messages/:id/reactions/:emoji", async (req, res): Promise<void> => {
  try {
    const caller = await resolveCaller(req);
    if (!caller) { res.status(401).json({ error: "Unauthorized" }); return; }

    const messageId = parseInt(req.params["id"] as string, 10);
    const emoji = decodeURIComponent(req.params["emoji"] as string);

    const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId));
    if (!msg) { res.status(404).json({ error: "Message not found" }); return; }

    if (!await canAccessChannel(msg.channelId, caller)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    const staffId  = caller.kind === "staff"  ? caller.userId : null;
    const parentId = caller.kind === "parent" ? caller.email  : null;

    await db.delete(messageReactionsTable).where(
      staffId
        ? and(
            eq(messageReactionsTable.messageId, messageId),
            eq(messageReactionsTable.emoji, emoji),
            eq(messageReactionsTable.reactorStaffId, staffId),
          )
        : and(
            eq(messageReactionsTable.messageId, messageId),
            eq(messageReactionsTable.emoji, emoji),
            eq(messageReactionsTable.reactorParentId, parentId!),
          ),
    );
    pubSub.publish({ type: "reaction_removed", channelId: msg.channelId, data: { messageId, emoji } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/messages/stream ─────────────────────────────────────────────────
// SSE — must be registered before /:id routes to avoid matching "stream" as an id.

router.get("/messages/stream", async (req, res): Promise<void> => {
  const caller = await resolveCaller(req).catch(() => null);
  if (!caller) { res.status(401).json({ error: "Unauthorized" }); return; }

  const raw = String(req.query["channelIds"] ?? "");
  const channelIds = raw.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);

  const accessChecks = await Promise.all(channelIds.map(id => canAccessChannel(id, caller)));
  const allowed = channelIds.filter((_, i) => accessChecks[i]);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: "connected", channelIds: allowed })}\n\n`);

  const listener = (ev: any) => { res.write(`data: ${JSON.stringify(ev)}\n\n`); };
  pubSub.subscribeChannels(allowed, listener);

  const heartbeat = setInterval(() => { res.write(": heartbeat\n\n"); }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    pubSub.unsubscribeChannels(allowed, listener);
  });
});

export default router;

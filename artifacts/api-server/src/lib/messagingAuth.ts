import { normAgeGroup } from "../middlewares/auth";
/**
 * Shared auth helpers for messaging routes.
 * Correctly verifies that a Clerk userId exists in staffTable before granting
 * staff-level access; falls back to parent-token auth.
 */

import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  staffTable,
  parentTokensTable,
  membersTable,
  channelsTable,
  channelMembersTable,
} from "@workspace/db";
import { eq, and, gt, sql } from "drizzle-orm";
import type { Request } from "express";

export type Caller =
  | { kind: "staff";  userId: string; name: string }
  | { kind: "parent"; email: string;  name: string };

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7);
  return typeof req.query.token === "string" ? req.query.token : null;
}

/**
 * Resolve the authenticated caller.
 *  - Staff: must have a valid Clerk session AND a matching row in kjihc_staff.
 *  - Parent: must present a non-expired parent token.
 * Returns null if neither applies.
 */
export async function resolveCaller(req: Request): Promise<Caller | null> {
  const clerkAuth = getAuth(req);

  if (clerkAuth?.userId) {
    // Verify the Clerk user is actually a registered staff member
    const [staffRow] = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.clerkUserId, clerkAuth.userId));

    if (staffRow) {
      return { kind: "staff", userId: clerkAuth.userId, name: staffRow.staffName ?? "Staff" };
    }
    // Clerk session exists but user is not staff — fall through to parent auth.
    // (Handles the edge case of a Clerk account that is not a club staff member.)
  }

  const token = extractBearerToken(req);
  if (token) {
    const [tokenRow] = await db
      .select()
      .from(parentTokensTable)
      .where(and(eq(parentTokensTable.token, token), gt(parentTokensTable.expiresAt, new Date())));

    if (tokenRow?.email) {
      const [child] = await db
        .select({ playerParent: membersTable.playerParent })
        .from(membersTable)
        .where(sql`lower(${membersTable.playerEmail}) = lower(${tokenRow.email})`);

      return {
        kind: "parent",
        email: tokenRow.email,
        name: child?.playerParent ?? "Parent",
      };
    }
  }

  return null;
}

/**
 * Check whether the given caller may read/write in a channel.
 *
 *  Staff     → always allowed (they manage all channels).
 *  Parent    → noticeboard channels: club-wide (ageGroup IS NULL) or matching their
 *               child's age group; direct/group channels: must be an explicit member.
 */
export async function canAccessChannel(channelId: number, caller: Caller): Promise<boolean> {
  const [channel] = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.id, channelId));

  if (!channel) return false;
  if (caller.kind === "staff") return true;

  if (channel.type === "noticeboard") {
    if (!channel.ageGroup) return true; // club-wide — all parents may read/reply
    const children = await db
      .select({ ageGroup: membersTable.ageGroup })
      .from(membersTable)
      .where(sql`lower(${membersTable.playerEmail}) = lower(${caller.email})`);
    return children.some(c => normAgeGroup(c.ageGroup) === normAgeGroup(channel.ageGroup));
  }

  // direct / group — parent must be an explicit channel member
  const [membership] = await db
    .select()
    .from(channelMembersTable)
    .where(
      and(
        eq(channelMembersTable.channelId, channelId),
        eq(channelMembersTable.memberId, caller.email),
        eq(channelMembersTable.memberType, "parent"),
      ),
    );
  return !!membership;
}

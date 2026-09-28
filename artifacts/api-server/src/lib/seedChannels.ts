import { db } from "@workspace/db";
import { channelsTable, channelMembersTable, staffTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const AGE_GROUPS = ["LTP", "u10", "u12", "u14", "u16", "u19", "lightning"];

const AGE_LABELS: Record<string, string> = {
  LTP: "LTP Notice Board",
  u10: "U10 Notice Board",
  u12: "U12 Notice Board",
  u14: "U14 Notice Board",
  u16: "U16 Notice Board",
  u19: "U19 Notice Board",
  lightning: "Lightning Notice Board",
};

export async function seedDefaultChannels() {
  // Club-wide noticeboard
  const [existing] = await db
    .select()
    .from(channelsTable)
    .where(and(eq(channelsTable.type, "noticeboard"), eq(channelsTable.name, "Club Announcements")));

  if (!existing) {
    await db.insert(channelsTable).values({
      type: "noticeboard",
      name: "Club Announcements",
      ageGroup: null,
      createdByStaffId: null,
    });
  }

  // Per-age-group noticeboards
  for (const ag of AGE_GROUPS) {
    const label = AGE_LABELS[ag];
    const [exists] = await db
      .select()
      .from(channelsTable)
      .where(and(eq(channelsTable.type, "noticeboard"), eq(channelsTable.ageGroup, ag)));
    if (!exists) {
      await db.insert(channelsTable).values({
        type: "noticeboard",
        name: label,
        ageGroup: ag,
        createdByStaffId: null,
      });
    }
  }

  // Staff team channel — one shared chat for all staff
  const [staffChannel] = await db
    .select()
    .from(channelsTable)
    .where(and(eq(channelsTable.type, "staff"), eq(channelsTable.name, "Staff Team")));

  let staffChannelId: number;
  if (!staffChannel) {
    const [created] = await db.insert(channelsTable).values({
      type: "staff",
      name: "Staff Team",
      ageGroup: null,
      createdByStaffId: null,
    }).returning();
    staffChannelId = created.id;
  } else {
    staffChannelId = staffChannel.id;
  }

  // Ensure every existing staff member is in the channel
  const allStaff = await db.select({ id: staffTable.id }).from(staffTable);
  for (const s of allStaff) {
    await db.insert(channelMembersTable).values({
      channelId: staffChannelId,
      memberId: String(s.id),
      memberType: "staff",
    }).onConflictDoNothing();
  }
}

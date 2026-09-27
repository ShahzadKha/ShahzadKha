import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getRetentionSettings } from "@/lib/settings";

const MONTH = 30 * 24 * 60 * 60 * 1000;

// Candidates with nothing happening for `months`: not customers, record untouched, no event since
export function inactiveWhere(months: number, now = Date.now()): Prisma.CandidateWhereInput {
  const cutoff = new Date(now - months * MONTH);
  return { status: { not: "WON" }, updatedAt: { lt: cutoff }, events: { none: { createdAt: { gte: cutoff } } } };
}

/** Runs from the daily scheduler. Returns how many candidates were deleted. */
export async function applyRetention() {
  const settings = await getRetentionSettings();
  if (!settings.enabled) return 0;
  let deleted = 0;
  for (let i = 0; i < 20; i++) {
    const batch = await db.candidate.findMany({ where: inactiveWhere(settings.months), select: { id: true }, take: 200 });
    if (batch.length === 0) break;
    deleted += (await db.candidate.deleteMany({ where: { id: { in: batch.map((c) => c.id) } } })).count;
  }
  const value = { at: new Date().toISOString(), deleted };
  await db.setting.upsert({ where: { key: "retentionLastRun" }, create: { key: "retentionLastRun", value }, update: { value } });
  return deleted;
}

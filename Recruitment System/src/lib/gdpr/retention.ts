import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getRetentionSettings } from "@/lib/settings";
import { deleteContacts } from "@/lib/integrations/acumbamail";

const MONTH = 30 * 24 * 60 * 60 * 1000;

// Candidates with nothing happening for `months`: not customers, record untouched, no event since
export function inactiveWhere(months: number, now = Date.now()): Prisma.CandidateWhereInput {
  const cutoff = new Date(now - months * MONTH);
  return { status: { not: "WON" }, updatedAt: { lt: cutoff }, events: { none: { createdAt: { gte: cutoff } } } };
}

/**
 * GDPR erasure. Deletes the candidates with everything linked to them (CV, emails, calls, payments,
 * history), plus the traces kept elsewhere: inbox log, team notifications, the email given by
 * the customer who recommended them, and the Acumbamail contact.
 */
export async function eraseCandidates(ids: string[]) {
  if (ids.length === 0) return 0;
  const rows = await db.candidate.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } });
  const found = rows.map((r) => r.id);
  const emails = rows.map((r) => r.email);
  await deleteContacts(emails);
  const [, , , deleted] = await db.$transaction([
    db.notification.deleteMany({ where: { link: { in: found.flatMap((id) => [`/candidates/${id}`, `/sdr/appel/${id}`]) } } }),
    db.inboundEmail.deleteMany({ where: { OR: [{ candidateId: { in: found } }, { fromEmail: { in: emails } }] } }),
    db.feedback.updateMany({ where: { referralEmail: { in: emails } }, data: { referralName: null, referralEmail: null } }),
    db.candidate.deleteMany({ where: { id: { in: found } } }),
  ]);
  return deleted.count;
}

/** Runs from the daily scheduler. Returns how many candidates were deleted. */
export async function applyRetention() {
  const settings = await getRetentionSettings();
  if (!settings.enabled) return 0;
  let deleted = 0;
  const started = Date.now();
  // Stops after ~3 minutes to stay within the scheduler's time limit; the rest goes the next day
  for (let i = 0; i < 20 && Date.now() - started < 180_000; i++) {
    const batch = await db.candidate.findMany({ where: inactiveWhere(settings.months), select: { id: true }, take: 200 });
    if (batch.length === 0) break;
    deleted += await eraseCandidates(batch.map((c) => c.id));
  }
  // The inbox log (senders' addresses) is kept no longer than the candidates
  await db.inboundEmail.deleteMany({ where: { processedAt: { lt: new Date(Date.now() - settings.months * MONTH) } } });
  const value = { at: new Date().toISOString(), deleted };
  await db.setting.upsert({ where: { key: "retentionLastRun" }, create: { key: "retentionLastRun", value }, update: { value } });
  return deleted;
}

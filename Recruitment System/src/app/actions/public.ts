"use server";

import { db } from "@/lib/db";
import { recordInterest, unsubscribe } from "@/lib/nurture/engine";

const TIMINGS = [14, 30, 60, 120];

// Offer page form: "I'm interested, call me back" with the wished start date
export async function requestCallback(publicToken: string, _prev: { ok: boolean } | undefined, formData: FormData) {
  const c = await db.candidate.findUnique({ where: { publicToken }, select: { id: true } });
  const timing = Number(formData.get("timing"));
  if (!c || !TIMINGS.includes(timing)) return { ok: false };
  await recordInterest(c.id, timing);
  return { ok: true };
}

export async function confirmUnsubscribe(publicToken: string) {
  const c = await db.candidate.findUnique({ where: { publicToken }, select: { id: true } });
  if (c) await unsubscribe(c.id);
  return { ok: true };
}

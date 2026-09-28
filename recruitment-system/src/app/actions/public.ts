"use server";

import { db } from "@/lib/db";
import { z } from "zod";
import { recordClick, recordInterest, recordPriceView, unsubscribe } from "@/lib/nurture/engine";
import { confirmPayment, recordFeedback } from "@/lib/closing/engine";
import { overLimit } from "@/lib/rate-limit";

const HOUR = 60 * 60 * 1000;

const TIMINGS = [14, 30, 60, 120];

// Offer page form: "I'm interested, call me back" with the wished start date
export async function requestCallback(publicToken: string, _prev: { ok: boolean } | undefined, formData: FormData) {
  const c = await db.candidate.findUnique({ where: { publicToken }, select: { id: true } });
  const timing = Number(formData.get("timing"));
  if (!c || !TIMINGS.includes(timing)) return { ok: false };
  if (await overLimit("callback", 10, HOUR)) return { ok: false };
  await recordInterest(c.id, timing);
  return { ok: true };
}

// Sent by the offer page once a real browser has shown it (not by mail scanners)
export async function recordOfferVisit(publicToken: string, messageToken: string | null) {
  const c = await db.candidate.findUnique({ where: { publicToken }, select: { id: true, recommendedProductId: true } });
  if (!c?.recommendedProductId) return;
  if (messageToken) {
    const m = await db.emailMessage.findFirst({ where: { token: messageToken, candidateId: c.id }, select: { id: true } });
    if (m) await recordClick(m.id);
  }
  await recordPriceView(c.id);
}

export async function confirmUnsubscribe(publicToken: string) {
  const c = await db.candidate.findUnique({ where: { publicToken }, select: { id: true } });
  if (c) await unsubscribe(c.id);
  return { ok: true };
}

// Demo checkout: confirms the payment the way the ThriveCart webhook would.
// Refused when the product has a real ThriveCart link, so nobody can "pay" for free.
export async function payDemo(publicToken: string) {
  const c = await db.candidate.findUnique({
    where: { publicToken },
    select: { id: true, status: true, recommendedProduct: { select: { checkoutUrl: true } } },
  });
  if (!c || !c.recommendedProduct || c.recommendedProduct.checkoutUrl) return { ok: false };
  if (c.status !== "WON") await confirmPayment({ candidateId: c.id, provider: "simulated", externalId: `demo-${c.id}` });
  return { ok: true };
}

const FeedbackSchema = z.object({
  nps: z.coerce.number().int().min(0).max(10),
  comment: z.string().trim().max(2000).transform((v) => v || null),
  publishConsent: z.boolean(),
  referralName: z.string().trim().max(80).transform((v) => v || null),
  referralEmail: z.union([z.literal(""), z.email().trim().toLowerCase()]).transform((v) => v || null),
});

export async function submitFeedback(publicToken: string, _prev: { ok: boolean } | undefined, formData: FormData) {
  const c = await db.candidate.findUnique({ where: { publicToken }, select: { id: true, status: true } });
  if (!c || c.status !== "WON") return { ok: false };
  const parsed = FeedbackSchema.safeParse({
    nps: formData.get("nps"),
    comment: formData.get("comment") ?? "",
    publishConsent: formData.get("publishConsent") === "on",
    referralName: formData.get("referralName") ?? "",
    referralEmail: formData.get("referralEmail") ?? "",
  });
  if (!parsed.success) return { ok: false };
  await recordFeedback(c.id, parsed.data);
  return { ok: true };
}

import "server-only";
import { db } from "@/lib/db";
import { getClosingSettings, getEmailSettings } from "@/lib/settings";
import type { EventType } from "@/generated/prisma/enums";
import { advanceStatus, ensureDefaultSequences, moveCandidate, sendDueSteps, sendEmail, stopEnrollment } from "@/lib/nurture/engine";
import { STATUS_RANK } from "@/lib/nurture/status";

const HOUR = 60 * 60 * 1000;

type Actor = { actorId?: string | null };

async function logEvent(candidateId: string, type: EventType, title: string, detail?: string | null, actorId?: string | null) {
  await db.candidateEvent.create({ data: { candidateId, type, title, detail: detail ?? null, actorId: actorId ?? null } });
}

export async function notify(userId: string, title: string, body?: string | null, link?: string | null) {
  await db.notification.create({ data: { userId, title, body: body ?? null, link: link ?? null } });
}

// The active SDR with the fewest open calls (ties: alphabetical)
async function pickSdr() {
  const sdrs = await db.user.findMany({
    where: { role: "SDR", active: true },
    select: { id: true, name: true, _count: { select: { tasks: { where: { status: "OPEN" } } } } },
    orderBy: { name: "asc" },
  });
  sdrs.sort((a, b) => a._count.tasks - b._count.tasks);
  return sdrs[0] ?? null;
}

/**
 * Step 19 — Handoff SDR: assign the candidate, create the closing call task and notify the SDR.
 */
export async function assignSdr(candidateId: string, opts: Actor & { sdrId?: string } = {}) {
  const [c, settings] = await Promise.all([
    db.candidate.findUnique({ where: { id: candidateId }, include: { recommendedProduct: { select: { name: true } } } }),
    getClosingSettings(),
  ]);
  if (!c || c.status === "WON" || c.status === "LOST") return null;
  const sdr = opts.sdrId
    ? await db.user.findFirst({ where: { id: opts.sdrId, role: "SDR", active: true }, select: { id: true, name: true } })
    : await pickSdr();
  if (!sdr) return null;

  // Reassigning: open calls move to the new SDR
  await db.callTask.updateMany({ where: { candidateId, status: "OPEN" }, data: { status: "CANCELLED", completedAt: new Date() } });
  await db.callTask.create({
    data: { candidateId, sdrId: sdr.id, kind: "closing", dueAt: new Date(Date.now() + settings.callSlaHours * HOUR) },
  });
  await db.candidate.update({ where: { id: candidateId }, data: { assignedSdrId: sdr.id } });
  await stopEnrollment(candidateId, "Transmis au SDR", opts);

  const moved = await advanceStatus(candidateId, "SDR_ASSIGNED", {
    type: "SDR_ASSIGNED",
    title: "Assigné à un SDR",
    detail: sdr.name,
    actorId: opts.actorId,
  });
  if (!moved) await logEvent(candidateId, "SDR_ASSIGNED", "Assigné à un SDR", sdr.name, opts.actorId);

  await notify(
    sdr.id,
    `Nouveau candidat à appeler : ${c.firstName} ${c.lastName}`,
    c.recommendedProduct ? `Prêt à acheter — ${c.recommendedProduct.name}` : null,
    `/sdr/appel/${candidateId}`,
  );
  return sdr;
}

export async function autoAssignIfEnabled(candidateId: string) {
  const settings = await getClosingSettings();
  if (settings.autoAssign) await assignSdr(candidateId);
}

export type CallOutcome = "payment_link" | "callback" | "nurture" | "lost";

export const BLOCKERS = ["price", "financing", "time", "level", "timing", "none"] as const;
export type Blocker = (typeof BLOCKERS)[number];

const BLOCKER_LABEL: Record<Blocker, string> = {
  price: "Prix",
  financing: "Financement",
  time: "Disponibilité",
  level: "Niveau",
  timing: "Date de démarrage",
  none: "Aucun",
};

/**
 * Steps 20–21 — the SDR logs the result of the call.
 */
export async function logCall(
  candidateId: string,
  input: { outcome: CallOutcome; notes: string | null; durationMin: number | null; blocker: Blocker; callbackAt?: Date | null; lostReason?: string | null },
  actor: { actorId: string },
) {
  const c = await db.candidate.findUnique({ where: { id: candidateId }, select: { id: true, assignedSdrId: true } });
  if (!c) return;
  const now = new Date();
  const summary = [
    input.durationMin ? `Appel de ${input.durationMin} min` : "Appel",
    input.blocker !== "none" ? `blocage : ${BLOCKER_LABEL[input.blocker]}` : null,
    input.notes,
  ]
    .filter(Boolean)
    .join(" — ");

  await db.callTask.updateMany({
    where: { candidateId, status: "OPEN" },
    data: { status: "DONE", completedAt: now, outcome: input.outcome, notes: input.notes },
  });

  if (input.outcome === "payment_link") {
    const moved = await advanceStatus(candidateId, "CALL_COMPLETED", { type: "CALL_LOGGED", title: "Appel de closing", detail: summary, actorId: actor.actorId });
    if (!moved) await logEvent(candidateId, "CALL_LOGGED", "Appel de closing", summary, actor.actorId);
    await sendPaymentLink(candidateId, actor);
  } else if (input.outcome === "callback") {
    const due = input.callbackAt && input.callbackAt > now ? input.callbackAt : new Date(now.getTime() + 24 * HOUR);
    await logEvent(candidateId, "CALL_LOGGED", "Rappel planifié", `${summary} · rappel le ${due.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`, actor.actorId);
    await db.callTask.create({ data: { candidateId, sdrId: c.assignedSdrId ?? actor.actorId, kind: "callback", dueAt: due } });
  } else if (input.outcome === "nurture") {
    await logEvent(candidateId, "CALL_LOGGED", "Appel — pas maintenant", summary, actor.actorId);
    await moveCandidate(candidateId, "NURTURE", actor);
  } else {
    await logEvent(candidateId, "CALL_LOGGED", "Appel — perdu", summary, actor.actorId);
    await moveCandidate(candidateId, "LOST", actor);
    if (input.lostReason) await logEvent(candidateId, "NOTE", "Raison de la perte", input.lostReason, actor.actorId);
  }
}

/** Step 22 — email the secure payment link (ThriveCart checkout, or the demo checkout page). */
export async function sendPaymentLink(candidateId: string, actor: Actor = {}) {
  const settings = await getEmailSettings();
  const message = await sendEmail(candidateId, { subject: settings.paymentSubject, body: settings.paymentBody }, { kind: "payment" });
  if (message) await logEvent(candidateId, "PAYMENT_LINK_SENT", "Lien de paiement envoyé", message.subject, actor.actorId);
}

/**
 * Step 23 — payment confirmed (ThriveCart webhook or demo checkout). Safe to call twice for the same order.
 */
export async function confirmPayment(input: {
  candidateId: string;
  amount?: number | null;
  provider: "thrivecart" | "simulated";
  externalId?: string | null;
  raw?: object;
}) {
  if (input.externalId && (await db.payment.findUnique({ where: { externalId: input.externalId } }))) return { duplicate: true };
  const c = await db.candidate.findUnique({ where: { id: input.candidateId }, include: { recommendedProduct: true } });
  if (!c) return { duplicate: false };
  const product = c.recommendedProduct;
  const amount = input.amount ?? product?.price ?? 0;

  await db.payment.create({
    data: {
      candidateId: c.id,
      productId: product?.id ?? null,
      amount,
      provider: input.provider,
      externalId: input.externalId ?? null,
      raw: input.raw ? JSON.parse(JSON.stringify(input.raw)) : undefined,
    },
  });
  await db.callTask.updateMany({ where: { candidateId: c.id, status: "OPEN" }, data: { status: "DONE", completedAt: new Date(), outcome: "paid" } });
  await stopEnrollment(c.id, "Paiement confirmé");

  const label = `${input.provider === "thrivecart" ? "ThriveCart" : "Paiement démo"} — ${product?.name ?? "Formation"} (${amount} €)`;
  if (c.status === "WON") {
    await logEvent(c.id, "PAYMENT_CONFIRMED", "Paiement confirmé", label);
  } else {
    // A payment always wins, even from "lost" or "nurture"
    await db.candidate.update({ where: { id: c.id }, data: { status: "WON" } });
    await db.candidateEvent.create({ data: { candidateId: c.id, type: "PAYMENT_CONFIRMED", title: "Paiement confirmé", detail: label, toStatus: "WON" } });
  }
  if (c.assignedSdrId) {
    await notify(c.assignedSdrId, `Vente gagnée : ${c.firstName} ${c.lastName}`, label, `/candidates/${c.id}`);
  }
  await startOnboarding(c.id);
  return { duplicate: false };
}

/** Step 24 — welcome email right away, then coaching (25) and testimonial request (26). */
export async function startOnboarding(candidateId: string) {
  await ensureDefaultSequences();
  const sequence = await db.emailSequence.findFirst({
    where: { kind: "ONBOARDING", active: true },
    include: { _count: { select: { steps: true } } },
  });
  if (!sequence || sequence._count.steps === 0) return;
  const c = await db.candidate.findUnique({ where: { id: candidateId }, select: { unsubscribedAt: true } });
  if (c?.unsubscribedAt) return;

  const now = new Date();
  const data = { sequenceId: sequence.id, status: "ACTIVE" as const, stepsSent: 0, startedAt: now, nextSendAt: now, endedAt: null, endReason: null };
  const enrollment = await db.enrollment.upsert({ where: { candidateId }, create: { candidateId, ...data }, update: data });
  await logEvent(candidateId, "SEQUENCE_STARTED", "Onboarding démarré", sequence.name);
  await sendDueSteps(enrollment.id, now);
}

/** Step 26 — NPS, testimonial and referral, from the candidate's feedback page. */
export async function recordFeedback(
  candidateId: string,
  input: { nps: number; comment: string | null; publishConsent: boolean; referralName: string | null; referralEmail: string | null },
) {
  const data = { ...input };
  await db.feedback.upsert({ where: { candidateId }, create: { candidateId, ...data }, update: data });
  const detail = [`NPS ${input.nps}/10`, input.comment ? `« ${input.comment.slice(0, 200)} »` : null, input.referralEmail ? `Recommande ${input.referralName ?? ""} (${input.referralEmail})` : null]
    .filter(Boolean)
    .join(" · ");
  await logEvent(candidateId, "FEEDBACK_RECEIVED", "Avis reçu", detail);
  const c = await db.candidate.findUnique({ where: { id: candidateId }, select: { assignedSdrId: true, firstName: true, lastName: true } });
  if (c?.assignedSdrId) await notify(c.assignedSdrId, `Avis de ${c.firstName} ${c.lastName} : ${input.nps}/10`, input.comment, `/candidates/${candidateId}`);
}

export const isClosingStage = (status: keyof typeof STATUS_RANK) =>
  STATUS_RANK[status] >= STATUS_RANK.PURCHASE_READY && STATUS_RANK[status] < STATUS_RANK.WON;

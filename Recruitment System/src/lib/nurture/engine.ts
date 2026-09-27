import "server-only";
import { db } from "@/lib/db";
import { getBrand, getEmailSettings, getScoringRules } from "@/lib/settings";
import { purchaseReadyConditions } from "@/lib/rules";
import type { CandidateStatus, EventType } from "@/generated/prisma/enums";
import { appUrl, deliver } from "./mailer";
import { renderEmail, type TemplateVars } from "./render";
import { STATUS_RANK, canAdvance, shouldRecycle } from "./status";

const DAY = 24 * 60 * 60 * 1000;

type Actor = { actorId?: string | null };

async function logEvent(candidateId: string, type: EventType, title: string, detail?: string | null, extra: { toStatus?: CandidateStatus } & Actor = {}) {
  await db.candidateEvent.create({
    data: { candidateId, type, title, detail: detail ?? null, toStatus: extra.toStatus, actorId: extra.actorId ?? null },
  });
}

/** Move a candidate forward in the funnel (never backwards, never out of WON/LOST). */
export async function advanceStatus(candidateId: string, to: CandidateStatus, reason: { type?: EventType; title: string; detail?: string | null } & Actor) {
  const c = await db.candidate.findUnique({ where: { id: candidateId }, select: { status: true } });
  if (!c || !canAdvance(c.status, to)) return false;
  await db.candidate.update({ where: { id: candidateId }, data: { status: to } });
  await logEvent(candidateId, reason.type ?? "STATUS_CHANGED", reason.title, reason.detail, { toStatus: to, actorId: reason.actorId });
  return true;
}

async function templateVars(candidateId: string): Promise<{ vars: TemplateVars; to: string; fromName: string } | null> {
  const c = await db.candidate.findUnique({
    where: { id: candidateId },
    include: { recommendedProduct: true },
  });
  if (!c) return null;
  const brand = await getBrand();
  const price = c.recommendedProduct
    ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(c.recommendedProduct.price)
    : "";
  return {
    to: c.email,
    fromName: brand.name,
    vars: {
      prenom: c.firstName,
      nom: c.lastName,
      produit: c.recommendedProduct?.name ?? "",
      prix: price,
      poste: c.currentTitle ?? "",
      marque: brand.name,
      lien_offre: "", // set per message (tracked link)
    },
  };
}

/** Render, send (or simulate) and store one email. */
async function sendEmail(candidateId: string, template: { subject: string; body: string }, meta: { stepId?: string; kind: "sequence" | "offer" }) {
  const ctx = await templateVars(candidateId);
  const candidate = await db.candidate.findUnique({ where: { id: candidateId }, select: { publicToken: true } });
  if (!ctx || !candidate) return null;

  // Create the row first so its token can be used in the tracking links
  const message = await db.emailMessage.create({
    data: { candidateId, stepId: meta.stepId, kind: meta.kind, toEmail: ctx.to, subject: "", body: "", provider: "pending" },
  });
  const base = appUrl();
  const vars = { ...ctx.vars, lien_offre: `${base}/api/t/c/${message.token}` };
  const email = renderEmail(template, vars, {
    unsubscribe: `${base}/desinscription/${candidate.publicToken}`,
    openPixel: `${base}/api/t/o/${message.token}`,
  });

  let provider = "simulated";
  let error: string | null = null;
  try {
    provider = (await deliver({ to: ctx.to, subject: email.subject, text: email.text, html: email.html, fromName: ctx.fromName })).provider;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    provider = "smtp";
  }
  await db.emailMessage.update({
    where: { id: message.id },
    data: { subject: email.subject, body: email.text, provider, error },
  });
  await logEvent(candidateId, "EMAIL_SENT", "Email envoyé", error ? `${email.subject} — échec : ${error}` : email.subject);
  return { ...message, subject: email.subject, error };
}

/**
 * Steps 10–11: put an eligible candidate into the sequence of their follow-up track
 * and send the first email right away (day 0).
 */
export async function enrollCandidate(candidateId: string, opts: Actor & { force?: boolean } = {}) {
  const [c, settings] = await Promise.all([
    db.candidate.findUnique({ where: { id: candidateId }, include: { enrollment: true } }),
    getEmailSettings(),
  ]);
  if (!c?.routingTrack || !c.eligible || c.unsubscribedAt) return { ok: false as const, reason: "not_eligible" };
  if (!opts.force && !settings.autoEnroll) return { ok: false as const, reason: "auto_enroll_off" };
  if (settings.requireConsent && !c.consentAt) {
    await logEvent(candidateId, "SEQUENCE_ENDED", "Séquence non démarrée", "Pas de consentement RGPD", opts);
    return { ok: false as const, reason: "no_consent" };
  }
  if (c.enrollment?.status === "ACTIVE") return { ok: false as const, reason: "already_active" };

  const sequence = await db.emailSequence.findUnique({
    where: { track: c.routingTrack },
    include: { steps: { orderBy: { order: "asc" }, take: 1 } },
  });
  if (!sequence?.active || sequence.steps.length === 0) return { ok: false as const, reason: "no_sequence" };

  const now = new Date();
  const data = { sequenceId: sequence.id, status: "ACTIVE" as const, stepsSent: 0, startedAt: now, nextSendAt: now, endedAt: null, endReason: null };
  const enrollment = await db.enrollment.upsert({
    where: { candidateId },
    create: { candidateId, ...data },
    update: data,
  });
  await logEvent(candidateId, "SEQUENCE_STARTED", "Séquence démarrée", sequence.name, opts);
  await sendDueSteps(enrollment.id, now);
  return { ok: true as const };
}

/** Send every step of an enrollment that is due at `now`. Returns how many emails were sent. */
export async function sendDueSteps(enrollmentId: string, now = new Date()) {
  let sent = 0;
  for (let guard = 0; guard < 20; guard++) {
    const e = await db.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { sequence: { include: { steps: { orderBy: { order: "asc" } } } } },
    });
    if (!e || e.status !== "ACTIVE" || !e.nextSendAt || e.nextSendAt > now) return sent;

    const steps = e.sequence.steps;
    const step = steps[e.stepsSent];
    if (!step) {
      await completeEnrollment(e.id, e.candidateId);
      return sent;
    }

    await sendEmail(e.candidateId, step, { stepId: step.id, kind: "sequence" });
    sent++;
    const next = steps[e.stepsSent + 1];
    await db.enrollment.update({
      where: { id: e.id },
      data: {
        stepsSent: { increment: 1 },
        nextSendAt: next ? new Date(e.startedAt.getTime() + next.dayOffset * DAY) : new Date(now.getTime() + 2 * DAY),
      },
    });

    if (e.stepsSent === 0) {
      await advanceStatus(e.candidateId, "EMAIL_1_SENT", { title: "Email 1 envoyé", detail: e.sequence.name });
    }
    if (step.isOffer) {
      await advanceStatus(e.candidateId, "OFFER_SENT", { title: "Offre envoyée", detail: step.subject });
    }
  }
  return sent;
}

// Sequence finished without a reply → recycle into nurturing (diagram "Nurturing / Recyclage")
async function completeEnrollment(enrollmentId: string, candidateId: string) {
  await db.enrollment.update({
    where: { id: enrollmentId },
    data: { status: "COMPLETED", endedAt: new Date(), nextSendAt: null, endReason: "Séquence terminée" },
  });
  await logEvent(candidateId, "SEQUENCE_ENDED", "Séquence terminée", "Tous les emails ont été envoyés");
  const c = await db.candidate.findUnique({ where: { id: candidateId }, select: { status: true, interestConfirmed: true, priceViewed: true } });
  if (c && shouldRecycle(c)) {
    await db.candidate.update({ where: { id: candidateId }, data: { status: "NURTURE" } });
    await logEvent(candidateId, "STATUS_CHANGED", "Recyclage", "Pas de réponse — retour en nurturing", { toStatus: "NURTURE" });
  }
}

export async function stopEnrollment(candidateId: string, reason: string, actor: Actor = {}) {
  const e = await db.enrollment.findUnique({ where: { candidateId } });
  if (!e || (e.status !== "ACTIVE" && e.status !== "PAUSED")) return;
  await db.enrollment.update({ where: { id: e.id }, data: { status: "STOPPED", endedAt: new Date(), nextSendAt: null, endReason: reason } });
  await logEvent(candidateId, "SEQUENCE_ENDED", "Séquence arrêtée", reason, actor);
}

export async function pauseEnrollment(candidateId: string, actor: Actor) {
  const e = await db.enrollment.findUnique({ where: { candidateId } });
  if (e?.status !== "ACTIVE") return;
  await db.enrollment.update({ where: { id: e.id }, data: { status: "PAUSED" } });
  await logEvent(candidateId, "SEQUENCE_ENDED", "Séquence en pause", "En pause", actor);
}

export async function resumeEnrollment(candidateId: string, actor: Actor) {
  const e = await db.enrollment.findUnique({ where: { candidateId } });
  if (e?.status !== "PAUSED") return;
  await db.enrollment.update({ where: { id: e.id }, data: { status: "ACTIVE" } });
  await logEvent(candidateId, "SEQUENCE_STARTED", "Séquence reprise", "Reprise", actor);
  await sendDueSteps(e.id);
}

/** Demo helper: send the next email now instead of waiting for its day. */
export async function sendNextNow(candidateId: string) {
  const e = await db.enrollment.findUnique({ where: { candidateId } });
  if (e?.status !== "ACTIVE" || !e.nextSendAt) return;
  const shift = Math.max(0, e.nextSendAt.getTime() - Date.now());
  await db.enrollment.update({
    where: { id: e.id },
    data: { startedAt: new Date(e.startedAt.getTime() - shift), nextSendAt: new Date(e.nextSendAt.getTime() - shift) },
  });
  await sendDueSteps(e.id);
}

/** Runs from the scheduler (cron) or the "run now" button. Returns how many emails were sent. */
export async function processDueEmails(now = new Date()) {
  const due = await db.enrollment.findMany({
    where: { status: "ACTIVE", nextSendAt: { lte: now } },
    select: { id: true },
    take: 200,
  });
  let sent = 0;
  for (const e of due) sent += await sendDueSteps(e.id, now);
  return sent;
}

/** Demo helper: pretend `days` have passed for every active sequence, then send what is due. */
export async function simulateDays(days: number) {
  const active = await db.enrollment.findMany({ where: { status: "ACTIVE" } });
  const shift = days * DAY;
  for (const e of active) {
    await db.enrollment.update({
      where: { id: e.id },
      data: { startedAt: new Date(e.startedAt.getTime() - shift), nextSendAt: e.nextSendAt ? new Date(e.nextSendAt.getTime() - shift) : null },
    });
  }
  return processDueEmails();
}

// ─── Engagement: what the candidate does with the emails ───────────────────────

export async function recordOpen(messageId: string) {
  const m = await db.emailMessage.findUnique({ where: { id: messageId } });
  if (!m || m.openedAt) return;
  await db.emailMessage.update({ where: { id: m.id }, data: { openedAt: new Date() } });
  await logEvent(m.candidateId, "EMAIL_OPENED", "Email ouvert", m.subject);
  await advanceStatus(m.candidateId, "ENGAGED", { title: "Engagé", detail: "Premier email ouvert" });
}

export async function recordClick(messageId: string) {
  const m = await db.emailMessage.findUnique({ where: { id: messageId } });
  if (!m) return null;
  const now = new Date();
  if (!m.clickedAt) {
    await db.emailMessage.update({ where: { id: m.id }, data: { clickedAt: now, openedAt: m.openedAt ?? now } });
    await logEvent(m.candidateId, "EMAIL_CLICKED", "Lien cliqué", m.subject);
  }
  await advanceStatus(m.candidateId, "ENGAGED", { title: "Engagé", detail: "Lien cliqué" });
  return m;
}

/** A reply stops the automatic sequence (steps 12–17 only run "si pas de réponse"). */
export async function recordReply(candidateId: string, positive: boolean, text: string | null, actor: Actor = {}) {
  const last = await db.emailMessage.findFirst({ where: { candidateId }, orderBy: { sentAt: "desc" } });
  if (last && !last.repliedAt) {
    await db.emailMessage.update({ where: { id: last.id }, data: { repliedAt: new Date(), openedAt: last.openedAt ?? new Date() } });
  }
  await logEvent(candidateId, "EMAIL_REPLIED", "Réponse reçue", text || (positive ? "Réponse positive" : "Réponse négative"), actor);
  await stopEnrollment(candidateId, "Réponse reçue");

  if (!positive) {
    await advanceStatus(candidateId, "LOST", { title: "Perdu", detail: "Pas intéressé(e)", ...actor });
    return;
  }
  await db.candidate.update({ where: { id: candidateId }, data: { interestConfirmed: true } });
  await advanceStatus(candidateId, "INTEREST_CONFIRMED", { title: "Intérêt confirmé", detail: "Réponse positive" });
  await sendOfferEmail(candidateId);
  await checkPurchaseReady(candidateId);
}

export async function sendOfferEmail(candidateId: string) {
  const settings = await getEmailSettings();
  const c = await db.candidate.findUnique({ where: { id: candidateId }, select: { unsubscribedAt: true, recommendedProductId: true } });
  if (!c || c.unsubscribedAt || !c.recommendedProductId) return;
  await sendEmail(candidateId, { subject: settings.offerSubject, body: settings.offerBody }, { kind: "offer" });
  await advanceStatus(candidateId, "OFFER_SENT", { title: "Offre envoyée", detail: "Offre personnalisée" });
}

/** The candidate opened their offer page, which shows the price. */
export async function recordPriceView(candidateId: string) {
  const c = await db.candidate.findUnique({ where: { id: candidateId }, select: { priceViewed: true } });
  if (!c) return;
  if (!c.priceViewed) {
    await db.candidate.update({ where: { id: candidateId }, data: { priceViewed: true } });
    await logEvent(candidateId, "PRICE_VIEWED", "Page prix consultée", "Page offre personnalisée");
  }
  await advanceStatus(candidateId, "PRICE_VIEWED", { title: "Prix consulté", detail: "Page offre personnalisée" });
  await checkPurchaseReady(candidateId);
}

/** The candidate asked to be called back from the offer page, with their start date. */
export async function recordInterest(candidateId: string, timingDays: number, actor: Actor = {}) {
  await db.candidate.update({ where: { id: candidateId }, data: { interestConfirmed: true, timingDays } });
  await logEvent(candidateId, "EMAIL_REPLIED", "Demande de rappel", `Souhaite démarrer sous ${timingDays} jours`, actor);
  await stopEnrollment(candidateId, "Intérêt confirmé");
  await advanceStatus(candidateId, "INTEREST_CONFIRMED", { title: "Intérêt confirmé", detail: "Page offre" });
  await checkPurchaseReady(candidateId);
}

export async function unsubscribe(candidateId: string) {
  const c = await db.candidate.findUnique({ where: { id: candidateId }, select: { unsubscribedAt: true } });
  if (!c || c.unsubscribedAt) return;
  await db.candidate.update({ where: { id: candidateId }, data: { unsubscribedAt: new Date() } });
  await logEvent(candidateId, "UNSUBSCRIBED", "Désinscription", "Ne reçoit plus d'emails");
  await stopEnrollment(candidateId, "Désinscription");
  await advanceStatus(candidateId, "LOST", { title: "Perdu", detail: "Désinscription" });
}

/** Step 18: the 4 conditions. When all are met the candidate is ready for an SDR. */
export async function checkPurchaseReady(candidateId: string) {
  const [c, rules] = await Promise.all([db.candidate.findUnique({ where: { id: candidateId } }), getScoringRules()]);
  if (!c) return false;
  const cond = purchaseReadyConditions(c, rules);
  if (!(cond.fit && cond.interest && cond.price && cond.timing)) return false;
  const moved = await advanceStatus(candidateId, "PURCHASE_READY", { title: "Prêt à acheter", detail: "4/4 conditions remplies" });
  if (moved) await stopEnrollment(candidateId, "Prêt à acheter — transmis au SDR");
  return moved;
}

/** Manual move from the pipeline board or the profile. */
export async function moveCandidate(candidateId: string, to: CandidateStatus, actor: Actor) {
  const c = await db.candidate.findUnique({ where: { id: candidateId }, select: { status: true } });
  if (!c || c.status === to) return;
  await db.candidate.update({ where: { id: candidateId }, data: { status: to } });
  await logEvent(candidateId, "STATUS_CHANGED", "Déplacé manuellement", null, { toStatus: to, actorId: actor.actorId });
  if (to === "WON" || to === "LOST" || to === "NOT_ELIGIBLE" || STATUS_RANK[to] >= STATUS_RANK.PURCHASE_READY) {
    await stopEnrollment(candidateId, "Statut changé manuellement", actor);
  }
}

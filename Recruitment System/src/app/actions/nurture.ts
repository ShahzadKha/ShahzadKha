"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  enrollCandidate,
  moveCandidate,
  pauseEnrollment,
  processDueEmails,
  recordClick,
  recordOpen,
  recordReply,
  resumeEnrollment,
  sendNextNow,
  simulateDays,
  stopEnrollment,
  unsubscribe,
} from "@/lib/nurture/engine";
import { CandidateStatus } from "@/generated/prisma/enums";
import { EmailSettingsSchema, getEmailSettings } from "@/lib/settings";
import type { SettingsState } from "@/app/actions/settings";

const refresh = (candidateId?: string) => {
  if (candidateId) revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/pipeline");
  revalidatePath("/sequences");
};

// ─── Candidate profile ──────────────────────────────────────────────

export async function sequenceAction(candidateId: string, action: "start" | "pause" | "resume" | "stop" | "next") {
  const user = await requireUser();
  const actor = { actorId: user.id };
  if (action === "start") await enrollCandidate(candidateId, { ...actor, force: true });
  if (action === "pause") await pauseEnrollment(candidateId, actor);
  if (action === "resume") await resumeEnrollment(candidateId, actor);
  if (action === "stop") await stopEnrollment(candidateId, "Arrêtée manuellement", actor);
  if (action === "next") await sendNextNow(candidateId);
  refresh(candidateId);
}

// Demo buttons: reproduce what the candidate would do with the emails
export async function simulateCandidate(candidateId: string, kind: "open" | "click" | "replyYes" | "replyNo" | "unsubscribe") {
  const user = await requireUser();
  const last = await db.emailMessage.findFirst({ where: { candidateId }, orderBy: { sentAt: "desc" } });
  if (kind === "open" && last) await recordOpen(last.id);
  if (kind === "click" && last) await recordClick(last.id);
  if (kind === "replyYes") {
    await recordReply(candidateId, true, "Bonjour, oui ça m'intéresse ! Pouvez-vous m'en dire plus sur le calendrier et le financement ?", { actorId: user.id });
  }
  if (kind === "replyNo") await recordReply(candidateId, false, "Merci, mais ce n'est pas le bon moment pour moi.", { actorId: user.id });
  if (kind === "unsubscribe") await unsubscribe(candidateId);
  refresh(candidateId);
}

export async function changeStatus(candidateId: string, formData: FormData) {
  const user = await requireUser();
  const status = String(formData.get("status")) as CandidateStatus;
  if (!(status in CandidateStatus)) return;
  await moveCandidate(candidateId, status, { actorId: user.id });
  refresh(candidateId);
}

// Pipeline board drag and drop
export async function moveOnBoard(candidateId: string, status: CandidateStatus) {
  const user = await requireUser();
  if (!(status in CandidateStatus)) return { ok: false };
  await moveCandidate(candidateId, status, { actorId: user.id });
  revalidatePath("/pipeline");
  return { ok: true };
}

// ─── Sequences page ─────────────────────────────────────────────────

export async function runDueEmails() {
  await requireUser(["ADMIN", "RECRUITER"]);
  const n = await processDueEmails();
  refresh();
  return n;
}

export async function simulateDaysAction(days: number) {
  await requireUser(["ADMIN", "RECRUITER"]);
  const n = await simulateDays(Math.min(30, Math.max(1, Math.round(days))));
  refresh();
  return n;
}

const StepSchema = z.object({
  id: z.string().min(1),
  dayOffset: z.coerce.number().int().min(0).max(365),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  isOffer: z.boolean(),
});

export async function saveStep(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireUser(["ADMIN"]);
  const parsed = StepSchema.safeParse({
    id: formData.get("id"),
    dayOffset: formData.get("dayOffset"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    isOffer: formData.get("isOffer") === "on",
  });
  if (!parsed.success) return { ok: false, at: Date.now() };
  const { id, ...data } = parsed.data;
  await db.emailStep.update({ where: { id }, data });
  revalidatePath("/sequences");
  return { ok: true, at: Date.now() };
}

export async function addStep(sequenceId: string) {
  await requireUser(["ADMIN"]);
  const last = await db.emailStep.findFirst({ where: { sequenceId }, orderBy: { order: "desc" } });
  await db.emailStep.create({
    data: {
      sequenceId,
      order: (last?.order ?? 0) + 1,
      dayOffset: (last?.dayOffset ?? -3) + 3,
      subject: "Nouvel email pour {{prenom}}",
      body: "Bonjour {{prenom}},\n\n…\n\nÀ très vite,\nL'équipe {{marque}}",
    },
  });
  revalidatePath("/sequences");
}

export async function deleteStep(stepId: string) {
  await requireUser(["ADMIN"]);
  const step = await db.emailStep.findUnique({ where: { id: stepId } });
  if (!step) return;
  await db.$transaction(async (tx) => {
    await tx.emailStep.delete({ where: { id: stepId } });
    // Keep the order numbers continuous (1, 2, 3…)
    const rest = await tx.emailStep.findMany({ where: { sequenceId: step.sequenceId }, orderBy: { order: "asc" } });
    for (const [i, s] of rest.entries()) await tx.emailStep.update({ where: { id: s.id }, data: { order: -(i + 1) } });
    for (const [i, s] of rest.entries()) await tx.emailStep.update({ where: { id: s.id }, data: { order: i + 1 } });
  });
  revalidatePath("/sequences");
}

export async function toggleSequence(sequenceId: string, active: boolean) {
  await requireUser(["ADMIN"]);
  await db.emailSequence.update({ where: { id: sequenceId }, data: { active } });
  revalidatePath("/sequences");
}

export async function saveEmailSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireUser(["ADMIN"]);
  const current = await getEmailSettings();
  const parsed = EmailSettingsSchema.safeParse({
    autoEnroll: formData.has("offerSubject") ? current.autoEnroll : formData.get("autoEnroll") === "on",
    requireConsent: formData.has("offerSubject") ? current.requireConsent : formData.get("requireConsent") === "on",
    offerSubject: String(formData.get("offerSubject") ?? current.offerSubject).trim(),
    offerBody: String(formData.get("offerBody") ?? current.offerBody).trim(),
  });
  if (!parsed.success) return { ok: false, at: Date.now() };
  await db.setting.upsert({
    where: { key: "emailSettings" },
    create: { key: "emailSettings", value: parsed.data },
    update: { value: parsed.data },
  });
  revalidatePath("/sequences");
  return { ok: true, at: Date.now() };
}

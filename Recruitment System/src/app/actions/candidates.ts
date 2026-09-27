"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/engine/parse";
import { sendEmail } from "@/lib/nurture/engine";
import type { SettingsState } from "@/app/actions/settings";

const optional = z
  .string()
  .trim()
  .transform((v) => v || null);

const CandidateSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.email().trim().toLowerCase(),
  phone: optional,
  city: optional,
  currentTitle: optional,
  yearsExperience: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(0).max(60).nullable()),
  skills: z
    .string()
    .trim()
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  linkedinUrl: optional,
});

export type CandidateFormState =
  | { errors?: Partial<Record<keyof z.infer<typeof CandidateSchema>, string>>; values?: Record<string, string> }
  | undefined;

// Manual entry (diagram source "Ajout manuel"). Step 4 — deduplication by email:
// an existing email updates the record instead of creating a duplicate.
export async function createCandidate(_prev: CandidateFormState, formData: FormData): Promise<CandidateFormState> {
  const user = await requireUser();
  const parsed = CandidateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: NonNullable<CandidateFormState>["errors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof typeof errors;
      errors[key] = key === "email" ? "invalidEmail" : "required";
    }
    // Send the typed values back so the form is not cleared
    const values = Object.fromEntries([...formData.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
    return { errors, values };
  }

  const data = parsed.data;
  const existing = await db.candidate.findUnique({ where: { email: data.email } });

  if (existing) {
    // Only fill in fields that were provided, keep everything else
    const changes = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0)),
    );
    await db.candidate.update({
      where: { id: existing.id },
      data: {
        ...changes,
        events: {
          create: { type: "DUPLICATE_MERGED", title: "Doublon détecté", detail: `Email ${data.email}`, actorId: user.id },
        },
      },
    });
    revalidatePath("/candidates");
    redirect(`/candidates/${existing.id}`);
  }

  const candidate = await db.candidate.create({
    data: {
      ...data,
      source: "MANUAL",
      status: "NEW_CV",
      events: {
        create: { type: "CREATED", title: "Candidat créé", toStatus: "NEW_CV", actorId: user.id },
      },
    },
  });
  revalidatePath("/candidates");
  redirect(`/candidates/${candidate.id}`);
}

export async function addNote(candidateId: string, formData: FormData) {
  const user = await requireUser();
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return;
  await db.candidateEvent.create({
    data: { candidateId, type: "NOTE", title: "Note", detail: note.slice(0, 2000), actorId: user.id },
  });
  revalidatePath(`/candidates/${candidateId}`);
}

// GDPR right to erasure: removes the candidate with their CV, emails, calls, payments and history
export async function deleteCandidate(candidateId: string) {
  await requireUser(["ADMIN"]);
  await db.candidate.delete({ where: { id: candidateId } });
  revalidatePath("/candidates");
  revalidatePath("/pipeline");
  redirect("/candidates");
}

const EditSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80),
  email: z.email().trim().toLowerCase(),
  phone: optional,
  city: optional,
  currentTitle: optional,
  linkedinUrl: optional,
  sourceDetail: optional,
  yearsExperience: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(0).max(60).nullable()),
  timingDays: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().min(0).max(730).nullable()),
  recommendedProductId: z.string().transform((v) => v || null),
});

const FIELD_LABELS: Record<string, string> = {
  firstName: "prénom", lastName: "nom", email: "email", phone: "téléphone", city: "ville", currentTitle: "poste",
  linkedinUrl: "LinkedIn", sourceDetail: "partenaire", yearsExperience: "expérience", timingDays: "démarrage souhaité",
  recommendedProductId: "formation",
};

// Edit the candidate record (any team member), e.g. change the recommended training
export async function updateCandidate(candidateId: string, _prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const parsed = EditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, at: Date.now() };
  const data = parsed.data;
  const current = await db.candidate.findUnique({ where: { id: candidateId } });
  if (!current) return { ok: false, at: Date.now() };
  if (data.email !== current.email && (await db.candidate.findUnique({ where: { email: data.email } }))) return { ok: false, at: Date.now() };
  if (data.recommendedProductId && !(await db.product.findUnique({ where: { id: data.recommendedProductId } }))) return { ok: false, at: Date.now() };

  const changed = (Object.keys(data) as (keyof typeof data)[]).filter((k) => (data[k] ?? null) !== (current[k] ?? null));
  if (changed.length === 0) return { ok: true, at: Date.now() };
  await db.candidate.update({
    where: { id: candidateId },
    data: {
      ...data,
      phoneKey: data.phone ? normalizePhone(data.phone) : null,
      events: { create: { type: "UPDATED", title: "Fiche modifiée", detail: changed.map((k) => FIELD_LABELS[k]).join(", "), actorId: user.id } },
    },
  });
  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true, at: Date.now() };
}

// A personal email written by a team member from the profile
export async function sendManualEmail(candidateId: string, _prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 200);
  const body = String(formData.get("body") ?? "").trim().slice(0, 5000);
  if (!subject || !body) return { ok: false, at: Date.now() };
  const c = await db.candidate.findUnique({ where: { id: candidateId }, select: { unsubscribedAt: true } });
  if (!c || c.unsubscribedAt) return { ok: false, at: Date.now() };
  const message = await sendEmail(candidateId, { subject, body }, { kind: "manual", log: false });
  if (!message) return { ok: false, at: Date.now() };
  await db.candidateEvent.create({
    data: {
      candidateId,
      type: "MANUAL_EMAIL",
      title: "Email personnel",
      detail: message.error ? `${message.subject} — échec : ${message.error}` : message.subject,
      actorId: user.id,
    },
  });
  revalidatePath(`/candidates/${candidateId}`);
  return { ok: !message.error, at: Date.now() };
}

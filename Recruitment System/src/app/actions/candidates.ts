"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

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

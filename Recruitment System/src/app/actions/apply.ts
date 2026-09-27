"use server";

import { after } from "next/server";
import { z } from "zod";
import { analyzeCandidate, ingestCv } from "@/lib/engine/pipeline";
import { intakeErrorCode, type IntakeErrorCode } from "@/lib/engine/errors";
import { overLimit } from "@/lib/rate-limit";

// Public web form (diagram source "Formulaire web — Skillhubs.io / landing page")
const ApplySchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email().trim().toLowerCase(),
  phone: z.string().trim().max(30).optional(),
  city: z.string().trim().max(80).optional(),
  motivation: z.string().trim().max(2000).optional(),
  consent: z.literal("on"),
});

export type ApplyState =
  | { ok: true }
  | { ok: false; error: IntakeErrorCode | "invalid" | "too_many"; fields?: string[]; values?: Record<string, string> }
  | undefined;

export async function submitApplication(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const values = Object.fromEntries(
    ["firstName", "lastName", "email", "phone", "city", "motivation"].map((k) => [k, String(formData.get(k) ?? "")]),
  );
  // Honeypot: real people never fill this hidden field
  if (String(formData.get("website") ?? "")) return { ok: true };

  const parsed = ApplySchema.safeParse({ ...values, consent: formData.get("consent") ?? undefined });
  if (!parsed.success) {
    return { ok: false, error: "invalid", fields: parsed.error.issues.map((i) => String(i.path[0])), values };
  }
  const file = formData.get("cv");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "no_file", fields: ["cv"], values };
  // 10 applications per hour from one connection: plenty for people, stops bots
  if (await overLimit("apply", 10, 60 * 60 * 1000)) return { ok: false, error: "too_many", values };

  try {
    const { consent, motivation, ...contact } = parsed.data;
    const result = await ingestCv({
      source: "WEB_FORM",
      file: { bytes: new Uint8Array(await file.arrayBuffer()), fileName: file.name, mimeType: file.type },
      contact,
      motivation,
      consent: consent === "on",
      // ?ref=… in the form link (landing page, partner, campaign)
      sourceDetail: String(formData.get("ref") ?? "") || null,
    });
    after(() => analyzeCandidate(result.candidateId));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: intakeErrorCode(error), values };
  }
}

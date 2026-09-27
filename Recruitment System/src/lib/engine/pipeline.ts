import "server-only";
import { db } from "@/lib/db";
import { aiStatus, getScoringRules } from "@/lib/settings";
import { globalScore, isEligible, trackFromScore } from "@/lib/rules";
import type { CandidateSource, CandidateStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { CANONICAL_MIME, extractCvText } from "./extract";
import { normalizePhone, parseContact } from "./parse";
import { analyzeDemo } from "./analyze-demo";
import { analyzeWithOpenAI } from "./analyze-openai";
import type { Analysis, AnalysisInput } from "./analysis";

export class IngestError extends Error {
  constructor(public code: "no_email" | "no_name") {
    super(code);
  }
}

export type IngestInput = {
  source: CandidateSource;
  actorId?: string | null;
  file?: { bytes: Uint8Array; fileName: string; mimeType: string };
  text?: string; // CV text when there is no file (API)
  // Values typed by a person (web form, API) win over what is read from the CV
  contact?: Partial<{ firstName: string; lastName: string; email: string; phone: string; city: string }>;
  motivation?: string | null;
  consent?: boolean;
};

export type IngestResult = { candidateId: string; duplicate: boolean; name: string };

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

// Statuses the analysis is allowed to move a candidate out of. Later stages keep their status.
const EARLY_STATUSES: CandidateStatus[] = ["NEW_CV", "CV_PARSED", "GPT_ANALYZED", "PRODUCT_MATCHED", "NOT_ELIGIBLE"];

/**
 * Steps 1–5 of the diagram: receive a CV, extract its text, parse contact details,
 * look for a duplicate (email, then phone) and create or update the candidate.
 * Returns quickly; the AI analysis (steps 6–9) runs afterwards with analyzeCandidate().
 */
export async function ingestCv(input: IngestInput): Promise<IngestResult> {
  const extracted = input.file ? await extractCvText(input.file.bytes, input.file.fileName, input.file.mimeType) : null;
  const cvText = extracted?.text ?? clean(input.text);
  const parsed = cvText ? parseContact(cvText) : null;

  const email = (clean(input.contact?.email) ?? parsed?.email)?.toLowerCase() ?? null;
  const phone = clean(input.contact?.phone) ?? parsed?.phone ?? null;
  const firstName = clean(input.contact?.firstName) ?? parsed?.firstName ?? null;
  const lastName = clean(input.contact?.lastName) ?? parsed?.lastName ?? null;
  const phoneKey = phone ? normalizePhone(phone) : null;
  if (!email) throw new IngestError("no_email");

  const fileData = input.file
    ? {
        fileName: input.file.fileName,
        mimeType: CANONICAL_MIME[extracted!.kind],
        size: input.file.bytes.byteLength,
        data: Buffer.from(input.file.bytes),
      }
    : null;

  // Step 4 — deduplication
  const existing =
    (await db.candidate.findUnique({ where: { email } })) ??
    (phoneKey ? await db.candidate.findFirst({ where: { phoneKey } }) : null);

  if (existing) {
    const how = existing.email === email ? `email ${email}` : `téléphone ${phone}`;
    await db.candidate.update({
      where: { id: existing.id },
      data: {
        // Enrich the record: new CV replaces the old one, empty fields get filled
        ...(cvText ? { cvText, analysisState: "PENDING", analysisError: null } : {}),
        ...(fileData ? { cvFileName: fileData.fileName, cvFile: { upsert: { create: fileData, update: fileData } } } : {}),
        phone: existing.phone ?? phone,
        phoneKey: existing.phoneKey ?? phoneKey,
        city: existing.city ?? clean(input.contact?.city),
        linkedinUrl: existing.linkedinUrl ?? parsed?.linkedinUrl ?? null,
        motivation: clean(input.motivation) ?? existing.motivation,
        consentAt: input.consent ? new Date() : existing.consentAt,
        events: {
          create: {
            type: "DUPLICATE_MERGED",
            title: "Doublon détecté",
            detail: `Même ${how} — fiche mise à jour (${sourceLabel(input.source)})`,
            actorId: input.actorId ?? null,
          },
        },
      },
    });
    return { candidateId: existing.id, duplicate: true, name: `${existing.firstName} ${existing.lastName}` };
  }

  if (!firstName && !lastName) throw new IngestError("no_name");

  const now = Date.now();
  const candidate = await db.candidate.create({
    data: {
      firstName: firstName ?? "",
      lastName: lastName ?? "",
      email,
      phone,
      phoneKey,
      city: clean(input.contact?.city),
      source: input.source,
      status: cvText ? "CV_PARSED" : "NEW_CV",
      cvText,
      cvFileName: fileData?.fileName ?? null,
      cvFile: fileData ? { create: fileData } : undefined,
      linkedinUrl: parsed?.linkedinUrl ?? null,
      motivation: clean(input.motivation),
      consentAt: input.consent ? new Date() : null,
      analysisState: cvText ? "PENDING" : null,
      events: {
        create: [
          {
            type: "CREATED",
            title: "Candidat créé",
            detail: `${sourceLabel(input.source)}${fileData ? ` — ${fileData.fileName}` : ""}`,
            toStatus: "NEW_CV",
            actorId: input.actorId ?? null,
            createdAt: new Date(now),
          },
          ...(cvText
            ? [
                {
                  type: "CV_PARSED" as const,
                  title: "CV extrait",
                  detail: parsedDetail(cvText, { email, phone, linkedin: parsed?.linkedinUrl }),
                  toStatus: "CV_PARSED" as const,
                  createdAt: new Date(now + 1),
                },
              ]
            : []),
        ],
      },
    },
  });
  return { candidateId: candidate.id, duplicate: false, name: `${candidate.firstName} ${candidate.lastName}`.trim() };
}

function sourceLabel(source: CandidateSource) {
  return {
    EMAIL: "Email entrant",
    WEB_FORM: "Formulaire web",
    CSV_IMPORT: "Import CSV / API",
    FILE_DROP: "Dépôt de CV",
    MANUAL: "Ajout manuel",
  }[source];
}

function parsedDetail(text: string, found: { email: string | null; phone: string | null; linkedin?: string | null }) {
  const words = text.split(/\s+/).length;
  const parts = [`${words} mots`, found.email && "email", found.phone && "téléphone", found.linkedin && "LinkedIn"].filter(Boolean);
  return parts.join(" · ");
}

/** Mark a candidate for (re-)analysis. The caller then runs analyzeCandidate() in the background. */
export async function requestAnalysis(candidateId: string) {
  const c = await db.candidate.findUnique({ where: { id: candidateId }, select: { cvText: true } });
  if (!c?.cvText) return false;
  await db.candidate.update({ where: { id: candidateId }, data: { analysisState: "PENDING", analysisError: null } });
  return true;
}

/**
 * Steps 6–9: send the CV to the AI (or the demo analyser), compute the scores,
 * decide eligibility, pick the product and the follow-up track.
 */
export async function analyzeCandidate(candidateId: string, actorId?: string | null) {
  const [c, products, rules] = await Promise.all([
    db.candidate.findUnique({ where: { id: candidateId } }),
    db.product.findMany({ where: { active: true }, select: { id: true, name: true, description: true, price: true, keywords: true } }),
    getScoringRules(),
  ]);
  if (!c?.cvText) return;

  const ai = aiStatus();
  const input: AnalysisInput = { cvText: c.cvText, motivation: c.motivation, source: c.source, products };

  let result: Analysis;
  try {
    result = ai.enabled ? await analyzeWithOpenAI(input, ai.model!) : analyzeDemo(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Analysis failed for candidate ${candidateId}:`, message);
    await db.candidate.update({
      where: { id: candidateId },
      data: {
        analysisState: "FAILED",
        analysisError: message.slice(0, 500),
        events: { create: { type: "ANALYSIS_FAILED", title: "Analyse échouée", detail: message.slice(0, 300), actorId } },
      },
    });
    return;
  }

  const product = products.find((p) => p.id === result.recommendedProductId) ?? null;
  const score = globalScore({ fit: result.fitScore, need: result.needScore, intent: result.intentScore }, rules);
  const eligible = Boolean(product) && isEligible(result.fitScore, result.eligible, rules);
  const track = eligible ? trackFromScore(score, rules) : null;
  const moveStatus = EARLY_STATUSES.includes(c.status);
  const p = result.profile;

  const t = Date.now();
  const events: Prisma.CandidateEventCreateWithoutCandidateInput[] = [
    {
      type: "AI_ANALYZED",
      title: "Analyse IA",
      detail: `Score global ${score}/100 · ${ai.enabled ? `OpenAI ${ai.model}` : "mode démo"}`,
      toStatus: moveStatus ? "GPT_ANALYZED" : undefined,
      createdAt: new Date(t),
      ...(actorId ? { actor: { connect: { id: actorId } } } : {}),
    },
  ];
  if (moveStatus) {
    events.push(
      eligible
        ? { type: "STATUS_CHANGED", title: "Produit associé", detail: product!.name, toStatus: "PRODUCT_MATCHED", createdAt: new Date(t + 1) }
        : { type: "STATUS_CHANGED", title: "Non éligible", detail: "Aucune formation ne correspond au profil", toStatus: "NOT_ELIGIBLE", createdAt: new Date(t + 1) },
    );
  }
  if (track) events.push({ type: "ROUTED", title: "Parcours", detail: track, createdAt: new Date(t + 2) });

  await db.candidate.update({
    where: { id: candidateId },
    data: {
      // Fill in what the CV told us, without overwriting what a person already entered
      firstName: c.firstName || p.firstName || "",
      lastName: c.lastName || p.lastName || "",
      currentTitle: c.currentTitle ?? p.currentTitle,
      yearsExperience: c.yearsExperience ?? p.yearsExperience,
      education: c.education ?? p.education,
      city: c.city ?? p.city,
      skills: c.skills.length ? c.skills : p.skills,
      languages: c.languages.length ? c.languages : p.languages,
      timingDays: c.timingDays ?? result.timingDays,
      persona: result.persona,
      skillGap: result.skillGap,
      aiSummary: result.summary,
      fitScore: result.fitScore,
      needScore: result.needScore,
      intentScore: result.intentScore,
      globalScore: score,
      eligible,
      routingTrack: track,
      recommendedProductId: product?.id ?? null,
      analysisState: "DONE",
      analysisMode: ai.enabled ? "openai" : "demo",
      analysisModel: ai.model,
      analyzedAt: new Date(),
      analysisError: null,
      ...(moveStatus ? { status: eligible ? "PRODUCT_MATCHED" : "NOT_ELIGIBLE" } : {}),
      events: { create: events },
    },
  });
}

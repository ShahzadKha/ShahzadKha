import { z } from "zod";
import type { CandidateSource } from "@/generated/prisma/enums";

// Model output is clamped rather than rejected, so one odd number never fails an analysis
const score = z.number().transform((n) => Math.max(0, Math.min(100, Math.round(n))));
const optionalInt = (max: number) =>
  z.number().nullable().transform((n) => (n == null ? null : Math.max(0, Math.min(max, Math.round(n)))));
const list = (max: number) => z.array(z.string()).transform((a) => a.map((s) => s.trim()).filter(Boolean).slice(0, max));

// What an analysis (OpenAI or demo) returns — the "JSON structuré" of step 7
export const AnalysisSchema = z.object({
  profile: z.object({
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    currentTitle: z.string().nullable(),
    yearsExperience: optionalInt(60),
    education: z.string().nullable(),
    city: z.string().nullable(),
    skills: list(20),
    languages: list(8),
  }),
  persona: z.string(),
  skillGap: z.string(),
  summary: z.string(),
  fitScore: score,
  needScore: score,
  intentScore: score,
  eligible: z.boolean(),
  recommendedProductId: z.string().nullable(),
  timingDays: optionalInt(730),
});

export type Analysis = z.output<typeof AnalysisSchema>;

export type AnalysisInput = {
  cvText: string;
  motivation: string | null;
  source: CandidateSource;
  products: { id: string; name: string; description: string | null; price: number; keywords: string[] }[];
};

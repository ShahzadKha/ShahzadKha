import type { CandidateStatus } from "@/generated/prisma/enums";

// The six phases of the conversion process (columns of the BPMN diagram)
export const PHASES = ["acquisition", "analysis", "nurturing", "qualification", "closing", "won", "lost"] as const;
export type Phase = (typeof PHASES)[number];

export const STATUS_ORDER: CandidateStatus[] = [
  "NEW_CV",
  "CV_PARSED",
  "GPT_ANALYZED",
  "PRODUCT_MATCHED",
  "EMAIL_1_SENT",
  "ENGAGED",
  "NURTURE",
  "INTEREST_CONFIRMED",
  "OFFER_SENT",
  "PRICE_VIEWED",
  "PURCHASE_READY",
  "SDR_ASSIGNED",
  "CALL_COMPLETED",
  "WON",
  "LOST",
  "NOT_ELIGIBLE",
];

export const STATUS_PHASE: Record<CandidateStatus, Phase> = {
  NEW_CV: "acquisition",
  CV_PARSED: "analysis",
  GPT_ANALYZED: "analysis",
  PRODUCT_MATCHED: "analysis",
  EMAIL_1_SENT: "nurturing",
  ENGAGED: "nurturing",
  NURTURE: "nurturing",
  INTEREST_CONFIRMED: "qualification",
  OFFER_SENT: "qualification",
  PRICE_VIEWED: "qualification",
  PURCHASE_READY: "qualification",
  SDR_ASSIGNED: "closing",
  CALL_COMPLETED: "closing",
  WON: "won",
  LOST: "lost",
  NOT_ELIGIBLE: "lost",
};

// Badge styles per phase, echoing the lane colours of the diagram
export const PHASE_BADGE: Record<Phase, string> = {
  acquisition: "bg-green-50 text-green-800 ring-green-200",
  analysis: "bg-sky-50 text-sky-800 ring-sky-200",
  nurturing: "bg-amber-50 text-amber-800 ring-amber-200",
  qualification: "bg-violet-50 text-violet-800 ring-violet-200",
  closing: "bg-teal-50 text-teal-800 ring-teal-200",
  won: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  lost: "bg-slate-100 text-slate-700 ring-slate-200",
};

// Score routing bands (diagram: "Règles de routage principales")
export const SCORE_BANDS = ["lt50", "50_64", "65_79", "80_89", "90_100"] as const;
export type ScoreBand = (typeof SCORE_BANDS)[number];

export const SCORE_BAND_RANGE: Record<ScoreBand, [number, number]> = {
  lt50: [0, 49],
  "50_64": [50, 64],
  "65_79": [65, 79],
  "80_89": [80, 89],
  "90_100": [90, 100],
};

export function scoreBand(score: number | null | undefined): ScoreBand | null {
  if (score == null) return null;
  return SCORE_BANDS.find((b) => score >= SCORE_BAND_RANGE[b][0] && score <= SCORE_BAND_RANGE[b][1]) ?? null;
}

export function scoreTone(score: number | null | undefined) {
  if (score == null) return "text-slate-400";
  if (score >= 80) return "text-emerald-700";
  if (score >= 65) return "text-sky-700";
  if (score >= 50) return "text-amber-700";
  return "text-slate-500";
}

// The 4 "Purchase Ready" conditions (diagram legend)
export function purchaseReadyConditions(c: {
  fitScore: number | null;
  eligible: boolean | null;
  interestConfirmed: boolean;
  priceViewed: boolean;
  timingDays: number | null;
}) {
  return {
    fit: (c.fitScore ?? 0) >= 70 && c.eligible === true,
    interest: c.interestConfirmed,
    price: c.priceViewed,
    timing: c.timingDays != null && c.timingDays <= 30,
  };
}

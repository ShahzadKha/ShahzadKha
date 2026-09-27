import { z } from "zod";
import type { RoutingTrack } from "@/generated/prisma/enums";

// Scoring & routing rules. Defaults follow the client's diagram; admins edit them in Settings.
export const ScoringRulesSchema = z.object({
  weights: z.object({
    fit: z.number().int().min(0).max(100),
    need: z.number().int().min(0).max(100),
    intent: z.number().int().min(0).max(100),
  }),
  eligibilityMinFit: z.number().int().min(0).max(100),
  bands: z.object({
    light: z.number().int().min(1).max(100),
    conversion: z.number().int().min(1).max(100),
    callInvite: z.number().int().min(1).max(100),
    prioritySdr: z.number().int().min(1).max(100),
  }),
  purchaseReady: z.object({
    minFit: z.number().int().min(0).max(100),
    maxTimingDays: z.number().int().min(1).max(365),
  }),
});

export type ScoringRules = z.infer<typeof ScoringRulesSchema>;

export const DEFAULT_RULES: ScoringRules = {
  weights: { fit: 50, need: 25, intent: 25 },
  eligibilityMinFit: 50,
  bands: { light: 50, conversion: 65, callInvite: 80, prioritySdr: 90 },
  purchaseReady: { minFit: 70, maxTimingDays: 30 },
};

export const TRACKS: RoutingTrack[] = ["EDUCATIONAL", "LIGHT", "CONVERSION", "CALL_INVITE", "PRIORITY_SDR"];

export function globalScore(s: { fit: number; need: number; intent: number }, rules: ScoringRules) {
  const { fit, need, intent } = rules.weights;
  const total = fit + need + intent || 1;
  return Math.round((s.fit * fit + s.need * need + s.intent * intent) / total);
}

export function isEligible(fitScore: number, aiSaysEligible: boolean, rules: ScoringRules) {
  return aiSaysEligible && fitScore >= rules.eligibilityMinFit;
}

export function trackFromScore(score: number, rules: ScoringRules): RoutingTrack {
  const b = rules.bands;
  if (score >= b.prioritySdr) return "PRIORITY_SDR";
  if (score >= b.callInvite) return "CALL_INVITE";
  if (score >= b.conversion) return "CONVERSION";
  if (score >= b.light) return "LIGHT";
  return "EDUCATIONAL";
}

// Score range covered by a track, e.g. [65, 79]
export function trackRange(track: RoutingTrack, rules: ScoringRules): [number, number] {
  const b = rules.bands;
  switch (track) {
    case "EDUCATIONAL":
      return [0, b.light - 1];
    case "LIGHT":
      return [b.light, b.conversion - 1];
    case "CONVERSION":
      return [b.conversion, b.callInvite - 1];
    case "CALL_INVITE":
      return [b.callInvite, b.prioritySdr - 1];
    case "PRIORITY_SDR":
      return [b.prioritySdr, 100];
  }
}

export function trackRangeLabel(track: RoutingTrack, rules: ScoringRules) {
  const [min, max] = trackRange(track, rules);
  return min === 0 ? `< ${max + 1}` : `${min}–${max}`;
}

// The 4 "Purchase Ready" conditions (diagram legend)
export function purchaseReadyConditions(
  c: { fitScore: number | null; eligible: boolean | null; interestConfirmed: boolean; priceViewed: boolean; timingDays: number | null },
  rules: ScoringRules,
) {
  return {
    fit: (c.fitScore ?? 0) >= rules.purchaseReady.minFit && c.eligible === true,
    interest: c.interestConfirmed,
    price: c.priceViewed,
    timing: c.timingDays != null && c.timingDays <= rules.purchaseReady.maxTimingDays,
  };
}

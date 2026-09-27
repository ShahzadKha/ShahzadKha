import type { CandidateStatus } from "@/generated/prisma/enums";

// Position of each status in the funnel. Automatic updates only ever move a candidate forward.
export const STATUS_RANK: Record<CandidateStatus, number> = {
  NEW_CV: 0,
  CV_PARSED: 1,
  GPT_ANALYZED: 2,
  NOT_ELIGIBLE: 2,
  PRODUCT_MATCHED: 3,
  EMAIL_1_SENT: 4,
  NURTURE: 4.5,
  ENGAGED: 5,
  INTEREST_CONFIRMED: 6,
  OFFER_SENT: 7,
  PRICE_VIEWED: 8,
  PURCHASE_READY: 9,
  SDR_ASSIGNED: 10,
  CALL_COMPLETED: 11,
  WON: 12,
  LOST: 12,
};

export const FINAL_STATUSES: CandidateStatus[] = ["WON", "LOST", "NOT_ELIGIBLE"];

export function canAdvance(from: CandidateStatus, to: CandidateStatus) {
  return !FINAL_STATUSES.includes(from) && STATUS_RANK[to] > STATUS_RANK[from];
}

// End of a sequence with no sign of interest → back to nurturing (diagram "Nurturing / Recyclage")
export function shouldRecycle(c: { status: CandidateStatus; interestConfirmed: boolean; priceViewed: boolean }) {
  const rank = STATUS_RANK[c.status];
  return !c.interestConfirmed && !c.priceViewed && rank >= STATUS_RANK.PRODUCT_MATCHED && rank < STATUS_RANK.PURCHASE_READY;
}

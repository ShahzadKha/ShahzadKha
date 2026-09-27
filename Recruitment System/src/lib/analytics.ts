import "server-only";
import { db } from "@/lib/db";
import { STATUS_RANK } from "@/lib/nurture/status";
import { startOfDay, weekday } from "@/lib/format";
import type { CandidateSource, CandidateStatus } from "@/generated/prisma/enums";

export const PERIODS = ["7", "30", "90", "all"] as const;
export type Period = (typeof PERIODS)[number];

const DAY = 24 * 60 * 60 * 1000;

export function periodStart(period: Period, now = Date.now()) {
  return period === "all" ? null : new Date(now - Number(period) * DAY);
}

// Funnel stages: a candidate counts in a stage once they have ever reached it
export const FUNNEL = [
  { key: "received", rank: STATUS_RANK.NEW_CV },
  { key: "analyzed", rank: STATUS_RANK.GPT_ANALYZED },
  { key: "eligible", rank: STATUS_RANK.PRODUCT_MATCHED },
  { key: "engaged", rank: STATUS_RANK.ENGAGED },
  { key: "interested", rank: STATUS_RANK.INTEREST_CONFIRMED },
  { key: "ready", rank: STATUS_RANK.PURCHASE_READY },
  { key: "called", rank: STATUS_RANK.CALL_COMPLETED },
  { key: "won", rank: STATUS_RANK.WON },
] as const;
export type FunnelKey = (typeof FUNNEL)[number]["key"];

// Exit statuses say nothing about how far a candidate got
const EXITS: CandidateStatus[] = ["LOST", "NOT_ELIGIBLE", "NURTURE"];

/**
 * Everything the dashboard shows, for candidates who arrived in the period
 * (payments and calls: made in the period).
 */
export async function getDashboard(period: Period) {
  const from = periodStart(period);
  const created = from ? { createdAt: { gte: from } } : {};

  const [candidates, events, messages, payments, tasks, feedback, sdrs] = await Promise.all([
    db.candidate.findMany({
      where: created,
      select: { id: true, source: true, status: true, eligible: true, globalScore: true, createdAt: true, assignedSdrId: true },
    }),
    db.candidateEvent.findMany({
      where: { toStatus: { not: null }, candidate: created },
      select: { candidateId: true, toStatus: true },
    }),
    db.emailMessage.findMany({
      where: from ? { sentAt: { gte: from } } : {},
      select: { openedAt: true, clickedAt: true, repliedAt: true },
    }),
    db.payment.findMany({
      where: from ? { paidAt: { gte: from } } : {},
      select: { amount: true, paidAt: true, product: { select: { name: true } }, candidate: { select: { source: true, assignedSdrId: true } } },
    }),
    db.callTask.findMany({
      where: from ? { OR: [{ status: "OPEN" }, { completedAt: { gte: from } }] } : {},
      select: { sdrId: true, status: true, dueAt: true, outcome: true },
    }),
    db.feedback.findMany({ where: from ? { createdAt: { gte: from } } : {}, select: { nps: true } }),
    db.user.findMany({ where: { role: "SDR" }, select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
  ]);

  // Highest stage each candidate has reached
  const reached = new Map<string, number>();
  for (const c of candidates) reached.set(c.id, EXITS.includes(c.status) ? 0 : STATUS_RANK[c.status]);
  for (const e of events) {
    if (!e.toStatus || EXITS.includes(e.toStatus)) continue;
    reached.set(e.candidateId, Math.max(reached.get(e.candidateId) ?? 0, STATUS_RANK[e.toStatus]));
  }
  const funnel = FUNNEL.map((stage) => ({
    key: stage.key,
    count: stage.key === "received" ? candidates.length : [...reached.values()].filter((r) => r >= stage.rank).length,
  }));

  const won = candidates.filter((c) => c.status === "WON").length;
  const eligible = candidates.filter((c) => c.eligible).length;
  const revenue = payments.reduce((n, p) => n + p.amount, 0);
  const sent = messages.length;

  // New CVs per week (last 12 weeks, or the period if shorter)
  const weeks = Math.min(12, period === "all" ? 12 : Math.max(1, Math.ceil(Number(period) / 7)));
  const weekStart = startOfWeek(Date.now());
  const weekly = Array.from({ length: weeks }, (_, i) => {
    const start = weekStart - (weeks - 1 - i) * 7 * DAY;
    return { start: new Date(start), count: 0 };
  });
  const weeklyAll = await db.candidate.findMany({
    where: { createdAt: { gte: weekly[0].start } },
    select: { createdAt: true },
  });
  for (const c of weeklyAll) {
    const idx = Math.floor((startOfWeek(c.createdAt.getTime()) - weekly[0].start.getTime()) / (7 * DAY));
    if (weekly[idx]) weekly[idx].count++;
  }

  // Per source
  const sources = new Map<CandidateSource, { candidates: number; eligible: number; won: number; revenue: number }>();
  for (const c of candidates) {
    const s = sources.get(c.source) ?? { candidates: 0, eligible: 0, won: 0, revenue: 0 };
    s.candidates++;
    if (c.eligible) s.eligible++;
    if (c.status === "WON") s.won++;
    sources.set(c.source, s);
  }
  for (const p of payments) {
    const s = sources.get(p.candidate.source);
    if (s) s.revenue += p.amount;
  }

  // Per product (revenue)
  const products = new Map<string, { sales: number; revenue: number }>();
  for (const p of payments) {
    const name = p.product?.name ?? "—";
    const row = products.get(name) ?? { sales: 0, revenue: 0 };
    row.sales++;
    row.revenue += p.amount;
    products.set(name, row);
  }

  // Per SDR
  const now = new Date();
  const sdrRows = sdrs
    .filter((u) => u.active || tasks.some((t) => t.sdrId === u.id))
    .map((u) => {
      const mine = tasks.filter((t) => t.sdrId === u.id);
      const sales = payments.filter((p) => p.candidate.assignedSdrId === u.id);
      const calls = mine.filter((t) => t.status === "DONE" && t.outcome && t.outcome !== "paid").length;
      return {
        id: u.id,
        name: u.name,
        open: mine.filter((t) => t.status === "OPEN").length,
        overdue: mine.filter((t) => t.status === "OPEN" && t.dueAt < now).length,
        calls,
        won: sales.length,
        revenue: sales.reduce((n, p) => n + p.amount, 0),
      };
    });

  // NPS = % promoters (9–10) − % detractors (0–6)
  const promoters = feedback.filter((f) => f.nps >= 9).length;
  const detractors = feedback.filter((f) => f.nps <= 6).length;
  const nps = feedback.length ? Math.round(((promoters - detractors) / feedback.length) * 100) : null;

  return {
    kpis: {
      candidates: candidates.length,
      eligibleRate: candidates.length ? eligible / candidates.length : null,
      avgScore: avg(candidates.map((c) => c.globalScore).filter((n): n is number => n != null)),
      purchaseReady: funnel.find((f) => f.key === "ready")!.count,
      won,
      revenue,
      conversion: eligible ? won / eligible : null,
      nps,
      npsCount: feedback.length,
    },
    email: {
      sent,
      openRate: sent ? messages.filter((m) => m.openedAt).length / sent : null,
      clickRate: sent ? messages.filter((m) => m.clickedAt).length / sent : null,
      replyRate: sent ? messages.filter((m) => m.repliedAt).length / sent : null,
    },
    funnel,
    weekly,
    sources: [...sources.entries()].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.candidates - a.candidates),
    products: [...products.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue),
    sdrs: sdrRows,
  };
}

function avg(values: number[]) {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

// Monday 00:00 (team time zone) of the week containing `t`
function startOfWeek(t: number) {
  const d = new Date(t);
  return startOfDay(new Date(startOfDay(d).getTime() - weekday(d) * DAY + DAY / 2)).getTime();
}

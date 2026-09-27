import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { PHASES, STATUS_PHASE, type Phase } from "@/lib/pipeline";
import { daysAgo, formatDate, formatMoney, initials } from "@/lib/format";
import { Avatar, Card, PageHeader, ScorePill, StatusBadge } from "@/components/ui";
import { PhaseBars } from "@/components/phase-bars";

export default async function DashboardPage() {
  await requireUser();
  const { t, locale } = await getDictionary();
  const weekAgo = daysAgo(7);

  const [byStatus, total, newThisWeek, analyzed, eligible, wonCandidates, recent] = await Promise.all([
    db.candidate.groupBy({ by: ["status"], _count: { _all: true } }),
    db.candidate.count(),
    db.candidate.count({ where: { createdAt: { gte: weekAgo } } }),
    db.candidate.count({ where: { globalScore: { not: null } } }),
    db.candidate.count({ where: { eligible: true } }),
    db.candidate.findMany({ where: { status: "WON" }, select: { recommendedProduct: { select: { price: true } } } }),
    db.candidate.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, firstName: true, lastName: true, currentTitle: true, status: true, globalScore: true, createdAt: true },
    }),
  ]);

  const statusCount = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
  const phaseCounts = PHASES.map((phase) => ({
    phase,
    label: t.phases[phase],
    count: byStatus.filter((s) => STATUS_PHASE[s.status] === phase).reduce((n, s) => n + s._count._all, 0),
  }));
  const won = wonCandidates.length;
  const revenue = wonCandidates.reduce((sum, c) => sum + (c.recommendedProduct?.price ?? 0), 0);
  const conversion = eligible ? Math.round((won / eligible) * 1000) / 10 : 0;

  const kpis = [
    { label: t.dashboard.total, value: total.toString() },
    { label: t.dashboard.newThisWeek, value: newThisWeek.toString() },
    { label: t.dashboard.analyzed, value: analyzed.toString() },
    { label: t.dashboard.purchaseReady, value: (statusCount.PURCHASE_READY ?? 0).toString() },
    { label: t.dashboard.won, value: won.toString() },
    { label: t.dashboard.revenue, value: formatMoney(revenue, locale) },
    { label: t.dashboard.conversion, value: `${conversion.toLocaleString(locale)} %`, hint: t.dashboard.conversionHint },
  ];

  return (
    <>
      <PageHeader title={t.dashboard.title} subtitle={t.dashboard.subtitle} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-7">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{k.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{k.value}</p>
            {k.hint && <p className="mt-1 text-[11px] text-slate-400">{k.hint}</p>}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card title={t.dashboard.byPhase} hint={t.dashboard.byPhaseHint} className="lg:col-span-3">
          <PhaseBars rows={phaseCounts as { phase: Phase; label: string; count: number }[]} unit={t.dashboard.candidatesUnit} />
        </Card>

        <Card
          title={t.dashboard.recent}
          className="lg:col-span-2"
          action={
            <Link href="/candidates" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500">
              {t.dashboard.viewAll} <ArrowRight className="size-3" />
            </Link>
          }
        >
          <ul className="-my-2 divide-y divide-slate-100">
            {recent.map((c) => (
              <li key={c.id}>
                <Link href={`/candidates/${c.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50">
                  <Avatar text={initials(c.firstName, c.lastName)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{c.firstName} {c.lastName}</p>
                    <p className="truncate text-xs text-slate-500">
                      {c.currentTitle ?? "—"} · {formatDate(c.createdAt, locale)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={c.status} label={t.statuses[c.status]} />
                    <ScorePill score={c.globalScore} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

import Link from "next/link";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { PERIODS, getDashboard, type Period } from "@/lib/analytics";
import { formatDate, formatMoney, initials } from "@/lib/format";
import { Avatar, Card, PageHeader, ScorePill, StatusBadge } from "@/components/ui";
import { BarList, ColumnChart } from "@/components/charts";

export const metadata = { title: "Tableau de bord" };

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  await requireUser();
  const { t, locale } = await getDictionary();
  const d = t.dashboard;
  const raw = (await searchParams).period;
  const period: Period = PERIODS.includes(raw as Period) ? (raw as Period) : "30";

  const [data, recent] = await Promise.all([
    getDashboard(period),
    db.candidate.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, firstName: true, lastName: true, currentTitle: true, status: true, globalScore: true, createdAt: true },
    }),
  ]);
  const k = data.kpis;
  const pct = (v: number | null) => (v == null ? "—" : `${(Math.round(v * 1000) / 10).toLocaleString(locale)} %`);

  const kpis = [
    { label: d.candidates, value: String(k.candidates) },
    { label: d.eligibleRate, value: pct(k.eligibleRate) },
    { label: d.avgScore, value: k.avgScore == null ? "—" : `${k.avgScore}/100` },
    { label: d.purchaseReady, value: String(k.purchaseReady) },
    { label: d.won, value: String(k.won) },
    { label: d.revenue, value: formatMoney(k.revenue, locale), hero: true },
    { label: d.conversion, value: pct(k.conversion), hint: d.conversionHint },
    { label: d.nps, value: k.nps == null ? "—" : `${k.nps > 0 ? "+" : ""}${k.nps}`, hint: `${k.npsCount} ${d.npsHint}` },
  ];

  const funnelRows = data.funnel.map((f, i) => {
    const prev = i > 0 ? data.funnel[i - 1].count : null;
    return {
      label: d.funnelStages[f.key],
      value: f.count,
      note: prev ? `${Math.round((f.count / prev) * 100)} % ${d.ofPrevious}` : undefined,
    };
  });

  const weekLabel = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { day: "2-digit", month: "2-digit" });

  return (
    <>
      <PageHeader
        title={d.title}
        subtitle={d.subtitle}
        actions={
          <nav className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-sm font-medium" aria-label="Période">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={p === "30" ? "/" : `/?period=${p}`}
                aria-current={p === period ? "page" : undefined}
                className={clsx("rounded-md px-3 py-1.5", p === period ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}
              >
                {d.periods[p]}
              </Link>
            ))}
          </nav>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
            <p className={clsx("mt-2 font-semibold tabular-nums tracking-tight text-slate-900", kpi.hero ? "text-3xl" : "text-2xl")}>{kpi.value}</p>
            {kpi.hint && <p className="mt-1 text-[11px] text-slate-400">{kpi.hint}</p>}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={d.funnel} hint={d.funnelHint} className="lg:col-span-2">
          <BarList rows={funnelRows} unit={d.candidatesUnit} labelWidth="9rem" />
        </Card>
        <Card title={d.emails}>
          <dl className="grid grid-cols-2 gap-4">
            {[
              [d.emailsSent, String(data.email.sent)],
              [d.openRate, pct(data.email.openRate)],
              [d.clickRate, pct(data.email.clickRate)],
              [d.replyRate, pct(data.email.replyRate)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={d.weekly} hint={d.weeklyHint}>
          <ColumnChart columns={data.weekly.map((w) => ({ label: weekLabel.format(w.start), value: w.count }))} unit={d.cvUnit} />
        </Card>
        <Card title={d.products}>
          {data.products.length === 0 ? (
            <p className="text-sm text-slate-500">{d.noSales}</p>
          ) : (
            <BarList
              rows={data.products.map((p) => ({ label: p.name, value: p.revenue, display: formatMoney(p.revenue, locale), note: `${p.sales} ${p.sales > 1 ? d.sales : d.sale}` }))}
              labelWidth="11rem"
            />
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={d.sources}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="pb-2 font-medium">{d.source}</th>
                <th className="pb-2 text-right font-medium">{d.colCandidates}</th>
                <th className="pb-2 text-right font-medium">{d.colEligible}</th>
                <th className="pb-2 text-right font-medium">{d.colWon}</th>
                <th className="pb-2 text-right font-medium">{d.colConversion}</th>
                <th className="pb-2 text-right font-medium">{d.colRevenue}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {data.sources.map((s) => (
                <tr key={s.source}>
                  <td className="py-2 text-slate-700">{t.sources[s.source]}</td>
                  <td className="py-2 text-right">{s.candidates}</td>
                  <td className="py-2 text-right">{s.eligible}</td>
                  <td className="py-2 text-right">{s.won}</td>
                  <td className="py-2 text-right">{pct(s.eligible ? s.won / s.eligible : null)}</td>
                  <td className="py-2 text-right">{formatMoney(s.revenue, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title={d.sdrs}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="pb-2 font-medium">{d.sdr}</th>
                <th className="pb-2 text-right font-medium">{d.colOpen}</th>
                <th className="pb-2 text-right font-medium">{d.colOverdue}</th>
                <th className="pb-2 text-right font-medium">{d.colCalls}</th>
                <th className="pb-2 text-right font-medium">{d.colWon}</th>
                <th className="pb-2 text-right font-medium">{d.colRevenue}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {data.sdrs.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 text-slate-700">{s.name}</td>
                  <td className="py-2 text-right">{s.open}</td>
                  <td className={clsx("py-2 text-right", s.overdue > 0 && "font-semibold text-red-700")}>{s.overdue}</td>
                  <td className="py-2 text-right">{s.calls}</td>
                  <td className="py-2 text-right">{s.won}</td>
                  <td className="py-2 text-right">{formatMoney(s.revenue, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card
        title={d.recent}
        className="mt-6"
        action={
          <Link href="/candidates" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500">
            {d.viewAll} <ArrowRight className="size-3" />
          </Link>
        }
      >
        <ul className="-my-2 grid divide-y divide-slate-100 md:grid-cols-2 md:gap-x-8 md:divide-y-0">
          {recent.map((c) => (
            <li key={c.id} className="md:border-b md:border-slate-100">
              <Link href={`/candidates/${c.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50">
                <Avatar text={initials(c.firstName, c.lastName)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{c.firstName} {c.lastName}</p>
                  <p className="truncate text-xs text-slate-500">{c.currentTitle ?? "—"} · {formatDate(c.createdAt, locale)}</p>
                </div>
                <StatusBadge status={c.status} label={t.statuses[c.status]} />
                <ScorePill score={c.globalScore} />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

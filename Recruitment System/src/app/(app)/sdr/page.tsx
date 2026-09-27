import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, Phone, PhoneCall } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { daysAgo, formatDateTime, formatMoney, initials } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";
import { Avatar, Card, PageHeader, ScorePill, StatusBadge, buttonClass, selectClass } from "@/components/ui";

export const metadata = { title: "Espace SDR" };

export default async function SdrPage({ searchParams }: PageProps<"/sdr">) {
  const user = await requireUser();
  const { t, locale } = await getDictionary();
  const params = await searchParams;
  const isSdr = user.role === "SDR";
  const sdrFilter = isSdr ? user.id : (Array.isArray(params.sdr) ? params.sdr[0] : params.sdr) || "";

  const taskWhere: Prisma.CallTaskWhereInput = sdrFilter ? { sdrId: sdrFilter } : {};
  const weekAgo = daysAgo(7);
  const monthAgo = daysAgo(30);
  const now = daysAgo(0);

  const [open, recent, callsWeek, sales, sdrs] = await Promise.all([
    db.callTask.findMany({
      where: { ...taskWhere, status: "OPEN" },
      orderBy: { dueAt: "asc" },
      include: {
        sdr: { select: { name: true } },
        candidate: {
          select: {
            id: true, firstName: true, lastName: true, phone: true, status: true, globalScore: true, timingDays: true,
            recommendedProduct: { select: { name: true, price: true } },
          },
        },
      },
    }),
    db.callTask.findMany({
      where: { ...taskWhere, status: "DONE", outcome: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 10,
      include: { candidate: { select: { id: true, firstName: true, lastName: true } }, sdr: { select: { name: true } } },
    }),
    db.callTask.count({ where: { ...taskWhere, status: "DONE", completedAt: { gte: weekAgo }, outcome: { notIn: ["paid"] } } }),
    db.payment.findMany({
      where: { paidAt: { gte: monthAgo }, ...(sdrFilter ? { candidate: { assignedSdrId: sdrFilter } } : {}) },
      select: { amount: true },
    }),
    isSdr ? Promise.resolve([]) : db.user.findMany({ where: { role: "SDR", active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const overdue = open.filter((task) => task.dueAt < now).length;
  const s = t.sdr;

  const kpis = [
    { label: s.toCall, value: String(open.length) },
    { label: s.overdue, value: String(overdue), alert: overdue > 0 },
    { label: s.callsWeek, value: String(callsWeek) },
    { label: s.salesMonth, value: String(sales.length) },
    { label: s.revenueMonth, value: formatMoney(sales.reduce((n, p) => n + p.amount, 0), locale) },
  ];

  return (
    <>
      <PageHeader
        title={s.title}
        subtitle={s.subtitle}
        actions={
          !isSdr && (
            <form action="/sdr" className="flex gap-2">
              <select name="sdr" defaultValue={sdrFilter} className={selectClass} aria-label="SDR">
                <option value="">{s.allSdrs}</option>
                {sdrs.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <button type="submit" className={buttonClass.secondary}>{t.candidates.filter}</button>
            </form>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{k.label}</p>
            <p className={clsx("mt-2 text-2xl font-semibold tabular-nums tracking-tight", k.alert ? "text-red-700" : "text-slate-900")}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={s.queue} className="lg:col-span-2">
          {open.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{s.empty}</p>
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {open.map((task) => {
                const c = task.candidate;
                const late = task.dueAt < now;
                return (
                  <li key={task.id} className="flex flex-wrap items-center gap-4 py-3" data-testid="sdr-task">
                    <Avatar text={initials(c.firstName, c.lastName)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/candidates/${c.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                          {c.firstName} {c.lastName}
                        </Link>
                        <StatusBadge status={c.status} label={t.statuses[c.status]} />
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{s.kinds[task.kind as "closing" | "callback"] ?? task.kind}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {c.recommendedProduct ? `${c.recommendedProduct.name} · ${formatMoney(c.recommendedProduct.price, locale)}` : "—"}
                        {!isSdr && ` · ${task.sdr.name}`}
                      </p>
                      <p className={clsx("mt-0.5 flex items-center gap-1 text-xs", late ? "font-medium text-red-700" : "text-slate-500")}>
                        {late && <AlertTriangle className="size-3.5" />}
                        {late ? s.overdueBadge : s.due} · {formatDateTime(task.dueAt, locale)}
                      </p>
                    </div>
                    <ScorePill score={c.globalScore} />
                    {c.phone && (
                      <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className={buttonClass.secondary} title={c.phone}>
                        <Phone className="size-4" /> <span className="hidden sm:inline">{c.phone}</span>
                      </a>
                    )}
                    <Link href={`/sdr/appel/${c.id}`} className={buttonClass.primary}>
                      <PhoneCall className="size-4" /> {s.openSheet}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={s.recent}>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">{s.noRecent}</p>
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {recent.map((task) => (
                <li key={task.id} className="py-2.5">
                  <Link href={`/candidates/${task.candidate.id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-600">
                    {task.candidate.firstName} {task.candidate.lastName}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {s.outcomes[task.outcome as keyof typeof s.outcomes] ?? task.outcome}
                    {task.completedAt && ` · ${formatDateTime(task.completedAt, locale)}`}
                    {!isSdr && ` · ${task.sdr.name}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

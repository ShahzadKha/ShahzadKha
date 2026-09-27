import Link from "next/link";
import { Plus, Search, Upload } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { STATUS_ORDER } from "@/lib/pipeline";
import { TRACKS, trackRangeLabel } from "@/lib/rules";
import { getScoringRules } from "@/lib/settings";
import { formatDate, initials } from "@/lib/format";
import { Avatar, PageHeader, ScorePill, StatusBadge, buttonClass, inputClass, selectClass } from "@/components/ui";
import type { Prisma } from "@/generated/prisma/client";
import { CandidateSource, CandidateStatus, RoutingTrack } from "@/generated/prisma/enums";

const PAGE_SIZE = 15;
const SOURCES = Object.values(CandidateSource);

export default async function CandidatesPage({ searchParams }: PageProps<"/candidates">) {
  await requireUser();
  const { t, locale } = await getDictionary();
  const rules = await getScoringRules();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  const q = one(params.q).trim();
  const status = one(params.status) as CandidateStatus | "";
  const source = one(params.source) as CandidateSource | "";
  const track = one(params.track) as RoutingTrack | "none" | "";
  const page = Math.max(1, Number(one(params.page)) || 1);

  const where: Prisma.CandidateWhereInput = {};
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { currentTitle: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status && status in CandidateStatus) where.status = status;
  if (source && SOURCES.includes(source)) where.source = source;
  if (track === "none") where.globalScore = null;
  else if (track && TRACKS.includes(track)) where.routingTrack = track;

  const [total, candidates] = await Promise.all([
    db.candidate.count({ where }),
    db.candidate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        recommendedProduct: { select: { name: true } },
        assignedSdr: { select: { name: true } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (source) sp.set("source", source);
    if (track) sp.set("track", track);
    sp.set("page", String(p));
    return `/candidates?${sp}`;
  };

  return (
    <>
      <PageHeader
        title={t.candidates.title}
        subtitle={t.candidates.subtitle}
        actions={
          <>
            <Link href="/candidates/new" className={buttonClass.secondary}>
              <Plus className="size-4" /> {t.candidates.add}
            </Link>
            <Link href="/candidates/upload" className={buttonClass.primary}>
              <Upload className="size-4" /> {t.candidates.import}
            </Link>
          </>
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/candidates">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder={t.candidates.search} className={`${inputClass} pl-9`} />
        </div>
        <select name="status" defaultValue={status} className={selectClass} aria-label={t.candidates.cols.status}>
          <option value="">{t.candidates.allStatuses}</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{t.statuses[s]}</option>
          ))}
        </select>
        <select name="source" defaultValue={source} className={selectClass} aria-label={t.candidates.cols.source}>
          <option value="">{t.candidates.allSources}</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{t.sources[s]}</option>
          ))}
        </select>
        <select name="track" defaultValue={track} className={selectClass} aria-label={t.profile.track}>
          <option value="">{t.candidates.allTracks}</option>
          {TRACKS.map((tr) => (
            <option key={tr} value={tr}>{trackRangeLabel(tr, rules)} · {t.tracks[tr]}</option>
          ))}
          <option value="none">{t.candidates.notAnalyzed}</option>
        </select>
        <button type="submit" className={buttonClass.secondary}>{t.candidates.filter}</button>
        {(q || status || source || track) && (
          <Link href="/candidates" className="px-2 text-sm text-slate-500 hover:text-slate-800">{t.candidates.reset}</Link>
        )}
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">{t.candidates.cols.name}</th>
                <th className="px-4 py-3">{t.candidates.cols.title}</th>
                <th className="hidden px-4 py-3 2xl:table-cell">{t.candidates.cols.source}</th>
                <th className="px-4 py-3">{t.candidates.cols.status}</th>
                <th className="px-4 py-3 text-right">{t.candidates.cols.score}</th>
                <th className="px-4 py-3">{t.candidates.cols.product}</th>
                <th className="px-4 py-3">{t.candidates.cols.sdr}</th>
                <th className="px-4 py-3">{t.candidates.cols.created}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/candidates/${c.id}`} className="flex items-center gap-3">
                      <Avatar text={initials(c.firstName, c.lastName)} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900 hover:text-indigo-600">
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{c.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="max-w-44 truncate px-4 py-3 text-slate-600">{c.currentTitle ?? "—"}</td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-slate-600 2xl:table-cell">{t.sources[c.source]}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} label={t.statuses[c.status]} /></td>
                  <td className="px-4 py-3 text-right"><ScorePill score={c.globalScore} /></td>
                  <td className="max-w-44 truncate px-4 py-3 text-slate-600">{c.recommendedProduct?.name ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{c.assignedSdr?.name ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(c.createdAt, locale)}</td>
                </tr>
              ))}
              {candidates.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">{t.candidates.empty}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <span>
            {total} {t.candidates.results} · {t.candidates.page} {Math.min(page, pages)} {t.candidates.of} {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && <Link href={pageHref(page - 1)} className={buttonClass.secondary}>{t.candidates.previous}</Link>}
            {page < pages && <Link href={pageHref(page + 1)} className={buttonClass.secondary}>{t.candidates.next}</Link>}
          </div>
        </div>
      </div>
    </>
  );
}

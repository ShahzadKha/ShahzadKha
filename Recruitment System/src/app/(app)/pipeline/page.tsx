import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { STATUS_ORDER, STATUS_PHASE } from "@/lib/pipeline";
import { TRACKS } from "@/lib/rules";
import type { Prisma } from "@/generated/prisma/client";
import { RoutingTrack, type CandidateStatus } from "@/generated/prisma/enums";
import { PageHeader, buttonClass, selectClass } from "@/components/ui";
import { Board, type BoardCard, type BoardColumn } from "./board";

export const metadata = { title: "Pipeline" };

const CLOSED: CandidateStatus[] = ["WON", "LOST", "NOT_ELIGIBLE"];
const PROCESSING: CandidateStatus[] = ["NEW_CV", "CV_PARSED", "GPT_ANALYZED"];
const PER_COLUMN = 50;

export default async function PipelinePage({ searchParams }: PageProps<"/pipeline">) {
  await requireUser();
  const { t } = await getDictionary();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const track = one(params.track) as RoutingTrack | "";
  const sdr = one(params.sdr);
  const showClosed = one(params.closed) === "1";

  const where: Prisma.CandidateWhereInput = {};
  if (track && track in RoutingTrack) where.routingTrack = track;
  if (sdr) where.assignedSdrId = sdr;
  if (!showClosed) where.status = { notIn: CLOSED };

  const [counts, rows, sdrs] = await Promise.all([
    db.candidate.groupBy({ by: ["status"], where, _count: { _all: true } }),
    db.candidate.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        currentTitle: true,
        status: true,
        globalScore: true,
        routingTrack: true,
        recommendedProduct: { select: { name: true } },
        assignedSdr: { select: { name: true } },
      },
    }),
    db.user.findMany({ where: { role: "SDR", active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const countBy = new Map(counts.map((c) => [c.status, c._count._all]));

  const statuses = STATUS_ORDER.filter(
    (s) => (showClosed || !CLOSED.includes(s)) && (!PROCESSING.includes(s) || countBy.get(s)),
  );
  const columns: BoardColumn[] = statuses.map((s) => {
    const cards: BoardCard[] = rows
      .filter((r) => r.status === s)
      .slice(0, PER_COLUMN)
      .map((r) => ({
        id: r.id,
        name: `${r.firstName} ${r.lastName}`,
        title: r.currentTitle,
        score: r.globalScore,
        product: r.recommendedProduct?.name ?? null,
        track: r.routingTrack ? t.tracks[r.routingTrack] : null,
        sdr: r.assignedSdr?.name ?? null,
      }));
    return { status: s, label: t.statuses[s], phase: STATUS_PHASE[s], total: countBy.get(s) ?? 0, cards };
  });

  return (
    <div data-wide>
      <PageHeader title={t.pipeline.title} subtitle={t.pipeline.subtitle} />
      <form className="mb-4 flex flex-wrap items-center gap-2" action="/pipeline">
        <select name="track" defaultValue={track} className={selectClass} aria-label={t.profile.track}>
          <option value="">{t.pipeline.allTracks}</option>
          {TRACKS.map((tr) => (
            <option key={tr} value={tr}>{t.tracks[tr]}</option>
          ))}
        </select>
        <select name="sdr" defaultValue={sdr} className={selectClass} aria-label="SDR">
          <option value="">{t.pipeline.allSdrs}</option>
          {sdrs.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 px-2 text-sm text-slate-700">
          <input type="checkbox" name="closed" value="1" defaultChecked={showClosed} className="size-4 rounded border-slate-300" />
          {t.pipeline.showClosed}
        </label>
        <button type="submit" className={buttonClass.secondary}>{t.candidates.filter}</button>
        {(track || sdr || showClosed) && (
          <Link href="/pipeline" className="px-2 text-sm text-slate-500 hover:text-slate-800">{t.candidates.reset}</Link>
        )}
      </form>
      <Board columns={columns} t={{ empty: t.pipeline.empty, more: t.pipeline.more, moved: t.pipeline.moved }} />
    </div>
  );
}

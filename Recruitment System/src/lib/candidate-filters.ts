import type { Prisma } from "@/generated/prisma/client";
import { CandidateSource, CandidateStatus, type RoutingTrack } from "@/generated/prisma/enums";
import { TRACKS } from "@/lib/rules";

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// Search and filters of the candidate list, shared by the page and the CSV export
export function candidateFilters(params: Params) {
  const q = one(params.q).trim();
  const status = one(params.status) as CandidateStatus | "";
  const source = one(params.source) as CandidateSource | "";
  const track = one(params.track) as RoutingTrack | "none" | "";

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
  if (source && source in CandidateSource) where.source = source;
  if (track === "none") where.globalScore = null;
  else if (track && TRACKS.includes(track)) where.routingTrack = track;

  return { where, q, status, source, track };
}

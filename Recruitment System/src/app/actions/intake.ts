"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { analyzeCandidate, ingestCv, requestAnalysis } from "@/lib/engine/pipeline";
import { intakeErrorCode, type IntakeErrorCode } from "@/lib/engine/errors";
import { CandidateSource } from "@/generated/prisma/enums";

export type UploadResult =
  | { ok: true; candidateId: string; name: string; duplicate: boolean }
  | { ok: false; error: IntakeErrorCode };

const UPLOAD_SOURCES: CandidateSource[] = ["FILE_DROP", "EMAIL", "CSV_IMPORT", "MANUAL"];

// Internal upload: one CV per call, so large batches never hit request size limits
export async function uploadCv(formData: FormData): Promise<UploadResult> {
  const user = await requireUser();
  const file = formData.get("file");
  const sourceValue = String(formData.get("source") ?? "FILE_DROP") as CandidateSource;
  const source = UPLOAD_SOURCES.includes(sourceValue) ? sourceValue : "FILE_DROP";
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "no_file" };

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await ingestCv({ source, actorId: user.id, file: { bytes, fileName: file.name, mimeType: file.type } });
    after(() => analyzeCandidate(result.candidateId));
    revalidatePath("/candidates");
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: intakeErrorCode(error) };
  }
}

export type AnalysisProgress = {
  id: string;
  status: string;
  analysisState: string | null;
  globalScore: number | null;
  product: string | null;
};

export async function getAnalysisProgress(ids: string[]): Promise<AnalysisProgress[]> {
  await requireUser();
  const rows = await db.candidate.findMany({
    where: { id: { in: ids.slice(0, 100) } },
    select: { id: true, status: true, analysisState: true, globalScore: true, recommendedProduct: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    analysisState: r.analysisState,
    globalScore: r.globalScore,
    product: r.recommendedProduct?.name ?? null,
  }));
}

export async function reanalyzeCandidate(candidateId: string) {
  const user = await requireUser(["ADMIN", "RECRUITER"]);
  if (await requestAnalysis(candidateId)) {
    after(() => analyzeCandidate(candidateId, user.id));
  }
  revalidatePath(`/candidates/${candidateId}`);
}

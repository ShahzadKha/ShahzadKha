"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { analyzeCandidate, ingestCv, requestAnalysis } from "@/lib/engine/pipeline";
import { intakeErrorCode, type IntakeErrorCode } from "@/lib/engine/errors";
import { CandidateSource } from "@/generated/prisma/enums";
import { mapHeaders, parseCsv } from "@/lib/csv";

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

export type CsvImportState =
  | { ok: true; created: number; updated: number; toAnalyze: number; errors: { row: number; reason: IntakeErrorCode | "missing_email" }[] }
  | { ok: false; error: "no_file" | "too_large" | "no_email_column" | "too_many_rows" | "empty" }
  | undefined;

const MAX_ROWS = 500;

// Source 3 "Import CSV (partenaires, jobboards)": one candidate per row, deduplicated, analysed when a CV text is given
export async function importCsv(_prev: CsvImportState, formData: FormData): Promise<CsvImportState> {
  const user = await requireUser(["ADMIN", "RECRUITER"]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "no_file" };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "too_large" };

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { ok: false, error: "empty" };
  const cols = mapHeaders(rows[0]);
  if (cols.email === undefined) return { ok: false, error: "no_email_column" };
  if (rows.length - 1 > MAX_ROWS) return { ok: false, error: "too_many_rows" };
  const defaultDetail = String(formData.get("sourceDetail") ?? "").trim() || null;

  const get = (r: string[], k: keyof typeof cols) => (cols[k] !== undefined ? r[cols[k]!]?.trim() || undefined : undefined);
  let created = 0;
  let updated = 0;
  const toAnalyze: string[] = [];
  const errors: { row: number; reason: IntakeErrorCode | "missing_email" }[] = [];

  for (const [i, r] of rows.slice(1).entries()) {
    const email = get(r, "email");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: i + 2, reason: "missing_email" });
      continue;
    }
    try {
      const res = await ingestCv({
        source: "CSV_IMPORT",
        actorId: user.id,
        text: get(r, "cvText"),
        contact: { firstName: get(r, "firstName"), lastName: get(r, "lastName"), email, phone: get(r, "phone"), city: get(r, "city") },
        motivation: get(r, "motivation"),
        sourceDetail: get(r, "sourceDetail") ?? defaultDetail,
      });
      if (res.duplicate) updated++;
      else created++;
      if (get(r, "cvText")) toAnalyze.push(res.candidateId);
    } catch (error) {
      errors.push({ row: i + 2, reason: intakeErrorCode(error) });
    }
  }
  // Analyse in the background, one after the other
  after(async () => {
    for (const id of toAnalyze) await analyzeCandidate(id);
  });
  revalidatePath("/candidates");
  return { ok: true, created, updated, toAnalyze: toAnalyze.length, errors: errors.slice(0, 50) };
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Bot, CheckCircle2, CopyCheck, FileText, Loader2, UploadCloud, XCircle } from "lucide-react";
import { getAnalysisProgress, uploadCv, type AnalysisProgress } from "@/app/actions/intake";
import { buttonClass, selectClass, ScorePill, StatusBadge } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/fr";
import type { CandidateStatus } from "@/generated/prisma/enums";

type Labels = {
  upload: Dictionary["upload"];
  errors: Dictionary["intakeErrors"];
  sources: Dictionary["sources"];
  statuses: Dictionary["statuses"];
};

type Row = {
  key: string;
  file: File;
  state: "queued" | "uploading" | "done" | "error";
  error?: keyof Dictionary["intakeErrors"];
  candidateId?: string;
  name?: string;
  duplicate?: boolean;
  progress?: AnalysisProgress;
};

const SOURCES = ["FILE_DROP", "EMAIL", "CSV_IMPORT"] as const;
const ACCEPT = ".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png,image/webp";

export function CvUploader({ t, aiLabel }: { t: Labels; aiLabel: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [source, setSource] = useState<(typeof SOURCES)[number]>("FILE_DROP");
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function addFiles(files: FileList | File[]) {
    const added = Array.from(files).map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file, state: "queued" as const }));
    setRows((rs) => [...rs, ...added]);
  }

  async function start() {
    setRunning(true);
    // One file per request keeps each upload small and shows progress file by file
    for (const row of rows.filter((r) => r.state === "queued")) {
      update(row.key, { state: "uploading" });
      const fd = new FormData();
      fd.set("file", row.file);
      fd.set("source", source);
      try {
        const res = await uploadCv(fd);
        if (res.ok) update(row.key, { state: "done", candidateId: res.candidateId, name: res.name, duplicate: res.duplicate });
        else update(row.key, { state: "error", error: res.error });
      } catch {
        update(row.key, { state: "error", error: "unknown" });
      }
    }
    setRunning(false);
  }

  // Poll analysis results for uploaded candidates until every analysis is finished
  const waiting = rows.filter((r) => r.candidateId && (!r.progress || r.progress.analysisState === "PENDING"));
  const waitingIds = waiting.map((r) => r.candidateId!).join(",");
  useEffect(() => {
    if (!waitingIds) return;
    const id = setInterval(async () => {
      const progress = await getAnalysisProgress(waitingIds.split(","));
      setRows((rs) => rs.map((r) => ({ ...r, progress: progress.find((p) => p.id === r.candidateId) ?? r.progress })));
    }, 2000);
    return () => clearInterval(id);
  }, [waitingIds]);

  const queued = rows.filter((r) => r.state === "queued").length;

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={clsx(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragging ? "border-indigo-400 bg-indigo-50" : "border-slate-300 bg-white",
        )}
      >
        <UploadCloud className="size-10 text-slate-400" />
        <p className="mt-3 font-medium text-slate-900">{t.upload.drop}</p>
        <p className="my-2 text-sm text-slate-500">{t.upload.or}</p>
        <button type="button" onClick={() => inputRef.current?.click()} className={buttonClass.secondary}>
          {t.upload.browse}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          data-testid="cv-input"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="mt-3 text-xs text-slate-500">{t.upload.formats}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          {t.upload.source}
          <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className={selectClass}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>{t.sources[s]}</option>
            ))}
          </select>
        </label>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          <Bot className="size-3.5" /> {t.upload.aiMode} : {aiLabel}
        </span>
        <div className="ml-auto flex gap-2">
          {rows.length > 0 && !running && (
            <button type="button" onClick={() => setRows([])} className={buttonClass.secondary}>{t.upload.clear}</button>
          )}
          <button type="button" onClick={start} disabled={!queued || running} className={buttonClass.primary}>
            {running && <Loader2 className="size-4 animate-spin" />}
            {t.upload.start} {queued > 0 && `(${queued})`}
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {rows.map((r) => {
            const p = r.progress;
            const analyzing = r.state === "done" && (!p || p.analysisState === "PENDING");
            return (
              <li key={r.key} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid="upload-row">
                <FileText className="size-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{r.name || r.file.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {r.file.name} · {Math.max(1, Math.round(r.file.size / 1024))} Ko
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {r.state === "queued" && <span className="text-slate-500">{t.upload.queued}</span>}
                  {r.state === "uploading" && (
                    <span className="inline-flex items-center gap-1.5 text-slate-600"><Loader2 className="size-4 animate-spin" /> {t.upload.uploading}</span>
                  )}
                  {r.state === "error" && (
                    <span className="inline-flex items-center gap-1.5 text-red-700"><XCircle className="size-4" /> {t.errors[r.error ?? "unknown"]}</span>
                  )}
                  {r.duplicate && (
                    <span className="inline-flex items-center gap-1.5 text-amber-700"><CopyCheck className="size-4" /> {t.upload.duplicate}</span>
                  )}
                  {analyzing && (
                    <span className="inline-flex items-center gap-1.5 text-sky-700"><Loader2 className="size-4 animate-spin" /> {t.upload.analyzing}</span>
                  )}
                  {p && p.analysisState !== "PENDING" && (
                    <>
                      {p.analysisState === "DONE" && <CheckCircle2 className="size-4 text-emerald-600" />}
                      <StatusBadge status={p.status as CandidateStatus} label={t.statuses[p.status as CandidateStatus]} />
                      {p.product && <span className="hidden max-w-52 truncate text-slate-600 md:inline">{p.product}</span>}
                      <ScorePill score={p.globalScore} />
                    </>
                  )}
                  {r.candidateId && (
                    <Link href={`/candidates/${r.candidateId}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                      {t.upload.open}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {rows.some((r) => r.state === "done") && !running && (
        <Link href="/candidates" className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500">
          {t.upload.viewAll} →
        </Link>
      )}
    </div>
  );
}

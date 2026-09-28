"use client";

import { useActionState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { importCsv, type CsvImportState } from "@/app/actions/intake";
import { buttonClass, inputClass } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/fr";

export function CsvImport({ t, errors }: { t: Dictionary["csvImport"]; errors: Dictionary["intakeErrors"] }) {
  const [state, action, pending] = useActionState<CsvImportState, FormData>(importCsv, undefined);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileSpreadsheet className="size-4 text-slate-500" /> {t.title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">{t.hint}</p>
        </div>
        <a href="/modele-import-candidats.csv" download className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500">
          <Download className="size-3.5" /> {t.template}
        </a>
      </div>
      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block min-w-60 flex-1 text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t.file}</span>
          <input type="file" name="file" accept=".csv,text/csv" required data-testid="csv-input" className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700" />
        </label>
        <label className="block w-56 text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t.partner}</span>
          <input name="sourceDetail" maxLength={60} placeholder="Indeed, Pôle emploi…" className={inputClass} />
        </label>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending && <Loader2 className="size-4 animate-spin" />} {t.submit}
        </button>
      </form>
      {state?.ok === false && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{t.errors[state.error]}</p>}
      {state?.ok && (
        <div role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="size-4" /> {state.created} {t.created} · {state.updated} {t.updated} · {state.toAnalyze} {t.analyzing}
          </p>
          {state.errors.length > 0 && (
            <ul className="mt-1 list-disc pl-6 text-xs text-red-700">
              {state.errors.map((e) => (
                <li key={e.row}>
                  {t.row} {e.row} : {e.reason === "missing_email" ? t.missingEmail : errors[e.reason]}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

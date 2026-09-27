"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, FileText } from "lucide-react";
import { submitApplication, type ApplyState } from "@/app/actions/apply";
import { buttonClass, inputClass } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/fr";

type Labels = { apply: Dictionary["apply"]; errors: Dictionary["intakeErrors"] };

export function ApplyForm({ t, ref_ }: { t: Labels; ref_?: string }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(submitApplication, undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<ApplyState>(undefined);

  if (state?.ok && state !== dismissed) {
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <h2 className="mt-4 text-xl font-semibold text-slate-900">{t.apply.successTitle}</h2>
        <p className="mt-2 text-slate-600">{t.apply.successBody}</p>
        <button type="button" onClick={() => {
            setDismissed(state);
            setFileName(null);
          }} className={`${buttonClass.secondary} mt-6`}>
          {t.apply.another}
        </button>
      </div>
    );
  }

  const bad = (f: string) => state?.ok === false && state.fields?.includes(f);
  const values = state?.ok === false ? state.values : undefined;
  const field = (name: "firstName" | "lastName" | "email" | "phone" | "city", type = "text", required = false) => (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-slate-700">
        {t.apply[name]}
        {required && <span className="text-red-600"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={values?.[name]}
        aria-invalid={bad(name)}
        className={inputClass}
      />
    </div>
  );

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {field("firstName", "text", true)}
        {field("lastName", "text", true)}
        {field("email", "email", true)}
        {field("phone", "tel")}
        {field("city")}
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {t.apply.cv} <span className="text-red-600">*</span>
        </span>
        <label
          htmlFor="cv"
          className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-4 text-sm hover:border-indigo-400 ${bad("cv") ? "border-red-300" : "border-slate-300"}`}
        >
          <FileText className="size-6 text-slate-400" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-slate-900">{fileName ?? t.apply.cv}</span>
            <span className="text-xs text-slate-500">{t.apply.cvHint}</span>
          </span>
        </label>
        <input
          id="cv"
          name="cv"
          type="file"
          required
          accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </div>

      <div>
        <label htmlFor="motivation" className="mb-1 block text-sm font-medium text-slate-700">{t.apply.motivation}</label>
        <textarea
          id="motivation"
          name="motivation"
          rows={3}
          maxLength={2000}
          defaultValue={values?.motivation}
          placeholder={t.apply.motivationPlaceholder}
          className={inputClass}
        />
      </div>

      {ref_ && <input type="hidden" name="ref" value={ref_} />}
      {/* Honeypot for bots — hidden from people */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <label className="flex items-start gap-3 text-sm text-slate-600">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 rounded border-slate-300 text-indigo-600" />
        <span>{t.apply.consent}</span>
      </label>

      {state?.ok === false && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{t.errors[state.error]}</p>
      )}

      <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full justify-center py-2.5`}>
        {pending ? t.apply.sending : t.apply.submit}
      </button>
    </form>
  );
}

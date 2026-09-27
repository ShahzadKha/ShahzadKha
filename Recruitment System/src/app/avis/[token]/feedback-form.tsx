"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { buttonClass, inputClass } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/fr";

type State = { ok: boolean } | undefined;

export function FeedbackForm({ action, done, t }: { action: (p: State, f: FormData) => Promise<State>; done: boolean; t: Dictionary["feedbackPage"] }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  if (state?.ok || done) {
    return (
      <div className="mt-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
        <p className="mt-3 font-semibold text-slate-900">{t.thanks}</p>
      </div>
    );
  }
  return (
    <form action={formAction} className="mt-6 space-y-6">
      <fieldset>
        <legend className="text-sm font-medium text-slate-900">{t.question}</legend>
        <div className="mt-3 grid grid-cols-11 gap-1">
          {Array.from({ length: 11 }, (_, n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="nps" value={n} required className="peer sr-only" />
              <span className="flex h-10 items-center justify-center rounded-md border border-slate-300 text-sm font-medium tabular-nums text-slate-700 peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500">
                {n}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-slate-500">
          <span>{t.notLikely}</span>
          <span>{t.veryLikely}</span>
        </div>
      </fieldset>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">{t.comment}</span>
        <textarea name="comment" rows={4} maxLength={2000} className={inputClass} />
      </label>
      <label className="flex items-start gap-3 text-sm text-slate-600">
        <input type="checkbox" name="publishConsent" className="mt-0.5 size-4 rounded border-slate-300" />
        {t.publish}
      </label>
      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700">{t.referTitle}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="referralName" maxLength={80} placeholder={t.referName} aria-label={t.referName} className={inputClass} />
          <input name="referralEmail" type="email" placeholder={t.referEmail} aria-label={t.referEmail} className={inputClass} />
        </div>
      </fieldset>
      <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full justify-center py-2.5`}>
        {t.submit}
      </button>
    </form>
  );
}

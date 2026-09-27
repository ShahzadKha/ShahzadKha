"use client";

import { useActionState, useState } from "react";
import type { CallState } from "@/app/actions/closing";
import { buttonClass, inputClass, selectClass } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/fr";

type Outcome = keyof Dictionary["callSheet"]["outcomes"];

export function CallForm({
  action,
  t,
  timeZone,
}: {
  action: (prev: CallState, formData: FormData) => Promise<CallState>;
  t: Dictionary["callSheet"];
  timeZone: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [outcome, setOutcome] = useState<Outcome>("payment_link");

  return (
    <form action={formAction} className="space-y-4 text-sm">
      <fieldset>
        <legend className="mb-2 font-medium text-slate-900">{t.outcome}</legend>
        <div className="space-y-2">
          {(Object.keys(t.outcomes) as Outcome[]).map((o) => (
            <label key={o} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
              <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} className="mt-0.5" />
              {t.outcomes[o]}
            </label>
          ))}
        </div>
      </fieldset>

      {outcome === "callback" && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            {t.callbackAt} <span className="font-normal text-slate-400">({timeZone.replace(/_/g, " ")})</span>
          </span>
          <input type="datetime-local" name="callbackAt" required className={inputClass} />
        </label>
      )}
      {outcome === "lost" && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t.lostReason}</span>
          <select name="lostReason" className={`${selectClass} w-full`}>
            {t.lostReasons.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t.duration}</span>
          <input type="number" name="durationMin" min={0} max={300} className={`${inputClass} tabular-nums`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{t.blocker}</span>
          <select name="blocker" defaultValue="none" className={`${selectClass} w-full`}>
            {(Object.keys(t.blockers) as (keyof typeof t.blockers)[]).map((b) => (
              <option key={b} value={b}>{t.blockers[b]}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{t.notes}</span>
        <textarea name="notes" rows={4} maxLength={3000} className={inputClass} />
      </label>
      {state?.ok === false && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{t.callbackAt} ?</p>}
      <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full justify-center`}>
        {t.save}
      </button>
    </form>
  );
}

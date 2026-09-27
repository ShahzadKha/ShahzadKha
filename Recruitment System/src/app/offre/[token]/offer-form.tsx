"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/fr";

type State = { ok: boolean } | undefined;

export function OfferForm({
  action,
  alreadyInterested,
  t,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  alreadyInterested: boolean;
  t: Dictionary["offer"];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  if (state?.ok || alreadyInterested) {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
        <p className="mt-3 font-semibold text-slate-900">{t.thanksTitle}</p>
        <p className="mt-1 text-sm text-slate-600">{t.thanksBody}</p>
      </div>
    );
  }

  const options = [
    [14, t.when14],
    [30, t.when30],
    [60, t.when60],
    [120, t.when120],
  ] as const;

  return (
    <form action={formAction}>
      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">{t.whenTitle}</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {options.map(([days, label], i) => (
            <label key={days} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
              <input type="radio" name="timing" value={days} required defaultChecked={i === 1} className="text-indigo-600" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" disabled={pending} className={`${buttonClass.primary} mt-5 w-full justify-center py-2.5`}>
        {t.cta}
      </button>
    </form>
  );
}

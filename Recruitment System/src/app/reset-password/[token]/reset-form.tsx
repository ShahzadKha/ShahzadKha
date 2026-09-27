"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ResetState } from "@/app/actions/password";
import { buttonClass, inputClass } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/fr";

export function ResetForm({ action, t }: { action: (p: ResetState, f: FormData) => Promise<ResetState>; t: Dictionary["forgot"] }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  if (state?.result === "done") {
    return (
      <div className="space-y-4 text-center">
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{t.done}</p>
        <Link href="/login" className={`${buttonClass.primary} w-full justify-center`}>{t.back}</Link>
      </div>
    );
  }
  return (
    <form action={formAction} className="space-y-4">
      <h2 className="text-base font-semibold text-slate-900">{t.resetTitle}</h2>
      {(["next", "confirm"] as const).map((f) => (
        <label key={f} className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">{t[f]}</span>
          <input name={f} type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        </label>
      ))}
      {state && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.result === "invalid" ? t.invalid : t.mismatch}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full justify-center`}>{t.save}</button>
      {state?.result === "invalid" && <Link href="/forgot-password" className="block text-center text-sm text-indigo-600">{t.link}</Link>}
    </form>
  );
}

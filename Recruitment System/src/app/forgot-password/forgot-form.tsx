"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type ForgotState } from "@/app/actions/password";
import { buttonClass, inputClass } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/fr";

export function ForgotForm({ t }: { t: Dictionary["forgot"] }) {
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestPasswordReset, undefined);
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-slate-900">{t.title}</h2>
      {state ? (
        <p role="status" className={`rounded-lg px-3 py-2 text-sm ${state.result === "sent" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
          {state.result === "sent" ? t.sent : t.noEmail}
        </p>
      ) : (
        <form action={action} className="space-y-4">
          <p className="text-sm text-slate-600">{t.intro}</p>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">{t.email}</span>
            <input name="email" type="email" required autoComplete="email" className={inputClass} />
          </label>
          <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full justify-center`}>{t.submit}</button>
        </form>
      )}
      <Link href="/login" className="block text-center text-sm text-indigo-600 hover:text-indigo-500">{t.back}</Link>
    </div>
  );
}

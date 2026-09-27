"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";
import { buttonClass, inputClass } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/fr";

export function LoginForm({ labels }: { labels: Dictionary["login"] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);

  return (
    <form action={action} className="space-y-4">
      <h2 className="text-base font-semibold text-slate-900">{labels.title}</h2>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">{labels.email}</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.email} className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">{labels.password}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error === "locked" ? labels.locked : labels.invalid}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full justify-center`}>
        {labels.submit}
      </button>
    </form>
  );
}

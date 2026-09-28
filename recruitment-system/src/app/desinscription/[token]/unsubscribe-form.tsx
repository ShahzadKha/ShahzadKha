"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/fr";

export function UnsubscribeForm({ action, t }: { action: () => Promise<{ ok: boolean }>; t: Dictionary["unsubscribe"] }) {
  const [state, formAction, pending] = useActionState(async () => action(), undefined);
  if (state?.ok) return <p className="mt-6 font-medium text-emerald-700">{t.done}</p>;
  return (
    <form action={formAction} className="mt-6">
      <button type="submit" disabled={pending} className={`${buttonClass.secondary} justify-center`}>
        {t.confirm}
      </button>
    </form>
  );
}

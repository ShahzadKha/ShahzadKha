"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { buttonClass } from "@/components/ui";

export function PayButton({
  action,
  labels,
}: {
  action: () => Promise<{ ok: boolean }>;
  labels: { pay: string; paidTitle: string; paidBody: string };
}) {
  const [state, formAction, pending] = useActionState(async () => action(), undefined);
  if (state?.ok) {
    return (
      <div className="mt-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
        <p className="mt-3 font-semibold text-slate-900">{labels.paidTitle}</p>
        <p className="mt-1 text-sm text-slate-600">{labels.paidBody}</p>
      </div>
    );
  }
  return (
    <form action={formAction} className="mt-6">
      <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full justify-center py-2.5`}>
        {labels.pay}
      </button>
    </form>
  );
}

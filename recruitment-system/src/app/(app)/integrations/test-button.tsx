"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { TestResult } from "@/app/actions/integrations";
import { buttonClass } from "@/components/ui";

export function TestButton({ action, label, disabled }: { action: () => Promise<TestResult>; label: string; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(async () => action(), undefined);
  return (
    <form action={formAction} className="space-y-2">
      <button type="submit" disabled={pending || disabled} className={`${buttonClass.secondary} py-1.5 text-xs`}>
        {pending && <Loader2 className="size-3.5 animate-spin" />} {label}
      </button>
      {state && !pending && (
        <p role="status" className={`flex items-start gap-1.5 text-xs ${state.ok ? "text-emerald-700" : "text-red-700"}`}>
          {state.ok ? <CheckCircle2 className="mt-px size-3.5 shrink-0" /> : <XCircle className="mt-px size-3.5 shrink-0" />} {state.message}
        </p>
      )}
    </form>
  );
}

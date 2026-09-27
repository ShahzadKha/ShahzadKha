"use client";

import { useActionState, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import type { SettingsState } from "@/app/actions/settings";
import { buttonClass } from "@/components/ui";

// Form wrapper for settings: submit button + "saved" / "invalid" feedback
export function ActionForm({
  action,
  children,
  labels,
  className,
  resetOnSuccess,
}: {
  action: (prev: SettingsState, formData: FormData) => Promise<SettingsState>;
  children: ReactNode;
  labels: { save: string; saved: string; invalid: string };
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={className}
      // Settings forms keep their values after saving (React resets forms by default)
      onReset={(e) => !resetOnSuccess && e.preventDefault()}
    >
      {children}
      <div className="mt-4 flex items-center justify-end gap-3">
        {state && !pending && (
          <span className={`inline-flex items-center gap-1 text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`} role="status">
            {state.ok ? <><Check className="size-4" /> {labels.saved}</> : labels.invalid}
          </span>
        )}
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {labels.save}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import type { UserFormState } from "@/app/actions/users";
import { buttonClass } from "@/components/ui";

// Form with a save button and a result message, for the users and account pages
export function UserForm({
  action,
  children,
  labels,
  className,
  reset,
}: {
  action: (prev: UserFormState, formData: FormData) => Promise<UserFormState>;
  children: ReactNode;
  labels: { save: string; saved: string; errors: Record<NonNullable<NonNullable<UserFormState>["error"]>, string> };
  className?: string;
  reset?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    // Password and "new user" forms clear after submitting; edit forms keep their values
    <form action={formAction} className={className} onReset={(e) => !reset && e.preventDefault()}>
      {children}
      <div className="flex items-center justify-end gap-3">
        {state && !pending && (
          <span role="status" className={`inline-flex items-center gap-1 text-xs ${state.ok ? "text-emerald-700" : "text-red-700"}`}>
            {state.ok ? <><Check className="size-3.5" /> {labels.saved}</> : labels.errors[state.error ?? "invalid"]}
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

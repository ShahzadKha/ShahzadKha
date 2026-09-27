"use client";

import { AlertTriangle } from "lucide-react";
import { buttonClass } from "@/components/ui";

// Friendly message instead of a blank page when something fails
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-20 text-center">
      <AlertTriangle className="size-8 text-amber-500" />
      <p className="mt-4 font-medium text-slate-900">Une erreur est survenue / Something went wrong</p>
      <button type="button" onClick={reset} className={`${buttonClass.secondary} mt-6`}>
        Réessayer / Try again
      </button>
    </div>
  );
}

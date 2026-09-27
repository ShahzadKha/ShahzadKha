"use client";

import { useState, useTransition } from "react";
import { FastForward, Loader2, Send } from "lucide-react";
import { runDueEmails, simulateDaysAction } from "@/app/actions/nurture";
import { buttonClass } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/fr";

// "Send due emails" (what the daily scheduler does) and demo time travel
export function TimeControls({ t }: { t: Dictionary["sequences"] }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<number | null>(null);
  const run = (fn: () => Promise<number>) => start(async () => setResult(await fn()));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {result != null && !pending && (
        <span className="text-sm text-slate-600" role="status">{result} {t.ran}</span>
      )}
      {pending && <Loader2 className="size-4 animate-spin text-slate-500" />}
      <button type="button" disabled={pending} onClick={() => run(() => simulateDaysAction(1))} className={buttonClass.secondary}>
        <FastForward className="size-4" /> {t.simulateDay}
      </button>
      <button type="button" disabled={pending} onClick={() => run(() => simulateDaysAction(7))} className={buttonClass.secondary}>
        <FastForward className="size-4" /> {t.simulateWeek}
      </button>
      <button type="button" disabled={pending} onClick={() => run(runDueEmails)} className={buttonClass.primary}>
        <Send className="size-4" /> {t.runNow}
      </button>
    </div>
  );
}

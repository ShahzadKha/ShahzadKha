import clsx from "clsx";
import type { ReactNode } from "react";
import type { CandidateStatus } from "@/generated/prisma/enums";
import { PHASE_BADGE, STATUS_PHASE, scoreTone } from "@/lib/pipeline";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, hint, children, className, action }: {
  title?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={clsx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatusBadge({ status, label }: { status: CandidateStatus; label: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        PHASE_BADGE[STATUS_PHASE[status]],
      )}
    >
      {label}
    </span>
  );
}

export function ScorePill({ score }: { score: number | null }) {
  if (score == null) return <span className="text-sm text-slate-400">—</span>;
  return <span className={clsx("font-mono text-sm font-semibold tabular-nums", scoreTone(score))}>{score}</span>;
}

export function Avatar({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700",
        className,
      )}
    >
      {text}
    </span>
  );
}

export const buttonClass = {
  primary:
    "inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60",
  secondary:
    "inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
};

const fieldBase =
  "rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600";

export const inputClass = `block w-full ${fieldBase}`;
export const selectClass = `${fieldBase} pr-8`;

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createCandidate, type CandidateFormState } from "@/app/actions/candidates";
import { buttonClass, inputClass } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/fr";

type Labels = Dictionary["newCandidate"];

const FIELDS: { name: keyof Labels; type?: string; required?: boolean; wide?: boolean }[] = [
  { name: "firstName", required: true },
  { name: "lastName", required: true },
  { name: "email", type: "email", required: true },
  { name: "phone", type: "tel" },
  { name: "city" },
  { name: "currentTitle" },
  { name: "yearsExperience", type: "number" },
  { name: "linkedinUrl", type: "url" },
  { name: "skills", wide: true },
];

export function CandidateForm({ labels }: { labels: Labels }) {
  const [state, action, pending] = useActionState<CandidateFormState, FormData>(createCandidate, undefined);

  return (
    <form action={action} className="max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-5 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const error = state?.errors?.[f.name as keyof NonNullable<typeof state.errors>];
          return (
            <div key={f.name} className={f.wide ? "sm:col-span-2" : undefined}>
              <label htmlFor={f.name} className="mb-1 block text-sm font-medium text-slate-700">
                {labels[f.name]}
                {f.required && <span className="text-red-600"> *</span>}
              </label>
              <input
                id={f.name}
                name={f.name}
                type={f.type ?? "text"}
                required={f.required}
                min={f.type === "number" ? 0 : undefined}
                defaultValue={state?.values?.[f.name]}
                aria-invalid={!!error}
                className={inputClass}
              />
              {error && <p className="mt-1 text-xs text-red-600">{labels[error as "required" | "invalidEmail"]}</p>}
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Link href="/candidates" className={buttonClass.secondary}>{labels.cancel}</Link>
        <button type="submit" disabled={pending} className={buttonClass.primary}>{labels.submit}</button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { bulkAction, type BulkState } from "@/app/actions/bulk";
import { buttonClass, selectClass } from "@/components/ui";

type Labels = {
  selected: string; apply: string; choose: string; analyze: string; sequence: string; assign: string;
  moveTo: string; delete: string; confirmDelete: string; done: string; nothing: string;
};

// Row checkboxes use form="bulk" so they belong to this form while sitting in the table
export function BulkToolbar({ t, statuses, canDelete }: { t: Labels; statuses: { value: string; label: string }[]; canDelete: boolean }) {
  const [state, action, pending] = useActionState<BulkState, FormData>(bulkAction, undefined);
  const [choice, setChoice] = useState("");
  return (
    <form
      id="bulk"
      action={action}
      onSubmit={(e) => {
        const count = document.querySelectorAll('input[name="ids"][form="bulk"]:checked').length;
        if (count === 0) {
          e.preventDefault();
          window.alert(t.nothing);
        } else if (choice === "delete" && !window.confirm(t.confirmDelete.replace("{n}", String(count)))) e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm"
    >
      <span className="text-slate-600">{t.selected}</span>
      <select name="action" value={choice} onChange={(e) => setChoice(e.target.value)} required className={`${selectClass} py-1.5`} aria-label={t.choose}>
        <option value="">{t.choose}</option>
        <option value="analyze">{t.analyze}</option>
        <option value="sequence">{t.sequence}</option>
        <option value="assign">{t.assign}</option>
        <optgroup label={t.moveTo}>
          {statuses.map((s) => (
            <option key={s.value} value={`status:${s.value}`}>{s.label}</option>
          ))}
        </optgroup>
        {canDelete && <option value="delete">{t.delete}</option>}
      </select>
      <button type="submit" disabled={pending || !choice} className={`${buttonClass.secondary} py-1.5`}>
        {pending && <Loader2 className="size-4 animate-spin" />} {t.apply}
      </button>
      {state?.ok && !pending && (
        <span role="status" className="inline-flex items-center gap-1 text-emerald-700">
          <Check className="size-4" /> {state.done} {t.done}
        </span>
      )}
    </form>
  );
}

export function SelectAll({ label }: { label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="size-4 rounded border-slate-300"
      onChange={(e) =>
        document.querySelectorAll<HTMLInputElement>('input[name="ids"][form="bulk"]').forEach((box) => (box.checked = e.target.checked))
      }
    />
  );
}

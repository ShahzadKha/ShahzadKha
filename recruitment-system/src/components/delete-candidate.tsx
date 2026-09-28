"use client";

import { Trash2 } from "lucide-react";
import { deleteCandidate } from "@/app/actions/candidates";

export function DeleteCandidate({ candidateId, label, confirmText }: { candidateId: string; label: string; confirmText: string }) {
  return (
    <form
      action={deleteCandidate.bind(null, candidateId)}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <button type="submit" className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-500">
        <Trash2 className="size-3.5" /> {label}
      </button>
    </form>
  );
}

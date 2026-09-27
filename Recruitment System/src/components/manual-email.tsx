import { Send } from "lucide-react";
import { sendManualEmail } from "@/app/actions/candidates";
import { ActionForm } from "@/components/action-form";
import { inputClass } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/fr";

// "Écrire au candidat": collapsed by default
export function ManualEmail({ candidateId, unsubscribed, t }: { candidateId: string; unsubscribed: boolean; t: Dictionary["manualEmail"]; saved?: string }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold text-slate-900 hover:bg-slate-50">
        <Send className="size-4 text-slate-400" /> {t.title}
      </summary>
      <div className="border-t border-slate-100 p-5">
        {unsubscribed ? (
          <p className="text-sm text-slate-500">{t.unsubscribed}</p>
        ) : (
          <ActionForm action={sendManualEmail.bind(null, candidateId)} labels={{ save: t.send, saved: t.sent, invalid: t.invalid }} resetOnSuccess>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">{t.subject}</span>
                <input name="subject" required maxLength={200} className={inputClass} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">{t.body}</span>
                <textarea name="body" required rows={7} maxLength={5000} defaultValue={"Bonjour {{prenom}},\n\n\n\nBien cordialement,"} className={inputClass} />
              </label>
              <p className="text-xs text-slate-500">{t.hint}</p>
            </div>
          </ActionForm>
        )}
      </div>
    </details>
  );
}

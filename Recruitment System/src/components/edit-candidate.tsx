import { updateCandidate } from "@/app/actions/candidates";
import { ActionForm } from "@/components/action-form";
import { inputClass, selectClass } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/fr";

type Candidate = {
  id: string; firstName: string; lastName: string; email: string; phone: string | null; city: string | null;
  currentTitle: string | null; linkedinUrl: string | null; sourceDetail: string | null; yearsExperience: number | null;
  timingDays: number | null; recommendedProductId: string | null;
};

// "Modifier la fiche": collapsed by default, under the contact card
export function EditCandidate({ c, products, t }: { c: Candidate; products: { id: string; name: string; active: boolean }[]; t: Dictionary }) {
  const e = t.editCandidate;
  const text = (name: keyof Candidate & string, label: string, type = "text", required = false) => (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input name={name} type={type} required={required} defaultValue={(c[name] as string | number | null) ?? ""} className={inputClass} />
    </label>
  );
  return (
    <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-900 hover:bg-slate-50">
        {e.title} <span className="text-slate-400 group-open:hidden">▸</span><span className="hidden text-slate-400 group-open:inline">▾</span>
      </summary>
      <div className="border-t border-slate-100 p-5">
        <ActionForm action={updateCandidate.bind(null, c.id)} labels={{ save: e.save, saved: t.settings.saved, invalid: e.invalid }}>
          <div className="grid gap-3 sm:grid-cols-2">
            {text("firstName", t.newCandidate.firstName, "text", true)}
            {text("lastName", t.newCandidate.lastName)}
            <div className="sm:col-span-2">{text("email", t.newCandidate.email, "email", true)}</div>
            {text("phone", t.newCandidate.phone, "tel")}
            {text("city", t.newCandidate.city)}
            <div className="sm:col-span-2">{text("currentTitle", t.newCandidate.currentTitle)}</div>
            {text("yearsExperience", t.newCandidate.yearsExperience, "number")}
            {text("timingDays", e.timingDays, "number")}
            <div className="sm:col-span-2">{text("linkedinUrl", t.newCandidate.linkedinUrl, "url")}</div>
            <div className="sm:col-span-2">{text("sourceDetail", e.sourceDetail)}</div>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">{t.profile.recommended}</span>
              <select name="recommendedProductId" defaultValue={c.recommendedProductId ?? ""} className={`${selectClass} w-full`}>
                <option value="">—</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.active ? "" : " (inactive)"}</option>
                ))}
              </select>
            </label>
          </div>
        </ActionForm>
      </div>
    </details>
  );
}

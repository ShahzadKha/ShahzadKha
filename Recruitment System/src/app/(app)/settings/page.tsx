import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getBrand, getClosingSettings, getScoringRules } from "@/lib/settings";
import { SCRIPT_VARIABLES } from "@/lib/nurture/defaults";
import { saveClosingSettings } from "@/app/actions/closing";
import { saveBrand, saveProduct, saveRules } from "@/app/actions/settings";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader, inputClass } from "@/components/ui";

export const metadata = { title: "Paramètres" };

function NumberField({ name, label, value, max = 100 }: { name: string; label: string; value: number; max?: number }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input name={name} type="number" min={0} max={max} required defaultValue={value} className={`${inputClass} tabular-nums`} />
    </label>
  );
}

export default async function SettingsPage() {
  await requireUser(["ADMIN"]);
  const { t } = await getDictionary();
  const s = t.settings;
  const [brand, rules, closing, products] = await Promise.all([
    getBrand(),
    getScoringRules(),
    getClosingSettings(),
    db.product.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const cs = t.closingSettings;
  const formLabels = { save: s.save, saved: s.saved, invalid: s.invalid };

  return (
    <>
      <PageHeader title={s.title} subtitle={s.subtitle} />
      <div className="grid gap-6 lg:grid-cols-2">
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-4 text-sm text-slate-600 lg:col-span-2">
          {s.integrationsMoved}{" "}
          <Link href="/integrations" className="font-medium text-indigo-600 hover:text-indigo-500">{t.nav.integrations} →</Link>
        </p>

        <Card title={s.brand} hint={s.brandHint}>
          <ActionForm action={saveBrand} labels={formLabels}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">{s.brandName}</span>
                <input name="brandName" required maxLength={60} defaultValue={brand.name} className={inputClass} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">{s.brandTagline}</span>
                <input name="brandTagline" maxLength={80} defaultValue={brand.tagline ?? ""} className={inputClass} />
              </label>
            </div>
          </ActionForm>
        </Card>

        <Card title={s.rules} hint={s.rulesHint} className="lg:row-span-2">
          <ActionForm action={saveRules} labels={formLabels}>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-900">{s.weights}</legend>
              <div className="grid grid-cols-3 items-end gap-3">
                <NumberField name="wFit" label={s.weightFit} value={rules.weights.fit} />
                <NumberField name="wNeed" label={s.weightNeed} value={rules.weights.need} />
                <NumberField name="wIntent" label={s.weightIntent} value={rules.weights.intent} />
              </div>
            </fieldset>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumberField name="eligibilityMinFit" label={s.eligibility} value={rules.eligibilityMinFit} />
            </div>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium text-slate-900">{s.bands}</legend>
              <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
                <NumberField name="bLight" label={t.tracks.LIGHT} value={rules.bands.light} />
                <NumberField name="bConversion" label={t.tracks.CONVERSION} value={rules.bands.conversion} />
                <NumberField name="bCallInvite" label={t.tracks.CALL_INVITE} value={rules.bands.callInvite} />
                <NumberField name="bPrioritySdr" label={t.tracks.PRIORITY_SDR} value={rules.bands.prioritySdr} />
              </div>
            </fieldset>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium text-slate-900">{s.purchaseReady}</legend>
              <div className="grid grid-cols-2 items-end gap-3">
                <NumberField name="prMinFit" label={s.prMinFit} value={rules.purchaseReady.minFit} />
                <NumberField name="prTiming" label={s.prTiming} value={rules.purchaseReady.maxTimingDays} max={365} />
              </div>
            </fieldset>
          </ActionForm>
        </Card>

        <Card title={cs.title} hint={cs.hint} className="lg:col-span-2">
          <ActionForm action={saveClosingSettings} labels={formLabels}>
            <div className="space-y-4 text-sm">
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" name="autoAssign" defaultChecked={closing.autoAssign} className="size-4 rounded border-slate-300" />
                {cs.autoAssign}
              </label>
              <div className="max-w-48">
                <NumberField name="callSlaHours" label={cs.sla} value={closing.callSlaHours} max={168} />
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">{cs.script}</span>
                <textarea name="callScript" required rows={14} maxLength={10000} defaultValue={closing.callScript} className={`${inputClass} font-mono text-xs leading-relaxed`} />
                <span className="mt-1 block text-xs text-slate-500">
                  {cs.scriptHint} {SCRIPT_VARIABLES.map((v) => <code key={v} className="mr-1 rounded bg-slate-100 px-1">{`{{${v}}}`}</code>)}
                </span>
              </label>
            </div>
          </ActionForm>
        </Card>

        <Card title={s.products} hint={s.productsHint} className="lg:col-span-2">
          <div className="space-y-4">
            {[...products, null].map((p) => (
              <ActionForm
                key={p?.id ?? "new"}
                action={saveProduct}
                labels={{ ...formLabels, save: p ? s.save : s.addProduct }}
                resetOnSuccess={!p}
                className={`rounded-lg border p-4 ${p ? "border-slate-200" : "border-dashed border-slate-300 bg-slate-50/50"}`}
              >
                {p && <input type="hidden" name="id" value={p.id} />}
                <div className="grid gap-3 md:grid-cols-6">
                  <label className="block text-sm md:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-slate-600">{s.productName}</span>
                    <input name="name" required maxLength={120} defaultValue={p?.name} className={inputClass} />
                  </label>
                  <label className="block text-sm md:col-span-3">
                    <span className="mb-1 block text-xs font-medium text-slate-600">{s.productDescription}</span>
                    <input name="description" maxLength={300} defaultValue={p?.description ?? ""} className={inputClass} />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-600">{s.productPrice}</span>
                    <input name="price" type="number" min={0} required defaultValue={p?.price} className={`${inputClass} tabular-nums`} />
                  </label>
                  <label className="block text-sm md:col-span-5">
                    <span className="mb-1 block text-xs font-medium text-slate-600">{s.productKeywords}</span>
                    <input name="keywords" defaultValue={p?.keywords.join(", ")} className={inputClass} />
                  </label>
                  <label className="block text-sm md:col-span-5">
                    <span className="mb-1 block text-xs font-medium text-slate-600">{cs.checkoutUrl}</span>
                    <input name="checkoutUrl" type="url" placeholder="https://…thrivecart.com/…" defaultValue={p?.checkoutUrl ?? ""} className={inputClass} />
                  </label>
                  <label className="block text-sm md:col-span-5">
                    <span className="mb-1 block text-xs font-medium text-slate-600">{s.platformUrl}</span>
                    <input name="platformUrl" type="url" placeholder="https://…" defaultValue={p?.platformUrl ?? ""} className={inputClass} />
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
                    <input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="size-4 rounded border-slate-300" />
                    {s.productActive}
                  </label>
                </div>
              </ActionForm>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

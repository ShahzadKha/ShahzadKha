import { Mail, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getEmailSettings, getScoringRules } from "@/lib/settings";
import { TRACKS, trackRangeLabel } from "@/lib/rules";
import { TEMPLATE_VARIABLES } from "@/lib/nurture/defaults";
import { emailMode } from "@/lib/nurture/mailer";
import { ensureDefaultSequences } from "@/lib/nurture/engine";
import { fill, type TemplateVars } from "@/lib/nurture/render";
import { appUrl } from "@/lib/nurture/mailer";
import { getBrand } from "@/lib/settings";
import { addStep, deleteStep, saveEmailSettings, saveStep, toggleSequence } from "@/app/actions/nurture";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { TimeControls } from "./time-controls";

export const metadata = { title: "Séquences email" };

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : "—");

export default async function SequencesPage() {
  const user = await requireUser(["ADMIN", "RECRUITER"]);
  const isAdmin = user.role === "ADMIN";
  const { t } = await getDictionary();
  const s = t.sequences;
  await ensureDefaultSequences();
  const [sequences, settings, rules] = await Promise.all([
    db.emailSequence.findMany({ include: { steps: { orderBy: { order: "asc" } } } }),
    getEmailSettings(),
    getScoringRules(),
  ]);
  // Sample data for the previews: a real candidate with a training, or an example
  const [sample, brand] = await Promise.all([
    db.candidate.findFirst({ where: { recommendedProductId: { not: null } }, include: { recommendedProduct: true }, orderBy: { createdAt: "desc" } }),
    getBrand(),
  ]);
  const base = appUrl();
  const vars: TemplateVars = {
    prenom: sample?.firstName ?? "Sarah",
    nom: sample?.lastName ?? "Benali",
    produit: sample?.recommendedProduct?.name ?? "Formation Data Analyst",
    prix: `${(sample?.recommendedProduct?.price ?? 2490).toLocaleString("fr-FR")} €`,
    poste: sample?.currentTitle ?? "Assistante comptable",
    marque: brand.name,
    lien_offre: `${base}/offre/…`,
    lien_paiement: `${base}/paiement/…`,
    lien_avis: `${base}/avis/…`,
    lien_plateforme: sample?.recommendedProduct?.platformUrl ?? "https://plateforme…",
  };
  const byTrack = new Map(sequences.map((q) => [q.track, q]));
  const onboarding = sequences.find((q) => q.kind === "ONBOARDING");
  // Nurture sequences in track order, then the post-purchase one
  const blocks = [
    ...TRACKS.map((track) => ({ q: byTrack.get(track), range: trackRangeLabel(track, rules), hint: t.trackHints[track] })),
    { q: onboarding, range: null, hint: t.closingSettings.onboardingHint },
  ];
  const mode = emailMode();
  const formLabels = { save: t.settings.save, saved: t.settings.saved, invalid: t.settings.invalid };

  const stats = await Promise.all(
    sequences.map(async (q) => {
      const where = { step: { sequenceId: q.id } };
      const [active, sent, opened, clicked, replied] = await Promise.all([
        db.enrollment.count({ where: { sequenceId: q.id, status: "ACTIVE" } }),
        db.emailMessage.count({ where }),
        db.emailMessage.count({ where: { ...where, openedAt: { not: null } } }),
        db.emailMessage.count({ where: { ...where, clickedAt: { not: null } } }),
        db.emailMessage.count({ where: { ...where, repliedAt: { not: null } } }),
      ]);
      return [q.id, { active, sent, opened, clicked, replied }] as const;
    }),
  );
  const statsById = new Map(stats);

  return (
    <>
      <PageHeader title={s.title} subtitle={s.subtitle} actions={<TimeControls t={s} />} />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-start gap-3">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${mode === "smtp" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              <Mail className="size-5" />
            </span>
            <div className="text-sm">
              <p className="font-medium text-slate-900">{mode === "smtp" ? s.modeSmtp : s.modeSimulated}</p>
              {mode === "simulated" && <p className="mt-1 text-slate-600">{s.modeSimulatedBody}</p>}
            </div>
          </div>
        </Card>
        <Card title={s.options}>
          <ActionForm action={saveEmailSettings} labels={formLabels}>
            <input type="hidden" name="optionsForm" value="1" />
            <fieldset disabled={!isAdmin} className="space-y-2 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="autoEnroll" defaultChecked={settings.autoEnroll} className="size-4 rounded border-slate-300" />
                {s.autoEnroll}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="requireConsent" defaultChecked={settings.requireConsent} className="size-4 rounded border-slate-300" />
                {s.requireConsent}
              </label>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span>{s.recycle1}</span>
                <input name="recycleAfterDays" type="number" min={0} max={365} required defaultValue={settings.recycleAfterDays} className={`${inputClass} w-20 tabular-nums`} />
                <span>{s.recycle2}</span>
                <input name="maxRecycles" type="number" min={0} max={10} required defaultValue={settings.maxRecycles} className={`${inputClass} w-16 tabular-nums`} />
                <span>{s.recycle3}</span>
              </div>
              <p className="text-xs text-slate-500">{s.recycleHint}</p>
            </fieldset>
          </ActionForm>
        </Card>
      </div>

      <div className="space-y-4">
        {blocks.map(({ q, range, hint }, i) => {
          if (!q) return null;
          const st = statsById.get(q.id)!;
          return (
            <details key={q.id} open={i === 2} className="group rounded-xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
                <div className="min-w-56 flex-1">
                  <p className="font-semibold text-slate-900">
                    {q.name} {range && <span className="text-sm font-normal text-slate-500">· {range}</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {q.steps.length} {s.emailsCount} · {hint}
                    {!q.active && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">off</span>}
                  </p>
                </div>
                <dl className="grid grid-cols-5 gap-4 text-center text-xs">
                  {[
                    [s.enrolled, String(st.active)],
                    [s.sentCount, String(st.sent)],
                    [s.openRate, pct(st.opened, st.sent)],
                    [s.clickRate, pct(st.clicked, st.sent)],
                    [s.replyRate, pct(st.replied, st.sent)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </summary>

              <div className="space-y-4 border-t border-slate-100 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    {s.variables} : {TEMPLATE_VARIABLES.map((v) => <code key={v} className="mr-1 rounded bg-slate-100 px-1">{`{{${v}}}`}</code>)}
                  </p>
                  {isAdmin && (
                    <form action={toggleSequence.bind(null, q.id, !q.active)}>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <SubmitButton className="inline-flex items-center">
                          <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${q.active ? "bg-indigo-600" : "bg-slate-300"}`}>
                            <span className={`inline-block size-4 rounded-full bg-white transition ${q.active ? "translate-x-4" : "translate-x-0.5"}`} />
                          </span>
                        </SubmitButton>
                        {s.active}
                      </label>
                    </form>
                  )}
                </div>

                {q.steps.map((step) => (
                  <div key={step.id} className="relative rounded-lg border border-slate-200 p-4">
                    <ActionForm action={saveStep} labels={formLabels}>
                      <input type="hidden" name="id" value={step.id} />
                      <fieldset disabled={!isAdmin} className="grid gap-3 md:grid-cols-[6rem_1fr]">
                        <label className="block text-sm">
                          <span className="mb-1 block text-xs font-medium text-slate-600">{t.nurture.step} {step.order} · {s.day}</span>
                          <input name="dayOffset" type="number" min={0} max={365} required defaultValue={step.dayOffset} className={`${inputClass} tabular-nums`} />
                        </label>
                        <label className="block text-sm">
                          <span className="mb-1 block text-xs font-medium text-slate-600">{s.subject}</span>
                          <input name="subject" required maxLength={200} defaultValue={step.subject} className={inputClass} />
                        </label>
                        <label className="block text-sm md:col-span-2">
                          <span className="mb-1 block text-xs font-medium text-slate-600">{s.body}</span>
                          <textarea name="body" required rows={9} maxLength={5000} defaultValue={step.body} className={`${inputClass} font-mono text-xs leading-relaxed`} />
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                          <input type="checkbox" name="isOffer" defaultChecked={step.isOffer} className="size-4 rounded border-slate-300" />
                          {s.isOffer}
                        </label>
                      </fieldset>
                    </ActionForm>
                    <details className="mt-3 rounded-md bg-slate-50 text-sm">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-indigo-600">
                        {s.preview} ({vars.prenom})
                      </summary>
                      <div className="border-t border-slate-200 px-3 py-2">
                        <p className="font-medium text-slate-900">{fill(step.subject, vars)}</p>
                        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{fill(step.body, vars)}</pre>
                      </div>
                    </details>
                    {isAdmin && q.steps.length > 1 && (
                      <form action={deleteStep.bind(null, step.id)} className="mt-2">
                        <SubmitButton className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-500">
                          <Trash2 className="size-3.5" /> {s.deleteStep}
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                ))}

                {isAdmin && (
                  <form action={addStep.bind(null, q.id)}>
                    <SubmitButton className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500">
                      <Plus className="size-4" /> {s.addStep}
                    </SubmitButton>
                  </form>
                )}
              </div>
            </details>
          );
        })}
      </div>

      <Card title={t.closingSettings.paymentEmail} className="mt-6">
        <ActionForm action={saveEmailSettings} labels={formLabels}>
          <fieldset disabled={!isAdmin} className="grid gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">{s.subject}</span>
              <input name="paymentSubject" required maxLength={200} defaultValue={settings.paymentSubject} className={inputClass} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">{s.body}</span>
              <textarea name="paymentBody" required rows={9} maxLength={5000} defaultValue={settings.paymentBody} className={`${inputClass} font-mono text-xs leading-relaxed`} />
            </label>
          </fieldset>
        </ActionForm>
      </Card>

      <Card title={s.offerEmail} className="mt-6">
        <ActionForm action={saveEmailSettings} labels={formLabels}>
          <fieldset disabled={!isAdmin} className="grid gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">{s.subject}</span>
              <input name="offerSubject" required maxLength={200} defaultValue={settings.offerSubject} className={inputClass} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">{s.body}</span>
              <textarea name="offerBody" required rows={9} maxLength={5000} defaultValue={settings.offerBody} className={`${inputClass} font-mono text-xs leading-relaxed`} />
            </label>
          </fieldset>
        </ActionForm>
      </Card>
    </>
  );
}

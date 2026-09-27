import { Mail, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getEmailSettings, getScoringRules } from "@/lib/settings";
import { TRACKS, trackRangeLabel } from "@/lib/rules";
import { TEMPLATE_VARIABLES } from "@/lib/nurture/defaults";
import { emailMode } from "@/lib/nurture/mailer";
import { addStep, deleteStep, saveEmailSettings, saveStep, toggleSequence } from "@/app/actions/nurture";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { TimeControls } from "./time-controls";

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : "—");

export default async function SequencesPage() {
  const user = await requireUser(["ADMIN", "RECRUITER"]);
  const isAdmin = user.role === "ADMIN";
  const { t } = await getDictionary();
  const s = t.sequences;
  const [sequences, settings, rules] = await Promise.all([
    db.emailSequence.findMany({ include: { steps: { orderBy: { order: "asc" } } } }),
    getEmailSettings(),
    getScoringRules(),
  ]);
  const byTrack = new Map(sequences.map((q) => [q.track, q]));
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
            <fieldset disabled={!isAdmin} className="space-y-2 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="autoEnroll" defaultChecked={settings.autoEnroll} className="size-4 rounded border-slate-300" />
                {s.autoEnroll}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="requireConsent" defaultChecked={settings.requireConsent} className="size-4 rounded border-slate-300" />
                {s.requireConsent}
              </label>
            </fieldset>
          </ActionForm>
        </Card>
      </div>

      <div className="space-y-4">
        {TRACKS.map((track, i) => {
          const q = byTrack.get(track);
          if (!q) return null;
          const st = statsById.get(q.id)!;
          return (
            <details key={q.id} open={i === 2} className="group rounded-xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
                <div className="min-w-56 flex-1">
                  <p className="font-semibold text-slate-900">
                    {q.name} <span className="text-sm font-normal text-slate-500">· {trackRangeLabel(track, rules)}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {q.steps.length} {s.emailsCount} · {t.trackHints[track]}
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
                    {isAdmin && q.steps.length > 1 && (
                      <form action={deleteStep.bind(null, step.id)} className="absolute bottom-4 left-4">
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

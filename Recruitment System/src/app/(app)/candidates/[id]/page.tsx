import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Bot, CheckCircle2, Circle, ExternalLink, FileText, Link2, Loader2, Mail, MapPin, Phone, RefreshCw, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getScoringRules } from "@/lib/settings";
import { purchaseReadyConditions, trackRangeLabel } from "@/lib/rules";
import { reanalyzeCandidate } from "@/app/actions/intake";
import { AutoRefresh } from "@/components/auto-refresh";
import { SubmitButton } from "@/components/submit-button";
import { getDictionary } from "@/lib/i18n";
import { formatDate, formatDateTime, formatMoney, initials } from "@/lib/format";
import { addNote } from "@/app/actions/candidates";
import { Avatar, Card, ScorePill, StatusBadge, buttonClass, inputClass, selectClass } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { NurtureCard } from "@/components/nurture-card";
import { ClosingCard } from "@/components/closing-card";
import { DeleteCandidate } from "@/components/delete-candidate";
import { EditCandidate } from "@/components/edit-candidate";
import { changeStatus } from "@/app/actions/nurture";
import { STATUS_ORDER } from "@/lib/pipeline";

export default async function CandidatePage({ params }: PageProps<"/candidates/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const [rules, products] = await Promise.all([
    getScoringRules(),
    db.product.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
  ]);
  const { t, locale } = await getDictionary();

  const c = await db.candidate.findUnique({
    where: { id },
    include: {
      recommendedProduct: true,
      cvFile: { select: { id: true } },
      assignedSdr: { select: { name: true } },
      events: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!c) notFound();

  const analyzed = c.globalScore != null;
  const pending = c.analysisState === "PENDING";
  const failed = c.analysisState === "FAILED";
  const canAnalyze = user.role !== "SDR" && Boolean(c.cvText);
  const conditions = purchaseReadyConditions(c, rules);
  const conditionRows = [
    { ok: conditions.fit, label: t.profile.condFit.replace("{n}", String(rules.purchaseReady.minFit)) },
    { ok: conditions.interest, label: t.profile.condInterest },
    { ok: conditions.price, label: t.profile.condPrice },
    { ok: conditions.timing, label: t.profile.condTiming.replace("{n}", String(rules.purchaseReady.maxTimingDays)), extra: c.timingDays != null ? `${c.timingDays} ${t.profile.daysShort}` : null },
  ];

  return (
    <>
      <Link href="/candidates" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> {t.profile.back}
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar text={initials(c.firstName, c.lastName)} className="size-14 text-base" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {c.firstName} {c.lastName}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {c.currentTitle ?? "—"} · {t.sources[c.source]}
            {c.sourceDetail && ` (${c.sourceDetail})`} · {t.profile.created} {formatDate(c.createdAt, locale)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={c.status} label={t.statuses[c.status]} />
          <form action={changeStatus.bind(null, c.id)} className="flex items-center gap-2">
            <label htmlFor="status" className="sr-only">{t.nurture.changeStatus}</label>
            <select id="status" name="status" defaultValue={c.status} className={`${selectClass} py-1 text-xs`}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{t.statuses[s]}</option>
              ))}
            </select>
            <SubmitButton className={`${buttonClass.secondary} px-2.5 py-1 text-xs`}>{t.nurture.move}</SubmitButton>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title={t.profile.ai}
            action={
              analyzed && !pending && canAnalyze ? (
                <form action={reanalyzeCandidate.bind(null, c.id)}>
                  <SubmitButton className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-60">
                    <RefreshCw className="size-3.5" /> {t.profile.reanalyze}
                  </SubmitButton>
                </form>
              ) : undefined
            }
          >
            {pending && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                <Loader2 className="size-4 animate-spin" /> {t.profile.analysisPending}
                <AutoRefresh />
              </div>
            )}
            {failed && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                <p className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4" /> {t.profile.analysisFailed}</p>
                {c.analysisError && <p className="mt-1 text-xs text-red-700">{c.analysisError}</p>}
                {canAnalyze && (
                  <form action={reanalyzeCandidate.bind(null, c.id)} className="mt-2">
                    <SubmitButton className={buttonClass.secondary}><RefreshCw className="size-4" /> {t.profile.retry}</SubmitButton>
                  </form>
                )}
              </div>
            )}
            {!analyzed ? (
              !pending && !failed && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">{c.cvText ? t.profile.aiPending : t.profile.noCv}</p>
                  {canAnalyze && (
                    <form action={reanalyzeCandidate.bind(null, c.id)}>
                      <SubmitButton className={buttonClass.primary}><Bot className="size-4" /> {t.profile.analyze}</SubmitButton>
                    </form>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: t.profile.global, value: c.globalScore, strong: true },
                    { label: t.profile.fit, value: c.fitScore },
                    { label: t.profile.need, value: c.needScore },
                    { label: t.profile.intent, value: c.intentScore },
                  ].map((s) => (
                    <div key={s.label} className={s.strong ? "rounded-lg bg-slate-50 p-3" : "p-3"}>
                      <p className="text-xs text-slate-500">{s.label}</p>
                      <p className="mt-1 text-2xl"><ScorePill score={s.value} /></p>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-200" role="presentation">
                        <div className="h-full rounded-full" style={{ width: `${s.value ?? 0}%`, background: "var(--series-1)" }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ring-1 ring-inset ${c.eligible ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"}`}>
                    {c.eligible ? t.profile.eligible : t.profile.notEligible}
                  </span>
                  {c.analysisMode && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      <Bot className="size-3" />
                      {c.analysisMode === "openai" ? `${t.profile.modeOpenAI} · ${c.analysisModel}` : t.profile.modeDemo}
                    </span>
                  )}
                  {c.analyzedAt && <span className="px-1 py-0.5 text-slate-400">{formatDateTime(c.analyzedAt, locale)}</span>}
                </div>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-slate-500">{t.profile.persona}</dt>
                    <dd className="mt-1 text-slate-900">{c.persona ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">{t.profile.skillGap}</dt>
                    <dd className="mt-1 text-slate-900">{c.skillGap ?? "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium text-slate-500">{t.profile.summary}</dt>
                    <dd className="mt-1 leading-relaxed text-slate-700">{c.aiSummary ?? "—"}</dd>
                  </div>
                </dl>
                {c.routingTrack && (
                  <div className="rounded-lg border border-slate-200 p-4">
                    <p className="text-xs font-medium text-slate-500">{t.profile.track}</p>
                    <p className="mt-0.5 font-medium text-slate-900">
                      {t.tracks[c.routingTrack]}{" "}
                      <span className="text-sm font-normal text-slate-500">({trackRangeLabel(c.routingTrack, rules)})</span>
                    </p>
                    <p className="text-xs text-slate-500">{t.trackHints[c.routingTrack]}</p>
                  </div>
                )}
                {c.recommendedProduct && (
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
                    <div>
                      <p className="text-xs font-medium text-indigo-700">{t.profile.recommended}</p>
                      <p className="mt-0.5 font-medium text-slate-900">{c.recommendedProduct.name}</p>
                      {c.recommendedProduct.description && <p className="text-xs text-slate-500">{c.recommendedProduct.description}</p>}
                    </div>
                    <p className="text-lg font-semibold tabular-nums text-slate-900">{formatMoney(c.recommendedProduct.price, locale)}</p>
                  </div>
                )}
              </div>
            )}
          </Card>

          {analyzed && c.eligible && (
            <Card title={t.profile.conditions}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {conditionRows.map((row) => (
                  <li key={row.label} className="flex items-center gap-2 text-sm">
                    {row.ok ? (
                      <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-label={t.common.yes} />
                    ) : (
                      <Circle className="size-5 shrink-0 text-slate-300" aria-label={t.common.no} />
                    )}
                    <span className={row.ok ? "text-slate-900" : "text-slate-500"}>{row.label}</span>
                    {row.extra && <span className="text-xs text-slate-400">({row.extra})</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {c.eligible && <NurtureCard candidate={c} t={t} locale={locale} />}

          <Card title={t.profile.cv}>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">{t.profile.currentTitle}</dt>
                <dd className="mt-1 text-slate-900">{c.currentTitle ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">{t.profile.experience}</dt>
                <dd className="mt-1 text-slate-900">{c.yearsExperience != null ? `${c.yearsExperience} ${t.profile.years}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">{t.profile.education}</dt>
                <dd className="mt-1 text-slate-900">{c.education ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">{t.profile.languages}</dt>
                <dd className="mt-1 text-slate-900">{c.languages.length ? c.languages.join(", ") : "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">{t.profile.skills}</dt>
                <dd className="mt-2 flex flex-wrap gap-1.5">
                  {c.skills.length
                    ? c.skills.map((s) => (
                        <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{s}</span>
                      ))
                    : "—"}
                </dd>
              </div>
              {c.motivation && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-slate-500">{t.profile.motivation}</dt>
                  <dd className="mt-1 whitespace-pre-line rounded-md bg-slate-50 px-3 py-2 text-slate-700">{c.motivation}</dd>
                </div>
              )}
              {c.cvFileName && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-slate-500">{t.profile.cvFile}</dt>
                  <dd className="mt-1 flex items-center gap-2 text-slate-900">
                    <FileText className="size-4 text-slate-400" /> {c.cvFileName}
                    {c.cvFile && (
                      <a
                        href={`/api/candidates/${c.id}/cv`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        {t.profile.downloadCv} <ExternalLink className="size-3" />
                      </a>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          {c.eligible && <ClosingCard candidate={c} role={user.role} t={t} locale={locale} />}
          <Card title={t.profile.contact}>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2 text-slate-700"><Mail className="size-4 text-slate-400" /> {c.email}</li>
              <li className="flex items-center gap-2 text-slate-700"><Phone className="size-4 text-slate-400" /> {c.phone ?? "—"}</li>
              <li className="flex items-center gap-2 text-slate-700">
                <MapPin className="size-4 text-slate-400" /> {[c.city, c.country].filter(Boolean).join(", ") || "—"}
              </li>
              {c.linkedinUrl && (
                <li className="flex items-center gap-2 text-slate-700">
                  <Link2 className="size-4 text-slate-400" />
                  <span className="truncate">{c.linkedinUrl.replace("https://www.", "")}</span>
                </li>
              )}
              <li className="flex items-center gap-2 text-slate-700">
                <ShieldCheck className="size-4 text-slate-400" />
                <span className="text-xs text-slate-500">{t.profile.consent} :</span>
                {c.consentAt ? (
                  <span className="text-xs">{t.profile.consentOn} {formatDate(c.consentAt, locale)}</span>
                ) : (
                  <span className="text-xs text-slate-400">{t.profile.consentNone}</span>
                )}
              </li>
              <li className="border-t border-slate-100 pt-3 text-slate-700">
                <span className="text-xs text-slate-500">{t.profile.assignedSdr} : </span>
                {c.assignedSdr?.name ?? <span className="text-slate-400">{t.profile.unassigned}</span>}
              </li>
              {user.role === "ADMIN" && (
                <li className="border-t border-slate-100 pt-3">
                  <DeleteCandidate candidateId={c.id} label={t.profile.delete} confirmText={t.profile.deleteConfirm} />
                </li>
              )}
            </ul>
          </Card>

          <EditCandidate c={c} products={products} t={t} />

          <Card title={t.profile.timeline}>
            <form action={addNote.bind(null, c.id)} className="mb-5 space-y-2">
              <label htmlFor="note" className="sr-only">{t.profile.addNote}</label>
              <textarea id="note" name="note" rows={2} required placeholder={t.profile.notePlaceholder} className={inputClass} />
              <div className="flex justify-end">
                <button type="submit" className={buttonClass.secondary}>{t.profile.save}</button>
              </div>
            </form>
            <Timeline events={c.events} t={t} locale={locale} />
          </Card>
        </div>
      </div>
    </>
  );
}

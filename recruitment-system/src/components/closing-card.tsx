import Link from "next/link";
import { CreditCard, PhoneCall, Send, Star } from "lucide-react";
import { db } from "@/lib/db";
import type { Dictionary } from "@/lib/i18n/fr";
import type { Locale } from "@/lib/i18n";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { STATUS_RANK } from "@/lib/nurture/status";
import type { CandidateStatus, Role } from "@/generated/prisma/enums";
import { assignSdrAction, sendPaymentLinkAction, simulatePaymentAction } from "@/app/actions/closing";
import { Card, buttonClass, selectClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const smallBtn =
  "inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-60";

export async function ClosingCard({
  candidate,
  role,
  t,
  locale,
}: {
  candidate: { id: string; status: CandidateStatus; assignedSdrId: string | null };
  role: Role;
  t: Dictionary;
  locale: Locale;
}) {
  const [sdrs, openTask, payments, feedback, linkSent] = await Promise.all([
    db.user.findMany({ where: { role: "SDR", active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.callTask.findFirst({ where: { candidateId: candidate.id, status: "OPEN" }, orderBy: { dueAt: "asc" } }),
    db.payment.findMany({ where: { candidateId: candidate.id }, orderBy: { paidAt: "desc" }, include: { product: { select: { name: true } } } }),
    db.feedback.findUnique({ where: { candidateId: candidate.id } }),
    db.candidateEvent.count({ where: { candidateId: candidate.id, type: "PAYMENT_LINK_SENT" } }),
  ]);
  const k = t.closing;
  const closed = candidate.status === "WON" || candidate.status === "LOST" || candidate.status === "NOT_ELIGIBLE";
  const inClosing = STATUS_RANK[candidate.status] >= STATUS_RANK.PURCHASE_READY && !closed;
  const canAssign = role !== "SDR" && !closed;

  return (
    <Card title={k.card}>
      <div className="space-y-4 text-sm">
        {canAssign ? (
          <form action={assignSdrAction.bind(null, candidate.id)} className="flex items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-medium text-slate-500">{k.sdr}</span>
              <select name="sdrId" defaultValue={candidate.assignedSdrId ?? "auto"} className={`${selectClass} w-full`}>
                <option value="auto">{k.autoPick}</option>
                {sdrs.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <SubmitButton className={buttonClass.secondary}>{k.assign}</SubmitButton>
          </form>
        ) : null}

        {openTask && (
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{k.openTask}</p>
            <p className="font-medium text-slate-900">{formatDateTime(openTask.dueAt, locale)}</p>
            <Link href={`/sdr/appel/${candidate.id}`} className={`${buttonClass.primary} mt-2`}>
              <PhoneCall className="size-4" /> {k.openSheet}
            </Link>
          </div>
        )}

        {inClosing && (
          <div className="flex flex-wrap gap-2">
            <form action={sendPaymentLinkAction.bind(null, candidate.id)}>
              <SubmitButton className={smallBtn}><Send className="size-3.5" /> {k.sendPaymentLink}</SubmitButton>
            </form>
            {linkSent > 0 && (
              <form action={simulatePaymentAction.bind(null, candidate.id)}>
                <SubmitButton className={smallBtn}><CreditCard className="size-3.5" /> {t.callSheet.simulatePayment}</SubmitButton>
              </form>
            )}
          </div>
        )}

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">{k.payment}</p>
          {payments.length === 0 ? (
            <p className="text-slate-400">{k.noPayment}</p>
          ) : (
            <ul className="space-y-1">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-emerald-50 px-3 py-2 text-emerald-900">
                  <span>
                    {p.product?.name ?? "—"} · {k.paidOn} {formatDate(p.paidAt, locale)}
                    <span className="ml-1 text-xs text-emerald-700">({p.provider === "thrivecart" ? "ThriveCart" : "démo"})</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatMoney(p.amount, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {feedback && (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">{k.feedback}</p>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                <Star className="size-4 text-amber-500" /> NPS {feedback.nps}/10
                {feedback.publishConsent && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">{k.publish}</span>}
              </p>
              {feedback.comment && <p className="mt-1 text-slate-700">« {feedback.comment} »</p>}
              {feedback.referralEmail && (
                <p className="mt-1 text-xs text-slate-500">
                  {k.referral} : {feedback.referralName} ({feedback.referralEmail})
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

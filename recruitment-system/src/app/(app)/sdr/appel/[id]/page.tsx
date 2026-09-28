import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CreditCard, Mail, MessageSquareReply, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getBrand, getClosingSettings } from "@/lib/settings";
import { formatDateTime, formatMoney, initials, TIME_ZONE } from "@/lib/format";
import { STATUS_RANK } from "@/lib/nurture/status";
import { fill } from "@/lib/nurture/render";
import { logCallAction, simulatePaymentAction } from "@/app/actions/closing";
import { Avatar, Card, ScorePill, StatusBadge, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { CallForm } from "./call-form";

// Script variables beyond the email ones
function renderScript(script: string, vars: Record<string, string>) {
  return fill(script, vars as never).replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k: string) => vars[k] ?? m);
}

export default async function CallSheetPage({ params }: PageProps<"/sdr/appel/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { t, locale } = await getDictionary();
  const [c, settings, brand] = await Promise.all([
    db.candidate.findUnique({
      where: { id },
      include: {
        recommendedProduct: true,
        assignedSdr: { select: { name: true } },
        tasks: { orderBy: { createdAt: "desc" }, include: { sdr: { select: { name: true } } } },
        emails: { select: { openedAt: true, clickedAt: true } },
        events: { where: { type: { in: ["EMAIL_REPLIED", "PAYMENT_LINK_SENT"] } }, orderBy: { createdAt: "desc" } },
      },
    }),
    getClosingSettings(),
    getBrand(),
  ]);
  if (!c) notFound();
  if (user.role === "SDR" && c.assignedSdrId !== user.id) notFound();

  const cs = t.callSheet;
  const product = c.recommendedProduct;
  const lastReply = c.events.find((e) => e.type === "EMAIL_REPLIED");
  const paymentLinkSent = c.events.some((e) => e.type === "PAYMENT_LINK_SENT");
  const inClosing = STATUS_RANK[c.status] >= STATUS_RANK.PURCHASE_READY && c.status !== "WON" && c.status !== "LOST";
  const script = renderScript(settings.callScript, {
    prenom: c.firstName,
    nom: c.lastName,
    produit: product?.name ?? "",
    prix: product ? formatMoney(product.price, "fr") : "",
    marque: brand.name,
    sdr: c.assignedSdr?.name ?? user.name,
    delai: String(c.timingDays ?? 30),
    ecart: c.skillGap ?? "",
    score: String(c.globalScore ?? ""),
  });
  const calls = c.tasks.filter((task) => task.status === "DONE" && task.outcome);

  return (
    <>
      <Link href="/sdr" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> {cs.back}
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar text={initials(c.firstName, c.lastName)} className="size-14 text-base" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">{cs.title}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            <Link href={`/candidates/${c.id}`} className="hover:text-indigo-600">{c.firstName} {c.lastName}</Link>
          </h1>
          <p className="text-sm text-slate-500">{c.currentTitle ?? "—"}</p>
        </div>
        <StatusBadge status={c.status} label={t.statuses[c.status]} />
        {c.phone && (
          <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className={buttonClass.primary}>
            <Phone className="size-4" /> {c.phone}
          </a>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6">
          <Card title={cs.brief}>
            <dl className="space-y-3 text-sm">
              {product && (
                <div className="rounded-lg bg-indigo-50/60 p-3">
                  <dt className="text-xs font-medium text-indigo-700">{t.profile.recommended}</dt>
                  <dd className="mt-0.5 flex items-baseline justify-between gap-2">
                    <span className="font-medium text-slate-900">{product.name}</span>
                    <span className="font-semibold tabular-nums text-slate-900">{formatMoney(product.price, locale)}</span>
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{t.profile.global}</dt>
                <dd><ScorePill score={c.globalScore} /></dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{cs.timing}</dt>
                <dd className="text-slate-900">{c.timingDays != null ? `${cs.within} ${c.timingDays} ${cs.days}` : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{t.profile.persona}</dt>
                <dd className="text-right text-slate-900">{c.persona ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t.profile.skillGap}</dt>
                <dd className="mt-0.5 text-slate-900">{c.skillGap ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t.profile.summary}</dt>
                <dd className="mt-0.5 leading-relaxed text-slate-700">{c.aiSummary ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-slate-500"><Mail className="size-3.5" /> {cs.engagement}</dt>
                <dd className="text-xs tabular-nums text-slate-700">
                  {c.emails.length} · {c.emails.filter((e) => e.openedAt).length} · {c.emails.filter((e) => e.clickedAt).length}
                  <span className="ml-1 text-slate-400">({cs.engagementLine})</span>
                </dd>
              </div>
              {(lastReply || c.motivation) && (
                <div>
                  <dt className="flex items-center gap-1.5 text-slate-500"><MessageSquareReply className="size-3.5" /> {cs.lastReply}</dt>
                  <dd className="mt-1 whitespace-pre-line rounded-md bg-slate-50 px-3 py-2 text-slate-700">
                    {lastReply?.detail ?? c.motivation}
                    {lastReply && <span className="mt-1 block text-xs text-slate-400">{formatDateTime(lastReply.createdAt, locale)}</span>}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title={cs.history}>
            {calls.length === 0 ? (
              <p className="text-sm text-slate-500">{cs.noCalls}</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {calls.map((task) => (
                  <li key={task.id}>
                    <p className="font-medium text-slate-900">{t.sdr.outcomes[task.outcome as keyof typeof t.sdr.outcomes] ?? task.outcome}</p>
                    {task.notes && <p className="text-slate-600">{task.notes}</p>}
                    <p className="text-xs text-slate-400">{task.completedAt && formatDateTime(task.completedAt, locale)} · {task.sdr.name}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title={cs.script}>
          <div className="space-y-2 text-sm leading-relaxed text-slate-700">
            {script.split("\n").map((line, i) =>
              line.startsWith("#") ? (
                <h3 key={i} className="pt-3 text-sm font-semibold text-slate-900 first:pt-0">{line.replace(/^#+\s*/, "")}</h3>
              ) : line.trim() ? (
                <p key={i}>{line}</p>
              ) : null,
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title={cs.result}>
            {!inClosing ? (
              <p className="text-sm text-slate-500">{cs.closed}</p>
            ) : (
              <>
                {paymentLinkSent && (
                  <div className="mb-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">
                    <p>{cs.paymentPending}</p>
                    <form action={simulatePaymentAction.bind(null, c.id)} className="mt-2">
                      <SubmitButton className={buttonClass.secondary}><CreditCard className="size-4" /> {cs.simulatePayment}</SubmitButton>
                    </form>
                  </div>
                )}
                <CallForm action={logCallAction.bind(null, c.id)} t={cs} timeZone={TIME_ZONE} />
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

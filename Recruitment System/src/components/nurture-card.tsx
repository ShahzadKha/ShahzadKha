import clsx from "clsx";
import { ExternalLink, Mail, MailOpen, MessageSquareReply, MousePointerClick, Pause, Play, Send, Square, BellOff, ThumbsUp, ThumbsDown } from "lucide-react";
import { db } from "@/lib/db";
import type { Dictionary } from "@/lib/i18n/fr";
import type { Locale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { sequenceAction, simulateCandidate } from "@/app/actions/nurture";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const smallBtn =
  "inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-60";

const STATE_STYLE = {
  ACTIVE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  PAUSED: "bg-amber-50 text-amber-800 ring-amber-200",
  COMPLETED: "bg-slate-100 text-slate-700 ring-slate-200",
  STOPPED: "bg-slate-100 text-slate-700 ring-slate-200",
};

export async function NurtureCard({
  candidate,
  t,
  locale,
}: {
  candidate: { id: string; eligible: boolean | null; routingTrack: string | null; unsubscribedAt: Date | null; publicToken: string; status: string };
  t: Dictionary;
  locale: Locale;
}) {
  const n = t.nurture;
  const [enrollment, messages] = await Promise.all([
    db.enrollment.findUnique({
      where: { candidateId: candidate.id },
      include: { sequence: { select: { name: true, _count: { select: { steps: true } } } } },
    }),
    db.emailMessage.findMany({ where: { candidateId: candidate.id }, orderBy: { sentAt: "desc" } }),
  ]);
  const canEnroll = Boolean(candidate.eligible && candidate.routingTrack && !candidate.unsubscribedAt);
  const running = enrollment?.status === "ACTIVE" || enrollment?.status === "PAUSED";
  const closed = ["WON", "LOST", "NOT_ELIGIBLE"].includes(candidate.status);
  const act = (a: Parameters<typeof sequenceAction>[1]) => sequenceAction.bind(null, candidate.id, a);
  const sim = (k: Parameters<typeof simulateCandidate>[1]) => simulateCandidate.bind(null, candidate.id, k);

  return (
    <Card
      title={n.card}
      action={
        candidate.eligible ? (
          <a
            href={`/offre/${candidate.publicToken}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
          >
            {n.offerPage} <ExternalLink className="size-3" />
          </a>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {candidate.unsubscribedAt && (
          <p className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
            <BellOff className="size-4" /> {n.unsubscribed} {formatDateTime(candidate.unsubscribedAt, locale)}
          </p>
        )}

        {enrollment ? (
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-slate-900">{enrollment.sequence.name}</p>
              <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STATE_STYLE[enrollment.status])}>
                {n.states[enrollment.status]}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 rounded-full bg-slate-200" role="presentation">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(enrollment.stepsSent / Math.max(1, enrollment.sequence._count.steps)) * 100}%`, background: "var(--series-1)" }}
                />
              </div>
              <span className="text-xs tabular-nums text-slate-600">
                {n.step} {enrollment.stepsSent} {n.of} {enrollment.sequence._count.steps}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {enrollment.status === "ACTIVE" && enrollment.nextSendAt && enrollment.stepsSent < enrollment.sequence._count.steps
                ? `${n.next} : ${formatDateTime(enrollment.nextSendAt, locale)}`
                : enrollment.endedAt
                  ? `${n.ended} : ${formatDateTime(enrollment.endedAt, locale)}${enrollment.endReason ? ` — ${enrollment.endReason}` : ""}`
                  : null}
            </p>
            {running && (
              <div className="mt-3 flex flex-wrap gap-2">
                {enrollment.status === "ACTIVE" && enrollment.stepsSent < enrollment.sequence._count.steps && (
                  <form action={act("next")}><SubmitButton className={smallBtn}><Send className="size-3.5" /> {n.sendNext}</SubmitButton></form>
                )}
                {enrollment.status === "ACTIVE" ? (
                  <form action={act("pause")}><SubmitButton className={smallBtn}><Pause className="size-3.5" /> {n.pause}</SubmitButton></form>
                ) : (
                  <form action={act("resume")}><SubmitButton className={smallBtn}><Play className="size-3.5" /> {n.resume}</SubmitButton></form>
                )}
                <form action={act("stop")}><SubmitButton className={smallBtn}><Square className="size-3.5" /> {n.stop}</SubmitButton></form>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{canEnroll ? n.none : n.notEligible}</p>
        )}

        {canEnroll && !running && !closed && (
          <form action={act("start")}>
            <SubmitButton className={smallBtn}><Play className="size-3.5" /> {enrollment ? n.restart : n.start}</SubmitButton>
          </form>
        )}

        {messages.length > 0 && !candidate.unsubscribedAt && !closed && (
          <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/40 p-3">
            <p className="text-xs font-medium text-indigo-900">{n.simulate}</p>
            <p className="text-[11px] text-indigo-800/70">{n.simulateHint}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <form action={sim("open")}><SubmitButton className={smallBtn}><MailOpen className="size-3.5" /> {n.simOpen}</SubmitButton></form>
              <form action={sim("click")}><SubmitButton className={smallBtn}><MousePointerClick className="size-3.5" /> {n.simClick}</SubmitButton></form>
              <form action={sim("replyYes")}><SubmitButton className={smallBtn}><ThumbsUp className="size-3.5" /> {n.simReplyYes}</SubmitButton></form>
              <form action={sim("replyNo")}><SubmitButton className={smallBtn}><ThumbsDown className="size-3.5" /> {n.simReplyNo}</SubmitButton></form>
              <form action={sim("unsubscribe")}><SubmitButton className={smallBtn}><BellOff className="size-3.5" /> {n.simUnsubscribe}</SubmitButton></form>
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">{n.emails} ({messages.length})</p>
          {messages.length === 0 ? (
            <p className="text-sm text-slate-500">{n.noEmails}</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {messages.map((m) => (
                <li key={m.id}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                      <Mail className="size-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{m.subject}</span>
                        <span className="text-xs text-slate-500">
                          {n.sent} {formatDateTime(m.sentAt, locale)}
                          {m.provider === "simulated" && ` · ${n.simulated}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {m.error && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">{n.failed}</span>}
                        {m.openedAt && <MailOpen className="size-4 text-sky-600" aria-label={n.opened} />}
                        {m.clickedAt && <MousePointerClick className="size-4 text-violet-600" aria-label={n.clicked} />}
                        {m.repliedAt && <MessageSquareReply className="size-4 text-emerald-600" aria-label={n.replied} />}
                      </span>
                    </summary>
                    <pre className="whitespace-pre-wrap border-t border-slate-100 bg-slate-50 px-4 py-3 font-sans text-sm leading-relaxed text-slate-700">
                      {m.body}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

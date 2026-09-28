import clsx from "clsx";
import {
  AlertTriangle,
  Send,
  Gift,
  Link2,
  Star,
  BellOff,
  PlayCircle,
  StopCircle,
  Bot,
  CreditCard,
  Eye,
  FileText,
  GitMerge,
  Mail,
  MailOpen,
  MessageSquareReply,
  MousePointerClick,
  Phone,
  PlusCircle,
  RefreshCw,
  Route,
  StickyNote,
  Tag,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import type { EventType, CandidateStatus, RoutingTrack } from "@/generated/prisma/enums";
import type { Dictionary } from "@/lib/i18n/fr";
import type { Locale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/ui";

const ICON: Record<EventType, LucideIcon> = {
  CREATED: PlusCircle,
  UPDATED: RefreshCw,
  DUPLICATE_MERGED: GitMerge,
  CV_PARSED: FileText,
  AI_ANALYZED: Bot,
  ANALYSIS_FAILED: AlertTriangle,
  ROUTED: Route,
  STATUS_CHANGED: Tag,
  EMAIL_SENT: Mail,
  EMAIL_OPENED: MailOpen,
  EMAIL_CLICKED: MousePointerClick,
  EMAIL_REPLIED: MessageSquareReply,
  PRICE_VIEWED: Eye,
  UNSUBSCRIBED: BellOff,
  SEQUENCE_STARTED: PlayCircle,
  SEQUENCE_ENDED: StopCircle,
  SDR_ASSIGNED: UserCheck,
  CALL_LOGGED: Phone,
  REFERRAL_CREATED: Gift,
  MANUAL_EMAIL: Send,
  PAYMENT_LINK_SENT: Link2,
  PAYMENT_CONFIRMED: CreditCard,
  FEEDBACK_RECEIVED: Star,
  NOTE: StickyNote,
};

type TimelineEvent = {
  id: string;
  type: EventType;
  detail: string | null;
  toStatus: CandidateStatus | null;
  createdAt: Date;
  actor: { name: string } | null;
};

export function Timeline({ events, t, locale }: { events: TimelineEvent[]; t: Dictionary; locale: Locale }) {
  if (events.length === 0) return <p className="text-sm text-slate-500">{t.profile.noEvents}</p>;
  return (
    <ol className="relative space-y-5 before:absolute before:inset-y-1 before:left-3.5 before:w-px before:bg-slate-200">
      {events.map((e) => {
        const Icon = ICON[e.type];
        return (
          <li key={e.id} className="relative flex gap-3">
            <span
              className={clsx(
                "relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white",
                e.type === "NOTE" ? "bg-amber-100 text-amber-700" : e.type === "ANALYSIS_FAILED" ? "bg-red-100 text-red-700" : e.type === "PAYMENT_CONFIRMED" || e.type === "FEEDBACK_RECEIVED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-medium text-slate-900">{t.events[e.type]}</p>
                {e.toStatus && <StatusBadge status={e.toStatus} label={t.statuses[e.toStatus]} />}
              </div>
              {e.type === "ROUTED" && e.detail && e.detail in t.tracks ? (
                <p className="mt-0.5 text-sm text-slate-600">{t.tracks[e.detail as RoutingTrack]}</p>
              ) : e.detail && (
                <p className={clsx("mt-0.5 text-sm text-slate-600", e.type === "NOTE" && "whitespace-pre-line rounded-md bg-amber-50 px-2 py-1")}>
                  {e.detail}
                </p>
              )}
              <p className="mt-0.5 text-xs text-slate-400">
                {formatDateTime(e.createdAt, locale)} · {e.actor?.name ?? t.common.system}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

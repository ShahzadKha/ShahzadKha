import { Bell } from "lucide-react";
import { db } from "@/lib/db";
import type { Dictionary } from "@/lib/i18n/fr";
import type { Locale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { markAllNotificationsRead, openNotification } from "@/app/actions/closing";

// Header bell: unread count and the latest notifications (a native <details> dropdown, no JS needed)
export async function NotificationBell({ userId, t, locale }: { userId: string; t: Dictionary["notifications"]; locale: Locale }) {
  const [unread, latest] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  return (
    <details className="relative">
      <summary
        className="relative flex cursor-pointer list-none items-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        aria-label={`${t.title} (${unread})`}
        data-testid="bell"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <p className="text-sm font-semibold text-slate-900">{t.title}</p>
          {unread > 0 && (
            <form action={markAllNotificationsRead}>
              <button type="submit" className="text-xs font-medium text-indigo-600 hover:text-indigo-500">{t.markAll}</button>
            </form>
          )}
        </div>
        {latest.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">{t.empty}</p>
        ) : (
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {latest.map((n) => (
              <li key={n.id}>
                <form action={openNotification.bind(null, n.id)}>
                  <button type="submit" className="flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-indigo-600"}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-slate-500">{n.body}</span>}
                      <span className="block text-[11px] text-slate-400">{formatDateTime(n.createdAt, locale)}</span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

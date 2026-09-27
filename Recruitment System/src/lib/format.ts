import type { Locale } from "@/lib/i18n";

const intl = (locale: Locale) => (locale === "fr" ? "fr-FR" : "en-GB");

/**
 * The team's time zone. Servers (Vercel included) run in UTC, so dates are always shown
 * and typed in this zone, whatever the server's clock says. Set APP_TIMEZONE to change it.
 */
export const TIME_ZONE = process.env.APP_TIMEZONE || "Europe/Paris";

export function formatDate(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(intl(locale), { day: "2-digit", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(date);
}

export function formatDateTime(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(intl(locale), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date);
}

/** Minutes the time zone is ahead of UTC at this instant (+120 in Paris in summer). */
function zoneOffset(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** "2026-10-02T10:00" typed in a date-time field → the real instant, read in the team's time zone. */
export function parseLocalDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const naive = new Date(`${value}:00Z`);
  if (Number.isNaN(naive.getTime())) return null;
  // The offset depends on the date itself (summer / winter time), so check it twice
  let result = new Date(naive.getTime() - zoneOffset(naive) * 60_000);
  result = new Date(naive.getTime() - zoneOffset(result) * 60_000);
  return result;
}

/** Midnight of that day in the team's time zone. */
export function startOfDay(date: Date) {
  const local = new Date(date.getTime() + zoneOffset(date) * 60_000);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnight - zoneOffset(new Date(midnight)) * 60_000);
}

/** 0 = Monday … 6 = Sunday, in the team's time zone. */
export function weekday(date: Date) {
  const local = new Date(date.getTime() + zoneOffset(date) * 60_000);
  return (local.getUTCDay() + 6) % 7;
}

export function formatMoney(amount: number, locale: Locale) {
  return new Intl.NumberFormat(intl(locale), { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}

export function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

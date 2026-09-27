import type { Locale } from "@/lib/i18n";

const intl = (locale: Locale) => (locale === "fr" ? "fr-FR" : "en-GB");

export function formatDate(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(intl(locale), { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(intl(locale), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

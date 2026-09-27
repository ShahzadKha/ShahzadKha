import clsx from "clsx";
import { setLocale } from "@/app/actions/locale";
import type { Locale } from "@/lib/i18n";

export function LanguageSwitch({ locale, label }: { locale: Locale; label: string }) {
  return (
    <form action={setLocale} className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-xs font-medium" aria-label={label}>
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          type="submit"
          name="locale"
          value={l}
          aria-pressed={locale === l}
          className={clsx(
            "rounded-md px-2 py-1 uppercase",
            locale === l ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
          )}
        >
          {l}
        </button>
      ))}
    </form>
  );
}

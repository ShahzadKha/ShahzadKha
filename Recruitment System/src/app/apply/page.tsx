import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n";
import { getBrand } from "@/lib/settings";
import { LanguageSwitch } from "@/components/language-switch";
import { ApplyForm } from "./apply-form";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return { title: `${brand.name} — CV` };
}

// Public page: the "Formulaire web" source of the diagram
export default async function ApplyPage() {
  const { t, locale } = await getDictionary();
  const brand = await getBrand();

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-[#f6f7f9]">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            {brand.name.slice(0, 1)}
          </span>
          <span className="font-semibold text-slate-900">{brand.name}</span>
        </div>
        <LanguageSwitch locale={locale} label={t.common.language} />
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t.apply.title}</h1>
        <p className="mt-2 text-slate-600">{t.apply.subtitle}</p>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <ApplyForm t={{ apply: t.apply, errors: t.intakeErrors }} />
        </div>
      </main>
    </div>
  );
}

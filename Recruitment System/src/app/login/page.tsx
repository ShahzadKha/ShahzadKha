import { getDictionary } from "@/lib/i18n";
import { getBrand } from "@/lib/settings";
import { LanguageSwitch } from "@/components/language-switch";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const { t, locale } = await getDictionary();
  const brand = await getBrand();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <LanguageSwitch locale={locale} label={t.common.language} />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
            {brand.name.slice(0, 1)}
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{brand.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{t.login.subtitle}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm labels={t.login} />
        </div>
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white/60 p-4 text-xs text-slate-600">
          <p className="font-medium text-slate-700">{t.login.demoHint}</p>
          <ul className="mt-2 space-y-1 font-mono">
            <li>admin@demo.local — {t.roles.ADMIN}</li>
            <li>camille@demo.local — {t.roles.SDR}</li>
            <li>recruteur@demo.local — {t.roles.RECRUITER}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

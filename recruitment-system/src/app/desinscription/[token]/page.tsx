import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n";
import { getBrand } from "@/lib/settings";
import { confirmUnsubscribe } from "@/app/actions/public";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata: Metadata = { robots: { index: false } };

// The link only shows a confirmation button, so email scanners that open links cannot unsubscribe anyone
export default async function UnsubscribePage({ params }: PageProps<"/desinscription/[token]">) {
  const { token } = await params;
  const [{ t }, brand] = await Promise.all([getDictionary(), getBrand()]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-indigo-600">{brand.name}</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{t.unsubscribe.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{t.unsubscribe.body}</p>
        <UnsubscribeForm action={confirmUnsubscribe.bind(null, token)} t={t.unsubscribe} />
      </div>
    </div>
  );
}

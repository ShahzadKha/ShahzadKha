import type { Metadata } from "next";
import { after } from "next/server";
import { CheckCircle2, Eye } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getBrand } from "@/lib/settings";
import { formatMoney } from "@/lib/format";
import { recordPriceView } from "@/lib/nurture/engine";
import { STATUS_RANK } from "@/lib/nurture/status";
import { requestCallback } from "@/app/actions/public";
import { OfferForm } from "./offer-form";

export const metadata: Metadata = { robots: { index: false } };

// Personalised offer page, opened from the emails. Viewing it = "prix consulté".
export default async function OfferPage({ params }: PageProps<"/offre/[token]">) {
  const { token } = await params;
  const [{ t }, brand, viewer] = await Promise.all([getDictionary(), getBrand(), getCurrentUser()]);
  const c = await db.candidate.findUnique({
    where: { publicToken: token },
    select: { id: true, firstName: true, currentTitle: true, status: true, recommendedProduct: true },
  });
  const product = c?.recommendedProduct;

  // Team members previewing the page are not counted as candidate visits
  const preview = Boolean(viewer);
  if (c && product && !preview) after(() => recordPriceView(c.id));

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-[#f6f7f9]">
      <header className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">{brand.name.slice(0, 1)}</span>
        <span className="font-semibold text-slate-900">{brand.name}</span>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-4">
        {preview && (
          <p className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <Eye className="size-4" /> {t.offer.preview}
          </p>
        )}
        {!c || !product ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">{t.offer.notFound}</p>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {t.offer.hello} {c.firstName},
            </h1>
            <p className="mt-2 text-slate-600">{t.offer.intro}</p>
            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6 sm:p-8">
                <h2 className="text-xl font-semibold text-slate-900">{product.name}</h2>
                {product.description && <p className="mt-1 text-slate-600">{product.description}</p>}
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-sm text-slate-500">{t.offer.price}</span>
                  <span className="text-3xl font-semibold tabular-nums text-slate-900">{formatMoney(product.price, "fr")}</span>
                </div>
              </div>
              <div className="border-b border-slate-100 p-6 sm:p-8">
                <h3 className="text-sm font-semibold text-slate-900">{t.offer.whyTitle}</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {[
                    c.currentTitle ? `${c.currentTitle} → ${product.name}` : product.name,
                    ...product.keywords.slice(0, 4).map((k) => k),
                  ].map((line) => (
                    <li key={line} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {line}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 sm:p-8">
                <OfferForm
                  action={requestCallback.bind(null, token)}
                  // Once the candidate is purchase-ready an SDR takes over, so no need to ask again
                  alreadyInterested={STATUS_RANK[c.status] >= STATUS_RANK.PURCHASE_READY}
                  t={t.offer}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

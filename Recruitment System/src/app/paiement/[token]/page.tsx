import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { getBrand } from "@/lib/settings";
import { formatMoney } from "@/lib/format";
import { payDemo } from "@/app/actions/public";
import { PayButton } from "./pay-button";

export const metadata: Metadata = { robots: { index: false } };

/**
 * Step 22 — payment link from the email. With a ThriveCart link on the product, the candidate
 * goes straight to ThriveCart (their email and id are passed along for the webhook).
 * Without one, a demo checkout page is shown — it never asks for card details.
 */
export default async function PaymentPage({ params }: PageProps<"/paiement/[token]">) {
  const { token } = await params;
  const [{ t, locale }, brand] = await Promise.all([getDictionary(), getBrand()]);
  const c = await db.candidate.findUnique({
    where: { publicToken: token },
    select: { firstName: true, lastName: true, email: true, status: true, recommendedProduct: true },
  });
  const product = c?.recommendedProduct;

  if (c && product?.checkoutUrl && c.status !== "WON") {
    const url = new URL(product.checkoutUrl);
    url.searchParams.set("passthrough[customer_email]", c.email);
    url.searchParams.set("passthrough[customer_firstname]", c.firstName);
    url.searchParams.set("passthrough[customer_lastname]", c.lastName);
    url.searchParams.set("passthrough[candidate]", token);
    redirect(url.toString());
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-50 to-[#f6f7f9] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">{brand.name.slice(0, 1)}</span>
          <span className="font-semibold text-slate-900">{brand.name}</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {!c || !product ? (
            <p className="text-center text-slate-600">{t.payment.notAvailable}</p>
          ) : c.status === "WON" ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
              <h1 className="mt-4 text-xl font-semibold text-slate-900">{t.payment.paidTitle}</h1>
              <p className="mt-2 text-sm text-slate-600">{t.payment.paidBody}</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-slate-900">{t.payment.title}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {c.firstName} {c.lastName} · {c.email}
              </p>
              <div className="mt-6 rounded-lg border border-slate-200 p-4">
                <p className="font-medium text-slate-900">{product.name}</p>
                {product.description && <p className="mt-0.5 text-sm text-slate-500">{product.description}</p>}
                <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-3">
                  <span className="text-sm text-slate-600">{t.payment.total}</span>
                  <span className="text-2xl font-semibold tabular-nums text-slate-900">{formatMoney(product.price, locale)}</span>
                </div>
              </div>
              <p className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Lock className="size-3.5 shrink-0" /> {t.payment.demoBanner}
              </p>
              <PayButton action={payDemo.bind(null, token)} labels={{ pay: t.payment.pay, paidTitle: t.payment.paidTitle, paidBody: t.payment.paidBody }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

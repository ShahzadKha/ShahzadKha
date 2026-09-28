import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { getBrand } from "@/lib/settings";
import { submitFeedback } from "@/app/actions/public";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = { robots: { index: false } };

// Step 26 — NPS, testimonial and referral (link in the last onboarding email)
export default async function FeedbackPage({ params }: PageProps<"/avis/[token]">) {
  const { token } = await params;
  const [{ t }, brand] = await Promise.all([getDictionary(), getBrand()]);
  const c = await db.candidate.findUnique({ where: { publicToken: token }, select: { firstName: true, status: true, feedback: true } });
  const f = t.feedbackPage;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-[#f6f7f9] px-4 py-12">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">{brand.name.slice(0, 1)}</span>
          <span className="font-semibold text-slate-900">{brand.name}</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {!c || c.status !== "WON" ? (
            <p className="text-center text-slate-600">{f.notAvailable}</p>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {f.title}, {c.firstName}
              </h1>
              <FeedbackForm
                action={submitFeedback.bind(null, token)}
                done={Boolean(c.feedback)}
                t={{ ...f, question: f.question.replace("{{marque}}", brand.name) }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { confirmPayment } from "@/lib/closing/engine";

/**
 * Step 23 — ThriveCart webhook (Settings → Integrations → Webhooks in ThriveCart).
 * ThriveCart posts form data including "thrivecart_secret"; set the same value in THRIVECART_SECRET.
 * The candidate is found from the passthrough id added to the checkout link, or else by email.
 */

// ThriveCart checks the URL with a HEAD request when the webhook is saved
export function HEAD() {
  return new Response(null, { status: 200 });
}

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(request: NextRequest) {
  const secret = process.env.THRIVECART_SECRET;
  if (!secret) return NextResponse.json({ error: "disabled" }, { status: 503 });

  let fields: Record<string, string>;
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      fields = Object.fromEntries(Object.entries(await request.json()).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]));
    } else {
      const form = await request.formData();
      fields = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
    }
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!sameSecret(fields.thrivecart_secret ?? "", secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Only successful orders confirm a sale; other events are acknowledged and ignored
  if (fields.event !== "order.success") return NextResponse.json({ ignored: fields.event ?? null });

  const token = fields["passthrough[candidate]"];
  const email = (fields["customer[email]"] ?? fields.customer_email ?? fields["passthrough[customer_email]"] ?? "").toLowerCase();
  const candidate =
    (token ? await db.candidate.findUnique({ where: { publicToken: token }, select: { id: true } }) : null) ??
    (email ? await db.candidate.findUnique({ where: { email }, select: { id: true } }) : null);
  if (!candidate) return NextResponse.json({ error: "candidate_not_found" }, { status: 404 });

  // ThriveCart sends amounts in cents
  const cents = Number(fields["order[total]"] ?? fields.order_total ?? NaN);
  const orderId = fields.order_id ?? fields["order[id]"] ?? null;
  const safeRaw = Object.fromEntries(Object.entries(fields).filter(([k]) => k !== "thrivecart_secret"));
  const result = await confirmPayment({
    candidateId: candidate.id,
    provider: "thrivecart",
    amount: Number.isFinite(cents) ? Math.round(cents / 100) : null,
    externalId: orderId ? `thrivecart-${orderId}` : null,
    raw: safeRaw,
  });
  return NextResponse.json({ ok: true, duplicate: result.duplicate });
}

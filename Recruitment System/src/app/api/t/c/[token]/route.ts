import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Tracked link from an email → opens the candidate's offer page.
// Nothing is recorded here: mail security scanners (Outlook, Gmail, Proofpoint…) open every
// link to check it, so the click and the price view are recorded by the page itself, once a
// real browser has shown it (see offer-beacon.tsx).
// Only ever redirects inside the app, so it cannot be abused as an open redirect.
export async function GET(request: Request, { params }: RouteContext<"/api/t/c/[token]">) {
  const { token } = await params;
  const m = await db.emailMessage.findUnique({ where: { token }, select: { candidate: { select: { publicToken: true } } } });
  if (!m) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.redirect(new URL(`/offre/${m.candidate.publicToken}?m=${encodeURIComponent(token)}`, request.url));
}

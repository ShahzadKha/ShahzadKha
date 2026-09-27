import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordClick } from "@/lib/nurture/engine";

// Tracked link from an email → records the click, then opens the candidate's offer page.
// Only ever redirects inside the app, so it cannot be abused as an open redirect.
export async function GET(request: Request, { params }: RouteContext<"/api/t/c/[token]">) {
  const { token } = await params;
  const m = await db.emailMessage.findUnique({ where: { token }, select: { id: true, candidate: { select: { publicToken: true } } } });
  if (!m) return NextResponse.redirect(new URL("/", request.url));
  await recordClick(m.id);
  return NextResponse.redirect(new URL(`/offre/${m.candidate.publicToken}`, request.url));
}

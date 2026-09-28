import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { unsubscribe } from "@/lib/nurture/engine";

// One-click unsubscribe (RFC 8058), required by Gmail and Yahoo for bulk senders:
// the "Unsubscribe" button next to the sender name POSTs here, without opening a page.
// The candidate's public token is the only key, as for the unsubscribe page.
export async function POST(_request: Request, { params }: RouteContext<"/api/t/u/[token]">) {
  const { token } = await params;
  const c = await db.candidate.findUnique({ where: { publicToken: token }, select: { id: true } });
  if (c) await unsubscribe(c.id);
  return new Response(null, { status: 200 });
}

// Someone opening the link in a browser gets the normal page with its confirm button
// (a GET must never unsubscribe: mail scanners open every link).
export async function GET(request: Request, { params }: RouteContext<"/api/t/u/[token]">) {
  const { token } = await params;
  return NextResponse.redirect(new URL(`/desinscription/${encodeURIComponent(token)}`, request.url));
}

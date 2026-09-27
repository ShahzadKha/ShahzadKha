import { NextResponse, type NextRequest } from "next/server";
import { processDueEmails } from "@/lib/nurture/engine";

// Called by the scheduler (Vercel Cron, see vercel.json) to send the emails that are due.
// Vercel sends "Authorization: Bearer <CRON_SECRET>" automatically when CRON_SECRET is set.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const processed = await processDueEmails();
  return NextResponse.json({ processed });
}

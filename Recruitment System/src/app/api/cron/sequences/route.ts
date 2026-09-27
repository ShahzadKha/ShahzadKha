import { NextResponse, type NextRequest } from "next/server";
import { processDueEmails } from "@/lib/nurture/engine";
import { imapConfigured, pollInbox } from "@/lib/inbound/imap";
import { applyRetention } from "@/lib/gdpr/retention";

export const maxDuration = 300;

// Called by the scheduler (Vercel Cron, see vercel.json, or any external cron service):
// reads the inbox (new CVs and replies), sends the emails that are due, applies GDPR retention.
// Vercel sends "Authorization: Bearer <CRON_SECRET>" automatically when CRON_SECRET is set.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let inbox = null;
  if (imapConfigured()) {
    try {
      inbox = await pollInbox();
    } catch (e) {
      inbox = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  const processed = await processDueEmails();
  const deleted = await applyRetention();
  return NextResponse.json({ processed, inbox, retentionDeleted: deleted });
}

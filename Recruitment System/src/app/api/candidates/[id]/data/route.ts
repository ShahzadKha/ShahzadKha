import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GDPR right of access: everything stored about one candidate, as a JSON file
export async function GET(_request: Request, { params }: RouteContext<"/api/candidates/[id]/data">) {
  const user = await getCurrentUser();
  if (!user || user.role === "SDR") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const c = await db.candidate.findUnique({
    where: { id },
    include: {
      recommendedProduct: { select: { name: true, price: true } },
      assignedSdr: { select: { name: true } },
      cvFile: { select: { fileName: true, mimeType: true, size: true, createdAt: true } },
      events: { orderBy: { createdAt: "asc" }, select: { type: true, title: true, detail: true, createdAt: true } },
      emails: { orderBy: { sentAt: "asc" }, select: { subject: true, body: true, sentAt: true, openedAt: true, clickedAt: true, repliedAt: true } },
      tasks: { select: { kind: true, status: true, dueAt: true, completedAt: true, outcome: true, notes: true } },
      payments: { select: { amount: true, currency: true, provider: true, paidAt: true } },
      feedback: { select: { nps: true, comment: true, publishConsent: true, createdAt: true } },
    },
  });
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Internal tokens are left out of the export
  const data: Partial<typeof c> = { ...c };
  delete data.publicToken;
  delete data.phoneKey;
  const fileName = `donnees-${c.firstName}-${c.lastName}.json`.replace(/[^\w.-]/g, "_");
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), candidate: data }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

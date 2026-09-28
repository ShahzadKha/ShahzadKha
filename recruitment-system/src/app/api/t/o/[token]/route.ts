import { after } from "next/server";
import { db } from "@/lib/db";
import { recordOpen } from "@/lib/nurture/engine";

// 1×1 transparent GIF used as the open-tracking pixel
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(_request: Request, { params }: RouteContext<"/api/t/o/[token]">) {
  const { token } = await params;
  after(async () => {
    const m = await db.emailMessage.findUnique({ where: { token }, select: { id: true } });
    if (m) await recordOpen(m.id);
  });
  return new Response(new Uint8Array(PIXEL), {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" },
  });
}

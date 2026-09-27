import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

const DAY = 24 * 60 * 60 * 1000;

/** The visitor's IP address (set by Vercel / the reverse proxy). */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/**
 * Counts one use of `action` by this visitor and says whether they went over `max` uses
 * in the last `windowMs`. Protects the public forms against bots (and the OpenAI bill).
 */
export async function overLimit(action: string, max: number, windowMs: number) {
  const ip = await clientIp();
  if (!ip) return false;
  const key = `${action}:${ip}`;
  const count = await db.rateHit.count({ where: { key, createdAt: { gte: new Date(Date.now() - windowMs) } } });
  if (count >= max) return true;
  await db.rateHit.create({ data: { key } });
  // Now and then, forget old hits so the table stays small
  if (Math.random() < 0.02) await db.rateHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - DAY) } } });
  return false;
}

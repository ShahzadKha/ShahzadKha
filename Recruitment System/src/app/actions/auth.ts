"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { encryptSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

const LoginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

export type LoginState = { error?: "invalid" | "locked"; email?: string } | undefined;

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

// Too many failed logins for this email or this IP in the last 15 minutes
async function isLocked(email: string, ip: string | null) {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byEmail, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { email, success: false, createdAt: { gte: since } } }),
    ip ? db.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }) : 0,
  ]);
  return byEmail >= MAX_PER_EMAIL || byIp >= MAX_PER_IP;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid", email };

  const ip = await clientIp();
  if (await isLocked(parsed.data.email, ip)) return { error: "locked", email };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const valid = user?.active && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  await db.loginAttempt.create({ data: { email: parsed.data.email, ip, success: Boolean(user && valid) } });
  if (!user || !valid) return { error: "invalid", email };

  const token = await encryptSession({ userId: user.id, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

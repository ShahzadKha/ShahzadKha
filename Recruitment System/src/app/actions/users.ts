"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Role } from "@/generated/prisma/enums";

export type UserFormState = { ok: boolean; error?: "invalid" | "email_taken" | "last_admin" | "wrong_password"; at: number } | undefined;

const password = z.string().min(8).max(200);

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().trim().toLowerCase(),
  role: z.enum(Role),
  password,
});

export async function createUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireUser(["ADMIN"]);
  const parsed = CreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid", at: Date.now() };
  if (await db.user.findUnique({ where: { email: parsed.data.email } })) return { ok: false, error: "email_taken", at: Date.now() };
  const { password: pw, ...data } = parsed.data;
  await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(pw, 10) } });
  revalidatePath("/users");
  return { ok: true, at: Date.now() };
}

// Never leave the platform without an active administrator
async function wouldRemoveLastAdmin(userId: string, change: { role?: Role; active?: boolean }) {
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u || u.role !== "ADMIN" || !u.active) return false;
  if ((change.role ?? "ADMIN") === "ADMIN" && change.active !== false) return false;
  return (await db.user.count({ where: { role: "ADMIN", active: true } })) <= 1;
}

export async function updateUser(userId: string, _prev: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireUser(["ADMIN"]);
  const role = z.enum(Role).safeParse(formData.get("role"));
  const active = formData.get("active") === "on";
  if (!role.success) return { ok: false, error: "invalid", at: Date.now() };
  if (await wouldRemoveLastAdmin(userId, { role: role.data, active })) return { ok: false, error: "last_admin", at: Date.now() };

  const newPassword = String(formData.get("newPassword") ?? "");
  if (newPassword && !password.safeParse(newPassword).success) return { ok: false, error: "invalid", at: Date.now() };

  await db.user.update({
    where: { id: userId },
    data: { role: role.data, active, ...(newPassword ? { passwordHash: await bcrypt.hash(newPassword, 10) } : {}) },
  });
  // A deactivated SDR's open calls go back to be reassigned
  if (!active) await db.callTask.updateMany({ where: { sdrId: userId, status: "OPEN" }, data: { status: "CANCELLED", completedAt: new Date() } });
  revalidatePath("/users");
  return { ok: true, at: Date.now() };
}

export async function changeOwnPassword(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = password.safeParse(String(formData.get("next") ?? ""));
  if (!next.success || next.data !== String(formData.get("confirm") ?? "")) return { ok: false, error: "invalid", at: Date.now() };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(current, row.passwordHash))) return { ok: false, error: "wrong_password", at: Date.now() };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next.data, 10) } });
  return { ok: true, at: Date.now() };
}

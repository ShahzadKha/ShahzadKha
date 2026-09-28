"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/settings";
import { appUrl, deliver, emailMode } from "@/lib/nurture/mailer";
import { overLimit } from "@/lib/rate-limit";

const HOUR = 60 * 60 * 1000;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export type ForgotState = { result: "sent" | "no_email" } | undefined;

// Always answers "sent" so nobody can find out which emails have an account
export async function requestPasswordReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  if (emailMode() !== "smtp") return { result: "no_email" };
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { result: "sent" };
  if (await overLimit("password-reset", 10, HOUR)) return { result: "sent" };

  const user = await db.user.findUnique({ where: { email: email.data } });
  if (!user?.active) return { result: "sent" };
  // At most 3 links per hour per account
  const recent = await db.passwordReset.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - HOUR) } } });
  if (recent >= 3) return { result: "sent" };

  const token = randomBytes(32).toString("hex");
  await db.passwordReset.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + HOUR) } });
  const brand = await getBrand();
  const link = `${appUrl()}/reset-password/${token}`;
  try {
    await deliver({
      to: user.email,
      subject: `${brand.name} — nouveau mot de passe`,
      text: `Bonjour ${user.name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${link}\n\nSi vous n'avez rien demandé, ignorez cet email.`,
      html: `<p>Bonjour ${user.name.replace(/</g, "&lt;")},</p><p>Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :</p><p><a href="${link}">Choisir un nouveau mot de passe</a></p><p>Si vous n'avez rien demandé, ignorez cet email.</p>`,
      fromName: brand.name,
    });
  } catch (e) {
    console.error("Password reset email failed:", e);
  }
  return { result: "sent" };
}

export type ResetState = { result: "done" | "invalid" | "mismatch" } | undefined;

export async function resetPassword(token: string, _prev: ResetState, formData: FormData): Promise<ResetState> {
  const next = String(formData.get("next") ?? "");
  if (next.length < 8 || next.length > 200 || next !== String(formData.get("confirm") ?? "")) return { result: "mismatch" };
  const reset = await db.passwordReset.findUnique({ where: { tokenHash: hash(token) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return { result: "invalid" };
  const user = await db.user.findUnique({ where: { id: reset.userId } });
  if (!user?.active) return { result: "invalid" };

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10), passwordChangedAt: new Date() } }),
    // This link and any other pending link for the account stop working
    db.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    // A fresh password lifts the login lockout
    db.loginAttempt.deleteMany({ where: { email: user.email, success: false } }),
  ]);
  return { result: "done" };
}

"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { BLOCKERS, assignSdr, confirmPayment, logCall, sendPaymentLink } from "@/lib/closing/engine";
import { ClosingSettingsSchema, getClosingSettings } from "@/lib/settings";
import type { SettingsState } from "@/app/actions/settings";

const refresh = (candidateId?: string) => {
  if (candidateId) {
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath(`/sdr/appel/${candidateId}`);
  }
  revalidatePath("/sdr");
  revalidatePath("/pipeline");
};

export async function assignSdrAction(candidateId: string, formData: FormData) {
  const user = await requireUser(["ADMIN", "RECRUITER"]);
  const sdrId = String(formData.get("sdrId") ?? "");
  await assignSdr(candidateId, { actorId: user.id, sdrId: sdrId && sdrId !== "auto" ? sdrId : undefined });
  refresh(candidateId);
}

const CallSchema = z
  .object({
    outcome: z.enum(["payment_link", "callback", "nurture", "lost"]),
    durationMin: z.coerce.number().int().min(0).max(300).nullable(),
    blocker: z.enum(BLOCKERS),
    notes: z.string().trim().max(3000).transform((v) => v || null),
    callbackAt: z.string().optional(),
    lostReason: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.outcome !== "callback" || Boolean(v.callbackAt), { path: ["callbackAt"] });

export type CallState = { ok: false } | undefined;

export async function logCallAction(candidateId: string, _prev: CallState, formData: FormData): Promise<CallState> {
  const user = await requireUser();
  const parsed = CallSchema.safeParse({
    outcome: formData.get("outcome"),
    durationMin: formData.get("durationMin") || null,
    blocker: formData.get("blocker") ?? "none",
    notes: formData.get("notes") ?? "",
    callbackAt: formData.get("callbackAt") || undefined,
    lostReason: formData.get("lostReason") || undefined,
  });
  if (!parsed.success) return { ok: false };
  const d = parsed.data;
  // datetime-local has no time zone: it is the SDR's local time, sent with their offset
  const offset = Number(formData.get("tzOffset") ?? 0);
  const callbackAt = d.callbackAt ? new Date(new Date(`${d.callbackAt}:00Z`).getTime() + offset * 60_000) : null;
  await logCall(
    candidateId,
    { outcome: d.outcome, notes: d.notes, durationMin: d.durationMin, blocker: d.blocker, callbackAt, lostReason: d.lostReason ?? null },
    { actorId: user.id },
  );
  refresh(candidateId);
  redirect("/sdr");
}

export async function sendPaymentLinkAction(candidateId: string) {
  const user = await requireUser();
  await sendPaymentLink(candidateId, { actorId: user.id });
  refresh(candidateId);
}

// Demo only: what the ThriveCart webhook does when the candidate pays
export async function simulatePaymentAction(candidateId: string) {
  await requireUser();
  // Same id as the demo checkout page, so a candidate can only be "paid" once
  await confirmPayment({ candidateId, provider: "simulated", externalId: `demo-${candidateId}` });
  refresh(candidateId);
}

// ─── Notifications ──────────────────────────────────────────────────

export async function openNotification(id: string) {
  const user = await requireUser();
  const n = await db.notification.findFirst({ where: { id, userId: user.id } });
  if (!n) return;
  await db.notification.update({ where: { id }, data: { readAt: n.readAt ?? new Date() } });
  revalidatePath("/", "layout");
  if (n.link?.startsWith("/")) redirect(n.link);
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

// ─── Settings ───────────────────────────────────────────────────────

export async function saveClosingSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireUser(["ADMIN"]);
  const current = await getClosingSettings();
  const parsed = ClosingSettingsSchema.safeParse({
    autoAssign: formData.has("callSlaHours") ? formData.get("autoAssign") === "on" : current.autoAssign,
    callSlaHours: formData.has("callSlaHours") ? Number(formData.get("callSlaHours")) : current.callSlaHours,
    callScript: formData.has("callScript") ? String(formData.get("callScript")).trim() : current.callScript,
  });
  if (!parsed.success) return { ok: false, at: Date.now() };
  await db.setting.upsert({ where: { key: "closingSettings" }, create: { key: "closingSettings", value: parsed.data }, update: { value: parsed.data } });
  revalidatePath("/settings");
  return { ok: true, at: Date.now() };
}

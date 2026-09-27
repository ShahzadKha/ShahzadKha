import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { z } from "zod";
import { DEFAULT_RULES, ScoringRulesSchema, type ScoringRules } from "@/lib/rules";
import { DEFAULT_CALL_SCRIPT, DEFAULT_OFFER_EMAIL, DEFAULT_PAYMENT_EMAIL } from "@/lib/nurture/defaults";

// White-label branding stored in the Setting table
export const getBrand = cache(async () => {
  const rows = await db.setting.findMany({ where: { key: { in: ["brandName", "brandTagline"] } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    name: typeof map.brandName === "string" ? map.brandName : "Recruitment System",
    tagline: typeof map.brandTagline === "string" ? map.brandTagline : null,
  };
});

export const getScoringRules = cache(async (): Promise<ScoringRules> => {
  const row = await db.setting.findUnique({ where: { key: "scoringRules" } });
  const parsed = ScoringRulesSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : DEFAULT_RULES;
});

export function aiStatus() {
  const enabled = Boolean(process.env.OPENAI_API_KEY);
  return { enabled, model: enabled ? openAiModel() : null };
}

export function openAiModel() {
  return process.env.OPENAI_MODEL || "gpt-5-mini";
}

export const EmailSettingsSchema = z.object({
  autoEnroll: z.boolean(),
  requireConsent: z.boolean(),
  offerSubject: z.string().min(1).max(200),
  offerBody: z.string().min(1).max(5000),
  paymentSubject: z.string().min(1).max(200),
  paymentBody: z.string().min(1).max(5000),
});
export type EmailSettings = z.infer<typeof EmailSettingsSchema>;

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  autoEnroll: true,
  requireConsent: false,
  offerSubject: DEFAULT_OFFER_EMAIL.subject,
  offerBody: DEFAULT_OFFER_EMAIL.body,
  paymentSubject: DEFAULT_PAYMENT_EMAIL.subject,
  paymentBody: DEFAULT_PAYMENT_EMAIL.body,
};

// Stored settings are merged over the defaults, so fields added later never break older saves
const asObject = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

export const getEmailSettings = cache(async (): Promise<EmailSettings> => {
  const row = await db.setting.findUnique({ where: { key: "emailSettings" } });
  const parsed = EmailSettingsSchema.safeParse({ ...DEFAULT_EMAIL_SETTINGS, ...asObject(row?.value) });
  return parsed.success ? parsed.data : DEFAULT_EMAIL_SETTINGS;
});

// Closing (diagram steps 19–21)
export const ClosingSettingsSchema = z.object({
  autoAssign: z.boolean(), // assign an SDR as soon as a candidate is purchase ready
  callSlaHours: z.number().int().min(1).max(168), // the SDR should call within this many hours
  callScript: z.string().min(1).max(10000),
});
export type ClosingSettings = z.infer<typeof ClosingSettingsSchema>;

export const DEFAULT_CLOSING_SETTINGS: ClosingSettings = {
  autoAssign: true,
  callSlaHours: 24,
  callScript: DEFAULT_CALL_SCRIPT,
};

export const getClosingSettings = cache(async (): Promise<ClosingSettings> => {
  const row = await db.setting.findUnique({ where: { key: "closingSettings" } });
  const parsed = ClosingSettingsSchema.safeParse({ ...DEFAULT_CLOSING_SETTINGS, ...asObject(row?.value) });
  return parsed.success ? parsed.data : DEFAULT_CLOSING_SETTINGS;
});

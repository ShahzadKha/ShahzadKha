"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ScoringRulesSchema } from "@/lib/rules";

export type SettingsState = { ok: boolean; at: number } | undefined;

const int = (formData: FormData, key: string) => Number(formData.get(key));

export async function saveBrand(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireUser(["ADMIN"]);
  const name = String(formData.get("brandName") ?? "").trim().slice(0, 60);
  const tagline = String(formData.get("brandTagline") ?? "").trim().slice(0, 80);
  if (!name) return { ok: false, at: Date.now() };
  await db.$transaction([
    db.setting.upsert({ where: { key: "brandName" }, create: { key: "brandName", value: name }, update: { value: name } }),
    db.setting.upsert({ where: { key: "brandTagline" }, create: { key: "brandTagline", value: tagline }, update: { value: tagline } }),
  ]);
  revalidatePath("/", "layout");
  return { ok: true, at: Date.now() };
}

export async function saveRules(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireUser(["ADMIN"]);
  const parsed = ScoringRulesSchema.safeParse({
    weights: { fit: int(formData, "wFit"), need: int(formData, "wNeed"), intent: int(formData, "wIntent") },
    eligibilityMinFit: int(formData, "eligibilityMinFit"),
    bands: {
      light: int(formData, "bLight"),
      conversion: int(formData, "bConversion"),
      callInvite: int(formData, "bCallInvite"),
      prioritySdr: int(formData, "bPrioritySdr"),
    },
    purchaseReady: { minFit: int(formData, "prMinFit"), maxTimingDays: int(formData, "prTiming") },
  });
  if (!parsed.success) return { ok: false, at: Date.now() };
  const r = parsed.data;
  const ascending = r.bands.light < r.bands.conversion && r.bands.conversion < r.bands.callInvite && r.bands.callInvite < r.bands.prioritySdr;
  if (!ascending || r.weights.fit + r.weights.need + r.weights.intent === 0) return { ok: false, at: Date.now() };

  await db.setting.upsert({ where: { key: "scoringRules" }, create: { key: "scoringRules", value: r }, update: { value: r } });
  revalidatePath("/", "layout");
  return { ok: true, at: Date.now() };
}

const ProductSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300),
  price: z.coerce.number().int().min(0).max(1_000_000),
  keywords: z.string().transform((v) => [...new Set(v.split(",").map((k) => k.trim()).filter(Boolean))].slice(0, 30)),
  active: z.boolean(),
  checkoutUrl: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(z.url({ protocol: /^https$/ }).nullable()),
  platformUrl: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(z.url({ protocol: /^https$/ }).nullable()),
});

export async function saveProduct(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireUser(["ADMIN"]);
  const parsed = ProductSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    price: formData.get("price") ?? "",
    keywords: formData.get("keywords") ?? "",
    active: formData.get("active") === "on",
    checkoutUrl: formData.get("checkoutUrl") ?? "",
    platformUrl: formData.get("platformUrl") ?? "",
  });
  if (!parsed.success) return { ok: false, at: Date.now() };
  const { id, ...data } = parsed.data;
  const values = { ...data, description: data.description || null };
  if (id) await db.product.update({ where: { id }, data: values });
  else await db.product.create({ data: values });
  revalidatePath("/settings");
  return { ok: true, at: Date.now() };
}

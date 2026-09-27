import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { DEFAULT_RULES, ScoringRulesSchema, type ScoringRules } from "@/lib/rules";

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

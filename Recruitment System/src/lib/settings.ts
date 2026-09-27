import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

// White-label branding stored in the Setting table
export const getBrand = cache(async () => {
  const rows = await db.setting.findMany({ where: { key: { in: ["brandName", "brandTagline"] } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    name: typeof map.brandName === "string" ? map.brandName : "Recruitment System",
    tagline: typeof map.brandTagline === "string" ? map.brandTagline : null,
  };
});

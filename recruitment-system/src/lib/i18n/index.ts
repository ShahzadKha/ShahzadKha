import "server-only";
import { cookies } from "next/headers";
import { fr } from "./fr";
import { en } from "./en";

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "locale";

const dictionaries = { fr, en };

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value === "en" ? "en" : "fr";
}

export async function getDictionary() {
  const locale = await getLocale();
  return { t: dictionaries[locale], locale };
}

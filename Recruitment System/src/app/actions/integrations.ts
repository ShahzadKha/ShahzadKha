"use server";

import OpenAI from "openai";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { aiStatus, getBrand } from "@/lib/settings";
import { deliver, emailMode } from "@/lib/nurture/mailer";
import { imapConfigured, pollInbox } from "@/lib/inbound/imap";
import { acumbamailConfigured, testAcumbamail } from "@/lib/integrations/acumbamail";

export type TestResult = { ok: boolean; message: string } | undefined;

const fail = (e: unknown): TestResult => ({ ok: false, message: (e instanceof Error ? e.message : String(e)).slice(0, 300) });

export async function testOpenAI(): Promise<TestResult> {
  await requireUser(["ADMIN"]);
  const ai = aiStatus();
  if (!ai.enabled) return { ok: false, message: "OPENAI_API_KEY manquant" };
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15_000, maxRetries: 0 });
    await client.models.retrieve(ai.model!);
    return { ok: true, message: `Clé valide, modèle ${ai.model} disponible` };
  } catch (e) {
    return fail(e);
  }
}

export async function testEmail(): Promise<TestResult> {
  const user = await requireUser(["ADMIN"]);
  if (emailMode() !== "smtp") return { ok: false, message: "SMTP_URL manquant (emails simulés)" };
  try {
    const brand = await getBrand();
    await deliver({
      to: user.email,
      subject: `Test d'envoi — ${brand.name}`,
      text: "Si vous lisez ce message, l'envoi d'emails fonctionne.",
      html: "<p>Si vous lisez ce message, l'envoi d'emails fonctionne.</p>",
      fromName: brand.name,
    });
    return { ok: true, message: `Email de test envoyé à ${user.email}` };
  } catch (e) {
    return fail(e);
  }
}

export async function checkInbox(): Promise<TestResult> {
  await requireUser(["ADMIN"]);
  if (!imapConfigured()) return { ok: false, message: "IMAP_HOST / IMAP_USER / IMAP_PASSWORD manquants" };
  try {
    const r = await pollInbox();
    revalidatePath("/integrations");
    revalidatePath("/candidates");
    return { ok: true, message: `${r.checked} email(s) lu(s) : ${r.cvs} CV, ${r.replies} réponse(s), ${r.ignored} ignoré(s), ${r.errors} erreur(s)` };
  } catch (e) {
    return fail(e);
  }
}

export async function checkAcumbamail(): Promise<TestResult> {
  await requireUser(["ADMIN"]);
  if (!acumbamailConfigured()) return { ok: false, message: "ACUMBAMAIL_AUTH_TOKEN / ACUMBAMAIL_LIST_ID manquants" };
  try {
    await testAcumbamail();
    return { ok: true, message: "Connexion Acumbamail réussie" };
  } catch (e) {
    return fail(e);
  }
}

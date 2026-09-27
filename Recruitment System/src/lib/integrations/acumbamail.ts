import "server-only";
import { db } from "@/lib/db";

/**
 * Step 10 — keep an Acumbamail list in sync with the candidates (contact + custom fields).
 * Optional: set ACUMBAMAIL_AUTH_TOKEN and ACUMBAMAIL_LIST_ID. In the Acumbamail list, create the
 * custom fields prenom, nom, statut, score, formation, parcours.
 * Built from Acumbamail's public API (addSubscriber); check it once with the client's account.
 */
export function acumbamailConfigured() {
  return Boolean(process.env.ACUMBAMAIL_AUTH_TOKEN && process.env.ACUMBAMAIL_LIST_ID);
}

const apiBase = () => (process.env.ACUMBAMAIL_API_URL || "https://acumbamail.com/api/1").replace(/\/$/, "");

async function call(endpoint: string, fields: Record<string, string>) {
  const body = new URLSearchParams({ auth_token: process.env.ACUMBAMAIL_AUTH_TOKEN!, ...fields });
  const res = await fetch(`${apiBase()}/${endpoint}/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Acumbamail ${endpoint} ${res.status}: ${text.slice(0, 200)}`);
  return text;
}

async function recordResult(error: string | null) {
  const value = { at: new Date().toISOString(), error };
  await db.setting.upsert({ where: { key: "acumbamailLastSync" }, create: { key: "acumbamailLastSync", value }, update: { value } });
}

/** Adds or updates the candidate in the Acumbamail list. Never throws: failures are logged. */
export async function syncContact(candidateId: string) {
  if (!acumbamailConfigured()) return;
  try {
    const c = await db.candidate.findUnique({
      where: { id: candidateId },
      select: { email: true, firstName: true, lastName: true, status: true, globalScore: true, routingTrack: true, unsubscribedAt: true, recommendedProduct: { select: { name: true } } },
    });
    if (!c) return;
    await call("addSubscriber", {
      list_id: process.env.ACUMBAMAIL_LIST_ID!,
      "merge_fields[email]": c.email,
      "merge_fields[prenom]": c.firstName,
      "merge_fields[nom]": c.lastName,
      "merge_fields[statut]": c.unsubscribedAt ? "UNSUBSCRIBED" : c.status,
      "merge_fields[score]": c.globalScore != null ? String(c.globalScore) : "",
      "merge_fields[formation]": c.recommendedProduct?.name ?? "",
      "merge_fields[parcours]": c.routingTrack ?? "",
      double_optin: "0",
      update_subscriber: "1",
      complete_json: "1",
    });
    await recordResult(null);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Acumbamail sync failed:", message);
    await recordResult(message.slice(0, 300));
  }
}

/** Connection test for the Integrations page. */
export async function testAcumbamail() {
  await call("getLists", {});
  return true;
}

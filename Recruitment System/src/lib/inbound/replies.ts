import "server-only";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { aiStatus } from "@/lib/settings";
import { recordReply, unsubscribe } from "@/lib/nurture/engine";
import { notify } from "@/lib/closing/engine";
import { STATUS_RANK } from "@/lib/nurture/status";

export type ReplyIntent = "interested" | "not_interested" | "unsubscribe";

// Keep only what the candidate wrote, not the quoted email below
export function stripQuoted(text: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  const cut = lines.findIndex(
    (l) => /^\s*>/.test(l) || /^(Le|On) .{5,120}(a écrit|wrote)\s*:?\s*$/i.test(l.trim()) || /^-{2,}\s*(Original|Message d'origine)/i.test(l.trim()),
  );
  return (cut >= 0 ? lines.slice(0, cut) : lines).join("\n").trim().slice(0, 2000);
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function classifyByKeywords(text: string): ReplyIntent {
  const t = fold(text);
  if (/desinscri|desabonn|unsubscribe|ne plus recevoir|retirez.moi|\bstop\b/.test(t)) return "unsubscribe";
  if (/pas interess|plus interess|non merci|pas le (bon )?moment|pas pour moi|pas maintenant|no thanks|not interested/.test(t)) return "not_interested";
  return "interested";
}

/** Reads the intent of a reply: OpenAI when configured, otherwise keywords. */
export async function classifyReply(text: string): Promise<ReplyIntent> {
  const ai = aiStatus();
  if (!ai.enabled) return classifyByKeywords(text);
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20_000, maxRetries: 1 });
    const response = await client.responses.create({
      model: ai.model!,
      instructions:
        "Tu classes la réponse d'un prospect à un email commercial d'organisme de formation. " +
        "interested = intéressé, pose une question ou demande plus d'infos ; not_interested = refuse ; unsubscribe = demande à ne plus recevoir d'emails.",
      input: text.slice(0, 2000),
      text: {
        format: {
          type: "json_schema",
          name: "reply_intent",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["intent"],
            properties: { intent: { type: "string", enum: ["interested", "not_interested", "unsubscribe"] } },
          },
        },
      },
    });
    const intent = JSON.parse(response.output_text).intent;
    return intent === "not_interested" || intent === "unsubscribe" ? intent : "interested";
  } catch (e) {
    console.error("Reply classification failed, using keywords:", e);
    return classifyByKeywords(text);
  }
}

/** Step 12 "Suivi comportement: réponse": a real reply from a candidate. */
export async function handleReply(candidateId: string, rawText: string) {
  const text = stripQuoted(rawText) || "(réponse vide)";
  const c = await db.candidate.findUnique({ where: { id: candidateId }, select: { status: true, assignedSdrId: true, firstName: true, lastName: true } });
  if (!c) return "ignored";
  const intent = await classifyReply(text);

  if (intent === "unsubscribe") {
    await db.candidateEvent.create({ data: { candidateId, type: "EMAIL_REPLIED", title: "Réponse reçue", detail: text } });
    await unsubscribe(candidateId);
    return intent;
  }
  // Candidates already with an SDR or customers: log it and tell the SDR, don't restart the funnel
  if (STATUS_RANK[c.status] >= STATUS_RANK.PURCHASE_READY) {
    await db.candidateEvent.create({ data: { candidateId, type: "EMAIL_REPLIED", title: "Réponse reçue", detail: text } });
    if (c.assignedSdrId) await notify(c.assignedSdrId, `Réponse de ${c.firstName} ${c.lastName}`, text.slice(0, 140), `/candidates/${candidateId}`);
    return intent;
  }
  await recordReply(candidateId, intent === "interested", text);
  return intent;
}

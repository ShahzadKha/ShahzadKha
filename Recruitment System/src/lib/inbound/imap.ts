import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser, type Attachment } from "mailparser";
import { db } from "@/lib/db";
import { analyzeCandidate, ingestCv, IngestError } from "@/lib/engine/pipeline";
import { ACCEPTED_CV_TYPES, MAX_CV_BYTES } from "@/lib/engine/extract";
import { intakeErrorCode } from "@/lib/engine/errors";
import { handleReply } from "./replies";

/**
 * Source 1 "Email entrant (CV en pièce jointe)": reads the unread emails of a mailbox.
 * - an email with a CV attached → new candidate (source EMAIL), analysed right away
 * - an email from a known candidate → their reply (step 12), classified and acted on
 * Set IMAP_HOST, IMAP_USER, IMAP_PASSWORD (and optionally IMAP_PORT, IMAP_SECURE, IMAP_MAILBOX).
 */
export function imapConfigured() {
  return Boolean(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD);
}

export type PollResult = { checked: number; cvs: number; replies: number; ignored: number; errors: number };

const isCv = (a: Attachment) =>
  a.size > 0 && a.size <= MAX_CV_BYTES && (Boolean(ACCEPTED_CV_TYPES[a.contentType]) || /\.(pdf|docx)$/i.test(a.filename ?? ""));

export async function pollInbox(limit = 25): Promise<PollResult> {
  const result: PollResult = { checked: 0, cvs: 0, replies: 0, ignored: 0, errors: 0 };
  if (!imapConfigured()) return result;

  const client = new ImapFlow({
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT || 993),
    secure: (process.env.IMAP_SECURE ?? "true") !== "false",
    auth: { user: process.env.IMAP_USER!, pass: process.env.IMAP_PASSWORD! },
    logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock(process.env.IMAP_MAILBOX || "INBOX");
  try {
    const uids = ((await client.search({ seen: false }, { uid: true })) || []).slice(0, limit);
    for (const uid of uids) {
      result.checked++;
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) continue;
      const mail = await simpleParser(msg.source);
      const from = mail.from?.value[0]?.address?.toLowerCase() ?? "";
      const messageId = mail.messageId ?? `uid-${uid}-${from}-${mail.date?.toISOString() ?? ""}`;
      const base = { messageId, fromEmail: from || "?", subject: mail.subject?.slice(0, 300) ?? null, receivedAt: mail.date ?? new Date() };

      if (await db.inboundEmail.findUnique({ where: { messageId } })) {
        await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        continue;
      }
      try {
        const cv = mail.attachments.find(isCv);
        const known = from ? await db.candidate.findUnique({ where: { email: from }, select: { id: true } }) : null;
        const text = (mail.text ?? "").trim();

        if (cv) {
          const file = { bytes: new Uint8Array(cv.content), fileName: cv.filename ?? "cv.pdf", mimeType: cv.contentType };
          const input = { source: "EMAIL" as const, file, motivation: text.slice(0, 2000) || null, sourceDetail: "Email" };
          // The CV's own email wins; the sender's address is used when the CV has none
          const ingested = await ingestCv(input).catch((e) => {
            if (e instanceof IngestError && e.code === "no_email" && from) return ingestCv({ ...input, contact: { email: from } });
            throw e;
          });
          await analyzeCandidate(ingested.candidateId);
          await db.inboundEmail.create({ data: { ...base, kind: "cv", detail: ingested.duplicate ? "Doublon — fiche mise à jour" : ingested.name, candidateId: ingested.candidateId } });
          result.cvs++;
        } else if (known) {
          const intent = await handleReply(known.id, text);
          await db.inboundEmail.create({ data: { ...base, kind: "reply", detail: intent, candidateId: known.id } });
          result.replies++;
        } else {
          await db.inboundEmail.create({ data: { ...base, kind: "ignored", detail: "Ni CV ni candidat connu" } });
          result.ignored++;
        }
      } catch (e) {
        await db.inboundEmail.create({ data: { ...base, kind: "error", detail: intakeErrorCode(e) } });
        result.errors++;
      }
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return result;
}

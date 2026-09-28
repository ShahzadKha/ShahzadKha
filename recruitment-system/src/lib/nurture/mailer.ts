import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Emails are simulated (saved and shown in the app, not sent) unless SMTP_URL is set.
// SMTP works with any provider: Acumbamail, Brevo, Mailjet, Gmail Workspace, Amazon SES…
export function emailMode(): "smtp" | "simulated" {
  return process.env.SMTP_URL ? "smtp" : "simulated";
}

let transporter: Transporter | null = null;

export async function deliver(msg: {
  to: string;
  subject: string;
  text: string;
  html: string;
  fromName: string;
  /** Candidate emails: one-click unsubscribe link, shown by Gmail / Yahoo / Outlook next to the sender */
  unsubscribeUrl?: string;
}) {
  if (emailMode() === "simulated") return { provider: "simulated" as const };
  transporter ??= nodemailer.createTransport(process.env.SMTP_URL!);
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set");
  await transporter.sendMail({
    from: { name: msg.fromName, address: from },
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
    replyTo: process.env.EMAIL_REPLY_TO || from,
    headers: msg.unsubscribeUrl
      ? { "List-Unsubscribe": `<${msg.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      : undefined,
  });
  return { provider: "smtp" as const };
}

export function appUrl() {
  const url = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return url.replace(/\/$/, "");
}

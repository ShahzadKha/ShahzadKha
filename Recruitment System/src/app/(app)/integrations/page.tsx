import type { ReactNode } from "react";
import { Bot, CalendarClock, CreditCard, FileInput, FolderSync, Globe, Inbox, Mail, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { aiStatus } from "@/lib/settings";
import { appUrl, emailMode } from "@/lib/nurture/mailer";
import { imapConfigured } from "@/lib/inbound/imap";
import { acumbamailConfigured } from "@/lib/integrations/acumbamail";
import { formatDateTime } from "@/lib/format";
import { checkAcumbamail, checkInbox, testEmail, testOpenAI } from "@/app/actions/integrations";
import { PageHeader } from "@/components/ui";
import { TestButton } from "./test-button";

export const metadata = { title: "Intégrations" };

function Integration({ icon, title, step, on, status, children }: { icon: ReactNode; title: string; step: string; on: boolean; status: string; children?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${on ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{status}</span>
          </div>
          <p className="text-xs text-slate-500">{step}</p>
          {children && <div className="mt-3 space-y-3 text-sm text-slate-700">{children}</div>}
        </div>
      </div>
    </section>
  );
}

const Code = ({ children }: { children: string }) => (
  <code className="block overflow-x-auto whitespace-pre rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100">{children}</code>
);

export default async function IntegrationsPage() {
  await requireUser(["ADMIN"]);
  const { t, locale } = await getDictionary();
  const g = t.integrations;
  const base = appUrl();
  const ai = aiStatus();
  const [inbound, lastSync, checkoutCount] = await Promise.all([
    db.inboundEmail.findMany({ orderBy: { processedAt: "desc" }, take: 8 }),
    db.setting.findUnique({ where: { key: "acumbamailLastSync" } }),
    db.product.count({ where: { checkoutUrl: { not: null } } }),
  ]);
  const sync = lastSync?.value as { at?: string; error?: string | null } | undefined;
  const on = (b: boolean) => (b ? g.on : g.off);

  return (
    <>
      <PageHeader title={g.title} subtitle={g.subtitle} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Integration icon={<Bot className="size-5" />} title="OpenAI" step={g.openaiStep} on={ai.enabled} status={ai.enabled ? `${g.on} · ${ai.model}` : g.demoMode}>
          <p className="text-xs text-slate-500">{g.openaiHelp}</p>
          <TestButton action={testOpenAI} label={g.test} disabled={!ai.enabled} />
        </Integration>

        <Integration icon={<Mail className="size-5" />} title={g.email} step={g.emailStep} on={emailMode() === "smtp"} status={emailMode() === "smtp" ? g.on : g.simulated}>
          <p className="text-xs text-slate-500">{g.emailHelp}</p>
          <TestButton action={testEmail} label={g.sendTest} disabled={emailMode() !== "smtp"} />
        </Integration>

        <Integration icon={<Inbox className="size-5" />} title={g.inbox} step={g.inboxStep} on={imapConfigured()} status={on(imapConfigured())}>
          <p className="text-xs text-slate-500">{g.inboxHelp}</p>
          <TestButton action={checkInbox} label={g.checkNow} disabled={!imapConfigured()} />
          {inbound.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-xs">
              {inbound.map((m) => (
                <li key={m.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="w-16 shrink-0 font-medium text-slate-700">{g.kinds[m.kind as keyof typeof g.kinds] ?? m.kind}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-600">{m.fromEmail} — {m.subject ?? ""}</span>
                  <span className="shrink-0 text-slate-400">{formatDateTime(m.processedAt, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </Integration>

        <Integration icon={<Users className="size-5" />} title="Acumbamail" step={g.acumbamailStep} on={acumbamailConfigured()} status={on(acumbamailConfigured())}>
          <p className="text-xs text-slate-500">{g.acumbamailHelp}</p>
          {sync?.at && (
            <p className={`text-xs ${sync.error ? "text-red-700" : "text-emerald-700"}`}>
              {g.lastSync} : {formatDateTime(new Date(sync.at), locale)} {sync.error ? `— ${sync.error}` : "✓"}
            </p>
          )}
          <TestButton action={checkAcumbamail} label={g.test} disabled={!acumbamailConfigured()} />
        </Integration>

        <Integration icon={<CreditCard className="size-5" />} title="ThriveCart" step={g.thrivecartStep} on={Boolean(process.env.THRIVECART_SECRET)} status={on(Boolean(process.env.THRIVECART_SECRET))}>
          <p className="text-xs text-slate-500">{g.thrivecartHelp.replace("{n}", String(checkoutCount))}</p>
          <Code>{`${base}/api/webhooks/thrivecart`}</Code>
        </Integration>

        <Integration icon={<FileInput className="size-5" />} title={g.api} step={g.apiStep} on={Boolean(process.env.INTAKE_API_KEY)} status={on(Boolean(process.env.INTAKE_API_KEY))}>
          <p className="text-xs text-slate-500">{g.apiHelp}</p>
          <Code>{`curl -X POST ${base}/api/intake \\\n  -H "Authorization: Bearer $INTAKE_API_KEY" \\\n  -F "file=@cv.pdf" -F "source=CSV_IMPORT" -F "sourceDetail=Indeed"`}</Code>
        </Integration>

        <Integration icon={<FolderSync className="size-5" />} title={g.folder} step={g.folderStep} on={Boolean(process.env.INTAKE_API_KEY)} status={process.env.INTAKE_API_KEY ? g.on : g.off}>
          <p className="text-xs text-slate-500">{g.folderHelp}</p>
          <Code>{`POST ${base}/api/intake\nAuthorization: Bearer $INTAKE_API_KEY\nfile=<le fichier>  source=FILE_DROP  sourceDetail=Google Drive`}</Code>
        </Integration>

        <Integration icon={<Globe className="size-5" />} title={g.form} step={g.formStep} on status={g.on}>
          <p className="text-xs text-slate-500">{g.formHelp}</p>
          <Code>{`${base}/apply?ref=landing-page`}</Code>
          <p className="text-xs text-slate-500">{g.embedHelp}</p>
          <Code>{`<iframe src="${base}/apply?embed=1&ref=landing-page"\n        style="width:100%;height:820px;border:0"></iframe>`}</Code>
        </Integration>

        <Integration icon={<CalendarClock className="size-5" />} title={g.cron} step={g.cronStep} on={Boolean(process.env.CRON_SECRET)} status={on(Boolean(process.env.CRON_SECRET))}>
          <p className="text-xs text-slate-500">{g.cronHelp}</p>
          <Code>{`GET ${base}/api/cron/sequences\nAuthorization: Bearer $CRON_SECRET`}</Code>
        </Integration>
      </div>
    </>
  );
}

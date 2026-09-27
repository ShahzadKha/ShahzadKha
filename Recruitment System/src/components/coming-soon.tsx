import { Hammer } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import type { Role } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/ui";

// Placeholder for modules planned in later milestones
export async function ComingSoon({ titleKey, roles }: { titleKey: "pipeline" | "sdr" | "sequences" | "settings"; roles?: Role[] }) {
  await requireUser(roles);
  const { t } = await getDictionary();
  return (
    <>
      <PageHeader title={t.nav[titleKey]} />
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
        <Hammer className="size-8 text-slate-400" />
        <p className="mt-4 font-medium text-slate-900">{t.soon.title}</p>
        <p className="mt-1 text-sm text-slate-500">{t.soon.body}</p>
      </div>
    </>
  );
}

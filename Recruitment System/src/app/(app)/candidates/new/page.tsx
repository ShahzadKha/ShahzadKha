import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
import { CandidateForm } from "./candidate-form";

export default async function NewCandidatePage() {
  await requireUser();
  const { t } = await getDictionary();
  return (
    <>
      <PageHeader title={t.newCandidate.title} subtitle={t.newCandidate.subtitle} />
      <CandidateForm labels={t.newCandidate} />
    </>
  );
}

import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { aiStatus } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { CvUploader } from "./cv-uploader";

export default async function UploadPage() {
  await requireUser();
  const { t } = await getDictionary();
  const ai = aiStatus();
  return (
    <>
      <PageHeader title={t.upload.title} subtitle={t.upload.subtitle} />
      <CvUploader
        t={{ upload: t.upload, errors: t.intakeErrors, sources: t.sources, statuses: t.statuses }}
        aiLabel={ai.enabled ? `OpenAI · ${ai.model}` : t.profile.modeDemo}
      />
    </>
  );
}

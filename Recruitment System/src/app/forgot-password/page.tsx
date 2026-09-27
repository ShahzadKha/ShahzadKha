import { getDictionary } from "@/lib/i18n";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Mot de passe oublié" };

export default async function ForgotPasswordPage() {
  const { t } = await getDictionary();
  return (
    <AuthShell>
      <ForgotForm t={t.forgot} />
    </AuthShell>
  );
}

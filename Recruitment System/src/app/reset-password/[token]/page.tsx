import { getDictionary } from "@/lib/i18n";
import { resetPassword } from "@/app/actions/password";
import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Nouveau mot de passe", robots: { index: false } };

export default async function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  const { token } = await params;
  const { t } = await getDictionary();
  return (
    <AuthShell>
      <ResetForm action={resetPassword.bind(null, token)} t={t.forgot} />
    </AuthShell>
  );
}

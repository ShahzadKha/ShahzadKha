import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { changeOwnPassword } from "@/app/actions/users";
import { Card, PageHeader, inputClass } from "@/components/ui";
import { UserForm } from "@/components/user-form";

export const metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const user = await requireUser();
  const { t } = await getDictionary();
  const a = t.account;
  return (
    <>
      <PageHeader title={a.title} subtitle={`${user.name} · ${user.email} · ${t.roles[user.role]}`} />
      <Card title={a.changePassword} className="max-w-lg">
        <UserForm action={changeOwnPassword} labels={{ save: a.save, saved: a.saved, errors: t.users.errors }} reset className="space-y-3">
          {(["current", "next", "confirm"] as const).map((f) => (
            <label key={f} className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">{a[f]}</span>
              <input
                name={f}
                type="password"
                required
                minLength={f === "current" ? 1 : 8}
                autoComplete={f === "current" ? "current-password" : "new-password"}
                className={inputClass}
              />
            </label>
          ))}
        </UserForm>
      </Card>
    </>
  );
}

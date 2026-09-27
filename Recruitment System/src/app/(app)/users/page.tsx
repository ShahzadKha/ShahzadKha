import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { initials } from "@/lib/format";
import { createUser, updateUser } from "@/app/actions/users";
import { Avatar, Card, PageHeader, inputClass, selectClass } from "@/components/ui";
import { UserForm } from "@/components/user-form";
import { Role } from "@/generated/prisma/enums";

export const metadata = { title: "Utilisateurs" };

const ROLES = Object.values(Role);

export default async function UsersPage() {
  const me = await requireUser(["ADMIN"]);
  const { t } = await getDictionary();
  const u = t.users;
  const users = await db.user.findMany({
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
    include: { _count: { select: { assignedCandidates: true, tasks: { where: { status: "OPEN" } } } } },
  });
  const labels = { save: u.save, saved: t.settings.saved, errors: u.errors };

  return (
    <>
      <PageHeader title={u.title} subtitle={u.subtitle} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {users.map((user) => {
            const [first = "", last = ""] = user.name.split(" ");
            return (
              <div key={user.id} className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${user.active ? "" : "opacity-70"}`} data-testid="user-row">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar text={initials(first, last)} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">
                      {user.name} {user.id === me.id && <span className="text-xs font-normal text-slate-500">({u.you})</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {user.email} · {user._count.assignedCandidates} {u.assigned.toLowerCase()} · {user._count.tasks} {u.openCalls}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                    {user.active ? u.active : u.inactive}
                  </span>
                </div>
                <UserForm action={updateUser.bind(null, user.id)} labels={labels} className="mt-3 grid items-end gap-3 border-t border-slate-100 pt-3 sm:grid-cols-[10rem_1fr_auto_auto]">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-600">{u.role}</span>
                    <select name="role" defaultValue={user.role} className={`${selectClass} w-full`}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{t.roles[r]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-600">{u.newPassword}</span>
                    <input name="newPassword" type="password" minLength={8} autoComplete="new-password" placeholder={u.newPasswordHint} className={inputClass} />
                  </label>
                  <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                    <input type="checkbox" name="active" defaultChecked={user.active} disabled={user.id === me.id} className="size-4 rounded border-slate-300" />
                    {user.id === me.id && <input type="hidden" name="active" value="on" />}
                    {u.active}
                  </label>
                </UserForm>
              </div>
            );
          })}
        </div>

        <Card title={u.add}>
          <UserForm action={createUser} labels={{ ...labels, save: u.create }} reset className="space-y-3">
            {(["name", "email"] as const).map((f) => (
              <label key={f} className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">{u[f]}</span>
                <input name={f} type={f === "email" ? "email" : "text"} required className={inputClass} />
              </label>
            ))}
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">{u.role}</span>
              <select name="role" defaultValue="SDR" className={`${selectClass} w-full`}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{t.roles[r]}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">{u.password}</span>
              <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
              <span className="mt-1 block text-xs text-slate-500">{u.passwordHint}</span>
            </label>
          </UserForm>
        </Card>
      </div>
    </>
  );
}

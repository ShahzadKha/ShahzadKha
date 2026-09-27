import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { initials } from "@/lib/format";
import { Avatar, PageHeader } from "@/components/ui";

export default async function UsersPage() {
  await requireUser(["ADMIN"]);
  const { t } = await getDictionary();
  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: { _count: { select: { assignedCandidates: true } } },
  });

  return (
    <>
      <PageHeader title={t.users.title} subtitle={t.users.subtitle} />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">{t.users.name}</th>
              <th className="px-4 py-3">{t.users.role}</th>
              <th className="px-4 py-3 text-right">{t.users.assigned}</th>
              <th className="px-4 py-3">{t.users.active}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const [first = "", last = ""] = u.name.split(" ");
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar text={initials(first, last)} />
                      <div>
                        <p className="font-medium text-slate-900">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{t.roles[u.role]}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{u._count.assignedCandidates}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                      {u.active ? t.users.active : t.users.inactive}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

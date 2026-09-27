import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getBrand } from "@/lib/settings";
import { initials } from "@/lib/format";
import { logout } from "@/app/actions/auth";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { LanguageSwitch } from "@/components/language-switch";
import { Avatar } from "@/components/ui";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const { t, locale } = await getDictionary();
  const brand = await getBrand();

  const items: NavItem[] = [
    { href: "/", label: t.nav.dashboard },
    { href: "/candidates", label: t.nav.candidates },
    { href: "/pipeline", label: t.nav.pipeline, soon: true },
    { href: "/sdr", label: t.nav.sdr, soon: true },
    { href: "/sequences", label: t.nav.sequences, soon: true },
    ...(user.role === "ADMIN"
      ? [
          { href: "/users", label: t.nav.users },
          { href: "/settings", label: t.nav.settings, soon: true },
        ]
      : []),
  ];
  const [first = "", last = ""] = user.name.split(" ");

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-slate-900 px-4 py-5 lg:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold text-white">
            {brand.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{brand.name}</p>
            <p className="truncate text-xs text-slate-400">{t.app.tagline}</p>
          </div>
        </div>
        <SidebarNav items={items} soonLabel={t.nav.soon} />
        <div className="mt-auto flex items-center gap-3 border-t border-white/10 px-2 pt-4">
          <Avatar text={initials(first, last)} className="bg-white/10 text-white" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-400">{t.roles[user.role]}</p>
          </div>
          <form action={logout}>
            <button type="submit" title={t.nav.logout} aria-label={t.nav.logout} className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-8">
          <p className="text-sm font-semibold text-slate-900 lg:hidden">{brand.name}</p>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitch locale={locale} label={t.common.language} />
            <form action={logout} className="lg:hidden">
              <button type="submit" className="text-sm text-slate-600">{t.nav.logout}</button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  Headset,
  Mail,
  UserCog,
  Plug,
  Settings,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/candidates": Users,
  "/pipeline": KanbanSquare,
  "/sdr": Headset,
  "/sequences": Mail,
  "/users": UserCog,
  "/settings": Settings,
  "/integrations": Plug,
  "/account": UserCircle,
};

export type NavItem = { href: string; label: string; soon?: boolean };

export function SidebarNav({ items, soonLabel, variant = "dark" }: { items: NavItem[]; soonLabel: string; variant?: "dark" | "light" }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.href];
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
              variant === "dark"
                ? active
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
                : active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-700 hover:bg-slate-100",
            )}
          >
            {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
            <span className="flex-1">{item.label}</span>
            {item.soon && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {soonLabel}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

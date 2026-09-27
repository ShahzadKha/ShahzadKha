"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

// Dropdown menu for small screens; closes itself after navigating
export function MobileMenu({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  return (
    <details ref={ref} className="relative lg:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg p-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-100" aria-label="Menu">
        <Menu className="size-5" /> {label}
      </summary>
      <div className="absolute left-0 z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">{children}</div>
    </details>
  );
}

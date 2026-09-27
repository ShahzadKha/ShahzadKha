import type { ReactNode } from "react";
import { getBrand } from "@/lib/settings";

// Centered card with the brand, for the sign-in related pages
export async function AuthShell({ children }: { children: ReactNode }) {
  const brand = await getBrand();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">{brand.name.slice(0, 1)}</span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{brand.name}</h1>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

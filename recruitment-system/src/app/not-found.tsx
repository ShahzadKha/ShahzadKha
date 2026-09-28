import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl font-semibold text-slate-300">404</p>
      <Link href="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">← Dashboard</Link>
    </div>
  );
}

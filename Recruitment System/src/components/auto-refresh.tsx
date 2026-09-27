"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the page every few seconds while background work (AI analysis) is running
export function AutoRefresh({ intervalMs = 2500 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}

"use client";

import { useEffect, useRef } from "react";

/**
 * Records "link clicked" and "price viewed" once the page has really been seen:
 * visible in a browser for a moment. Mail scanners that only fetch the link never run this.
 */
export function OfferBeacon({ record }: { record: () => Promise<void> }) {
  const sent = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      if (sent.current || document.visibilityState !== "visible") return;
      timer = setTimeout(() => {
        if (sent.current || document.visibilityState !== "visible") return;
        sent.current = true;
        record().catch(() => {});
      }, 1500);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", arm);
    };
  }, [record]);
  return null;
}

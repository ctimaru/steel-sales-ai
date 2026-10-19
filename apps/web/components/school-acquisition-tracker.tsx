"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isSchoolCalculatorSource, schoolContentSurface, trackSchoolStage } from "@/lib/school-acquisition.client";

/** Keeps server-rendered knowledge links/canonical intact; observes allowlisted intents only. */
export function SchoolAcquisitionTracker() {
  const pathname = usePathname();
  const viewed = useRef<string | null>(null);
  useEffect(() => {
    const surface = schoolContentSurface(pathname);
    if (surface && viewed.current !== pathname &&
      trackSchoolStage("content_view", surface)) viewed.current = pathname;

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 ||
          event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const origin = event.target;
      if (!(origin instanceof Element)) return;
      const link = origin.closest("a[href]");
      if (!link || link.hasAttribute("download")) return;
      const href = link.getAttribute("href");
      if (!href) return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        const surface = schoolContentSurface(window.location.pathname) ?? "navigation";
        if (isSchoolCalculatorSource(url.pathname, url.search)) {
          trackSchoolStage("calculator_click", surface);
        } else if (url.pathname === "/distinta") {
          trackSchoolStage("distinta_click", surface);
        }
      } catch { /* best-effort measurement must not prevent navigation */ }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname]);
  return null;
}

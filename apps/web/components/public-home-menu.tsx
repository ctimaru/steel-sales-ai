"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type MenuLink = { label: string; href: string };

// Same targets as PUBLIC_HOME_LOCALE_ROUTES; inlined to keep this client island tiny.
const LANGUAGES = [
  { code: "it", label: "Italiano", href: "/" },
  { code: "en", label: "English", href: "/en" },
  { code: "de", label: "Deutsch", href: "/de" },
  { code: "fr", label: "Français", href: "/fr" },
  { code: "es", label: "Español", href: "/es" },
] as const;

/**
 * HOME-MOBILE-A1: below xl the public home keeps one header row (logo, Accedi,
 * Registrati, ☰). Section links and languages live in this menu instead of a
 * second bar. Native <details>: works without JS; the small client part only
 * closes the menu on link tap, Escape and outside tap.
 */
export function PublicHomeMenu({ locale, links }: { locale: "it" | "en"; links: readonly MenuLink[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const it = locale === "it";

  useEffect(() => {
    const close = (event: Event) => {
      const menu = ref.current;
      if (!menu?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        menu.open = false;
        menu.querySelector("summary")?.focus();
        return;
      }
      if (!menu.contains(event.target as Node)) menu.open = false;
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, []);

  const closeMenu = () => { if (ref.current) ref.current.open = false; };

  return (
    <details ref={ref} className="group relative xl:hidden" data-testid="public-home-menu">
      <summary
        aria-label={it ? "Apri il menu" : "Open menu"}
        className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-xl border border-[#466952] text-[#e1f7e9] transition hover:bg-[#183a2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#85f6c4] [&::-webkit-details-marker]:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 group-open:hidden" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="hidden h-5 w-5 group-open:block" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-[#dce5e0] bg-white p-2 text-[#173f35] shadow-[0_18px_48px_rgba(4,18,15,0.35)]">
        <nav aria-label={it ? "Navigazione mobile" : "Mobile navigation"}>
          {links.map((item) => (
            <Link key={item.label} href={item.href} onClick={closeMenu}
              className="flex min-h-11 items-center rounded-xl px-3 text-[15px] font-semibold hover:bg-[#edf4f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#237858]">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-1 border-t border-[#e6ede9] px-1 pt-2 sm:hidden">
          <p className="px-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#5f726a]">{it ? "Lingua" : "Language"}</p>
          <div className="mt-1 grid grid-cols-5 gap-1">
            {LANGUAGES.map(({ code, label, href }) => (
              <Link key={code} href={href} hrefLang={code} lang={code} onClick={closeMenu}
                aria-label={label}
                aria-current={code === locale ? "page" : undefined}
                className={"flex min-h-11 items-center justify-center rounded-lg text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#237858] " +
                  (code === locale ? "bg-[#e9f3ee] text-[#14543f]" : "text-[#294b3d] hover:bg-[#f2f8f4]")}>
                {code.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

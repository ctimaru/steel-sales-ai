import Link from "next/link";
import { CALCULATOR_FLAGS } from "@/lib/international-calculator-landing";
import { SCHOOL_HUB_ROUTES } from "@/lib/school-locales";
import {
  SCHOOL_PRIVATE_COPY,schoolWorkspaceHref,schoolWorkspaceLanguageOrder,
  type SchoolWorkspaceLocale,
} from "@/lib/school-workspace-i18n";

/** Workspace-only switch. Stays under /school, never redirects to a public URL on language change. */
export function SchoolPrivateLanguageSwitch({locale,pathname="/school"}:{
  locale:SchoolWorkspaceLocale;pathname?:string;
}) {
  const c=SCHOOL_PRIVATE_COPY[locale];
  return <nav lang={locale} aria-label={c.switchLabel} className="relative z-20">
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-[#c6d9cf] bg-white px-3.5 text-sm font-semibold text-[#123b34] shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#237858] [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true">{CALCULATOR_FLAGS[locale].flag}</span>
        <span>{CALCULATOR_FLAGS[locale].label}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
      </summary>
      <div className="absolute left-0 top-full z-30 mt-2 min-w-44 rounded-xl border border-[#c6d9cf] bg-white p-1.5 shadow-[0_12px_36px_rgba(17,54,45,0.14)]">
        {schoolWorkspaceLanguageOrder.map(language=><Link key={language}
          href={schoolWorkspaceHref(pathname,language)} lang={language}
          aria-current={language===locale?"page":undefined}
          className={"flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#237858] "+(language===locale?"bg-[#e9f3ee] font-bold text-[#14543f]":"font-medium text-[#294b3d] hover:bg-[#f2f8f4]")}>
          <span aria-hidden="true">{CALCULATOR_FLAGS[language].flag}</span>{CALCULATOR_FLAGS[language].label}
          {language===locale?<span className="ml-auto" aria-hidden="true">✓</span>:null}
        </Link>)}
      </div>
    </details>
  </nav>;
}
export function SchoolPrivateTopbar({locale,pathname="/school",compact=false}:{
  locale:SchoolWorkspaceLocale;pathname?:string;compact?:boolean;
}){
  const c=SCHOOL_PRIVATE_COPY[locale];
  return <div className={compact?"flex flex-wrap items-center justify-end gap-2 px-0 py-0.5":"flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d5e4db] bg-[#f7faf8] px-4 py-3 sm:px-5"}>
    <span className={compact?"sr-only":"text-xs font-bold uppercase tracking-[.1em] text-[#174b3c]"}>{c.kicker} · Smart Steel Sales</span>
    <div className="flex flex-wrap items-center gap-3">
      <SchoolPrivateLanguageSwitch locale={locale} pathname={pathname}/>
      <Link href={SCHOOL_HUB_ROUTES[locale] + (SCHOOL_HUB_ROUTES[locale].includes("?") ? "&" : "?") + "public=1"} hrefLang={locale}
        className={compact ? "inline-flex min-h-10 items-center rounded-xl border border-[#c9ddd1] bg-white px-3 text-xs font-semibold text-[#174b3c] hover:bg-[#edf5f0]" : "school-secondary-action"}>
        {c.publicLabel} ↗
      </Link>
    </div>
  </div>;
}

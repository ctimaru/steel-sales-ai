import Link from "next/link";
import {
  CALCULATOR_FLAGS, CALCULATOR_LANGUAGE_ORDER, CALCULATOR_ROUTES,
  type CalculatorSiteLocale,
} from "@/lib/international-calculator-landing";
import { SCHOOL_HUB_ROUTES } from "@/lib/school-locales";

/**
 * CALC-INT3E.6 — language belongs to page navigation, not to calculator controls.
 * Use public home routes on home pages, calculator routes on calculator pages.
 * Explicit anchors only: no automatic redirect, cookies or calculation state mutation.
 */
export const PUBLIC_HOME_LOCALE_ROUTES: Record<CalculatorSiteLocale,string> = {
  it:"/",en:"/en",de:"/de",fr:"/fr",es:"/es",
};
const labels: Record<CalculatorSiteLocale,{heading:string;choose:string;chooseHome:string;chooseSchool:string}> = {
  it:{heading:"Lingua",choose:"Scegli la lingua del calcolatore",chooseHome:"Seleziona lingua del sito",chooseSchool:"Seleziona la lingua della Scuola"},
  en:{heading:"Language",choose:"Choose calculator language",chooseHome:"Choose website language",chooseSchool:"Choose School language"},
  de:{heading:"Sprache",choose:"Sprache des Rechners wählen",chooseHome:"Sprache der Website auswählen",chooseSchool:"Sprache der Stahlschule wählen"},
  fr:{heading:"Langue",choose:"Choisir la langue du calculateur",chooseHome:"Choisir la langue du site",chooseSchool:"Choisir la langue de l’École"},
  es:{heading:"Idioma",choose:"Elegir idioma de la calculadora",chooseHome:"Elegir idioma del sitio",chooseSchool:"Elegir idioma de la Escuela"},
};

export function PublicPageLanguageSelector({
  locale,surface,
}:{locale:CalculatorSiteLocale;surface:"home"|"calculator"|"school"}){
  const routes=surface==="home"?PUBLIC_HOME_LOCALE_ROUTES:surface==="school"?SCHOOL_HUB_ROUTES:CALCULATOR_ROUTES;
  const ariaLabel=surface==="home"?labels[locale].chooseHome:surface==="school"?labels[locale].chooseSchool:labels[locale].choose;
  return <nav aria-label={ariaLabel} className="relative z-20 shrink-0">
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-[#c6d9cf] bg-white px-2.5 text-sm font-semibold sm:gap-2 sm:px-3.5 text-[#123b34] shadow-sm transition-colors hover:bg-[#f2f8f4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#237858] [&::-webkit-details-marker]:hidden">
        <span className="hidden text-xs font-medium text-[#52615b] sm:inline">{labels[locale].heading}:</span>
        <span className="hidden sm:inline">{CALCULATOR_FLAGS[locale].label}</span>
        <span className="sm:hidden">{locale.toUpperCase()}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </summary>
      <div className="absolute right-0 top-full z-30 mt-2 w-[210px] rounded-xl border border-[#c6d9cf] bg-white p-1.5 shadow-[0_12px_36px_rgba(17,54,45,0.14)]">
        {CALCULATOR_LANGUAGE_ORDER.map(code=>(
          <Link key={code} href={routes[code]} hrefLang={code} lang={code}
            aria-current={code===locale?"page":undefined}
            className={"flex min-h-10 items-center justify-between rounded-lg px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#237858] "+
              (code===locale?"bg-[#e9f3ee] font-bold text-[#14543f]":"font-medium text-[#294b3d] hover:bg-[#f2f8f4]")}>
            <span>{CALCULATOR_FLAGS[code].label}</span>
            {code===locale?<span aria-hidden="true">✓</span>:null}
          </Link>
        ))}
      </div>
    </details>
  </nav>;
}

export function CalculatorPageLanguageSelector({locale}:{locale:CalculatorSiteLocale}){
  return <PublicPageLanguageSelector locale={locale} surface="calculator"/>;
}

export function SchoolPageLanguageSelector({locale}:{locale:CalculatorSiteLocale}){
  return <PublicPageLanguageSelector locale={locale} surface="school"/>;
}

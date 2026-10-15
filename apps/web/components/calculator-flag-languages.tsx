"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CALCULATOR_FLAGS, CALCULATOR_LANGUAGE_ORDER, CALCULATOR_ROUTES,
  type CalculatorSiteLocale,
} from "@/lib/international-calculator-landing";

/** Language change navigates between real crawlable URLs; no browser-language redirect. */
export function CalculatorFlagLanguages({
  locale, query,
}:{
  locale:CalculatorSiteLocale;
  /** Live calculator share parameters, if provided; else existing URL query. */
  query?:string;
}){
  const [initialQuery,setInitialQuery]=useState("");
  useEffect(()=>{
    if(query===undefined)setInitialQuery(window.location.search.replace(/^\?/,""));
  },[query]);
  const suffix=query ?? initialQuery;
  const langLabels:Record<CalculatorSiteLocale,string>={
    it:"Seleziona lingua",en:"Select language",de:"Sprache wählen",
    fr:"Choisir la langue",es:"Elegir idioma",
  };
  return (
    <nav aria-label={langLabels[locale]} className="flex flex-wrap items-center gap-1 rounded-xl border border-[#d3e5dc] bg-white p-1">
      {CALCULATOR_LANGUAGE_ORDER.map(code=>(
        <Link key={code} href={CALCULATOR_ROUTES[code]+(suffix?"?"+suffix:"")}
          hrefLang={code} lang={code} aria-current={locale===code?"page":undefined}
          title={CALCULATOR_FLAGS[code].label}
          className="inline-flex min-h-11 min-w-12 items-center justify-center gap-1 rounded-lg border border-[#bbd4c7] px-2 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#117958]"
          style={{
            color:locale===code?"#ffffff":"#123b34",
            backgroundColor:locale===code?"#125743":"#ffffff",
          }}>
          <span aria-hidden="true" className="text-base">{CALCULATOR_FLAGS[code].flag}</span>
          <span>{code.toUpperCase()}</span>
        </Link>
      ))}
    </nav>
  );
}

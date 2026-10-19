import type {KnowledgeMarketLocale} from "@/lib/localized-steel-knowledge";
import {TECHNICAL_GLOSSARY,TECHNICAL_EDITORIAL_COPY,SCHOOL_EDITORIAL_DRAFT_DATE} from "@/lib/school-technical-editorial-trust";

export function SchoolTechnicalGlossary({locale}:{locale:KnowledgeMarketLocale}){
 const ui=TECHNICAL_EDITORIAL_COPY[locale];
 return <details lang={locale} className="group rounded-2xl border border-[#c7ddcf] bg-white px-4 py-4 sm:px-6">
   <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-bold text-[#174b3c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c] [&::-webkit-details-marker]:hidden">
     {ui.glossaryTitle}<span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45">+</span>
   </summary>
   <p className="mt-2 text-sm leading-6 text-[#52615b]">{ui.glossaryHint}</p>
   <dl className="mt-4 grid gap-3 sm:grid-cols-2">
     {TECHNICAL_GLOSSARY[locale].map(x=><div key={x.term} className="rounded-xl border border-[#d7e6dc] bg-[#f7faf8] p-3">
       <dt className="text-sm font-bold text-[#174b3c]">{x.term}</dt>
       <dd className="mt-1 text-sm leading-6 text-[#52615b]">{x.meaning}</dd>
     </div>)}
   </dl>
 </details>;
}

export function SchoolEditorialTrust({locale,recordLastReviewed,sourceUrl}:{
 locale:KnowledgeMarketLocale;recordLastReviewed:string;sourceUrl:string;
}){
 const ui=TECHNICAL_EDITORIAL_COPY[locale];
 return <aside lang={locale} aria-label={ui.trustTitle} className="rounded-2xl border border-[#c7ddcf] bg-[#f7faf8] p-5">
   <h2 className="text-base font-bold text-[#173f35]">{ui.trustTitle}</h2>
   <dl className="mt-3 space-y-3 text-xs leading-6 text-[#425e50]">
     <div><dt className="font-bold text-[#174b3c]">{ui.publisher}</dt>
       <dd><a href={sourceUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center break-all font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">BSI / UNI ↗</a></dd></div>
     <div><dt className="font-bold text-[#174b3c]">{ui.catalog}</dt>
       <dd>{ui.sourceReviewed}: <time dateTime={recordLastReviewed}>{recordLastReviewed}</time></dd></div>
     <div><dt className="font-bold text-[#174b3c]">{ui.prepared}</dt>
       <dd><time dateTime={SCHOOL_EDITORIAL_DRAFT_DATE}>{SCHOOL_EDITORIAL_DRAFT_DATE}</time></dd></div>
   </dl>
   <p className="mt-3 text-xs leading-6 text-[#52615b]">{ui.independence}</p>
   <p className="mt-2 text-xs leading-6 text-[#52615b]">{ui.editions}</p>
 </aside>;
}

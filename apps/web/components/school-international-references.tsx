import Link from "next/link";
import {listPublicStandards,listPublicGrades} from "@/lib/public-knowledge";
import {MARKET_TECHNICAL_RECORDS,MARKET_TECHNICAL_UI,localizedKnowledgePath,type KnowledgeMarketLocale} from "@/lib/localized-steel-knowledge";

/** Featured technical library counts are based only on published K2 source records. */
export async function SchoolInternationalReferences({locale}:{locale:KnowledgeMarketLocale}){
 const ui=MARKET_TECHNICAL_UI[locale];
 const [stds,grds]=await Promise.all([listPublicStandards(),listPublicGrades()]);
 const availableStandards=new Set(stds.map(x=>x.slug));
 const availableGrades=new Set(grds.map(x=>x.slug));
 const countStd=MARKET_TECHNICAL_RECORDS[locale].standards.filter(x=>availableStandards.has(x.slug)).length;
 const countGrade=MARKET_TECHNICAL_RECORDS[locale].grades.filter(x=>availableGrades.has(x.slug)).length;
 if(countStd+countGrade===0)return null;
 return <section aria-label={ui.more} lang={locale}>
  <div className="mb-4">
   <p className="text-xs font-bold uppercase tracking-[.12em] text-[#1e694e]">Smart Steel School · {ui.more}</p>
   <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#173f35]">{ui.standards} &amp; {ui.grades}</h2>
   <p className="mt-2 max-w-3xl text-sm leading-7 text-[#52615b]">{ui.sourceNote}</p>
  </div>
  <div className="grid gap-3 sm:grid-cols-2">
   {countStd>0?<Link href={localizedKnowledgePath(locale,"standards")} className="group rounded-2xl border border-[#c9dfd4] bg-white p-5 transition hover:border-[#88b79e] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">
     <p className="text-xs font-bold text-[#1b6349]">EN 10210 · EN 10219 · EN 10216-2</p>
     <h3 className="mt-2 text-lg font-semibold text-[#173f35]">{ui.standards}</h3>
     <p className="mt-2 text-sm text-[#52615b]">{ui.leadStd}</p>
     <span className="mt-4 inline-block text-sm font-bold text-[#174b3c]">{countStd} · {ui.more} →</span>
   </Link>:null}
   {countGrade>0?<Link href={localizedKnowledgePath(locale,"grades")} className="group rounded-2xl border border-[#c9dfd4] bg-white p-5 transition hover:border-[#88b79e] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">
     <p className="text-xs font-bold text-[#1b6349]">S355J2H · P265GH</p>
     <h3 className="mt-2 text-lg font-semibold text-[#173f35]">{ui.grades}</h3>
     <p className="mt-2 text-sm text-[#52615b]">{ui.leadGrade}</p>
     <span className="mt-4 inline-block text-sm font-bold text-[#174b3c]">{countGrade} · {ui.more} →</span>
   </Link>:null}
  </div>
 </section>;
}

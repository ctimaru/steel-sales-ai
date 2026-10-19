import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {LocalizedKnowledgeLayout} from "@/components/localized-knowledge-layout";
import {SchoolTechnicalGlossary} from "@/components/school-technical-editorial-trust";
import {TECHNICAL_EDITORIAL_COPY} from "@/lib/school-technical-editorial-trust";
import {MARKET_TECHNICAL_RECORDS,MARKET_TECHNICAL_UI,localizedKnowledgePath,type KnowledgeMarketLocale} from "@/lib/localized-steel-knowledge";
import {isNewCalculatorLocale} from "@/lib/international-calculator-landing";
import {listPublicStandards,listPublicGrades} from "@/lib/public-knowledge";
import {robotsForParameterizedPage} from "@/lib/seo";
import {absoluteUrl} from "@/lib/site";

type Params={params:Promise<{locale:string;kind:string}>;searchParams:Promise<{q?:string}>};
const valid=(locale:string,kind:string):locale is KnowledgeMarketLocale=>
 isNewCalculatorLocale(locale)&&(kind==="standards"||kind==="grades");

export function generateStaticParams(){
 return (["de","fr","es"] as const).flatMap(locale=>["standards","grades"].map(kind=>({locale,kind})));
}
export async function generateMetadata({params,searchParams}:Params):Promise<Metadata>{
 const {locale,kind}=await params;
 if(!valid(locale,kind))notFound();
 const scope=kind as "standards"|"grades";
 const ui=MARKET_TECHNICAL_UI[locale];
 const path=localizedKnowledgePath(locale,scope);
 const name=scope==="standards"?ui.standards:ui.grades;
 const desc=scope==="standards"?ui.leadStd:ui.leadGrade;
 return {
  title:name+" | Smart Steel School",description:desc,
  alternates:{canonical:absoluteUrl(path),languages:{
   it:absoluteUrl(scope==="standards"?"/knowledge/norme":"/knowledge/gradi"),
   en:absoluteUrl(scope==="standards"?"/en/knowledge/standards":"/en/knowledge/grades"),
   de:absoluteUrl(localizedKnowledgePath("de",scope)),
   fr:absoluteUrl(localizedKnowledgePath("fr",scope)),
   es:absoluteUrl(localizedKnowledgePath("es",scope)),
  }},
  robots:robotsForParameterizedPage(Boolean((await searchParams).q?.trim())),
  openGraph:{title:name+" | Smart Steel School",description:desc,url:absoluteUrl(path),type:"website",locale},
 };
}
export default async function TechnicalKnowledgeIndex({params,searchParams}:Params){
 const {locale,kind}=await params;
 if(!valid(locale,kind))notFound();
 const scope=kind as "standards"|"grades",ui=MARKET_TECHNICAL_UI[locale];
 const search=(await searchParams).q?.trim().slice(0,100)??"";
 const [standards,grades]=await Promise.all([listPublicStandards(),listPublicGrades()]);
 const published=new Set((scope==="standards"?standards:grades).map(x=>x.slug));
 const visible=MARKET_TECHNICAL_RECORDS[locale][scope].filter(x=>
  published.has(x.slug)&&(!search||(x.code+" "+x.title+" "+x.summary).toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)))
 );
 const path=localizedKnowledgePath(locale,scope);
 const title=scope==="standards"?ui.standards:ui.grades;
 const jsonLd={"@context":"https://schema.org","@type":"CollectionPage",
   name:title,description:scope==="standards"?ui.leadStd:ui.leadGrade,
   inLanguage:locale,url:absoluteUrl(path),isAccessibleForFree:true,
   mainEntity:{"@type":"ItemList",itemListElement:visible.map((x,i)=>({
     "@type":"ListItem",position:i+1,name:x.code+" — "+x.title,
     url:absoluteUrl(localizedKnowledgePath(locale,scope,x.slug)),
   }))}};
 return <LocalizedKnowledgeLayout locale={locale} kind={scope}>
   {!search?<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,"\\u003c")}}/>:null}
   <section>
     <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#1e694e]">Smart Steel School · {locale.toUpperCase()}</p>
     <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#173f35] sm:text-4xl">{title}</h1>
     <p className="mt-3 max-w-3xl text-sm leading-7 text-[#52615b]">{scope==="standards"?ui.leadStd:ui.leadGrade}</p>
   </section>
   <form method="get" action={path} role="search" className="flex flex-col gap-3 rounded-2xl border border-[#d3e2d9] bg-white p-4 sm:flex-row sm:items-end">
     <label htmlFor={"school-tech-search-"+locale+"-"+scope} className="min-w-0 flex-1 text-sm font-bold text-[#365247]">
       {scope==="standards"?ui.search:ui.searchGrade}
       <input id={"school-tech-search-"+locale+"-"+scope} type="search" name="q" maxLength={100} defaultValue={search}
          placeholder={scope==="standards"?"EN 10219":"S355J2H"}
          className="mt-2 block min-h-11 w-full rounded-xl border border-[#b8cac0] bg-white px-3 text-base text-[#1d2824] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]"/>
     </label>
     <button type="submit" className="school-primary-action">{ui.go}</button>
     {search?<Link href={path} className="school-secondary-action">{ui.clear}</Link>:null}
   </form>
   {visible.length?<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={title}>
     {visible.map(item=><Link key={item.slug} href={localizedKnowledgePath(locale,scope,item.slug)}
       className="group flex min-h-[194px] flex-col rounded-2xl border border-[#d0e0d6] bg-white p-5 transition hover:border-[#92b9a6] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">
       <p className="text-xs font-extrabold text-[#1d6a4e]">{item.code}</p>
       <h2 className="mt-3 text-lg font-semibold text-[#153d31]">{item.title}</h2>
       <p className="mt-2 flex-1 text-sm leading-6 text-[#52615b]">{item.summary}</p>
       <span className="mt-3 text-sm font-bold text-[#174b3c]">{ui.read} →</span>
     </Link>)}
   </section>:<p role="status" className="rounded-xl border border-[#d0e0d6] bg-white p-6 text-sm text-[#52615b]">{ui.noResults}. {ui.empty}</p>}
   <SchoolTechnicalGlossary locale={locale}/>
   <aside className="rounded-2xl border border-[#d0e0d6] bg-[#eaf4ee] p-5 text-xs leading-6 text-[#425e50]">
     <p className="font-semibold text-[#174b3c]">{TECHNICAL_EDITORIAL_COPY[locale].evidenceNote}</p>
     {ui.sourceNote}
   </aside>
 </LocalizedKnowledgeLayout>;
}

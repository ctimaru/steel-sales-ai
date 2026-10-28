import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {cache} from "react";
import {LocalizedKnowledgeLayout} from "@/components/localized-knowledge-layout";
import {SchoolHero} from "@/components/school-ui";
import {SchoolReadingIndex} from "@/components/school-reading-index";
import {SchoolEditorialTrust,SchoolTechnicalGlossary} from "@/components/school-technical-editorial-trust";
import {TECHNICAL_RELATED_SLUGS,SCHOOL_EDITORIAL_DRAFT_DATE} from "@/lib/school-technical-editorial-trust";
import {MARKET_TECHNICAL_RECORDS,MARKET_TECHNICAL_UI,localizedKnowledgeGuide,localizedKnowledgePath,type KnowledgeMarketLocale} from "@/lib/localized-steel-knowledge";
import {getPublicStandard,getPublicGrade,listPublicStandards,listPublicGrades} from "@/lib/public-knowledge";
import {isNewCalculatorLocale} from "@/lib/international-calculator-landing";
import {absoluteUrl} from "@/lib/site";

type Kind="standards"|"grades";
type Params={params:Promise<{locale:string;kind:string;slug:string}>};
const valid=(locale:string,kind:string):locale is KnowledgeMarketLocale=>
 isNewCalculatorLocale(locale)&&(kind==="standards"||kind==="grades");
const readStandard=cache(getPublicStandard),readGrade=cache(getPublicGrade);

export function generateStaticParams(){
 return (["de","fr","es"] as const).flatMap(locale=>
  (["standards","grades"] as const).flatMap(kind=>
   MARKET_TECHNICAL_RECORDS[locale][kind].map(item=>({locale,kind,slug:item.slug}))));
}
export async function generateMetadata({params}:Params):Promise<Metadata>{
 const {locale,kind,slug}=await params;
 if(!valid(locale,kind))notFound();
 const group=kind as Kind,copy=localizedKnowledgeGuide(locale,group,slug);
 const published=copy?(group==="standards"?await readStandard(slug):await readGrade(slug)):null;
 if(!copy||!published)return{title:"Technical article unavailable",robots:{index:false,follow:false}};
 const path=localizedKnowledgePath(locale,group,slug);
 const itPath=group==="standards"?"/knowledge/norme/":"/knowledge/gradi/";
 const enPath=group==="standards"?"/en/knowledge/standards/":"/en/knowledge/grades/";
 return {
  title:copy.code+" — "+copy.title,description:copy.summary,
  robots:{index:true,follow:true},
  alternates:{canonical:absoluteUrl(path),languages:{
   it:absoluteUrl(itPath+slug),en:absoluteUrl(enPath+slug),
   de:absoluteUrl(localizedKnowledgePath("de",group,slug)),
   fr:absoluteUrl(localizedKnowledgePath("fr",group,slug)),
   es:absoluteUrl(localizedKnowledgePath("es",group,slug)),
  }},
  openGraph:{type:"article",title:copy.code+" — "+copy.title,description:copy.summary,
   url:absoluteUrl(path),locale,publishedTime:published.published_at,
   modifiedTime:(published.last_reviewed_at>SCHOOL_EDITORIAL_DRAFT_DATE?published.last_reviewed_at:SCHOOL_EDITORIAL_DRAFT_DATE)+"T00:00:00Z"},
 };
}
export default async function LocalizedTechnicalDetail({params}:Params){
 const {locale,kind,slug}=await params;
 if(!valid(locale,kind))notFound();
 const group=kind as Kind,copy=localizedKnowledgeGuide(locale,group,slug);
 if(!copy)notFound();
 const published=group==="standards"?await readStandard(slug):await readGrade(slug);
 if(!published)notFound();
 const ui=MARKET_TECHNICAL_UI[locale],path=localizedKnowledgePath(locale,group,slug);
 const officialLinks=[copy.source,...published.source_references.filter(x=>/^https:\/\//i.test(x.url)).map(x=>x.url)];
 const uniqueSources=[...new Set(officialLinks.filter(x=>/^https:\/\//i.test(x)))];
 const otherKind:Kind=group==="standards"?"grades":"standards";
 const opposite=group==="standards"?await listPublicGrades():await listPublicStandards();
 const allowed=new Set(opposite.map(x=>x.slug));
 const relevantSlugs=TECHNICAL_RELATED_SLUGS[group][slug]??[];
 const linked=MARKET_TECHNICAL_RECORDS[locale][otherKind].filter(x=>relevantSlugs.includes(x.slug)&&allowed.has(x.slug));
 const jsonLd={"@context":"https://schema.org","@graph":[
  {"@type":"TechArticle",headline:copy.code+" — "+copy.title,
   description:copy.summary,inLanguage:locale,
   datePublished:published.published_at,dateModified:published.last_reviewed_at>SCHOOL_EDITORIAL_DRAFT_DATE?published.last_reviewed_at:SCHOOL_EDITORIAL_DRAFT_DATE,
   mainEntityOfPage:absoluteUrl(path),
   author:{"@type":"Organization",name:"Smart Steel Sales"},
   citation:uniqueSources},
  {"@type":"BreadcrumbList",itemListElement:[
   {"@type":"ListItem",position:1,name:ui.school,item:absoluteUrl("/"+locale+"/knowledge")},
   {"@type":"ListItem",position:2,name:group==="standards"?ui.standards:ui.grades,item:absoluteUrl(localizedKnowledgePath(locale,group))},
   {"@type":"ListItem",position:3,name:copy.code,item:absoluteUrl(path)},
  ]},
 ]};
 return <LocalizedKnowledgeLayout locale={locale} kind={group}>
   <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,"\\u003c")}}/>
   <SchoolHero
     reading
     eyebrow={group==="standards"?ui.standards:ui.grades}
     title={copy.code+": "+copy.title}
     description={<>{copy.summary}</>}
     badges={[ui.publicRecord]}
   />
   <SchoolReadingIndex locale={locale} entries={[
     { id: "localized-reading-part-1", label: group==="standards"?ui.scope:ui.meaning },
     { id: "localized-reading-part-2", label: ui.request },
     { id: "localized-reading-part-3", label: ui.warning },
   ]}/>
   <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(255px,0.42fr)]">
     <article className="space-y-8 rounded-[22px] border border-[#dce6df] bg-white px-5 py-7 sm:px-9 sm:py-9">
       <section id="localized-reading-part-1" className="scroll-mt-24"><h2 className="text-lg font-bold text-[#173f35]">{group==="standards"?ui.scope:ui.meaning}</h2>
         <p className="mt-3 max-w-[72ch] text-[15px] leading-8 text-[#465c4f] sm:text-base">{copy.covers}</p></section>
       <section id="localized-reading-part-2" className="scroll-mt-24"><h2 className="text-lg font-bold text-[#173f35]">{ui.request}</h2>
         <p className="mt-3 max-w-[72ch] text-[15px] leading-8 text-[#465c4f] sm:text-base">{copy.request}</p></section>
       <section id="localized-reading-part-3" className="scroll-mt-24"><h2 className="text-lg font-bold text-[#173f35]">{ui.warning}</h2>
         <p className="mt-3 max-w-[72ch] text-[15px] leading-8 text-[#465c4f] sm:text-base">{copy.caution}</p></section>
     </article>
     <aside className="space-y-4">
       <SchoolEditorialTrust locale={locale} recordLastReviewed={published.last_reviewed_at} sourceUrl={copy.source}/>
       <Link href={"/"+locale+"/distinta"} className="school-primary-action w-full justify-center">{ui.bill} →</Link>
       <Link href={"/"+locale+"/knowledge/tubes"} className="school-secondary-action w-full justify-center">{ui.calculator} →</Link>
     </aside>
   </div>
   {linked.length?<section aria-label={ui.related}>
     <h2 className="text-xl font-semibold text-[#173f35]">{ui.related}</h2>
     <div className="mt-3 grid gap-3 sm:grid-cols-2">
       {linked.map(x=><Link key={x.slug} href={localizedKnowledgePath(locale,otherKind,x.slug)}
        className="rounded-xl border border-[#d0e0d6] bg-white p-4 text-sm font-semibold text-[#174b3c] transition hover:border-[#8dbca4]">
        {x.code} — {x.title} ↗
       </Link>)}
     </div>
     <p className="mt-2 text-xs leading-6 text-[#52615b]">{ui.sourceNote}</p>
   </section>:null}
   <SchoolTechnicalGlossary locale={locale}/>
   <section className="rounded-2xl border border-[#d0e0d6] bg-white p-5">
     <h2 className="text-xl font-semibold text-[#173f35]">{ui.resources}</h2>
     <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
       {uniqueSources.map((url,i)=><li key={url}><a href={url} target="_blank" rel="noopener noreferrer"
        className="font-semibold text-[#174b3c] underline underline-offset-4">{i===0?copy.code+" · "+ui.resources:ui.publicRecord+" "+(i+1)} ↗</a></li>)}
     </ul>
   </section>
   <Link href={localizedKnowledgePath(locale,group)} className="inline-flex min-h-11 items-center text-sm font-bold text-[#174b3c] underline underline-offset-4">← {ui.back}</Link>
 </LocalizedKnowledgeLayout>;
}

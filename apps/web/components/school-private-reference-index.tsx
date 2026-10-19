import Link from "next/link";
import { SchoolPrivateTopbar } from "@/components/school-private-language-switch";
import { englishGrades,englishStandards } from "@/lib/international-steel-knowledge";
import { listPublicGrades,listPublicStandards } from "@/lib/public-knowledge";
import { SCHOOL_PRIVATE_COPY,schoolWorkspaceHref,type SchoolWorkspaceLocale } from "@/lib/school-workspace-i18n";

export type SchoolReferenceKind="norme"|"gradi";
const normalize=(s:string)=>s.toLocaleLowerCase("it").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
export async function SchoolPrivateReferenceIndex({locale,kind,query}:{locale:SchoolWorkspaceLocale;kind:SchoolReferenceKind;query:string}){
  const c=SCHOOL_PRIVATE_COPY[locale],q=query.trim().slice(0,120);
  const isStandard=kind==="norme";
  const origin=schoolWorkspaceHref("/school",locale);
  const collectionPath="/school/"+kind;
  // Reuse public-published, anonymous-safe K2 read contracts even inside a
  // workspace; private tenant data must NEVER be used to build these cards.
  const published=isStandard?await listPublicStandards():await listPublicGrades();
  const englishMap=new Map<string,{title:string;summary:string}>(
    (isStandard?englishStandards:englishGrades).map(item=>[item.slug,{title:item.title,summary:item.summary}]),
  );
  const rows=published.flatMap(item=>{
    const slug=item.slug;
    const native=englishMap.get(slug);
    if(locale==="en"&&!native)return [];
    const label=isStandard?("code" in item?item.code:""):("designation" in item?item.designation:"");
    const title=locale==="en"&&native?native.title:( "title" in item ? item.title : item.short_description )??label;
    const summary=locale==="en"&&native?native.summary:
      ("short_explanation" in item?item.short_explanation:"short_description" in item?item.short_description:null)??"";
    if(q&&!normalize(label+" "+title+" "+summary).includes(normalize(q)))return [];
    return [{slug,label,title,summary,lang:locale==="en"?"en":"it"}];
  }).slice(0,120);
  return <div lang={locale} className="mx-auto max-w-[1160px] space-y-6 px-4 py-8 sm:px-6">
    <SchoolPrivateTopbar locale={locale} pathname={collectionPath}/>
    <header>
      <Link href={origin} className="inline-flex min-h-10 items-center text-sm font-bold text-[#174b3c] underline underline-offset-4">← {c.returnHome}</Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-[.13em] text-[#1a5144]">{c.listed}</p>
      <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">{isStandard?c.standards:c.grades}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-[#52615b]">{c.sourceNote}</p>
    </header>
    <form action={collectionPath} method="get" role="search"
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#dce5df] bg-white p-4 sm:p-5">
      {locale!=="it"?<input type="hidden" name="lang" value={locale}/>:null}
      <label htmlFor={"private-"+kind+"-query"} className="min-w-[220px] flex-1 text-sm font-bold text-[#365247]">
        {isStandard?c.standards:c.grades}
        <input id={"private-"+kind+"-query"} name="q" type="search" maxLength={120} defaultValue={q}
          placeholder={isStandard?"EN 10219":"S355J2H"}
          className="mt-2 block min-h-11 w-full rounded-xl border border-[#b8cac0] bg-white px-3 text-base text-[#1d2824] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]"/>
      </label>
      <button type="submit" className="school-primary-action">{c.searchAction}</button>
      {q?<Link href={schoolWorkspaceHref(collectionPath,locale)} className="school-secondary-action">{c.clear}</Link>:null}
    </form>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(item=><Link key={item.slug} href={schoolWorkspaceHref(collectionPath+"/"+item.slug,locale)}
        className="group flex min-h-[186px] flex-col rounded-2xl border border-[#dce5df] bg-white p-5 transition hover:border-[#89b9a4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-[#174b3c]">{item.label}</span>
          <span className="rounded-lg border border-[#d7e7dd] bg-[#f2f8f4] px-2 py-1 text-[11px] font-semibold text-[#1a5144]" lang={item.lang}>
            {item.lang==="en"?c.englishGuides:c.originalItalian}
          </span>
        </div>
        <h2 className="mt-3 text-base font-semibold text-[#173f35]" lang={item.lang}>{item.title}</h2>
        <p className="mt-2 flex-1 text-sm leading-6 text-[#52615b]" lang={item.lang}>{item.summary}</p>
        <span className="mt-3 text-sm font-bold text-[#174b3c]">{c.read} →</span>
      </Link>)}
    </div>
    {!rows.length?<p role="status" className="rounded-xl border border-[#dce5df] bg-white p-6 text-sm text-[#52615b]">{c.none}</p>:null}
    <p className="text-xs leading-6 text-[#52615b]">{c.referenceNotice}</p>
  </div>;
}

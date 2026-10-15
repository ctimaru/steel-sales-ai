import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InternationalSteelCalculator } from "@/components/international-steel-calculator";
import {
  CALCULATOR_ROUTES,CALCULATOR_TRANSLATIONS,localizedHrefLangPaths,
  isNewCalculatorLocale,
} from "@/lib/international-calculator-landing";
import { absoluteUrl } from "@/lib/site";
import { robotsForParameterizedPage } from "@/lib/seo";

type PageProps = {
  params:Promise<{locale:string}>;
  searchParams:Promise<Record<string,string|string[]|undefined>>;
};
const inputValue=(raw:Record<string,string|string[]|undefined>,key:string)=>
  typeof raw[key]==="string" ? raw[key] as string : undefined;
const queryKeys=["standard","family","od","width","height","thickness","length","quantity","density"] as const;

export async function generateMetadata({params,searchParams}:PageProps):Promise<Metadata>{
  const {locale}=await params;
  if(!isNewCalculatorLocale(locale))notFound();
  const search=await searchParams;
  const copy=CALCULATOR_TRANSLATIONS[locale];
  const path=CALCULATOR_ROUTES[locale];
  const hasParameters=Object.values(search).some(v=>Boolean(v));
  return {
    title:copy.title,
    description:copy.description,
    robots:robotsForParameterizedPage(hasParameters),
    alternates:{
      canonical:absoluteUrl(path),
      languages:Object.fromEntries(
        Object.entries(localizedHrefLangPaths()).map(([key,value])=>[key,absoluteUrl(value)])
      ),
    },
    openGraph:{
      type:"website",title:copy.title,description:copy.description,
      url:absoluteUrl(path),locale:locale,
    },
  };
}

export default async function InternationalTubeCalculatorPage({params,searchParams}:PageProps){
  const {locale}=await params;
  if(!isNewCalculatorLocale(locale))notFound();
  const copy=CALCULATOR_TRANSLATIONS[locale];
  const raw=await searchParams;
  const seed=Object.fromEntries(queryKeys.map(k=>[k,inputValue(raw,k)]));
  const path=CALCULATOR_ROUTES[locale];
  const data={
    "@context":"https://schema.org",
    "@graph":[
      {
        "@type":"WebApplication",name:copy.title,
        applicationCategory:"EngineeringApplication",operatingSystem:"Web",
        inLanguage:locale,isAccessibleForFree:true,
        url:absoluteUrl(path),
        offers:{"@type":"Offer",price:"0",priceCurrency:"EUR"},
      },
      {
        "@type":"FAQPage",
        mainEntity:copy.faq.map(item=>({
          "@type":"Question",name:item.q,
          acceptedAnswer:{"@type":"Answer",text:item.a},
        })),
      },
    ],
  };
  return <main className="min-h-screen bg-[#f7faf8]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(data)}}/>
    <header className="border-b border-[#d7e4dc] bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href={path} className="text-base font-bold tracking-tight text-[#123b34]">
          Smart Steel Sales <span className="text-[#278664]">· Steel Knowledge</span>
        </Link>
        <Link href="/en" hrefLang="en"
          className="text-xs font-semibold text-[#196a51] underline underline-offset-4">
          Smart Steel Sales →
        </Link>
      </div>
    </header>
    <div className="mx-auto max-w-6xl space-y-7 px-4 py-9 sm:px-6 lg:px-8">
      <section className="max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1d7358]">{copy.eyebrow}</p>
        <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-[#123b34] sm:text-4xl">{copy.title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#456052] sm:text-base">{copy.intro}</p>
      </section>
      <InternationalSteelCalculator locale={locale} seed={seed}/>
      <section className="grid gap-4 rounded-xl border border-[#d7e4dc] bg-white p-5 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-bold text-[#123b34]">{copy.methodTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-[#52615b]">{copy.methodText}</p>
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#123b34]">EN 10219 · EN 10210 · CHS / SHS / RHS</h2>
          <p className="mt-3 text-sm leading-7 text-[#52615b]">{copy.disclaimer}</p>
          <p className="mt-2 text-sm text-[#52615b]">{copy.rfqEnglish}</p>
        </div>
      </section>
      <section aria-labelledby="international-calculator-faq">
        <h2 id="international-calculator-faq" className="text-xl font-bold text-[#123b34]">{copy.faqTitle}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {copy.faq.map(item=><article key={item.q} className="rounded-xl border border-[#d7e4dc] bg-white p-5">
            <h3 className="text-sm font-bold text-[#123b34]">{item.q}</h3>
            <p className="mt-3 text-sm leading-6 text-[#52615b]">{item.a}</p>
          </article>)}
        </div>
      </section>
    </div>
  </main>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";

import { CalculatorRegionSwitch } from "@/components/calculator-region-switch";
import { CalculatorPageLanguageSelector, PUBLIC_HOME_LOCALE_ROUTES } from "@/components/calculator-page-language-selector";
import { calculatorRegionFromQuery, usPipeSeedFromQuery } from "@/lib/us-calculator-route-seed";
import {
  CALCULATOR_ROUTES,CALCULATOR_TRANSLATIONS,localizedHrefLangPaths,
  isNewCalculatorLocale,
} from "@/lib/international-calculator-landing";
import { MARKET_GUIDES, MARKET_GUIDE_ROUTES } from "@/lib/calculator-market-editorial";
import { MARKET_TOPIC_GUIDES, MARKET_TOPIC_ROUTES } from "@/lib/calculator-topic-clusters";
import { listPublicTubeDimensionPages } from "@/lib/public-knowledge";
import { absoluteUrl } from "@/lib/site";
import { robotsForParameterizedPage } from "@/lib/seo";

// Same public dimension source as IT/EN; cache feed for 24h.
const cachedPublicTubeReferences = unstable_cache(listPublicTubeDimensionPages, ["calc-international-published-dimensions"], { revalidate: 86400 });

type PageProps = {
  params:Promise<{locale:string}>;
  searchParams:Promise<Record<string,string|string[]|undefined>>;
};
const inputValue=(raw:Record<string,string|string[]|undefined>,key:string)=>
  typeof raw[key]==="string" ? raw[key] as string : undefined;
const queryKeys=["standard","family","od","width","height","thickness","length","quantity","target","density"] as const;

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
  const guide=MARKET_GUIDES[locale];
  const topic=MARKET_TOPIC_GUIDES[locale];
  const raw=await searchParams;
  const seed=Object.fromEntries(queryKeys.map(k=>[k,inputValue(raw,k)]));
  const usSeed=usPipeSeedFromQuery(raw);
  const references=await cachedPublicTubeReferences();
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
        <Link href={PUBLIC_HOME_LOCALE_ROUTES[locale]} className="text-base font-bold tracking-tight text-[#123b34]">
          Smart Steel Sales <span className="text-[#278664]">· Steel Knowledge</span>
        </Link>
        <CalculatorPageLanguageSelector locale={locale} />
        <Link href={PUBLIC_HOME_LOCALE_ROUTES[locale]}
          className="text-xs font-semibold text-[#196a51] underline underline-offset-4">
          ← Smart Steel Sales
        </Link>
      </div>
    </header>
    <div className="mx-auto max-w-6xl space-y-7 px-4 py-9 sm:px-6 lg:px-8">
      <section className="max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1d7358]">{copy.eyebrow}</p>
        <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-[#123b34] sm:text-4xl">{copy.title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#456052] sm:text-base">{copy.intro}</p>
      </section>
      <CalculatorRegionSwitch locale={locale} references={references} internationalSeed={seed} usInitialValues={usSeed}
        initialRegion={calculatorRegionFromQuery(raw)}/>
      {/* CALC-INT4: crawlable local technical resource; full guide lives on its own URL. */}
      <section aria-label={guide.kicker} className="rounded-2xl border border-[#bfdacd] bg-white p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#1b7052]">{guide.kicker}</p>
        <h2 className="mt-2 text-lg font-bold text-[#123b34]">{guide.title}</h2>
        <p className="mt-2 text-sm leading-7 text-[#476355]">{guide.description}</p>
        <Link href={MARKET_GUIDE_ROUTES[locale]} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#136044] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#237858]">{guide.title} →</Link>
        {/* CALC-INT4.3: link directly to this market's distinctive satellite intent.
            Keep the block compact and crawlable, without repeated editorial text
            above the tool or artificial cross-language satellite translations. */}
        <div className="mt-3 border-t border-[#e1eae4] pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#397258]">{topic.kicker}</p>
          <Link href={MARKET_TOPIC_ROUTES[locale]}
            className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold leading-6 text-[#136044] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#237858]">
            {topic.title} →
          </Link>
          <p className="mt-1 text-xs leading-6 text-[#52675b]">{topic.description}</p>
        </div>
      </section>
      {/* CALC-INT3E.7: keep references crawlable and genuinely localized,
          but avoid article-like columns and long repeated sections below the tool. */}
      <section aria-label={copy.methodTitle} className="rounded-2xl border border-[#d7e4dc] bg-white p-4 sm:p-5">
        <p className="text-xs leading-6 text-[#52615b]">{copy.disclaimer}</p>
        <details className="mt-4 rounded-xl border border-[#dce5df] bg-[#f6faf7]">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[#123b34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#237858]">
            {copy.methodTitle}<span aria-hidden="true">⌄</span>
          </summary>
          <div className="border-t border-[#dce5df] px-4 py-3">
            <p className="text-sm leading-7 text-[#52615b]">{copy.methodText}</p>
            <p className="mt-3 text-xs leading-6 text-[#52615b]">{copy.rfqEnglish}</p>
          </div>
        </details>
        <details className="mt-2 rounded-xl border border-[#dce5df] bg-[#f6faf7]">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[#123b34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#237858]">
            {copy.usTitle}<span aria-hidden="true">⌄</span>
          </summary>
          <div className="space-y-2 border-t border-[#dce5df] px-4 py-3 text-sm leading-7 text-[#52615b]">
            <p>{copy.usDescription}</p><p>{copy.usNps}</p><p>{copy.usHss}</p>
            <p className="text-xs">{copy.usCaveat}</p>
          </div>
        </details>
        <details className="mt-2 rounded-xl border border-[#dce5df] bg-[#f6faf7]">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[#123b34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#237858]">
            {copy.faqTitle}<span aria-hidden="true">⌄</span>
          </summary>
          <div className="space-y-4 border-t border-[#dce5df] px-4 py-4">
            {copy.faq.map(item=><article key={item.q}>
              <h3 className="text-sm font-semibold text-[#123b34]">{item.q}</h3>
              <p className="mt-1 text-sm leading-6 text-[#52615b]">{item.a}</p>
            </article>)}
          </div>
        </details>
      </section>
    </div>
  </main>;
}

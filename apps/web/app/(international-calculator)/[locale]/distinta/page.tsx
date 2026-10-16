import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EnglishRfqBillBuilder } from "@/components/english-rfq-bill-builder";
import { PUBLIC_HOME_LOCALE_ROUTES } from "@/components/calculator-page-language-selector";
import { InternationalRfqRegisterLink } from "@/components/international-rfq-register-link";
import { isNewCalculatorLocale, type CalculatorLandingLocale } from "@/lib/international-calculator-landing";
import { RFQ_BILL_LANDING, RFQ_BILL_ROUTES } from "@/lib/rfq-bill-localization";
import { absoluteUrl } from "@/lib/site";
import { robotsForParameterizedPage } from "@/lib/seo";

type PageProps={
  params:Promise<{locale:string}>;
  searchParams:Promise<Record<string,string|string[]|undefined>>;
};

export function generateStaticParams(){
  return [{locale:"de"},{locale:"fr"},{locale:"es"}];
}

export async function generateMetadata({params,searchParams}:PageProps):Promise<Metadata>{
  const {locale}=await params;
  if(!isNewCalculatorLocale(locale))notFound();
  const t=RFQ_BILL_LANDING[locale];
  const path=RFQ_BILL_ROUTES[locale];
  const queries=await searchParams;
  return {
    title:t.title+" — Smart Steel Sales",
    description:t.description,
    robots:robotsForParameterizedPage(Object.values(queries).some(Boolean)),
    alternates:{
      canonical:absoluteUrl(path),
      languages:Object.fromEntries(
        Object.entries(RFQ_BILL_ROUTES).map(([lang,url])=>[lang,absoluteUrl(url)])
      ),
    },
    openGraph:{type:"website",title:t.title,description:t.description,url:absoluteUrl(path),locale},
  };
}

export default async function LocalizedRfqBillPage({params}:PageProps){
  const {locale}=await params;
  if(!isNewCalculatorLocale(locale))notFound();
  const language=locale as CalculatorLandingLocale;
  const t=RFQ_BILL_LANDING[language];
  const jsonLd={
    "@context":"https://schema.org",
    "@type":"WebApplication",
    name:t.title,
    applicationCategory:"BusinessApplication",
    operatingSystem:"Web",
    isAccessibleForFree:true,
    inLanguage:language,
    url:absoluteUrl(RFQ_BILL_ROUTES[language]),
  };
  const languageLabel:Record<CalculatorLandingLocale,string>={
    de:"Sprache der Stückliste",fr:"Langue de la nomenclature",es:"Idioma de la lista",
  };
  return <main lang={language} className="min-h-screen bg-[#f5f8f6] text-[#123b34]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd)}}/>
    <header className="border-b border-[#d8e6dc] bg-white">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href={PUBLIC_HOME_LOCALE_ROUTES[language]} className="text-base font-bold">Smart Steel Sales <span className="text-[#237958]">· RFQ</span></Link>
        <nav aria-label={languageLabel[language]} className="flex flex-wrap gap-2">
          {(["en","de","fr","es"] as const).map(lang=><Link
            key={lang} href={RFQ_BILL_ROUTES[lang]} hrefLang={lang} lang={lang}
            aria-current={language===lang?"page":undefined}
            className={"inline-flex min-h-11 min-w-12 items-center justify-center rounded-lg border px-3 text-xs font-bold "+(language===lang?"border-[#145941] bg-[#145941] text-white":"border-[#bbd4c7] bg-white text-[#123b34]")}>
            {lang.toUpperCase()}
          </Link>)}
        </nav>
      </div>
    </header>
    <div className="mx-auto max-w-[1120px] px-4 py-9 sm:px-6">
      <div className="mb-7 max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-wider text-[#17644c]">{t.eyebrow}</p>
        <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-4xl">{t.title}</h1>
        <p className="mt-4 text-sm leading-7 text-[#456052] sm:text-base">{t.lead}</p>
        <Link href={"/"+language+"/knowledge/tubes"} hrefLang={language}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#17644c] underline underline-offset-4">
          ← {t.back}
        </Link>
      </div>
      <EnglishRfqBillBuilder locale={language}/>
      <section className="mt-7 rounded-2xl border border-[#d6e5dc] bg-white p-5 sm:p-7">
        <h2 className="text-lg font-bold">{t.guidance}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#52615b]">{t.detail}</p>
        <div className="mt-5 border-t border-[#d6e5dc] pt-5">
          <p className="max-w-3xl text-xs leading-6 text-[#52615b]">{t.registerDetail}</p>
          <InternationalRfqRegisterLink locale={language} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#155943] px-5 text-sm font-bold text-white">
            {t.register} →
          </InternationalRfqRegisterLink>
        </div>
      </section>
    </div>
  </main>;
}

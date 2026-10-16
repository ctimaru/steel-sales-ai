import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicPageLanguageSelector, PUBLIC_HOME_LOCALE_ROUTES } from "@/components/calculator-page-language-selector";
import { ProductBrand } from "@/components/product-brand";
import {
  CALCULATOR_ROUTES, isNewCalculatorLocale,
} from "@/lib/international-calculator-landing";
import { INTERNATIONAL_PUBLIC_HOME } from "@/lib/international-public-home";
import { absoluteUrl } from "@/lib/site";

type PageProps={params:Promise<{locale:string}>};

export function generateStaticParams(){
  return [{locale:"de"},{locale:"fr"},{locale:"es"}];
}
export async function generateMetadata({params}:PageProps):Promise<Metadata>{
  const {locale}=await params;
  if(!isNewCalculatorLocale(locale))notFound();
  const t=INTERNATIONAL_PUBLIC_HOME[locale];
  const url=PUBLIC_HOME_LOCALE_ROUTES[locale];
  return {
    title:t.title,
    description:t.description,
    alternates:{
      canonical:absoluteUrl(url),
      languages:Object.fromEntries(Object.entries(PUBLIC_HOME_LOCALE_ROUTES)
        .map(([language,path])=>[language,absoluteUrl(path)])),
    },
    openGraph:{
      title:t.title,description:t.description,url:absoluteUrl(url),
      type:"website",locale,
    },
  };
}

export default async function InternationalPublicHome({params}:PageProps){
  const {locale}=await params;
  if(!isNewCalculatorLocale(locale))notFound();
  const t=INTERNATIONAL_PUBLIC_HOME[locale];
  const calculator=CALCULATOR_ROUTES[locale];
  const bill=`/${locale}/distinta`;
  const jsonld={
    "@context":"https://schema.org",
    "@type":"WebPage",
    name:t.title,
    description:t.description,
    inLanguage:locale,
    url:absoluteUrl(PUBLIC_HOME_LOCALE_ROUTES[locale]),
    isPartOf:{"@type":"WebSite",name:"Smart Steel Sales",url:absoluteUrl("/")},
    mainEntity:{
      "@type":"WebApplication",name:t.calculator,
      applicationCategory:"EngineeringApplication",
      operatingSystem:"Web",isAccessibleForFree:true,
      url:absoluteUrl(calculator),inLanguage:locale,
    },
  };
  return <main className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonld)}}/>
    <header className="border-b border-[#dce5e0] bg-white">
      <div className="mx-auto flex min-h-[72px] max-w-[1180px] items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
        <ProductBrand href={PUBLIC_HOME_LOCALE_ROUTES[locale]} compact/>
        <div className="flex items-center gap-2">
          <PublicPageLanguageSelector locale={locale} surface="home"/>
          <Link href="/en/login" hrefLang="en" lang="en" className="hidden min-h-11 items-center px-3 text-xs font-semibold text-[#345a4b] hover:text-[#123b34] sm:inline-flex">
            {t.login}
          </Link>
        </div>
      </div>
    </header>

    <section aria-labelledby="international-home-heading" className="relative overflow-hidden border-b border-[#dce5e0] bg-[#f6f8f7]">
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-44 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(31,107,90,0.12),transparent_68%)]"/>
      <div className="relative mx-auto grid max-w-[1180px] items-center gap-9 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,.88fr)] lg:gap-14 lg:px-8 lg:py-20">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[.13em] text-[#1d7358]">{t.eyebrow}</p>
          <h1 id="international-home-heading" className="mt-5 max-w-[720px] text-[2.4rem] font-semibold leading-[1.1] tracking-[-.045em] text-[#123b34] sm:text-[3.3rem] lg:text-[3.65rem]">
            {t.headline}
            <span className="mt-1 block text-[#315c74]">{t.accent}</span>
          </h1>
          <p className="mt-5 max-w-[640px] text-base leading-7 text-[#52615b] sm:text-lg sm:leading-8">{t.intro}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={calculator}
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#155740] px-6 text-sm font-bold text-white shadow-[0_8px_20px_rgba(18,59,52,.10)] hover:bg-[#216e50] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155740]">
              {t.calculator} <span aria-hidden="true">→</span>
            </Link>
            <Link href={bill}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#a9c5b6] bg-white px-6 text-sm font-bold text-[#123b34] hover:bg-[#edf5f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155740]">
              {t.bill}
            </Link>
          </div>
          <p className="mt-3 text-xs font-medium text-[#52615b]">{t.freeLabel}</p>
        </div>
        <div className="rounded-3xl border border-[#c7ddcf] bg-white p-5 shadow-[0_16px_46px_rgba(18,59,52,.07)] sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[#336b55]">{t.systemLabel}</p>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-[#c4dcd0] bg-[#edf6f0] p-4">
              <p className="text-sm font-extrabold text-[#155740]">{t.eu}</p>
              <p className="mt-1 text-xs leading-6 text-[#4c6257]">CHS · SHS · RHS · kg/m</p>
            </div>
            <div className="rounded-2xl border border-[#d7e1d9] bg-[#f6f8f7] p-4">
              <p className="text-sm font-extrabold text-[#155740]">{t.us}</p>
              <p className="mt-1 text-xs leading-6 text-[#4c6257]">API 5L · ASTM A53 / A106 · HSS A500</p>
            </div>
          </div>
          <div className="mt-5 border-t border-[#dce5e0] pt-4">
            <p className="text-xs leading-6 text-[#52615b]">{t.safetyDescription}</p>
          </div>
        </div>
      </div>
    </section>

    <section aria-labelledby="international-workflow-heading" className="bg-white">
      <div className="mx-auto max-w-[1120px] px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#1d7358]">{t.freeLabel}</p>
        <h2 id="international-workflow-heading" className="mt-2 text-2xl font-semibold tracking-tight text-[#123b34] sm:text-3xl">{t.workflowsTitle}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#52615b]">{t.workflowsDescription}</p>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {[t.stepOne,t.stepTwo,t.stepThree].map(step=>
            <div key={step} className="rounded-2xl border border-[#d8e5dd] bg-[#f8faf8] p-5">
              <p className="text-sm font-bold leading-6 text-[#123b34]">{step}</p>
            </div>
          )}
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link href={calculator} className="group rounded-2xl border border-[#d1e2d8] bg-white p-5 hover:border-[#7cae95] hover:bg-[#f8fbf9]">
            <p className="text-base font-bold text-[#155740]">{t.calculator} <span aria-hidden="true">→</span></p>
            <p className="mt-2 text-sm leading-6 text-[#52615b]">{t.calculatorDescription}</p>
          </Link>
          <Link href={bill} className="group rounded-2xl border border-[#d1e2d8] bg-white p-5 hover:border-[#7cae95] hover:bg-[#f8fbf9]">
            <p className="text-base font-bold text-[#155740]">{t.bill} <span aria-hidden="true">→</span></p>
            <p className="mt-2 text-sm leading-6 text-[#52615b]">{t.billDescription}</p>
          </Link>
        </div>
      </div>
    </section>

    <section className="border-t border-[#dce5e0] bg-[#f2f4f3]">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 py-12 sm:px-6 sm:py-14 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-[#123b34]">{t.platformTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-[#52615b]">{t.platformDescription}</p>
          <p className="mt-2 text-xs leading-6 text-[#66736e]">{t.registerNotice}</p>
        </div>
        <Link href="/en/register" hrefLang="en"
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl border border-[#bed3c7] bg-white px-5 text-sm font-bold text-[#123b34] hover:bg-[#e9f3ee]">
          {t.register} <span aria-hidden="true" className="ml-2">→</span>
        </Link>
      </div>
    </section>
    <footer className="border-t border-[#dce5e0] bg-white">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-4 py-7 text-xs text-[#52615b] sm:px-6">
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          <Link href={PUBLIC_HOME_LOCALE_ROUTES[locale]}>{t.home}</Link>
          <Link href={calculator}>{t.calculator}</Link>
          <Link href={bill}>{t.bill}</Link>
          <Link href="/privacy" hrefLang="it">{t.privacy}</Link>
          <a href="mailto:hello@smartsteelsales.com">{t.contact}</a>
        </div>
        <span>{t.footnote}</span>
      </div>
    </footer>
  </main>;
}

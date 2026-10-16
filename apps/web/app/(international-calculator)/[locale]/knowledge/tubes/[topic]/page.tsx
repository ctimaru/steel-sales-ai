import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CalculatorPageLanguageSelector, PUBLIC_HOME_LOCALE_ROUTES } from "@/components/calculator-page-language-selector";
import { CALCULATOR_ROUTES } from "@/lib/international-calculator-landing";
import { MARKET_GUIDES, MARKET_GUIDE_ROUTES, type MarketGuideLocale } from "@/lib/calculator-market-editorial";
import { robotsForParameterizedPage } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

type Props = {
  params: Promise<{ locale: string; topic: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return (["de", "fr", "es"] as const).map(locale => ({
    locale, topic: MARKET_GUIDES[locale].slug
  }));
}

function resolveGuide(locale: string, topic: string) {
  if (locale !== "de" && locale !== "fr" && locale !== "es") notFound();
  const guide = MARKET_GUIDES[locale];
  if (topic !== guide.slug) notFound();
  return { locale: locale as MarketGuideLocale, guide, path: MARKET_GUIDE_ROUTES[locale] };
}

const languageAlternates = Object.fromEntries(
  (["de", "fr", "es"] as const).map(locale => [locale, absoluteUrl(MARKET_GUIDE_ROUTES[locale])])
);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, topic } = await params;
  const { guide, path } = resolveGuide(locale, topic);
  const query = await searchParams;
  return {
    title: guide.title,
    description: guide.description,
    robots: robotsForParameterizedPage(Object.values(query).some(Boolean)),
    alternates: { canonical: absoluteUrl(path), languages: languageAlternates },
    openGraph: {
      type: "article", url: absoluteUrl(path), locale,
      title: guide.title, description: guide.description,
      publishedTime: "2026-10-16", modifiedTime: "2026-10-16"
    }
  };
}

export default async function MarketTechnicalGuide({ params }: Props) {
  const { locale, topic } = await params;
  const { guide, path } = resolveGuide(locale, topic);
  const calculatorPath = CALCULATOR_ROUTES[locale];
  const billPath = `/${locale}/distinta`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: guide.title,
        description: guide.description,
        inLanguage: locale,
        url: absoluteUrl(path),
        mainEntityOfPage: absoluteUrl(path),
        datePublished: "2026-10-16",
        dateModified: "2026-10-16",
        author: { "@type": "Organization", name: "Smart Steel Sales" },
        publisher: { "@type": "Organization", name: "Smart Steel Sales" },
        isAccessibleForFree: true,
        citation: guide.sources.map(source => source.url)
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Smart Steel Sales", item: absoluteUrl(PUBLIC_HOME_LOCALE_ROUTES[locale]) },
          { "@type": "ListItem", position: 2, name: guide.calculatorCta, item: absoluteUrl(calculatorPath) },
          { "@type": "ListItem", position: 3, name: guide.title, item: absoluteUrl(path) }
        ]
      },
      {
        "@type": "FAQPage",
        mainEntity: guide.questions.map(item => ({
          "@type": "Question", name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer }
        }))
      }
    ]
  };

  return <main className="min-h-screen bg-[#f7faf8] text-[#123b34]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <header className="border-b border-[#d7e4dc] bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href={PUBLIC_HOME_LOCALE_ROUTES[locale]} className="font-bold text-[#123b34]">Smart Steel Sales <span className="text-[#278664]">· Steel Knowledge</span></Link>
        <CalculatorPageLanguageSelector locale={locale} />
      </div>
    </header>
    <article className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-[#476355]">
        <Link href={PUBLIC_HOME_LOCALE_ROUTES[locale]} className="underline underline-offset-4">Smart Steel Sales</Link><span aria-hidden="true">/</span>
        <Link href={calculatorPath} className="underline underline-offset-4">{guide.calculatorCta}</Link>
      </nav>
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1b7052]">{guide.kicker}</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{guide.title}</h1>
        <p className="mt-5 text-base leading-8 text-[#405d50]">{guide.intro}</p>
        <p className="mt-4 text-xs text-[#54685c]">{guide.updatedLabel}</p>
      </header>
      <div className="rounded-2xl border border-[#bfdacd] bg-white p-5 sm:p-6">
        <p className="text-sm leading-7 text-[#3e5e50]">{guide.description}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={calculatorPath} className="inline-flex min-h-11 items-center rounded-xl bg-[#186a4d] px-4 py-3 text-sm font-semibold text-white hover:bg-[#124c38] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#124c38]">{guide.calculatorCta} →</Link>
          <Link href={billPath} className="inline-flex min-h-11 items-center rounded-xl border border-[#b8d3c7] px-4 py-3 text-sm font-semibold text-[#185941] hover:bg-[#edf7f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#124c38]">{guide.billCta} →</Link>
        </div>
      </div>
      {guide.sections.map(section => <section key={section.heading} className="space-y-3">
        <h2 className="text-xl font-bold leading-snug sm:text-2xl">{section.heading}</h2>
        {section.paragraphs.map(paragraph => <p key={paragraph} className="text-base leading-8 text-[#405d50]">{paragraph}</p>)}
      </section>)}
      <section className="rounded-2xl bg-[#edf5ef] p-5 sm:p-6">
        <h2 className="text-xl font-bold">{guide.checklistTitle}</h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm leading-7 text-[#2e5140]">
          {guide.checklist.map(item => <li key={item}>{item}</li>)}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">{guide.exampleTitle}</h2>
        <p className="text-base leading-8 text-[#405d50]">{guide.example}</p>
      </section>
      <section className="space-y-4" aria-label="FAQ">
        {guide.questions.map(item => <div key={item.question} className="border-b border-[#dae6de] pb-4">
          <h2 className="text-lg font-semibold">{item.question}</h2>
          <p className="mt-2 text-sm leading-7 text-[#405d50]">{item.answer}</p>
        </div>)}
      </section>
      <aside className="space-y-3 border-t border-[#d7e4dc] pt-6">
        <h2 className="text-lg font-semibold">{guide.sourcesTitle}</h2>
        <ul className="list-inside list-disc space-y-2 text-sm leading-7">
          {guide.sources.map(source => <li key={source.url}>
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-[#126447] underline underline-offset-4">{source.title}</a>
          </li>)}
        </ul>
        <p className="rounded-xl bg-[#edf5ef] p-4 text-sm leading-7 text-[#3d594a]">{guide.warning}</p>
      </aside>
    </article>
  </main>;
}

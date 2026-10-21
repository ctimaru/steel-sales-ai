import Link from "next/link";
import type { ReactNode } from "react";

import { EnglishConversionHandoff } from "@/components/english-conversion-handoff";
import { ProductBrand } from "@/components/product-brand";
import { PublicContactSection } from "@/components/public-contact-section";
import { PublicLanguageSwitch } from "@/components/public-language-switch";
import { CalculatorPageLanguageSelector, SchoolPageLanguageSelector } from "@/components/calculator-page-language-selector";

export function EnglishPublicSubpage({
  eyebrow,
  title,
  description,
  italianHref,
  englishHref,
  children,
  calculatorLanguageMenu = false,
  knowledgeLanguageMenu = false,
  compactMobileHero = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  italianHref: string;
  englishHref: string;
  children: ReactNode;
  /** Replaces the two-language header switch only on the calculator landing. */
  calculatorLanguageMenu?: boolean;
  /** Five-language School switch, only where every target hub really exists. */
  knowledgeLanguageMenu?: boolean;
  /** Short public RFQ intro on mobile; other English pages unchanged. */
  compactMobileHero?: boolean;
}) {
  return (
    <main lang="en" className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <header className="border-b border-[#dce5e0] bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-[1180px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <ProductBrand href="/en" compact />
          <nav aria-label="English public navigation" className="hidden items-center gap-1.5 xl:flex">
            <Link href="/en" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Home</Link>
            <Link href="/en/knowledge" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Knowledge</Link>
            <Link href="/en/network" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Network</Link>
            <Link href="/en/knowledge/standards" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Standards</Link>
            <Link href="/en/knowledge/grades" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Grades</Link>
            <Link href="/en/knowledge/tubes" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Weight calculator</Link>
            <Link href="/en/distinta" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">RFQ builder</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {calculatorLanguageMenu
              ? <CalculatorPageLanguageSelector locale="en" />
              : knowledgeLanguageMenu ? <SchoolPageLanguageSelector locale="en" />
              : <PublicLanguageSwitch locale="en" italianHref={italianHref} englishHref={englishHref} />}
            <Link href="/en/register" className="platform-primary inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-xs font-bold">Join</Link>
          </div>
        </div>
        <nav aria-label="English mobile public navigation" className="flex items-center gap-1 overflow-x-auto border-t border-[#edf1ee] px-4 py-1.5 xl:hidden">
          <Link href="/en/knowledge/standards" className="inline-flex min-h-10 shrink-0 items-center px-3 text-xs font-semibold text-[#52615b]">Standards</Link>
          <Link href="/en/knowledge/grades" className="inline-flex min-h-10 shrink-0 items-center px-3 text-xs font-semibold text-[#52615b]">Grades</Link>
          <Link href="/en/knowledge/tubes" className="inline-flex min-h-10 shrink-0 items-center px-3 text-xs font-semibold text-[#52615b]">Weight calculator</Link>
          <Link href="/en/distinta" className="inline-flex min-h-10 shrink-0 items-center px-3 text-xs font-semibold text-[#52615b]">RFQ builder</Link>
          <Link href="/en/network" className="inline-flex min-h-10 shrink-0 items-center px-3 text-xs font-semibold text-[#52615b]">Network</Link>
          <Link href="/en/login" className="inline-flex min-h-10 shrink-0 items-center px-3 text-xs font-semibold text-[#52615b]">Sign in</Link>
        </nav>
      </header>

      <section className="border-b border-[#dce5e0] bg-[#f6f8f7]">
        <div data-rfq-hero={compactMobileHero ? "true" : undefined} className={compactMobileHero ? "mx-auto max-w-[1120px] px-4 py-3 sm:px-6 sm:py-20 lg:px-8" : "mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8"}>
          <Link href="/en" className="text-xs font-semibold text-[#1f6b5a] underline underline-offset-4">← Smart Steel Sales</Link>
          <p className={compactMobileHero ? "mt-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#1a5144] sm:mt-7 sm:text-xs" : "mt-7 text-xs font-extrabold uppercase tracking-[0.14em] text-[#1a5144]"}>{eyebrow}</p>
          <h1 className={compactMobileHero ? "mt-1 max-w-3xl text-xl font-semibold leading-tight tracking-tight text-[#123b34] sm:mt-3 sm:text-5xl" : "mt-3 max-w-3xl text-4xl font-semibold leading-[1.12] tracking-[-0.045em] text-[#123b34] sm:text-5xl"}>{title}</h1>
          <p className={compactMobileHero ? "mt-2 line-clamp-2 max-w-3xl text-xs leading-5 text-[#52615b] sm:mt-5 sm:line-clamp-none sm:text-base sm:leading-8" : "mt-5 max-w-3xl text-base leading-8 text-[#52615b]"}>{description}</p>
        </div>
      </section>

      {children}

      <EnglishConversionHandoff context={englishHref === "/en/distinta" ? "rfq" : englishHref === "/en/network" ? "network" : "knowledge"} />

      <PublicContactSection locale="en" />

      <footer className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-4 px-4 py-7 text-xs text-[#52615b] sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/en" className="font-semibold">Home</Link>
          <Link href="/en/knowledge" className="font-semibold">Knowledge</Link>
          <Link href="/en/network" className="font-semibold">Network</Link>
          <Link href="/en/knowledge/standards" className="font-semibold">Standards</Link>
          <Link href="/en/knowledge/grades" className="font-semibold">Steel grades</Link>
          <Link href="/en/knowledge/tubes" className="font-semibold">Weight calculator</Link>
          <Link href="/en/distinta" className="font-semibold">RFQ builder</Link>
          <Link href="/en/register" className="font-semibold">Register</Link>
          <Link href="/en/login" className="font-semibold">Sign in</Link>
          <Link href="/privacy" hrefLang="it" className="font-semibold">Privacy (IT)</Link>
          <Link href="/terms" hrefLang="it" className="font-semibold">Terms (IT)</Link>
        </div>
        <span>Smart Steel Sales · Super Intelligence Ready</span>
      </footer>
    </main>
  );
}

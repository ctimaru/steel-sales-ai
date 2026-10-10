import Link from "next/link";
import type { ReactNode } from "react";

import { ProductBrand } from "@/components/product-brand";
import { PublicContactSection } from "@/components/public-contact-section";
import { PublicLanguageSwitch } from "@/components/public-language-switch";

export function EnglishPublicSubpage({
  eyebrow,
  title,
  description,
  italianHref,
  englishHref,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  italianHref: string;
  englishHref: string;
  children: ReactNode;
}) {
  return (
    <main lang="en" className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <header className="border-b border-[#dce5e0] bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-[1180px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <ProductBrand href="/en" compact />
          <nav aria-label="English public navigation" className="hidden items-center gap-2 md:flex">
            <Link href="/en" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Home</Link>
            <Link href="/en/knowledge" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Knowledge</Link>
            <Link href="/en/network" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Network</Link>
            <Link href="/en/knowledge/standards" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Standards</Link>
            <Link href="/en/knowledge/grades" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Grades</Link>
            <Link href="/en/knowledge/tubes" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Weight calculator</Link>
            <Link href="/en/distinta" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">RFQ builder</Link>
          </nav>
          <PublicLanguageSwitch locale="en" italianHref={italianHref} englishHref={englishHref} />
        </div>
      </header>

      <section className="border-b border-[#dce5e0] bg-[#f6f8f7]">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <Link href="/en" className="text-xs font-semibold text-[#1f6b5a] underline underline-offset-4">← Smart Steel Sales</Link>
          <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.14em] text-[#1a5144]">{eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.12] tracking-[-0.045em] text-[#123b34] sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#52615b]">{description}</p>
        </div>
      </section>

      {children}

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
          <Link href="/privacy" hrefLang="it" className="font-semibold">Privacy (IT)</Link>
          <Link href="/terms" hrefLang="it" className="font-semibold">Terms (IT)</Link>
        </div>
        <span>Smart Steel Sales · Super Intelligence Ready</span>
      </footer>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { EnglishPublicSubpage } from "@/components/english-public-subpage";
import { SchoolJourney, SchoolTechnicalSections } from "@/components/school-unified-experience";
import { SchoolUnifiedNavigation, SchoolConversionPath } from "@/components/school-unified-navigation";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Steel Knowledge — Standards, Grades and Tube Weights",
  description:
    "Explore steel and tube standards, material grades, dimensions and theoretical weight calculations with Smart Steel Sales.",
  alternates: {
    canonical: absoluteUrl("/en/knowledge"),
    languages: {
      it: absoluteUrl("/knowledge"),
      en: absoluteUrl("/en/knowledge"),
      de: absoluteUrl("/de/knowledge"),
      fr: absoluteUrl("/fr/knowledge"),
      es: absoluteUrl("/es/knowledge"),
    },
  },
  openGraph: {
    title: "Steel Knowledge — Smart Steel Sales",
    description: "Technical resources for steel and tube buyers, traders and fabricators.",
    url: absoluteUrl("/en/knowledge"),
    type: "website",
    locale: "en_US",
  },
};

const topics = [
  {
    title: "Steel standards",
    description:
      "Learn how technical standards define product requirements, dimensional tolerances and testing conditions. EN 10219 covers cold-formed structural hollow sections; EN 10210 covers hot-finished structural hollow sections.",
    href: "/en/knowledge/standards",
    linkText: "Browse the English steel standards catalogue"
  },
  {
    title: "Material grades",
    description:
      "Understand material designations such as S235, S275 and S355, and why a full grade and standard reference matter when specifying steel.",
    href: "/en/knowledge/grades",
    linkText: "Explore steel grades in English"
  },
  {
    title: "Tube dimensions and weights",
    description:
      "Calculate theoretical kg/m, bar mass and tonnes for circular (CHS), square (SHS) and rectangular (RHS) hollow sections using EN 10210 or EN 10219.",
    href: "/en/knowledge/tubes",
    linkText: "Calculate steel tube weight in kg/m (CHS, SHS, RHS)"
  },
  {
    title: "RFQ bill of materials",
    description:
      "A precise request should include section type, dimensions, wall thickness, steel grade, manufacturing standard, quantity, unit and length.",
    href: "/en/distinta",
    linkText: "Create an RFQ bill of materials in English"
  },
] as const;

export default function EnglishKnowledgePage() {
  return (
    <EnglishPublicSubpage
      eyebrow="Open technical knowledge"
      title="Steel knowledge for clearer specifications."
      description="The steel and tube supply chain uses precise terminology. Start with standards, material grades, hollow section geometries and theoretical weight calculations, then turn requirements into a structured enquiry."
      italianHref="/knowledge"
      englishHref="/en/knowledge"
      knowledgeLanguageMenu
    >
      <div className="mx-auto max-w-[1120px] px-4 pt-6 sm:px-6 lg:px-8"><SchoolUnifiedNavigation locale="en" scope="public" /></div>
      <section className="mx-auto mt-6 grid max-w-[1120px] items-center gap-4 overflow-hidden rounded-[28px] bg-[#102921] px-6 py-9 text-white sm:px-9 sm:py-11 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]" aria-label="Steel sections technical overview">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cover bg-[position:72%_center] opacity-65" style={{backgroundImage:"url('/home-cine1a-steel.webp')"}} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(9,31,23,.97)_0%,rgba(9,31,23,.86)_55%,rgba(9,31,23,.50)_100%)]" />
        <div className="p-3 sm:p-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#a6d4ba]">Smart Steel School</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Steel, explained clearly.</h2>
          <p className="mt-3 text-sm leading-7 text-[#d2e4d9]">Explore the same tools and reference categories as the Italian School. Public information remains separate from private company documents.</p>
        </div>
        <SchoolTechnicalSections locale="en"/>
      </section>
      <div className="mx-auto max-w-[1120px] px-4 pt-8 sm:px-6 lg:px-8"><SchoolJourney locale="en"/></div>
      <div className="mx-auto max-w-[1120px] px-4 pt-5 sm:px-6 lg:px-8"><SchoolConversionPath locale="en"/></div>
      <section aria-label="Featured steel tube calculator" className="px-4 pt-8 sm:px-6">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-4 rounded-2xl border border-[#bcd6c9] bg-[#eaf4ee] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-[#225a45]">Free technical tool</p>
            <h2 className="mt-2 text-xl font-semibold text-[#123b34]">Steel tube weight calculator: CHS, SHS & RHS</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#496257]">Calculate kg/m, bar weights and total tonnes for hollow sections, then prepare an RFQ bill of materials.</p>
          </div>
          <Link href="/en/knowledge/tubes" className="school-primary-action shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123b34]">Calculate steel tube weight <span className="ml-2" aria-hidden="true">→</span></Link>
        </div>
      </section>
      <section aria-label="Knowledge topics" className="bg-white">
        <div className="mx-auto grid max-w-[1120px] gap-4 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:px-8">
          {topics.map((topic) => (
            <article key={topic.title} className="flex flex-col rounded-2xl border border-[#dce5e0] bg-[#f8faf8] p-6">
              <h2 className="text-xl font-semibold text-[#123b34]">{topic.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-7 text-[#52615b]">{topic.description}</p>
              <Link href={topic.href} hrefLang={topic.href.startsWith("/en/") ? "en" : "it"} className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-[#1f6b5a] underline underline-offset-4">
                {topic.linkText} ↗
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="bg-[#f2f4f3]">
        <div className="mx-auto max-w-[1120px] px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-[#123b34]">About theoretical tube weights</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#52615b]">
            A theoretical mass per metre is a specification aid, not a verified delivery weight. Actual mass depends on tolerances, manufacturing process and applicable product requirements. Confirm commercial quantities and acceptance conditions with your supplier.
          </p>
        </div>
      </section>
    </EnglishPublicSubpage>
  );
}

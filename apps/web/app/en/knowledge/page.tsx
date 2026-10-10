import type { Metadata } from "next";
import Link from "next/link";

import { EnglishPublicSubpage } from "@/components/english-public-subpage";
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
      "Compare circular, square and rectangular hollow sections. Calculate indicative kilograms per metre, piece weights and total mass from the relevant dimensions.",
    href: "/en/knowledge/tubes",
    linkText: "Open the English tube weight calculator"
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
    >
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

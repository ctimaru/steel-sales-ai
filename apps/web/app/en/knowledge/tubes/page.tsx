import type { Metadata } from "next";
import Link from "next/link";

import { EnglishPublicSubpage } from "@/components/english-public-subpage";
import { EnglishTubeWeightCalculator } from "@/components/english-tube-weight-calculator";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Steel Tube Weight Calculator — CHS, SHS, RHS | EN 10210 & EN 10219",
  description:
    "Calculate theoretical steel tube weight in kg/m, mass per bar and tonnes. Free English calculator for CHS, SHS and RHS under EN 10210 or EN 10219, plus geometric mode.",
  alternates: {
    canonical: absoluteUrl("/en/knowledge/tubes"),
    languages: {
      it: absoluteUrl("/knowledge/tubes"),
      en: absoluteUrl("/en/knowledge/tubes"),
    },
  },
  openGraph: {
    title: "Steel Tube Weight Calculator · Smart Steel Sales",
    description: "Free English steel tube weight calculator for EN 10210 and EN 10219 structural hollow sections.",
    url: absoluteUrl("/en/knowledge/tubes"),
    locale: "en_GB",
    type: "website",
  },
};

const faqs = [
  {
    question: "How do you calculate the weight of a round steel tube?",
    answer: "The theoretical cross-sectional area in mm² is π × t × (D − t), where D is the outside diameter and t is wall thickness. Multiply that area by steel density (7,850 kg/m³ by default) and divide by 1,000,000 to obtain kg/m.",
  },
  {
    question: "Why can EN 10210 and EN 10219 give different SHS or RHS weights?",
    answer: "The calculation uses different nominal outer and inner corner radii for cold-formed and hot-finished structural hollow sections. These change the nominal section area, so estimated kg/m may differ for the same outside dimensions.",
  },
  {
    question: "Can I use different steel density?",
    answer: "Yes, in free geometric mode. Normative calculation mode uses the nominal steel density of 7,850 kg/m³ and its applicable corner geometry.",
  },
];

export default function EnglishTubeWeightsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Smart Steel Sales Steel Tube Weight Calculator",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "en",
        isAccessibleForFree: true,
        url: absoluteUrl("/en/knowledge/tubes"),
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };

  return (
    <EnglishPublicSubpage
      eyebrow="Free technical tool · Steel Knowledge"
      title="Steel tube weight calculator: kg/m, bar weight and tonnes."
      description="Estimate structural hollow section masses for circular (CHS), square (SHS) and rectangular (RHS) steel tubes. Select EN 10219, EN 10210 or the geometric method. The result updates immediately as you enter dimensions."
      italianHref="/knowledge/tubes"
      englishHref="/en/knowledge/tubes"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8">
        <EnglishTubeWeightCalculator />
      </div>
      <section className="bg-white">
        <div className="mx-auto max-w-[1120px] px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-[#123b34]">Calculating hollow section mass</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#52615b]">
            For CHS, the calculation uses the area of an annulus. For SHS and RHS under EN 10210 or EN 10219,
            it also accounts for nominal corner radii. Total theoretical tonnage equals weight per metre × bar length × bar count ÷ 1,000.
            These are estimates, not certified published weights or a product conformity assessment.
          </p>
          <dl className="mt-7 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[#dce5e0] p-5"><dt className="font-bold text-[#123b34]">CHS — Circular</dt><dd className="mt-2 text-sm leading-6 text-[#52615b]">Enter outside diameter and wall thickness in millimetres.</dd></div>
            <div className="rounded-xl border border-[#dce5e0] p-5"><dt className="font-bold text-[#123b34]">SHS — Square</dt><dd className="mt-2 text-sm leading-6 text-[#52615b]">Enter the outside side dimension and thickness.</dd></div>
            <div className="rounded-xl border border-[#dce5e0] p-5"><dt className="font-bold text-[#123b34]">RHS — Rectangular</dt><dd className="mt-2 text-sm leading-6 text-[#52615b]">Enter outside width, outside height and thickness.</dd></div>
          </dl>
          <div className="mt-9 space-y-5">
            {faqs.map((faq) => (
              <section key={faq.question}>
                <h3 className="font-bold text-[#123b34]">{faq.question}</h3>
                <p className="mt-2 text-sm leading-7 text-[#52615b]">{faq.answer}</p>
              </section>
            ))}
          </div>
          <Link href="/en/distinta" className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-[#123b34] px-5 text-sm font-bold text-white hover:bg-[#1f6b5a]">
            Prepare an RFQ bill of materials →
          </Link>
        </div>
      </section>
    </EnglishPublicSubpage>
  );
}

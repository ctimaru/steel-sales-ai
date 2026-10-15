import type { Metadata } from "next";
import Link from "next/link";

import { EnglishPublicSubpage } from "@/components/english-public-subpage";
import { CalculatorRegionSwitch } from "@/components/calculator-region-switch";
import { CALCULATOR_STANDARDS } from "@/lib/calculator-standards-registry";
import { absoluteUrl } from "@/lib/site";

const path = "/en/knowledge/tubes/american-pipe";
const other = "/knowledge/tubes/tubi-americani";

export const metadata: Metadata = {
  title: "US Steel Pipe Weight Calculator — API 5L, NPS & Schedule",
  description: "Explore a sourced NPS/Schedule manufacturer sample and calculate theoretical steel pipe kg/m, lb/ft and bar weight. Understand API 5L vs ASME B36.10 vs ASTM A53/A106.",
  alternates: {
    canonical: absoluteUrl(path),
    languages: { it: absoluteUrl(other), en: absoluteUrl(path) },
  },
  openGraph: {
    title: "US Pipe Weight: NPS, Schedule, API 5L · Smart Steel Sales",
    description: "Sourced U.S. Steel pipe dimensions and theoretical weights, with clear product-standard caveats.",
    locale: "en_US", type: "website", url: absoluteUrl(path),
  },
};

export default function AmericanPipeMassPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "US Steel Pipe NPS/Schedule Sample Weight Calculator",
    applicationCategory: "EngineeringApplication",
    operatingSystem: "Web", isAccessibleForFree: true, inLanguage: "en",
    url: absoluteUrl(path),
    description: "Theoretical pipe weight using nominal dimensions from a limited manufacturer sample; not a complete ASME table or compliance check.",
  };
  const selected = CALCULATOR_STANDARDS.filter(x =>
    ["api5l","asme-b3610","astm-a53","astm-a106","astm-a500"].includes(x.id));
  return (
    <EnglishPublicSubpage
      eyebrow="International steel knowledge · US pipe"
      title="US steel pipe weight: NPS, Schedule, API 5L and ASTM context."
      description="Find a manufacturer-reported NPS/Schedule dimension, calculate its geometric mass in kg/m and lb/ft, and understand which standards address dimensions versus product requirements. This limited sample is not an ASME schedule table."
      italianHref={other} englishHref={path}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd)}}/>
      <div className="mx-auto max-w-[1120px] space-y-8 px-4 py-10 sm:px-6">
        <CalculatorRegionSwitch locale="en" initialRegion="us" references={[]} />
        <section className="rounded-2xl border border-[#dce5e0] bg-white p-5 sm:p-7">
          <h2 className="text-xl font-bold text-[#123b34]">API, ASME and ASTM are not interchangeable</h2>
          <p className="mt-3 text-sm leading-7 text-[#52615b]">
            API Spec 5L sets product requirements for line pipe. Its 47th edition was published in June 2026.
            ASME B36.10 addresses dimensional designations for welded and seamless wrought steel pipe.
            ASTM A53 and ASTM A106 describe different product applications. Selecting any one does not by itself
            establish a certified weight, material grade, manufacturing process or suitability for service.
          </p>
          <p className="mt-3 text-sm leading-7 text-[#52615b]">
            For structural HSS (square and rectangular sections), ASTM A500 has its own product context.
            Do not apply the EN 10219 corner radii as a surrogate ASTM rule. For European structural
            hollow sections, use the existing <Link href="/en/knowledge/tubes" className="font-bold text-[#156449] underline">
              EN 10219 / EN 10210 steel tube calculator
            </Link>.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {selected.map(item=>(
              <div key={item.id} className="rounded-xl border border-[#dce5e0] p-4">
                <h3 className="text-sm font-bold text-[#123b34]">{item.title}</h3>
                <p className="mt-2 text-xs leading-6 text-[#52615b]">{item.noteEn}</p>
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs font-bold text-[#156449] underline">Standards organization →</a>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-[#dce5e0] bg-white p-6">
          <h2 className="text-xl font-bold text-[#123b34]">How the theoretical weight is calculated</h2>
          <p className="mt-3 text-sm leading-7 text-[#52615b]">
            For an ordinary round pipe using the manufacturer sample outside diameter D and nominal thickness t,
            sectional area is π × t × (D − t) mm². Multiply by the illustrative carbon-steel density
            7,850 kg/m³ and divide by 1,000,000 to get theoretical kg/m. Multiply by 0.671968975
            to obtain lb/ft. The listed U.S. Steel published weight is displayed separately, and
            can differ because of rounding and catalog conventions.
          </p>
          <p className="mt-3 text-sm leading-7 text-[#52615b]">
            The source sample covers selected NPS 2, 2½, 3, 4, 6, 8, 10 and 12 combinations only.
            It does not establish complete NPS-to-OD or Schedule-to-wall correspondences;
            do not extrapolate to sizes absent from the sample.
          </p>
        </section>
      </div>
    </EnglishPublicSubpage>
  );
}

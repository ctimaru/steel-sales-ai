import type { Metadata } from "next";
import Link from "next/link";

import { EnglishPublicSubpage } from "@/components/english-public-subpage";
import { EnglishRfqBillBuilder } from "@/components/english-rfq-bill-builder";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Free Steel RFQ Bill of Materials Builder — Smart Steel Sales",
  description:
    "Create an English steel tube RFQ bill of materials with mixed EN 10210 / EN 10219 items, grades, quantities, theoretical tonnes and optional target prices. Copy a supplier-ready email.",
  alternates: {
    canonical: absoluteUrl("/en/distinta"),
    languages: {
      it: absoluteUrl("/distinta"),
      en: absoluteUrl("/en/distinta"),
    },
  },
  openGraph: {
    title: "Free Steel RFQ Bill of Materials · Smart Steel Sales",
    description: "Build and copy a multi-item steel tube RFQ, without an account.",
    url: absoluteUrl("/en/distinta"),
    type: "website",
    locale: "en_GB",
  },
};

export default function EnglishRfqBuilderPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Smart Steel Sales RFQ Bill of Materials Builder",
    url: absoluteUrl("/en/distinta"),
    inLanguage: "en",
    isAccessibleForFree: true,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
  };
  return (
    <EnglishPublicSubpage
      eyebrow="Free public buyer tool"
      title="Create a steel RFQ bill of materials in English."
      description="Prepare one clear enquiry for multiple suppliers. Mix CHS, SHS and RHS items, including EN 10210 and EN 10219, with quantities, material grades, indicative weights and optional price targets."
      italianHref="/distinta"
      englishHref="/en/distinta"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8">
        <EnglishRfqBillBuilder />
      </div>
      <section className="bg-white">
        <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-[#123b34]">From specification to supplier enquiry</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#52615b]">
            Consistent line items make quotations easier to compare. Verify grade designations, delivery tolerances,
            documentation requirements, bar lengths and freight terms before awarding an order.
            The free English tool copies an email; it does not dispatch requests or create orders.
          </p>
          <Link href="/en/knowledge/tubes" className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-[#1f6b5a] underline underline-offset-4">
            Open the English tube weight calculator →
          </Link>
        </div>
      </section>
    </EnglishPublicSubpage>
  );
}

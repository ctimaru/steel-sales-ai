import type { Metadata } from "next";
import Link from "next/link";

import { EnglishPublicSubpage } from "@/components/english-public-subpage";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Steel Industry Network — Producers, Distributors and Buyers",
  description:
    "Explore the Smart Steel Sales B2B network model for steel producers, distributors, processors and industrial buyers.",
  alternates: { canonical: absoluteUrl("/en/network") },
  openGraph: {
    title: "Steel Industry Network — Smart Steel Sales",
    description:
      "A governed B2B network connecting the steel and tube supply chain.",
    url: absoluteUrl("/en/network"),
    type: "website",
    locale: "en_US",
  },
};

const types = [
  {
    name: "Producers",
    description: "Steel manufacturers and mills supplying semi-finished or finished steel and tubular products.",
  },
  {
    name: "Distributors",
    description: "Traders, steel service businesses, stockholders and wholesalers serving local and international demand.",
  },
  {
    name: "Processors",
    description: "Fabricators, subcontractors, cut-to-length specialists and industrial processing partners.",
  },
  {
    name: "Industrial buyers",
    description: "OEMs, manufacturers and projects specifying and purchasing steel products for their operations.",
  },
] as const;

export default function EnglishNetworkPage() {
  return (
    <EnglishPublicSubpage
      eyebrow="Steel industry network"
      title="Connect the people who produce, trade, process and use steel."
      description="Smart Steel Sales is building a governed company network alongside its purchasing and commercial workflows. Each organization has its own identity and controlled access to private information."
      italianHref="/#network"
      englishHref="/en/network"
    >
      <section aria-label="Network company types" className="bg-white">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-[#123b34]">Four company categories, one supply chain.</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {types.map((type) => (
              <article key={type.name} className="rounded-2xl border border-[#dce5e0] bg-[#f8faf8] p-6">
                <h3 className="text-lg font-semibold text-[#123b34]">{type.name}</h3>
                <p className="mt-2 text-sm leading-7 text-[#52615b]">{type.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-[#f2f4f3]">
        <div className="mx-auto max-w-[1120px] px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-[#123b34]">Public discovery, private business information.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#52615b]">
            The public company lookup helps identify organizations and determine whether a profile can be claimed. Contacts, quotations, orders and private commercial records are not published through the directory.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#52615b]">
            Company registration requires review before private workspace activation. The registration and company lookup interfaces are currently in Italian.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/register" hrefLang="it" className="platform-primary inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-bold">Register company (IT) →</Link>
            <Link href="/azienda" hrefLang="it" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#b9c9c2] bg-white px-5 text-sm font-bold text-[#123b34]">Find a company (IT)</Link>
          </div>
        </div>
      </section>
    </EnglishPublicSubpage>
  );
}

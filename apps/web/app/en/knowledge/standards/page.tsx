import type { Metadata } from "next";
import Link from "next/link";

import { EnglishPublicSubpage } from "@/components/english-public-subpage";
import { englishKnowledgeSearch, englishStandards } from "@/lib/international-steel-knowledge";
import { listPublicStandards } from "@/lib/public-knowledge";
import { robotsForParameterizedPage } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

const copy = {
  title: "Steel Tube Standards: EN 10210, EN 10219 & Pressure Pipes",
  description: "Original English guides to EN steel tube standards: structural hollow sections, welded and seamless pressure tubes, and water pipelines. Compare scope and supply requirements.",
};
const canonical = "/en/knowledge/standards";

const baseMetadata: Metadata = {
  title: copy.title,
  description: copy.description,
  alternates: {
    canonical: absoluteUrl(canonical),
    languages: { it: absoluteUrl("/knowledge/norme"), en: absoluteUrl(canonical) },
  },
  openGraph: {
    title: copy.title,
    description: copy.description,
    url: absoluteUrl(canonical),
    locale: "en_GB",
    type: "website",
  },
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q } = await searchParams;
  return { ...baseMetadata, robots: robotsForParameterizedPage(Boolean(q?.trim())) };
}

const groups = [
  { key: "structural", name: "Structural hollow sections", intro: "Product families used in structural frames and steelwork." },
  { key: "pressure", name: "Pressure-service tubes", intro: "Distinguish manufacture and required temperature properties." },
  { key: "water", name: "Water and aqueous liquids", intro: "Product scope for conveying water and related liquids." },
] as const;

export default async function EnglishStandardsIndex({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim().slice(0,120) ?? "";
  const published = await listPublicStandards();
  const publishedBySlug = new Map(published.map((item) => [item.slug, item]));
  const visible = englishStandards.filter((item) =>
    publishedBySlug.has(item.slug) &&
    englishKnowledgeSearch(query, `${item.code} ${item.title} ${item.summary}`)
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: copy.title,
    inLanguage: "en",
    url: absoluteUrl(canonical),
    description: copy.description,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: visible.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `${item.code} — ${item.title}`,
        url: absoluteUrl(`${canonical}/${item.slug}`),
      })),
    },
  };

  return (
    <EnglishPublicSubpage
      eyebrow="Steel Knowledge · Published standards"
      title="Steel tube standards, explained in English."
      description="Explore the scope of European steel tube standards, understand the difference between structural and pressure applications, and prepare clearer technical enquiries. These are concise editorial guides, not reproductions of official standards."
      italianHref="/knowledge/norme"
      englishHref={canonical}
    >
      {!query ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <div className="mx-auto max-w-[1120px] space-y-9 px-4 py-12 sm:px-6 lg:px-8">
        <form action={canonical} method="get" role="search" className="flex max-w-2xl flex-col gap-3 rounded-2xl border border-[#dce5e0] bg-white p-5 sm:flex-row sm:items-end">
          <label htmlFor="standards-en-search" className="flex-1 text-xs font-bold text-[#123b34]">
            Search by code or product family
            <input id="standards-en-search" name="q" defaultValue={query} placeholder="e.g. EN 10219, welded, pressure…" className="mt-2 block min-h-11 w-full rounded-lg border border-[#bbcfc5] px-3 text-base" />
          </label>
          <button type="submit" className="min-h-11 rounded-xl bg-[#123b34] px-6 text-sm font-bold text-white">Search standards</button>
          {query ? <Link href={canonical} className="inline-flex min-h-11 items-center text-sm font-bold text-[#1f6b5a]">Clear</Link> : null}
        </form>
        {visible.length ? groups.map((group) => {
          const items = visible.filter((item) => item.group === group.key);
          if (!items.length) return null;
          return (
            <section key={group.key}>
              <h2 className="text-2xl font-semibold text-[#123b34]">{group.name}</h2>
              <p className="mt-2 text-sm leading-6 text-[#52615b]">{group.intro}</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {items.map((item) => (
                  <Link key={item.slug} href={`${canonical}/${item.slug}`} className="rounded-2xl border border-[#dce5e0] bg-white p-5 transition hover:border-[#7fb3a0] hover:shadow-sm">
                    <p className="text-xs font-bold tracking-wide text-[#1f6b5a]">{item.code}</p>
                    <h3 className="mt-2 text-lg font-bold text-[#123b34]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#52615b]">{item.summary}</p>
                    <p className="mt-4 text-xs font-bold text-[#1f6b5a]">Read standard guide →</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        }) : (
          <section className="rounded-2xl border border-[#dce5e0] bg-white p-6" aria-live="polite">
            <h2 className="font-bold text-[#123b34]">No published English standard guide found</h2>
            <p className="mt-2 text-sm text-[#52615b]">Try a different term. Only currently published and reviewed source records appear here.</p>
          </section>
        )}
        <aside className="rounded-xl bg-[#e6f3ed] p-5 text-sm leading-7 text-[#123b34]">
          <strong>Technical note:</strong> Editions, requirements and legal applicability must be verified against the official standard and project documentation. An EN product family and a steel grade are different identifiers.
        </aside>
        <div className="flex flex-wrap gap-5 text-sm font-bold text-[#1f6b5a]">
          <Link href="/en/knowledge/grades" className="underline underline-offset-4">Explore steel grades →</Link>
          <Link href="/en/knowledge/tubes" className="underline underline-offset-4">Calculate theoretical tube weight →</Link>
        </div>
      </div>
    </EnglishPublicSubpage>
  );
}

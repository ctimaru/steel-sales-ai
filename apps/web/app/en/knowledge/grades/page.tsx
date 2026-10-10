import type { Metadata } from "next";
import Link from "next/link";

import { EnglishPublicSubpage } from "@/components/english-public-subpage";
import { englishGrades, englishKnowledgeSearch } from "@/lib/international-steel-knowledge";
import { listPublicGrades } from "@/lib/public-knowledge";
import { robotsForParameterizedPage } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

const canonical = "/en/knowledge/grades";
const title = "Steel Grades for Tubes: S355, P265GH, 16Mo3 & TR Series";
const description = "English guide to structural hollow-section and pressure-tube steel grades. Learn to distinguish S355J2H, S355NH, P235GH, P265GH, 16Mo3 and TR1/TR2 materials.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: absoluteUrl(canonical),
    languages: { it: absoluteUrl("/knowledge/gradi"), en: absoluteUrl(canonical) },
  },
  openGraph: {
    title,
    description,
    url: absoluteUrl(canonical),
    type: "website",
    locale: "en_GB",
  },
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q } = await searchParams;
  return { ...metadata, robots: robotsForParameterizedPage(Boolean(q?.trim())) };
}

const groups = [
  { key: "structural", name: "Structural hollow-section grades", intro: "Materials encountered in structural CHS, SHS and RHS products." },
  { key: "pressure-high", name: "Pressure steels for elevated-temperature service", intro: "Grades used in applicable seamless and welded pressure-tube product specifications." },
  { key: "pressure-room", name: "Pressure-tube grades for room-temperature service", intro: "Separate material grades from their TR1 and TR2 quality designations." },
] as const;

export default async function EnglishGradesIndex({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim().slice(0,120) ?? "";
  const published = await listPublicGrades();
  const publishedBySlug = new Map(published.map((item) => [item.slug, item]));
  const visible = englishGrades.filter((item) =>
    publishedBySlug.has(item.slug) &&
    englishKnowledgeSearch(query, `${item.designation} ${item.title} ${item.summary} ${publishedBySlug.get(item.slug)?.material_number ?? ""}`)
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    inLanguage: "en",
    url: absoluteUrl(canonical),
    description,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: visible.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `${item.designation} — ${item.title}`,
        url: absoluteUrl(`${canonical}/${item.slug}`),
      })),
    },
  };
  return (
    <EnglishPublicSubpage
      eyebrow="Steel Knowledge · Published grades"
      title="Understand steel grade designations before you buy."
      description="Learn what common structural and pressure-tube steel grades mean, how their specifications differ and why a grade alone never proves interchangeability or product compliance."
      italianHref="/knowledge/gradi"
      englishHref={canonical}
    >
      {!query ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <div className="mx-auto max-w-[1120px] space-y-9 px-4 py-12 sm:px-6 lg:px-8">
        <form action={canonical} method="get" role="search" className="flex max-w-2xl flex-col gap-3 rounded-2xl border border-[#dce5e0] bg-white p-5 sm:flex-row sm:items-end">
          <label htmlFor="grades-en-search" className="flex-1 text-xs font-bold text-[#123b34]">
            Search a grade or material number
            <input id="grades-en-search" name="q" defaultValue={query} placeholder="e.g. P265GH, S355J2H, 1.0425…" className="mt-2 block min-h-11 w-full rounded-lg border border-[#bbcfc5] px-3 text-base" />
          </label>
          <button type="submit" className="min-h-11 rounded-xl bg-[#123b34] px-6 text-sm font-bold text-white">Search grades</button>
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
                    <p className="text-xs font-bold tracking-wide text-[#1f6b5a]">{item.designation}{publishedBySlug.get(item.slug)?.material_number ? ` · ${publishedBySlug.get(item.slug)?.material_number}` : ""}</p>
                    <h3 className="mt-2 text-lg font-bold text-[#123b34]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#52615b]">{item.summary}</p>
                    <p className="mt-4 text-xs font-bold text-[#1f6b5a]">Read material guide →</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        }) : (
          <section className="rounded-2xl border border-[#dce5e0] bg-white p-6" aria-live="polite">
            <h2 className="font-bold text-[#123b34]">No published English grade guide found</h2>
            <p className="mt-2 text-sm text-[#52615b]">Try another designation. Unpublished materials are intentionally excluded.</p>
          </section>
        )}
        <aside className="rounded-xl bg-[#e6f3ed] p-5 text-sm leading-7 text-[#123b34]">
          <strong>No automatic equivalences:</strong> Similar grade names, shared nominal strength classes and observed supplier ranges do not establish normative equivalence, availability or suitability for a specific project.
        </aside>
        <div className="flex flex-wrap gap-5 text-sm font-bold text-[#1f6b5a]">
          <Link href="/en/knowledge/standards" className="underline underline-offset-4">Explore steel standards →</Link>
          <Link href="/en/distinta" className="underline underline-offset-4">Create an RFQ bill →</Link>
        </div>
      </div>
    </EnglishPublicSubpage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { EnglishPublicSubpage } from "@/components/english-public-subpage";
import {
  englishGrades,
  englishStandardForSlug,
} from "@/lib/international-steel-knowledge";
import { getPublicStandard, listPublicGrades } from "@/lib/public-knowledge";
import { absoluteUrl } from "@/lib/site";

const readPublishedStandard = cache(getPublicStandard);

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const copy = englishStandardForSlug(slug);
  const published = copy ? await readPublishedStandard(slug) : null;
  if (!copy || !published) {
    return { title: "English steel standard guide unavailable", robots: { index: false, follow: false } };
  }

  const path = `/en/knowledge/standards/${copy.slug}`;
  return {
    title: `${copy.code}: ${copy.title}`,
    description: copy.summary,
    alternates: {
      canonical: absoluteUrl(path),
      languages: {
        it: absoluteUrl(`/knowledge/norme/${copy.slug}`),
        en: absoluteUrl(path),
      },
    },
    openGraph: {
      title: `${copy.code}: ${copy.title}`,
      description: copy.summary,
      type: "article",
      url: absoluteUrl(path),
      locale: "en_GB",
      publishedTime: published.published_at,
      modifiedTime: `${published.last_reviewed_at}T00:00:00Z`,
    },
  };
}

export default async function EnglishStandardDetail({ params }: PageProps) {
  const { slug } = await params;
  const copy = englishStandardForSlug(slug);
  if (!copy) notFound();

  // K2 returns only live published records: no unapproved material is exposed.
  const published = await readPublishedStandard(slug);
  if (!published) notFound();

  const publishedGrades = await listPublicGrades();
  const availableSlugs = new Set(publishedGrades.map((item) => item.slug));
  const relatedGrades = englishGrades.filter((item) =>
    copy.relatedGrades.includes(item.slug) && availableSlugs.has(item.slug)
  );
  const path = `/en/knowledge/standards/${copy.slug}`;
  const sourceLinks = published.source_references.filter((source) => /^https:\/\//i.test(source.url));
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: `${copy.code}: ${copy.title}`,
        description: copy.summary,
        inLanguage: "en",
        datePublished: published.published_at,
        dateModified: published.last_reviewed_at,
        mainEntityOfPage: absoluteUrl(path),
        author: { "@type": "Organization", name: "Smart Steel Sales" },
        citation: sourceLinks.map((source) => source.url),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Steel Knowledge", item: absoluteUrl("/en/knowledge") },
          { "@type": "ListItem", position: 2, name: "Steel standards", item: absoluteUrl("/en/knowledge/standards") },
          { "@type": "ListItem", position: 3, name: copy.code, item: absoluteUrl(path) },
        ],
      },
    ],
  };

  return (
    <EnglishPublicSubpage
      eyebrow="Steel Knowledge · Standards"
      title={`${copy.code}: ${copy.title}`}
      description={copy.summary}
      italianHref={`/knowledge/norme/${copy.slug}`}
      englishHref={path}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-[1120px] space-y-8 px-4 py-12 sm:px-6 lg:px-8">
        <nav aria-label="Knowledge breadcrumbs" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#1f6b5a]">
          <Link href="/en/knowledge">Knowledge</Link><span aria-hidden="true">/</span>
          <Link href="/en/knowledge/standards">Standards</Link><span aria-hidden="true">/</span>
          <span className="text-[#52615b]">{copy.code}</span>
        </nav>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
          <article className="space-y-7 rounded-2xl border border-[#dce5e0] bg-white p-6 sm:p-8">
            <section>
              <h2 className="text-xl font-bold text-[#123b34]">What does {copy.code} cover?</h2>
              <p className="mt-3 text-sm leading-7 text-[#52615b]">{copy.covers}</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-[#123b34]">How to specify it in a steel RFQ</h2>
              <p className="mt-3 text-sm leading-7 text-[#52615b]">{copy.procurement}</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-[#123b34]">Important distinctions</h2>
              <p className="mt-3 text-sm leading-7 text-[#52615b]">{copy.distinction}</p>
            </section>
          </article>
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#dce5e0] bg-white p-5">
              <h2 className="text-base font-bold text-[#123b34]">Editorial status</h2>
              <dl className="mt-3 space-y-2 text-xs leading-6 text-[#52615b]">
                <div><dt className="font-semibold">Public record</dt><dd>{published.code}</dd></div>
                <div><dt className="font-semibold">Source record last reviewed</dt><dd>{published.last_reviewed_at}</dd></div>
              </dl>
              <p className="mt-3 text-xs leading-5 text-[#718078]">English explanatory content is limited to this curated guide; the official standard controls technical conformity.</p>
            </div>
            <Link href="/en/distinta" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#123b34] px-4 text-center text-sm font-bold text-white">Create an RFQ bill →</Link>
            <Link href="/en/knowledge/tubes" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#b9c9c2] bg-white px-4 text-center text-sm font-bold text-[#123b34]">Calculate tube mass →</Link>
          </aside>
        </div>
        {relatedGrades.length ? (
          <section aria-label="Related steel grade guides">
            <h2 className="text-xl font-bold text-[#123b34]">Related steel grades for further research</h2>
            <p className="mt-2 text-sm leading-6 text-[#52615b]">Discovery links only. Product compatibility and compliance must be checked for each order.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {relatedGrades.map((grade) => (
                <Link key={grade.slug} href={`/en/knowledge/grades/${grade.slug}`} className="rounded-xl border border-[#dce5e0] bg-white p-4 text-sm font-semibold text-[#123b34] hover:border-[#8bb6a7]">{grade.designation} — {grade.title} →</Link>
              ))}
            </div>
          </section>
        ) : null}
        {sourceLinks.length ? (
          <section aria-label="Technical source references" className="rounded-2xl border border-[#dce5e0] bg-white p-6">
            <h2 className="text-xl font-bold text-[#123b34]">Official and technical references</h2>
            <p className="mt-2 text-sm leading-6 text-[#52615b]">Check the current edition and full requirements with the issuing body or publisher before purchase.</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6">
              {sourceLinks.map((source, index) => (
                <li key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1f6b5a] underline underline-offset-4">{source.label} ↗</a></li>
              ))}
            </ul>
          </section>
        ) : null}
        <Link href="/en/knowledge/standards" className="inline-flex min-h-11 items-center text-sm font-bold text-[#1f6b5a] underline underline-offset-4">← All English steel standard guides</Link>
      </div>
    </EnglishPublicSubpage>
  );
}

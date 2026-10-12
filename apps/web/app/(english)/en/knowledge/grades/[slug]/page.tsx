import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { EnglishPublicSubpage } from "@/components/english-public-subpage";
import {
  englishGradeForSlug,
  englishStandards,
} from "@/lib/international-steel-knowledge";
import { getPublicGrade, listPublicStandards } from "@/lib/public-knowledge";
import { absoluteUrl } from "@/lib/site";

const readPublishedGrade = cache(getPublicGrade);

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const copy = englishGradeForSlug(slug);
  const published = copy ? await readPublishedGrade(slug) : null;
  if (!copy || !published) {
    return { title: "English steel grade guide unavailable", robots: { index: false, follow: false } };
  }
  const path = `/en/knowledge/grades/${copy.slug}`;
  return {
    title: `${copy.designation}: ${copy.title}`,
    description: copy.summary,
    alternates: {
      canonical: absoluteUrl(path),
      languages: {
        it: absoluteUrl(`/knowledge/gradi/${copy.slug}`),
        en: absoluteUrl(path),
      },
    },
    openGraph: {
      title: `${copy.designation}: ${copy.title}`,
      description: copy.summary,
      url: absoluteUrl(path),
      type: "article",
      locale: "en_GB",
      publishedTime: published.published_at,
      modifiedTime: `${published.last_reviewed_at}T00:00:00Z`,
    },
  };
}

export default async function EnglishGradeDetail({ params }: PageProps) {
  const { slug } = await params;
  const copy = englishGradeForSlug(slug);
  if (!copy) notFound();

  const published = await readPublishedGrade(slug);
  if (!published) notFound();
  const publishedStandards = await listPublicStandards();
  const availableSlugs = new Set(publishedStandards.map((item) => item.slug));
  const relatedStandards = englishStandards.filter((item) =>
    copy.relatedStandards.includes(item.slug) && availableSlugs.has(item.slug)
  );
  const path = `/en/knowledge/grades/${copy.slug}`;
  const sourceLinks = published.source_references.filter((source) => /^https:\/\//i.test(source.url));
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: `${copy.designation}: ${copy.title}`,
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
          { "@type": "ListItem", position: 2, name: "Steel grades", item: absoluteUrl("/en/knowledge/grades") },
          { "@type": "ListItem", position: 3, name: copy.designation, item: absoluteUrl(path) },
        ],
      },
    ],
  };
  return (
    <EnglishPublicSubpage
      eyebrow="Steel Knowledge · Material grades"
      title={`${copy.designation}: ${copy.title}`}
      description={copy.summary}
      italianHref={`/knowledge/gradi/${copy.slug}`}
      englishHref={path}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-[1120px] space-y-8 px-4 py-12 sm:px-6 lg:px-8">
        <nav aria-label="Knowledge breadcrumbs" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#1f6b5a]">
          <Link href="/en/knowledge">Knowledge</Link><span aria-hidden="true">/</span>
          <Link href="/en/knowledge/grades">Grades</Link><span aria-hidden="true">/</span>
          <span className="text-[#52615b]">{copy.designation}</span>
        </nav>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
          <article className="space-y-7 rounded-2xl border border-[#dce5e0] bg-white p-6 sm:p-8">
            <section>
              <h2 className="text-xl font-bold text-[#123b34]">Understanding the designation</h2>
              <p className="mt-3 text-sm leading-7 text-[#52615b]">{copy.designationMeaning}</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-[#123b34]">Writing a reliable purchasing specification</h2>
              <p className="mt-3 text-sm leading-7 text-[#52615b]">{copy.procurement}</p>
            </section>
            <section>
              <h2 className="text-xl font-bold text-[#123b34]">Do similar grades mean the same thing?</h2>
              <p className="mt-3 text-sm leading-7 text-[#52615b]">{copy.difference}</p>
            </section>
          </article>
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#dce5e0] bg-white p-5">
              <h2 className="text-base font-bold text-[#123b34]">Published material record</h2>
              <dl className="mt-3 space-y-2 text-xs leading-6 text-[#52615b]">
                <div><dt className="font-semibold">Designation</dt><dd>{published.designation}</dd></div>
                {published.material_number ? <div><dt className="font-semibold">Material number</dt><dd>{published.material_number}</dd></div> : null}
                <div><dt className="font-semibold">Source record last reviewed</dt><dd>{published.last_reviewed_at}</dd></div>
              </dl>
              <p className="mt-3 text-xs leading-5 text-[#718078]">Product qualification requires the original standard and material certificate.</p>
            </div>
            <Link href="/en/distinta" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#123b34] px-4 text-center text-sm font-bold text-white">Prepare an RFQ bill →</Link>
          </aside>
        </div>
        {relatedStandards.length ? (
          <section aria-label="Related steel standard guides">
            <h2 className="text-xl font-bold text-[#123b34]">Product standards to investigate</h2>
            <p className="mt-2 text-sm leading-6 text-[#52615b]">Related catalogue context is not a certification statement. Validate process, edition, product scope and the supplier's actual offer.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {relatedStandards.map((standard) => (
                <Link key={standard.slug} href={`/en/knowledge/standards/${standard.slug}`} className="rounded-xl border border-[#dce5e0] bg-white p-4 text-sm font-semibold text-[#123b34] hover:border-[#8bb6a7]">{standard.code}: {standard.title} →</Link>
              ))}
            </div>
          </section>
        ) : null}
        {sourceLinks.length ? (
          <section aria-label="Technical source references" className="rounded-2xl border border-[#dce5e0] bg-white p-6">
            <h2 className="text-xl font-bold text-[#123b34]">Technical sources</h2>
            <p className="mt-2 text-sm leading-6 text-[#52615b]">These are references from the governed public source record, not a statement of equivalence or current certification.</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6">
              {sourceLinks.map((source, index) => (
                <li key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1f6b5a] underline underline-offset-4">{source.label} ↗</a></li>
              ))}
            </ul>
          </section>
        ) : null}
        <Link href="/en/knowledge/grades" className="inline-flex min-h-11 items-center text-sm font-bold text-[#1f6b5a] underline underline-offset-4">← All English steel grades</Link>
      </div>
    </EnglishPublicSubpage>
  );
}

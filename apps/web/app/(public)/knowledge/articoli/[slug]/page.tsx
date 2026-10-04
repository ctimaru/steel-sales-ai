import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SchoolHero } from "@/components/school-ui";
import { getSchoolArticle, schoolArticles } from "@/lib/school-articles";
import { absoluteUrl } from "@/lib/site";

export function generateStaticParams() {
  return schoolArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getSchoolArticle(slug);

  if (!article) {
    return {
      title: "Articolo non disponibile",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: article.title,
    description: article.description,
    alternates: {
      canonical: absoluteUrl(`/knowledge/articoli/${article.slug}`),
    },
    openGraph: {
      title: article.title,
      description: article.description,
      url: absoluteUrl(`/knowledge/articoli/${article.slug}`),
      type: "article",
      publishedTime: `${article.publishedAt}T00:00:00Z`,
      modifiedTime: `${article.lastReviewedAt}T00:00:00Z`,
    },
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default async function SchoolArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getSchoolArticle(slug);
  if (!article) notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.lastReviewedAt,
    mainEntityOfPage: absoluteUrl(`/knowledge/articoli/${article.slug}`),
    author: {
      "@type": "Organization",
      name: "Smart Steel Sales",
    },
    publisher: {
      "@type": "Organization",
      name: "Smart Steel Sales",
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Scuola",
        item: absoluteUrl("/knowledge"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Articoli",
        item: absoluteUrl("/knowledge/articoli"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: absoluteUrl(`/knowledge/articoli/${article.slug}`),
      },
    ],
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-xs font-semibold text-[#68736f]">
        <Link href="/knowledge" className="hover:text-[#173f35]">Scuola</Link>
        <span className="mx-2">/</span>
        <Link href="/knowledge/articoli" className="hover:text-[#173f35]">Articoli</Link>
        <span className="mx-2">/</span>
        <span>{article.category}</span>
      </nav>

      <SchoolHero
        eyebrow={article.category}
        title={article.title}
        description={<>{article.lead}</>}
        badges={[
          `${article.readMinutes} min di lettura`,
          `Rivisto ${formatDate(article.lastReviewedAt)}`,
        ]}
      />

      {article.timeline?.length ? (
        <section className="school-card p-6 sm:p-8" aria-labelledby="article-timeline">
          <p className="school-kicker">Timeline</p>
          <h2 id="article-timeline" className="mt-2 text-2xl font-semibold text-[#1d2824]">
            Le tappe essenziali
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {article.timeline.map((item) => (
              <div key={item.year + item.title} className="rounded-2xl border border-[#d9e8e2] bg-[#f7f9f8] p-5">
                <p className="text-sm font-extrabold text-[#173f35]">{item.year}</p>
                <h3 className="mt-1 font-semibold text-[#1d2824]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#5d6a65]">{item.text}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <article className="space-y-6">
        {article.sections.map((section) => (
          <section key={section.heading} className="school-card p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-[#1d2824]">
              {section.heading}
            </h2>
            <div className="mt-4 space-y-4">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-base leading-8 text-[#4f5e58]">
                  {paragraph}
                </p>
              ))}
            </div>
            {section.bullets?.length ? (
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {section.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="rounded-xl border border-[#d9e8e2] bg-[#f7f9f8] px-4 py-3 text-sm font-medium text-[#43524c]"
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </article>

      <section className="school-muted-card p-6 sm:p-8" aria-labelledby="article-sources">
        <p className="school-kicker">Fonti e revisione</p>
        <h2 id="article-sources" className="mt-2 text-2xl font-semibold text-[#1d2824]">
          Fonti consultate
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#5d6a65]">
          Ultima revisione editoriale: {formatDate(article.lastReviewedAt)}. Le fonti servono a
          verificare fatti storici, presenza industriale e dati dichiarati dai produttori.
        </p>
        <div className="mt-5 space-y-3">
          {article.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl border border-[#d7dfdb] bg-white p-4 transition hover:border-[#9fbfb3]"
            >
              <p className="font-semibold text-[#173f35]">{source.label} ↗</p>
              <p className="mt-1 text-sm leading-6 text-[#5d6a65]">{source.note}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="school-card grid gap-5 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="school-kicker">Continua nella Scuola</p>
          <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
            Passa dal contesto ai dati tecnici
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/knowledge/articoli" className="school-secondary-action">Altri articoli</Link>
          <Link href="/knowledge/norme" className="school-secondary-action">Norme</Link>
          <Link href="/knowledge/tubes" className="school-primary-action">Calcola pesi</Link>
        </div>
      </section>
    </div>
  );
}

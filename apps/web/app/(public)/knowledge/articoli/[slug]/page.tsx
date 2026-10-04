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
    citation: article.sources.map((source) => source.url),
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

      <nav aria-label="Breadcrumb" className="school-breadcrumb">
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

      {article.processFlows?.length ? (
        <section className="space-y-5" aria-labelledby="article-process-flows">
          <div className="school-card p-6 sm:p-8">
            <p className="school-kicker">Processi produttivi</p>
            <h2 id="article-process-flows" className="mt-2 text-2xl font-semibold text-[#1d2824]">
              Quattro route industriali da non confondere
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5d6a65]">
              Ogni schema mostra il flusso logico principale. La configurazione reale di una linea cambia per
              diametri, spessori, grado, norma e requisiti di collaudo.
            </p>
          </div>

          {article.processFlows.map((flow) => (
            <section key={flow.title} className="school-card p-6 sm:p-8">
              <h3 className="text-xl font-semibold text-[#1d2824]">{flow.title}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5d6a65]">{flow.subtitle}</p>
              <ol className="mt-6 grid gap-3 md:grid-cols-5">
                {flow.steps.map((step, index) => (
                  <li
                    key={step.title}
                    className="relative rounded-2xl border border-[#d9e8e2] bg-[#f7f9f8] p-4"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#123d34] text-xs font-extrabold text-white">
                      {index + 1}
                    </span>
                    <h4 className="mt-3 text-sm font-semibold text-[#1d2824]">{step.title}</h4>
                    <p className="mt-2 text-xs leading-5 text-[#5d6a65]">{step.text}</p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </section>
      ) : null}

      {article.comparison?.length ? (
        <section className="school-card p-6 sm:p-8" aria-labelledby="article-process-comparison">
          <p className="school-kicker">Confronto</p>
          <h2 id="article-process-comparison" className="mt-2 text-2xl font-semibold text-[#1d2824]">
            Saldato vs seamless: cosa cambia davvero
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5d6a65]">
            Il confronto serve a capire la route produttiva, non a stabilire una classifica assoluta di qualità.
            La conformità dipende dalla specifica tecnica applicabile.
          </p>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-[#dce2df]">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="school-table-head border-b border-[#dce2df] text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 font-semibold">Aspetto</th>
                  <th className="px-4 py-3 font-semibold">Saldato</th>
                  <th className="px-4 py-3 font-semibold">Seamless</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7ece9]">
                {article.comparison.map((row) => (
                  <tr key={row.label} className="school-table-row align-top">
                    <th className="px-4 py-4 font-semibold text-[#1d2824]">{row.label}</th>
                    <td className="px-4 py-4 leading-6 text-[#4f5e58]">{row.welded}</td>
                    <td className="px-4 py-4 leading-6 text-[#4f5e58]">{row.seamless}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {article.relatedLinks?.length ? (
        <section className="school-muted-card p-6 sm:p-8" aria-labelledby="article-related-links">
          <p className="school-kicker">Collega processo e norma</p>
          <h2 id="article-related-links" className="mt-2 text-2xl font-semibold text-[#1d2824]">
            Continua nelle schede tecniche della Scuola
          </h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {article.relatedLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-[#d7dfdb] bg-white p-4 transition hover:border-[#9fbfb3]"
              >
                <p className="font-semibold text-[#173f35]">{item.label} →</p>
                <p className="mt-1 text-sm leading-6 text-[#5d6a65]">{item.note}</p>
              </Link>
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
          verificare fatti storici, processi produttivi, presenza industriale e ambito delle norme richiamate.
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

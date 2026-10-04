import type { Metadata } from "next";
import Link from "next/link";

import { SchoolHero } from "@/components/school-ui";
import { schoolArticles } from "@/lib/school-articles";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Articoli su tubi, acciaio e industria",
  description:
    "Articoli originali della Scuola Smart Steel Sales su storia del tubo, processi produttivi, produttori europei e cultura tecnica del settore steel e tube.",
  alternates: {
    canonical: absoluteUrl("/knowledge/articoli"),
  },
  openGraph: {
    title: "Articoli · Scuola Smart Steel Sales",
    description:
      "Storia, tecnologia e industria del tubo raccontate con fonti verificabili e collegamenti agli strumenti tecnici della Scuola.",
    url: absoluteUrl("/knowledge/articoli"),
    type: "website",
  },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function SchoolArticlesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Articoli · Scuola Smart Steel Sales",
    url: absoluteUrl("/knowledge/articoli"),
    hasPart: schoolArticles.map((article) => ({
      "@type": "Article",
      headline: article.title,
      url: absoluteUrl(`/knowledge/articoli/${article.slug}`),
      datePublished: article.publishedAt,
      dateModified: article.lastReviewedAt,
    })),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-xs font-semibold text-[#68736f]">
        <Link href="/knowledge" className="hover:text-[#173f35]">Scuola</Link>
        <span className="mx-2">/</span>
        <span>Articoli</span>
      </nav>

      <SchoolHero
        eyebrow="Articoli"
        title="Capire il settore, non solo consultare tabelle"
        description={
          <>
            Storia del tubo, processi produttivi, geografia industriale e cultura tecnica.
            Ogni articolo indica fonti e data di revisione, e collega la lettura agli strumenti
            pratici della Scuola.
          </>
        }
        badges={["Pubblico", `${schoolArticles.length} articoli`]}
        compact
      />

      <section aria-labelledby="school-articles-list">
        <div className="max-w-3xl">
          <p className="school-kicker">Biblioteca editoriale</p>
          <h2 id="school-articles-list" className="mt-2 text-2xl font-semibold text-[#1d2824]">
            Parti dalle domande che fanno davvero capire il tubo
          </h2>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {schoolArticles.map((article) => (
            <Link
              key={article.slug}
              href={`/knowledge/articoli/${article.slug}`}
              className="group school-card flex h-full flex-col p-6 transition hover:-translate-y-0.5 hover:border-[#9fbfb3] hover:shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="school-eyebrow">{article.category}</span>
                <span className="text-xs font-semibold text-[#68736f]">
                  {article.readMinutes} min
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[#1d2824]">
                {article.title}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-7 text-[#5d6a65]">
                {article.description}
              </p>
              <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#e2e7e4] pt-4">
                <span className="text-xs text-[#68736f]">
                  Rivisto {formatDate(article.lastReviewedAt)}
                </span>
                <span className="text-sm font-bold text-[#173f35]">Leggi articolo →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="school-muted-card grid gap-5 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="school-kicker">Dalla lettura alla pratica</p>
          <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
            Hai bisogno di una norma, un grado o un peso?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5d6a65]">
            Gli articoli danno contesto. I cataloghi e il calcolatore servono invece per il lavoro tecnico quotidiano.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/knowledge/norme" className="school-secondary-action">Norme</Link>
          <Link href="/knowledge/gradi" className="school-secondary-action">Gradi</Link>
          <Link href="/knowledge/tubes" className="school-primary-action">Pesi &amp; dimensioni</Link>
        </div>
      </section>
    </div>
  );
}

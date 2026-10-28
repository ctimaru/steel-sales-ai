import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

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
    images: [{ url: absoluteUrl("/api/school-og"), width: 1200, height: 630, alt: "Scuola tecnica Smart Steel Sales" }],
  },
  twitter: { card: "summary_large_image", images: [absoluteUrl("/api/school-og")] },
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
    <div className="mx-auto max-w-[1180px] space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
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
        title="Dentro il mondo dei tubi."
        description={
          <>
            Storia del tubo, processi produttivi, geografia industriale e cultura tecnica.
            Ogni articolo indica fonti e data di revisione, e collega la lettura agli strumenti
            pratici della Scuola.
          </>
        }
        badges={["Pubblico", `${schoolArticles.length} articoli`]}
        compact
        editorial
        action={{ href: "#school-articles-list", label: "Esplora gli articoli" }}
        secondaryAction={{ href: "/knowledge/norme", label: "Consulta le norme" }}
      />

      <section aria-labelledby="school-articles-list">
        <div className="max-w-3xl">
          <p className="school-kicker">Biblioteca editoriale</p>
          <h2 id="school-articles-list" className="mt-2 text-2xl font-semibold text-[#1d2824]">
            Parti dalle domande che fanno davvero capire il tubo
          </h2>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {schoolArticles.map((article, index) => (
            <Link
              key={article.slug}
              href={`/knowledge/articoli/${article.slug}`}
              className={"group flex h-full flex-col overflow-hidden rounded-[20px] border border-[#d9e5dc] bg-white transition duration-200 hover:-translate-y-0.5 hover:border-[#93b7a1] hover:shadow-[0_16px_32px_-25px_#174b3c] motion-reduce:transform-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c] "+(index===0?"lg:col-span-2 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]":"")}
            >
              <Image src={article.visual.src} alt={article.visual.alt} width={1200} height={675}
                unoptimized sizes="(max-width: 1024px) 100vw, 50vw"
                className={"aspect-video h-auto w-full border-b border-[#dce9e1] object-cover "+(index===0?"lg:h-full lg:min-h-[300px] lg:border-b-0 lg:border-r lg:border-[#dce9e1]":"")} />
              <div className="flex flex-1 flex-col justify-center p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="school-eyebrow">{article.category}</span>
                <span className="text-xs font-semibold text-[#68736f]">
                  {article.readMinutes} min
                </span>
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-[#1d2824] sm:text-2xl">
                {article.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-[#52645a]">
                {article.description}
              </p>
              <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#e2e7e4] pt-4">
                <span className="text-xs text-[#68736f]">
                  Rivisto {formatDate(article.lastReviewedAt)}
                </span>
                <span className="text-sm font-bold text-[#173f35]">Leggi articolo →</span>
              </div>
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
          <Link href="/knowledge/tubes?source=school&surface=school_section#calcolatore-pesi" className="school-primary-action">Calcolatore pesi</Link>
          <Link href="/azienda" className="school-secondary-action">Trova azienda</Link>
        </div>
      </section>
    </div>
  );
}

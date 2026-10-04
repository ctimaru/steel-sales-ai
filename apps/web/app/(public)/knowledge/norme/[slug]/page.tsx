import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  applicationCategoryLabel,
  applicabilityLabel,
  manufacturingProcessLabel,
  productFamilyLabel,
} from "@/lib/knowledge-labels";
import { getPublicStandard } from "@/lib/public-knowledge";
import { absoluteUrl } from "@/lib/site";

const loadStandard = cache(getPublicStandard);

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const standard = await loadStandard(slug);

  if (!standard) {
    return {
      title: "Norma non disponibile",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: standard.seo_title.replace(/ · (?:Steel Knowledge|Scuola).*$/i, ""),
    description: standard.seo_description,
    alternates: {
      canonical: absoluteUrl(`/knowledge/norme/${standard.slug}`),
    },
    openGraph: {
      title: standard.seo_title.replace(/ · Steel Knowledge.*$/i, ""),
      description: standard.seo_description,
      url: absoluteUrl(`/knowledge/norme/${standard.slug}`),
      type: "article",
      publishedTime: standard.published_at,
      modifiedTime: `${standard.last_reviewed_at}T00:00:00Z`,
    },
  };
}

export default async function StandardDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const standard = await loadStandard(slug);
  if (!standard) notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: standard.seo_title.replace(/ · Steel Knowledge.*$/i, ""),
    description: standard.seo_description,
    datePublished: standard.published_at,
    dateModified: standard.last_reviewed_at,
    mainEntityOfPage: absoluteUrl(`/knowledge/norme/${standard.slug}`),
    author: {
      "@type": "Organization",
      name: "Smart Steel Sales",
    },
    citation: standard.source_references.map((source) => source.url),
  };

  const faqJsonLd = standard.faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: standard.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

      <nav aria-label="Breadcrumb" className="text-xs font-semibold text-[#7e8da1]">
        <Link href="/knowledge" className="hover:text-[#1a5144]">Scuola</Link>
        <span className="mx-2">/</span>
        <Link href="/knowledge/norme" className="hover:text-[#1a5144]">Norme</Link>
        <span className="mx-2">/</span>
        <span>{standard.code}</span>
      </nav>

      <article className="space-y-8">
        <header className="rounded-3xl border border-[#dce2df] bg-white p-6 shadow-[0_1px_2px_rgba(30,43,69,0.025),0_12px_36px_rgba(30,43,69,0.035)] sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              {standard.standard_system ?? "Norma tecnica"}
            </span>
            {standard.application_category ? (
              <span className="rounded-full bg-[#ecefed] px-3 py-1 text-[11px] font-semibold text-[#66736e]">
                {applicationCategoryLabel(standard.application_category)}
              </span>
            ) : null}
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              Revisione editoriale {formatReviewDate(standard.last_reviewed_at)}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1d2824] sm:text-5xl">
            {standard.seo_title.replace(/ · Steel Knowledge.*$/i, "")}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#66736e]">
            {standard.intro}
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {standard.issuing_body ? (
            <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
              <p className="text-xs font-semibold text-[#7e8da1]">Ente / riferimento</p>
              <p className="mt-1 text-sm font-semibold text-[#1d2824]">{standard.issuing_body.split(";")[0]}</p>
            </div>
          ) : null}
          {standard.edition && !standard.edition.includes("manufacturer-reference") ? (
            <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
              <p className="text-xs font-semibold text-[#7e8da1]">Edizione / stato</p>
              <p className="mt-1 text-sm font-semibold text-[#1d2824]">{standard.edition}</p>
            </div>
          ) : null}
          {standard.product_families.length ? (
            <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
              <p className="text-xs font-semibold text-[#7e8da1]">Famiglie prodotto</p>
              <p className="mt-1 text-sm font-semibold text-[#1d2824]">
                {standard.product_families.map(productFamilyLabel).join(", ")}
              </p>
            </div>
          ) : null}
          {standard.manufacturing_processes.length ? (
            <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
              <p className="text-xs font-semibold text-[#7e8da1]">Processi</p>
              <p className="mt-1 text-sm font-semibold text-[#1d2824]">
                {standard.manufacturing_processes.map(manufacturingProcessLabel).join(", ")}
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Cosa tratta</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">Ambito della {standard.code}</h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#66736e]">{standard.what_it_covers}</p>

          {standard.how_to_read ? (
            <>
              <h3 className="mt-7 text-lg font-semibold text-[#1d2824]">Come leggere questa norma</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[#66736e]">{standard.how_to_read}</p>
            </>
          ) : null}

          {standard.typical_applications ? (
            <>
              <h3 className="mt-7 text-lg font-semibold text-[#1d2824]">Applicazioni tipiche</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[#66736e]">
                {standard.typical_applications}
              </p>
            </>
          ) : null}
        </section>

        {standard.editorial_sections.map((section, index) => (
          <section key={section.heading + index} className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-[#1d2824]">{section.heading}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#66736e]">{section.body}</p>
          </section>
        ))}

        {standard.related_standard_pages.length ? (
          <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#66736e]">Norme correlate</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">Confronta il riferimento vicino</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {standard.related_standard_pages.map((related) => (
                <Link
                  key={related.slug}
                  href={`/knowledge/norme/${related.slug}`}
                  className="rounded-2xl border border-[#dce2df] bg-[#f6f8f7] p-4 transition hover:border-[#b8d2c8]"
                >
                  <p className="font-semibold text-[#1d2824]">{related.code}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#66736e]">{related.title}</p>
                  {related.application_category ? (
                    <p className="mt-3 text-xs font-semibold text-[#1a5144]">
                      {applicationCategoryLabel(related.application_category)}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {standard.related_grades.length ? (
          <section className="rounded-3xl border border-[#d9e8e2] bg-[#f6f8f7] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Gradi collegati</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">
              Materiali associati alla {standard.code}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Il tipo di relazione viene mostrato esplicitamente: una gamma produttore o fornitore non viene
              presentata come applicabilità normativa.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {standard.related_grades.map((grade) => {
                const content = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#1d2824]">{grade.designation}</p>
                        {grade.material_number ? (
                          <p className="mt-1 text-xs text-[#7e8da1]">Materiale {grade.material_number}</p>
                        ) : null}
                      </div>
                      <span className={grade.is_normative
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700"
                        : "rounded-full bg-[#ecefed] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]"
                      }>
                        {applicabilityLabel(grade.applicability_type)}
                      </span>
                    </div>
                    {grade.manufacturing_processes.length ? (
                      <p className="mt-3 text-xs text-[#66736e]">
                        {grade.manufacturing_processes.map(manufacturingProcessLabel).join(" · ")}
                      </p>
                    ) : null}
                  </>
                );

                return grade.slug ? (
                  <Link
                    key={grade.material_grade_id}
                    href={`/knowledge/gradi/${grade.slug}`}
                    className="rounded-2xl border border-[#dce2df] bg-white p-4 transition hover:border-[#b8d2c8]"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={grade.material_grade_id} className="rounded-2xl border border-[#dce2df] bg-white p-4">
                    {content}
                  </div>
                );
              })}
            </div>

            <Link href="/knowledge/gradi" className="mt-5 inline-flex text-sm font-semibold text-[#1a5144]">
              Esplora il catalogo gradi →
            </Link>
          </section>
        ) : null}

        {standard.faq.length ? (
          <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-[#1d2824]">Domande frequenti</h2>
            <div className="mt-4 divide-y divide-[#e8eef7]">
              {standard.faq.map((item, index) => (
                <div key={item.question + index} className="py-4">
                  <h3 className="text-sm font-semibold text-[#1d2824]">{item.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#66736e]">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#66736e]">Fonti</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">Riferimenti ufficiali consultati</h2>
            </div>
            <p className="text-xs text-[#66736e]">Ultima revisione: {formatReviewDate(standard.last_reviewed_at)}</p>
          </div>
          <div className="mt-5 space-y-3">
            {standard.source_references.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start justify-between gap-4 rounded-2xl border border-[#dce2df] bg-[#f6f8f7] p-4 transition hover:border-[#b8d2c8]"
              >
                <div>
                  <p className="text-sm font-semibold text-[#1d2824]">{source.label}</p>
                  <p className="mt-1 text-xs text-[#66736e]">
                    {source.publisher}{source.status ? ` · ${source.status}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-[#1a5144]">Apri ↗</span>
              </a>
            ))}
          </div>
        </section>

        <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-950">Nota sull&apos;uso delle norme tecniche</p>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Questa pagina è una guida editoriale e non riproduce il contenuto normativo completo. Per requisiti di
            conformità, acquisto, collaudo o certificazione fa fede il testo ufficiale della norma applicabile,
            nella corretta edizione e con gli eventuali aggiornamenti.
          </p>
        </aside>

        <section className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/knowledge/norme"
            className="rounded-2xl border border-[#dce2df] bg-white p-5 text-sm font-semibold text-[#1a5144] hover:border-[#b8d2c8]"
          >
            ← Torna al catalogo norme
          </Link>
          <Link
            href="/knowledge/tubes"
            className="rounded-2xl border border-[#b8d2c8] bg-[#edf5f2] p-5 text-sm font-semibold text-[#1a5144] hover:border-[#b8d2c8]"
          >
            Continua con pesi & dimensioni →
          </Link>
        </section>
      </article>
    </div>
  );
}

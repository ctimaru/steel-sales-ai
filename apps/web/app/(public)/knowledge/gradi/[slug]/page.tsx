import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { SchoolHero } from "@/components/school-ui";

import {
  applicabilityLabel,
  manufacturingProcessLabel,
  materialFamilyLabel,
} from "@/lib/knowledge-labels";
import { getPublicGrade } from "@/lib/public-knowledge";
import { absoluteUrl } from "@/lib/site";

const loadGrade = cache(getPublicGrade);

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
  const grade = await loadGrade(slug);

  if (!grade) {
    return {
      title: "Grado non disponibile",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: grade.seo_title.replace(/ · (?:Steel Knowledge|Scuola).*$/i, ""),
    description: grade.seo_description,
    alternates: {
      canonical: absoluteUrl(`/knowledge/gradi/${grade.slug}`),
    },
    openGraph: {
      title: grade.seo_title.replace(/ · (?:Steel Knowledge|Scuola).*$/i, ""),
      description: grade.seo_description,
      url: absoluteUrl(`/knowledge/gradi/${grade.slug}`),
      type: "article",
      publishedTime: grade.published_at,
      modifiedTime: `${grade.last_reviewed_at}T00:00:00Z`,
    },
  };
}

export default async function GradeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const grade = await loadGrade(slug);
  if (!grade) notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: grade.seo_title.replace(/ · (?:Steel Knowledge|Scuola).*$/i, ""),
    description: grade.seo_description,
    datePublished: grade.published_at,
    dateModified: grade.last_reviewed_at,
    mainEntityOfPage: absoluteUrl(`/knowledge/gradi/${grade.slug}`),
    author: {
      "@type": "Organization",
      name: "Smart Steel Sales",
    },
    citation: grade.source_references.map((source) => source.url),
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
        name: "Gradi",
        item: absoluteUrl("/knowledge/gradi"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: grade.designation,
        item: absoluteUrl(`/knowledge/gradi/${grade.slug}`),
      },
    ],
  };

  const faqJsonLd = grade.faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: grade.faq.map((item) => ({
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

      <nav aria-label="Breadcrumb" className="school-breadcrumb">
        <Link href="/knowledge" className="hover:text-[#1a5144]">Scuola</Link>
        <span className="mx-2">/</span>
        <Link href="/knowledge/gradi" className="hover:text-[#1a5144]">Gradi</Link>
        <span className="mx-2">/</span>
        <span>{grade.designation}</span>
      </nav>

      <article className="space-y-8">
        <SchoolHero
          eyebrow={grade.standard_system ?? "Grado acciaio"}
          title={grade.seo_title.replace(/ · (?:Steel Knowledge|Scuola).*$/i, "")}
          description={<>{grade.intro}</>}
          badges={[
            ...(grade.material_family ? [materialFamilyLabel(grade.material_family)] : []),
            `Rivisto ${formatReviewDate(grade.last_reviewed_at)}`,
          ]}
        />

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="school-meta-label">Designazione</p>
            <p className="mt-1 text-lg font-semibold text-[#1d2824]">{grade.designation}</p>
          </div>
          <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="school-meta-label">Numero materiale</p>
            <p className="mt-1 text-lg font-semibold text-[#1d2824]">{grade.material_number ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="school-meta-label">Densità usata nei riferimenti</p>
            <p className="mt-1 text-lg font-semibold text-[#1d2824]">
              {grade.density_kg_m3 ? `${grade.density_kg_m3.toLocaleString("it-IT")} kg/m³` : "—"}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-[#66736e]">Valore di riferimento del catalogo, non tolleranza di fornitura.</p>
          </div>
        </section>

        <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Designazione</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">Come leggere {grade.designation}</h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#66736e]">
            {grade.designation_explanation}
          </p>

          {grade.typical_applications ? (
            <>
              <h3 className="mt-7 text-lg font-semibold text-[#1d2824]">Applicazioni tipiche</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[#66736e]">
                {grade.typical_applications}
              </p>
            </>
          ) : null}
        </section>

        {grade.editorial_sections.map((section, index) => (
          <section key={section.heading + index} className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-[#1d2824]">{section.heading}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#66736e]">{section.body}</p>
          </section>
        ))}

        {grade.related_grade_pages.length ? (
          <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#66736e]">Gradi correlati</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">Materiali utili da confrontare</h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Il collegamento serve a orientare la ricerca. Un materiale correlato non è automaticamente equivalente
              o sostituibile.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {grade.related_grade_pages.map((related) => (
                <Link
                  key={related.slug}
                  href={`/knowledge/gradi/${related.slug}`}
                  className="rounded-2xl border border-[#dce2df] bg-[#f6f8f7] p-4 transition hover:border-[#b8d2c8]"
                >
                  <p className="font-semibold text-[#1d2824]">{related.designation}</p>
                  {related.material_number ? (
                    <p className="mt-1 text-xs text-[#5d6a65]">Materiale {related.material_number}</p>
                  ) : null}
                  {related.material_family ? (
                    <p className="mt-3 text-xs font-semibold text-[#1a5144]">
                      {materialFamilyLabel(related.material_family)}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {grade.related_standards.length ? (
          <section className="rounded-3xl border border-[#d9e8e2] bg-[#f6f8f7] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Norme collegate</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">
              Dove compare {grade.designation}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Il tipo di evidenza resta visibile. Una gamma produttore o fornitore non viene presentata come
              applicabilità normativa e una relazione con una norma non implica sostituibilità.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {grade.related_standards.map((standard) => {
                const content = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#1d2824]">{standard.code}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#66736e]">{standard.title}</p>
                      </div>
                      <span className={standard.is_normative
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700"
                        : "rounded-full bg-[#ecefed] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]"
                      }>
                        {applicabilityLabel(standard.applicability_type)}
                      </span>
                    </div>
                    {standard.manufacturing_processes.length ? (
                      <p className="mt-3 text-xs text-[#66736e]">
                        {standard.manufacturing_processes.map(manufacturingProcessLabel).join(" · ")}
                      </p>
                    ) : null}
                  </>
                );

                return standard.slug ? (
                  <Link
                    key={standard.standard_id}
                    href={`/knowledge/norme/${standard.slug}`}
                    className="rounded-2xl border border-[#dce2df] bg-white p-4 transition hover:border-[#b8d2c8]"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={standard.standard_id} className="rounded-2xl border border-[#dce2df] bg-white p-4">
                    {content}
                  </div>
                );
              })}
            </div>

            <Link href="/knowledge/norme" className="school-inline-link mt-5 inline-flex">
              Esplora il catalogo norme →
            </Link>
          </section>
        ) : null}

        {grade.faq.length ? (
          <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-[#1d2824]">Domande frequenti</h2>
            <div className="mt-4 divide-y divide-[#e8eef7]">
              {grade.faq.map((item, index) => (
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
              <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">Riferimenti consultati</h2>
            </div>
            <p className="text-xs text-[#66736e]">Ultima revisione: {formatReviewDate(grade.last_reviewed_at)}</p>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
            Le fonti di produttori e fornitori documentano gamme osservate; i riferimenti UNI definiscono il
            contesto della norma. Nessuna fonte commerciale viene elevata a prova normativa completa.
          </p>
          <div className="mt-5 space-y-3">
            {grade.source_references.map((source) => (
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
                <span className="school-inline-link shrink-0 text-sm">Apri ↗</span>
              </a>
            ))}
          </div>
        </section>

        <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-950">Equivalenze e sostituzioni</p>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Stesso numero materiale, sigla simile, grado correlato o cross-reference commerciale non autorizzano
            automaticamente una sostituzione. Per conformità e progetto fanno fede norma applicabile,
            documentazione del materiale e requisiti contrattuali.
          </p>
        </aside>

        <section className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/knowledge/gradi"
            className="school-secondary-action min-h-16 justify-start px-5"
          >
            ← Torna al catalogo gradi
          </Link>
          <Link
            href="/knowledge/tubes"
            className="school-primary-action min-h-16 justify-start px-5"
          >
            Continua con pesi & dimensioni →
          </Link>
        </section>
      </article>
    </div>
  );
}

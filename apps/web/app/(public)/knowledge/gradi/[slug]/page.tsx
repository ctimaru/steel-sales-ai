import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  applicabilityLabel,
  manufacturingProcessLabel,
} from "@/lib/knowledge-labels";
import { getPublicGrade } from "@/lib/public-knowledge";
import { absoluteUrl } from "@/lib/site";

const loadGrade = cache(getPublicGrade);

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
    title: grade.seo_title,
    description: grade.seo_description,
    alternates: {
      canonical: absoluteUrl(`/knowledge/gradi/${grade.slug}`),
    },
    openGraph: {
      title: grade.seo_title,
      description: grade.seo_description,
      url: absoluteUrl(`/knowledge/gradi/${grade.slug}`),
      type: "article",
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: grade.seo_title,
    description: grade.seo_description,
    datePublished: grade.published_at,
    mainEntityOfPage: absoluteUrl(`/knowledge/gradi/${grade.slug}`),
    author: {
      "@type": "Organization",
      name: "Steel Sales AI",
    },
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-xs font-semibold text-[#7e8da1]">
        <Link href="/knowledge" className="hover:text-[#2f6fed]">Steel Knowledge</Link>
        <span className="mx-2">/</span>
        <Link href="/knowledge/gradi" className="hover:text-[#2f6fed]">Gradi</Link>
        <span className="mx-2">/</span>
        <span>{grade.designation}</span>
      </nav>

      <article className="space-y-8">
        <header className="rounded-3xl border border-[#dce7f7] bg-white p-6 shadow-[0_1px_2px_rgba(30,43,69,0.025),0_12px_36px_rgba(30,43,69,0.035)] sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#2f6fed]">
              {grade.standard_system ?? "Grado acciaio"}
            </span>
            {grade.material_family ? (
              <span className="rounded-full bg-[#f2f5f9] px-3 py-1 text-[11px] font-semibold text-[#68788e]">
                {grade.material_family.replaceAll("_", " ")}
              </span>
            ) : null}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1e2b45] sm:text-5xl">
            {grade.designation}: significato, norme e applicazioni
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#68788e]">{grade.intro}</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
            <p className="text-xs font-semibold text-[#7e8da1]">Designazione</p>
            <p className="mt-1 text-lg font-semibold text-[#1e2b45]">{grade.designation}</p>
          </div>
          <div className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
            <p className="text-xs font-semibold text-[#7e8da1]">Numero materiale</p>
            <p className="mt-1 text-lg font-semibold text-[#1e2b45]">{grade.material_number ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
            <p className="text-xs font-semibold text-[#7e8da1]">Densità di riferimento</p>
            <p className="mt-1 text-lg font-semibold text-[#1e2b45]">
              {grade.density_kg_m3 ? `${grade.density_kg_m3.toLocaleString("it-IT")} kg/m³` : "—"}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Designazione</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1e2b45]">Come leggere {grade.designation}</h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#68788e]">
            {grade.designation_explanation}
          </p>

          {grade.typical_applications ? (
            <>
              <h3 className="mt-7 text-lg font-semibold text-[#1e2b45]">Applicazioni tipiche</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[#68788e]">
                {grade.typical_applications}
              </p>
            </>
          ) : null}
        </section>

        {grade.editorial_sections.map((section, index) => (
          <section key={section.heading + index} className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-[#1e2b45]">{section.heading}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#68788e]">{section.body}</p>
          </section>
        ))}

        {grade.related_standards.length ? (
          <section className="rounded-3xl border border-[#dbe7f7] bg-[#f8fbff] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Norme collegate</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#1e2b45]">
              Dove compare {grade.designation}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#68788e]">
              Una relazione con una norma non equivale automaticamente a sostituibilità o equivalenza normativa.
              Steel Knowledge conserva il tipo di evidenza disponibile.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {grade.related_standards.map((standard) => {
                const content = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#1e2b45]">{standard.code}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#68788e]">{standard.title}</p>
                      </div>
                      <span className={standard.is_normative
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700"
                        : "rounded-full bg-[#f2f5f9] px-2.5 py-1 text-[10px] font-semibold text-[#68788e]"
                      }>
                        {applicabilityLabel(standard.applicability_type)}
                      </span>
                    </div>
                    {standard.manufacturing_processes.length ? (
                      <p className="mt-3 text-xs text-[#68788e]">
                        {standard.manufacturing_processes.map(manufacturingProcessLabel).join(" · ")}
                      </p>
                    ) : null}
                  </>
                );

                return standard.slug ? (
                  <Link
                    key={standard.standard_id}
                    href={`/knowledge/norme/${standard.slug}`}
                    className="rounded-2xl border border-[#e1e8f2] bg-white p-4 transition hover:border-[#bdd1f4]"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={standard.standard_id} className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
                    {content}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {grade.faq.length ? (
          <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-[#1e2b45]">Domande frequenti</h2>
            <div className="mt-4 divide-y divide-[#e8eef7]">
              {grade.faq.map((item, index) => (
                <div key={item.question + index} className="py-4">
                  <h3 className="text-sm font-semibold text-[#1e2b45]">{item.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#68788e]">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-950">Equivalenze e sostituzioni</p>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Stesso numero materiale, somiglianza commerciale o una cross-reference di fornitore non autorizzano
            automaticamente una sostituzione normativa. Per la conformità fa fede la documentazione applicabile.
          </p>
        </aside>
      </article>
    </div>
  );
}

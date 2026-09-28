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
    title: standard.seo_title,
    description: standard.seo_description,
    alternates: {
      canonical: absoluteUrl(`/knowledge/norme/${standard.slug}`),
    },
    openGraph: {
      title: standard.seo_title,
      description: standard.seo_description,
      url: absoluteUrl(`/knowledge/norme/${standard.slug}`),
      type: "article",
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: standard.seo_title,
    description: standard.seo_description,
    datePublished: standard.published_at,
    mainEntityOfPage: absoluteUrl(`/knowledge/norme/${standard.slug}`),
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
        <Link href="/knowledge/norme" className="hover:text-[#2f6fed]">Norme</Link>
        <span className="mx-2">/</span>
        <span>{standard.code}</span>
      </nav>

      <article className="space-y-8">
        <header className="rounded-3xl border border-[#dce7f7] bg-white p-6 shadow-[0_1px_2px_rgba(30,43,69,0.025),0_12px_36px_rgba(30,43,69,0.035)] sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#2f6fed]">
              {standard.standard_system ?? "Norma tecnica"}
            </span>
            {standard.application_category ? (
              <span className="rounded-full bg-[#f2f5f9] px-3 py-1 text-[11px] font-semibold text-[#68788e]">
                {applicationCategoryLabel(standard.application_category)}
              </span>
            ) : null}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1e2b45] sm:text-5xl">
            {standard.code}: {standard.title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#68788e]">
            {standard.intro}
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {standard.issuing_body ? (
            <div className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
              <p className="text-xs font-semibold text-[#7e8da1]">Ente</p>
              <p className="mt-1 text-sm font-semibold text-[#1e2b45]">{standard.issuing_body}</p>
            </div>
          ) : null}
          {standard.edition ? (
            <div className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
              <p className="text-xs font-semibold text-[#7e8da1]">Edizione / riferimento</p>
              <p className="mt-1 text-sm font-semibold text-[#1e2b45]">{standard.edition}</p>
            </div>
          ) : null}
          {standard.product_families.length ? (
            <div className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
              <p className="text-xs font-semibold text-[#7e8da1]">Famiglie prodotto</p>
              <p className="mt-1 text-sm font-semibold text-[#1e2b45]">
                {standard.product_families.map(productFamilyLabel).join(", ")}
              </p>
            </div>
          ) : null}
          {standard.manufacturing_processes.length ? (
            <div className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
              <p className="text-xs font-semibold text-[#7e8da1]">Processi</p>
              <p className="mt-1 text-sm font-semibold text-[#1e2b45]">
                {standard.manufacturing_processes.map(manufacturingProcessLabel).join(", ")}
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Cosa tratta</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1e2b45]">Ambito della {standard.code}</h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#68788e]">{standard.what_it_covers}</p>

          {standard.how_to_read ? (
            <>
              <h3 className="mt-7 text-lg font-semibold text-[#1e2b45]">Come leggere questa norma</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[#68788e]">{standard.how_to_read}</p>
            </>
          ) : null}

          {standard.typical_applications ? (
            <>
              <h3 className="mt-7 text-lg font-semibold text-[#1e2b45]">Applicazioni tipiche</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[#68788e]">
                {standard.typical_applications}
              </p>
            </>
          ) : null}
        </section>

        {standard.editorial_sections.map((section, index) => (
          <section key={section.heading + index} className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-[#1e2b45]">{section.heading}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#68788e]">{section.body}</p>
          </section>
        ))}

        {standard.related_grades.length ? (
          <section className="rounded-3xl border border-[#dbe7f7] bg-[#f8fbff] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Gradi collegati</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#1e2b45]">
              Materiali associati alla {standard.code}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#68788e]">
              Il tipo di relazione viene mostrato esplicitamente: una gamma produttore o fornitore non viene
              presentata come applicabilità normativa.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {standard.related_grades.map((grade) => {
                const content = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#1e2b45]">{grade.designation}</p>
                        {grade.material_number ? (
                          <p className="mt-1 text-xs text-[#7e8da1]">Materiale {grade.material_number}</p>
                        ) : null}
                      </div>
                      <span className={grade.is_normative
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700"
                        : "rounded-full bg-[#f2f5f9] px-2.5 py-1 text-[10px] font-semibold text-[#68788e]"
                      }>
                        {applicabilityLabel(grade.applicability_type)}
                      </span>
                    </div>
                    {grade.manufacturing_processes.length ? (
                      <p className="mt-3 text-xs text-[#68788e]">
                        {grade.manufacturing_processes.map(manufacturingProcessLabel).join(" · ")}
                      </p>
                    ) : null}
                  </>
                );

                return grade.slug ? (
                  <Link
                    key={grade.material_grade_id}
                    href={`/knowledge/gradi/${grade.slug}`}
                    className="rounded-2xl border border-[#e1e8f2] bg-white p-4 transition hover:border-[#bdd1f4]"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={grade.material_grade_id} className="rounded-2xl border border-[#e1e8f2] bg-white p-4">
                    {content}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {standard.faq.length ? (
          <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-[#1e2b45]">Domande frequenti</h2>
            <div className="mt-4 divide-y divide-[#e8eef7]">
              {standard.faq.map((item, index) => (
                <div key={item.question + index} className="py-4">
                  <h3 className="text-sm font-semibold text-[#1e2b45]">{item.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#68788e]">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-950">Nota sull&apos;uso delle norme tecniche</p>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Questa pagina è una guida editoriale. Per requisiti di conformità, acquisto, collaudo o certificazione
            fa fede il testo ufficiale della norma applicabile e la relativa edizione.
          </p>
        </aside>
      </article>
    </div>
  );
}

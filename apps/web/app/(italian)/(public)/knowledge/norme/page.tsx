import type { Metadata } from "next";
import Link from "next/link";

import { SchoolHero } from "@/components/school-ui";
import { applicationCategoryLabel, productFamilyLabel } from "@/lib/knowledge-labels";
import {
  listPublicStandards,
  type PublicKnowledgeStandardSummary,
} from "@/lib/public-knowledge";
import { robotsForParameterizedPage } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

const baseMetadata: Metadata = {
  title: "Norme per tubi e acciaio",
  description:
    "Catalogo pubblico delle principali norme per tubi e acciaio: EN 10210, EN 10219, EN 10216, EN 10217, EN 10224 e altre guide tecniche.",
  alternates: {
    canonical: absoluteUrl("/knowledge/norme"),
    languages: {
      it: absoluteUrl("/knowledge/norme"),en: absoluteUrl("/en/knowledge/standards"),
      de: absoluteUrl("/de/knowledge/standards"),fr: absoluteUrl("/fr/knowledge/standards"),
      es: absoluteUrl("/es/knowledge/standards"),
    },
  },
  openGraph: {
    title: "Norme per tubi e acciaio · Scuola Smart Steel Sales",
    description:
      "Consulta le schede pubbliche delle principali norme tecniche per tubi e prodotti siderurgici.",
    url: absoluteUrl("/knowledge/norme"),
    type: "website",
  },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  return {
    ...baseMetadata,
    robots: robotsForParameterizedPage(Boolean(params.q?.trim())),
  };
}

const categoryOrder = [
  "structural_hollow_sections",
  "pressure_tubes",
  "water_transport",
] as const;

const categoryCopy: Record<string, { title: string; description: string; anchor: string }> = {
  structural_hollow_sections: {
    title: "Profilati cavi strutturali",
    description:
      "Per orientarsi tra prodotti finiti a caldo, formati a freddo, parti dimensionali e gradi strutturali.",
    anchor: "strutturali",
  },
  pressure_tubes: {
    title: "Tubi per impieghi in pressione",
    description:
      "Per distinguere seamless, saldati, temperatura ambiente ed elevate temperature.",
    anchor: "pressione",
  },
  water_transport: {
    title: "Acqua e liquidi acquosi",
    description:
      "Norme dedicate a tubi e raccordi per trasporto acqua e altri fluidi acquosi.",
    anchor: "acqua",
  },
};

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function StandardCard({ standard }: { standard: PublicKnowledgeStandardSummary }) {
  return (
    <Link
      href={`/knowledge/norme/${standard.slug}`}
      className="group flex h-full flex-col rounded-[18px] border border-[#d7e3da] bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#86b39b] hover:shadow-[0_16px_30px_-25px_#174b3c] motion-reduce:transform-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
            {standard.standard_system ?? "Norma"}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-[#1d2824]">{standard.code}</h3>
        </div>
        {standard.related_grade_count > 0 ? (
          <span className="rounded-full bg-[#ecefed] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]">
            {standard.related_grade_count} gradi collegati
          </span>
        ) : null}
      </div>

      <p className="mt-3 mb-4 line-clamp-3 text-sm leading-6 text-[#52645a]">
        {standard.seo_description}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {standard.product_families.slice(0, 2).map((family) => (
          <span key={family} className="rounded-full bg-[#ecefed] px-2.5 py-1 text-xs text-[#5d6a65]">
            {productFamilyLabel(family)}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#e6ede8] pt-3 text-xs">
        <span className="text-[#66736e]">Rivista {formatReviewDate(standard.last_reviewed_at)}</span>
        <span className="font-semibold text-[#1a5144]">Apri scheda →</span>
      </div>
    </Link>
  );
}

export default async function StandardsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const standards = await listPublicStandards(query);

  const grouped = categoryOrder
    .map((category) => ({
      category,
      standards: standards.filter((standard) => standard.application_category === category),
    }))
    .filter((group) => group.standards.length > 0);

  const uncategorized = standards.filter(
    (standard) =>
      !standard.application_category ||
      !categoryOrder.includes(
        standard.application_category as (typeof categoryOrder)[number],
      ),
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Norme per tubi e acciaio",
    url: absoluteUrl("/knowledge/norme"),
    description:
      "Catalogo pubblico e revisionato di schede tecniche sulle norme del settore steel e tube.",
    hasPart: standards.map((standard) => ({
      "@type": "TechArticle",
      name: standard.seo_title,
      url: absoluteUrl(`/knowledge/norme/${standard.slug}`),
    })),
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="flex justify-end"><Link href="/en/knowledge/standards" hrefLang="en" lang="en" className="inline-flex min-h-10 items-center rounded-lg border border-[#dce5e0] bg-white px-3 text-xs font-bold text-[#123b34]">English standards →</Link></div>
      <nav aria-label="Breadcrumb" className="school-breadcrumb">
        <Link href="/knowledge" className="hover:text-[#1a5144]">Scuola</Link>
        <span className="mx-2">/</span>
        <span>Norme</span>
      </nav>

      <SchoolHero
        eyebrow="Catalogo norme"
        title="Norme tecniche, senza confusione."
        description={
          <>
            Le schede spiegano cosa tratta ogni norma, come leggere le sue parti e come si collega ai materiali
            osservati sul mercato. Il contenuto è originale e sintetico: per conformità e certificazione fa sempre
            fede il testo ufficiale dell&apos;edizione applicabile.
          </>
        }
        badges={["Pubblico", `${standards.length} schede`]}
        compact
        editorial
        action={{ href: "#school-catalog-search", label: "Cerca nel catalogo" }}
        secondaryAction={{ href: "/knowledge/gradi", label: "Esplora i materiali" }}
      />

      <section id="school-catalog-search" className="scroll-mt-20 rounded-[20px] border border-[#d3e1d7] bg-white p-4 sm:p-5" aria-label="Ricerca catalogo tecnico">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#256449]">RICERCA RAPIDA</p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">Cerca la norma che ti serve</h2>
            <p className="mt-1 text-xs leading-5 text-[#52665c]">
              Esempi: EN 10219, pressione, temperatura elevata, acqua.
            </p>
          </div>
          <form method="get" role="search" aria-label="Cerca la norma che ti serve" className="flex w-full max-w-xl items-end gap-2">
            <label htmlFor="school-standards-query" className="sr-only">Cerca la norma che ti serve</label>
            <input
              id="school-standards-query"
              name="q"
              type="search"
              maxLength={100}
              defaultValue={query}
              placeholder="Cerca EN 10219, pressione, acqua..."
              className="h-11 min-w-0 flex-1 rounded-xl border border-[#c6d7cd] bg-white px-3 text-sm text-[#1b352b] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246b52]"
            />
            <button type="submit" className="school-primary-action h-11">
              Cerca
            </button>
          </form>
        </div>
      </section>

      {!query ? (
        <section className="grid gap-3 md:grid-cols-3" aria-label="Percorsi del catalogo">
          {categoryOrder.map((category) => {
            const copy = categoryCopy[category];
            const count = standards.filter((standard) => standard.application_category === category).length;
            return (
              <a
                key={category}
                href={`#${copy.anchor}`}
                className="rounded-[18px] border border-[#d7e3da] bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#81ad94] hover:shadow-[0_14px_25px_-23px_#174b3c] motion-reduce:transform-none"
              >
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                  {count ? `${count} schede` : "In sviluppo"}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">{copy.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#66736e]">{copy.description}</p>
              </a>
            );
          })}
        </section>
      ) : null}

      {standards.length ? (
        <div className="space-y-10">
          {grouped.map(({ category, standards: groupStandards }) => {
            const copy = categoryCopy[category];
            return (
              <section key={category} id={copy.anchor} className="scroll-mt-24">
                <div className="mb-4 max-w-3xl">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                    {applicationCategoryLabel(category)}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-[#1d2824]">{copy.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#66736e]">{copy.description}</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {groupStandards.map((standard) => (
                    <StandardCard key={standard.standard_id} standard={standard} />
                  ))}
                </div>
              </section>
            );
          })}

          {uncategorized.length ? (
            <section>
              <h2 className="text-2xl font-semibold text-[#1d2824]">Altre norme</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {uncategorized.map((standard) => (
                  <StandardCard key={standard.standard_id} standard={standard} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <section className="rounded-3xl border border-dashed border-[#cbd7e6] bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-[#1d2824]">
            Nessuna scheda pubblicata corrisponde alla ricerca
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#66736e]">
            Prova con un codice norma, una famiglia di prodotto o un impiego più generale.
          </p>
          <Link href="/knowledge/norme" className="mt-4 inline-flex text-sm font-semibold text-[#1a5144]">
            Azzera ricerca
          </Link>
        </section>
      )}

      <section className="rounded-3xl border border-[#d9e8e2] bg-[#f6f8f7] p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">Approfondimento editoriale</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#1d2824]">Prima della norma, capisci come nasce il tubo</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#66736e]">
              HFI/ERW, SAW, seamless e cold drawn cambiano route produttiva e campo di applicazione: l’articolo collega i processi alle famiglie normative della Scuola.
            </p>
          </div>
          <Link href="/knowledge/articoli/come-si-producono-tubi-acciaio" className="school-secondary-action shrink-0">
            Come si producono i tubi →
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#b8d2c8] bg-[#edf5f2] p-5">
          <p className="text-sm font-semibold text-[#1d2824]">Cerchi un materiale?</p>
          <p className="mt-1 text-sm leading-6 text-[#5d6a65]">
            Il catalogo gradi collega designazioni, numeri materiale e norme senza assumere equivalenze automatiche.
          </p>
          <Link href="/knowledge/gradi" className="mt-3 inline-flex text-sm font-semibold text-[#1a5144]">
            Esplora i gradi di acciaio →
          </Link>
        </div>
        <div className="rounded-2xl border border-[#dce2df] bg-white p-5">
          <p className="text-sm font-semibold text-[#1d2824]">Hai già diametro e spessore?</p>
          <p className="mt-1 text-sm leading-6 text-[#66736e]">
            Passa alla sezione pesi e dimensioni per il prossimo livello del layer tecnico pubblico.
          </p>
          <Link href="/knowledge/tubes?source=school&surface=school_section#calcolatore-pesi" className="mt-3 inline-flex text-sm font-semibold text-[#1a5144]">
            Apri pesi & dimensioni →
          </Link>
        </div>
      </section>
    </div>
  );
}

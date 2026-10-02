import type { Metadata } from "next";
import Link from "next/link";

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
  },
  openGraph: {
    title: "Norme per tubi e acciaio · Steel Knowledge",
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
      className="group rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:border-[#b8d2c8] hover:shadow-sm"
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

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#66736e]">
        {standard.seo_description}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {standard.product_families.slice(0, 2).map((family) => (
          <span key={family} className="rounded-full bg-[#ecefed] px-2.5 py-1 text-xs text-[#5d6a65]">
            {productFamilyLabel(family)}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 text-xs">
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
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-xs font-semibold text-[#7e8da1]">
        <Link href="/knowledge" className="hover:text-[#1a5144]">Steel Knowledge</Link>
        <span className="mx-2">/</span>
        <span>Norme</span>
      </nav>

      <section className="max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Catalogo norme</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824] sm:text-4xl">
          Trova la norma partendo dal tipo di prodotto o dall&apos;impiego
        </h1>
        <p className="mt-4 text-base leading-7 text-[#66736e]">
          Le schede spiegano cosa tratta ogni norma, come leggere le sue parti e come si collega ai materiali
          osservati sul mercato. Il contenuto è originale e sintetico: per conformità e certificazione fa sempre
          fede il testo ufficiale dell&apos;edizione applicabile.
        </p>
      </section>

      {!query ? (
        <section className="grid gap-4 md:grid-cols-3" aria-label="Percorsi del catalogo">
          {categoryOrder.map((category) => {
            const copy = categoryCopy[category];
            const count = standards.filter((standard) => standard.application_category === category).length;
            return (
              <a
                key={category}
                href={`#${copy.anchor}`}
                className="rounded-2xl border border-[#d9e8e2] bg-[#f6f8f7] p-5 transition hover:border-[#b8d2c8]"
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

      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#66736e]">Ricerca</p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">Cerca per codice o argomento</h2>
            <p className="mt-1 text-sm text-[#66736e]">
              Esempi: EN 10219, pressione, temperatura elevata, acqua.
            </p>
          </div>
          <form className="flex w-full max-w-xl gap-2">
            <input
              name="q"
              defaultValue={query}
              placeholder="Cerca EN 10219, pressione, acqua..."
              className="h-11 min-w-0 flex-1 rounded-xl border border-[#dbe5f1] px-3 text-sm outline-none focus:border-[#b8d2c8] focus:ring-4 focus:ring-[#e1ece8]"
            />
            <button className="h-11 rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white hover:bg-[#226657]">
              Cerca
            </button>
          </form>
        </div>
      </section>

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
          <Link href="/knowledge/tubes" className="mt-3 inline-flex text-sm font-semibold text-[#1a5144]">
            Apri pesi & dimensioni →
          </Link>
        </div>
      </section>
    </div>
  );
}

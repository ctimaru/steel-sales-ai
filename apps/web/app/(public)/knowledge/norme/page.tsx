import type { Metadata } from "next";
import Link from "next/link";

import { applicationCategoryLabel, productFamilyLabel } from "@/lib/knowledge-labels";
import { listPublicStandards } from "@/lib/public-knowledge";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Norme per tubi e acciaio",
  description:
    "Guida alle principali norme per tubi e prodotti in acciaio: ambito, applicazioni, gradi collegati e relazioni con famiglie prodotto.",
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

export default async function StandardsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const standards = await listPublicStandards(query);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Norme per tubi e acciaio",
    url: absoluteUrl("/knowledge/norme"),
    description:
      "Raccolta di schede tecniche pubbliche sulle norme del settore steel e tube.",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-9 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-xs font-semibold text-[#7e8da1]">
        <Link href="/knowledge" className="hover:text-[#2f6fed]">Steel Knowledge</Link>
        <span className="mx-2">/</span>
        <span>Norme</span>
      </nav>

      <section className="max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Norme tecniche</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1e2b45] sm:text-4xl">
          Cosa tratta ogni norma e come si collega a prodotti e gradi
        </h1>
        <p className="mt-4 text-base leading-7 text-[#68788e]">
          Le schede Steel Knowledge spiegano l&apos;ambito delle norme in linguaggio pratico, senza riprodurne
          il testo protetto. Ogni pagina distingue chiaramente informazioni editoriali, riferimenti tecnici
          e relazioni di applicabilità.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Ambito", "Che cosa disciplina la norma e per quali famiglie di prodotto è rilevante."],
          ["Gradi collegati", "Quali materiali risultano associati e con quale livello di evidenza."],
          ["Uso pratico", "Come orientarsi tra norma, parte, processo produttivo e applicazione."],
        ].map(([title, body]) => (
          <article key={title} className="rounded-2xl border border-[#e1e8f2] bg-white p-5">
            <h2 className="text-sm font-semibold text-[#1e2b45]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#68788e]">{body}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-[#e1e8f2] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f8da3]">Catalogo pubblico</p>
            <h2 className="mt-1 text-xl font-semibold text-[#1e2b45]">Schede norma pubblicate</h2>
            <p className="mt-1 text-sm text-[#68788e]">
              Vengono mostrate solo le schede passate attraverso il layer editoriale pubblico.
            </p>
          </div>
          <form className="flex w-full max-w-xl gap-2">
            <input
              name="q"
              defaultValue={query}
              placeholder="Cerca EN 10219, EN 10217, ASTM..."
              className="h-11 min-w-0 flex-1 rounded-xl border border-[#dbe5f1] px-3 text-sm outline-none focus:border-[#bdd1f4] focus:ring-4 focus:ring-[#eaf2ff]"
            />
            <button className="h-11 rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245ed1]">
              Cerca
            </button>
          </form>
        </div>
      </section>

      {standards.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {standards.map((standard) => (
            <Link
              key={standard.standard_id}
              href={`/knowledge/norme/${standard.slug}`}
              className="group rounded-2xl border border-[#e1e8f2] bg-white p-5 transition hover:border-[#bdd1f4] hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#2f6fed]">
                    {standard.standard_system ?? "Norma"}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[#1e2b45]">{standard.code}</h2>
                </div>
                {standard.related_grade_count > 0 ? (
                  <span className="rounded-full bg-[#f2f5f9] px-2.5 py-1 text-[10px] font-semibold text-[#68788e]">
                    {standard.related_grade_count} gradi collegati
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm font-medium text-[#40516a]">{standard.title}</p>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#68788e]">
                {standard.short_explanation ?? standard.seo_description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {standard.application_category ? (
                  <span className="rounded-full bg-[#eef5ff] px-2.5 py-1 text-xs font-semibold text-[#2f6fed]">
                    {applicationCategoryLabel(standard.application_category)}
                  </span>
                ) : null}
                {standard.product_families.slice(0, 2).map((family) => (
                  <span key={family} className="rounded-full bg-[#f2f5f9] px-2.5 py-1 text-xs text-[#5f7088]">
                    {productFamilyLabel(family)}
                  </span>
                ))}
              </div>
              <p className="mt-5 text-xs font-semibold text-[#2f6fed]">Apri scheda norma →</p>
            </Link>
          ))}
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-[#cbd7e6] bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-[#1e2b45]">
            {query ? "Nessuna scheda pubblicata corrisponde alla ricerca" : "Le prime schede norma sono in preparazione"}
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#68788e]">
            K2 definisce struttura, URL e contratto pubblico. Le singole norme vengono pubblicate nel blocco
            editoriale successivo solo dopo revisione del contenuto e delle relazioni tecniche.
          </p>
          {query ? (
            <Link href="/knowledge/norme" className="mt-4 inline-flex text-sm font-semibold text-[#2f6fed]">
              Azzera ricerca
            </Link>
          ) : null}
        </section>
      )}

      <section className="rounded-2xl border border-[#d7e5ff] bg-[#eef5ff] p-5">
        <p className="text-sm font-semibold text-[#1e2b45]">Cerchi invece un materiale?</p>
        <p className="mt-1 text-sm leading-6 text-[#5f7088]">
          Il catalogo gradi collega designazioni, numeri materiale e norme senza assumere equivalenze non documentate.
        </p>
        <Link href="/knowledge/gradi" className="mt-3 inline-flex text-sm font-semibold text-[#2f6fed]">
          Esplora i gradi di acciaio →
        </Link>
      </section>
    </div>
  );
}

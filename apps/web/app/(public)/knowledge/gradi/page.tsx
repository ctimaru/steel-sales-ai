import type { Metadata } from "next";
import Link from "next/link";

import { listPublicGrades } from "@/lib/public-knowledge";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Gradi di acciaio e materiali",
  description:
    "Guida ai gradi di acciaio: significato delle designazioni, numeri materiale, applicazioni e norme collegate.",
  alternates: {
    canonical: absoluteUrl("/knowledge/gradi"),
  },
  openGraph: {
    title: "Gradi di acciaio e materiali · Steel Knowledge",
    description:
      "Consulta le schede pubbliche dei principali gradi di acciaio e le norme a cui risultano collegati.",
    url: absoluteUrl("/knowledge/gradi"),
    type: "website",
  },
};

export default async function GradesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const grades = await listPublicGrades(query);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Gradi di acciaio e materiali",
    url: absoluteUrl("/knowledge/gradi"),
    description:
      "Raccolta di schede tecniche pubbliche sui principali gradi di acciaio.",
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
        <span>Gradi di acciaio</span>
      </nav>

      <section className="max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Gradi & materiali</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1e2b45] sm:text-4xl">
          Cosa significano le sigle dei gradi di acciaio
        </h1>
        <p className="mt-4 text-base leading-7 text-[#68788e]">
          Una designazione come S355J2H o P265GH contiene informazioni utili, ma va sempre letta nel contesto
          della norma applicabile. Steel Knowledge separa identità del materiale, relazione con le norme e
          possibili cross-reference, evitando equivalenze automatiche.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Designazione", "Come leggere lettere, numeri e suffissi senza ridurli a una semplice sigla commerciale."],
          ["Numero materiale", "Quando disponibile, il numero materiale viene mostrato come identificatore aggiuntivo."],
          ["Norme collegate", "Ogni relazione conserva il proprio livello di evidenza e non implica sostituibilità automatica."],
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
            <h2 className="mt-1 text-xl font-semibold text-[#1e2b45]">Schede grado pubblicate</h2>
            <p className="mt-1 text-sm text-[#68788e]">
              Solo contenuti editorialmente revisionati vengono esposti al pubblico.
            </p>
          </div>
          <form className="flex w-full max-w-xl gap-2">
            <input
              name="q"
              defaultValue={query}
              placeholder="Cerca P265GH, S355J2H, 1.0425..."
              className="h-11 min-w-0 flex-1 rounded-xl border border-[#dbe5f1] px-3 text-sm outline-none focus:border-[#bdd1f4] focus:ring-4 focus:ring-[#eaf2ff]"
            />
            <button className="h-11 rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245ed1]">
              Cerca
            </button>
          </form>
        </div>
      </section>

      {grades.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {grades.map((grade) => (
            <Link
              key={grade.material_grade_id}
              href={`/knowledge/gradi/${grade.slug}`}
              className="group rounded-2xl border border-[#e1e8f2] bg-white p-5 transition hover:border-[#bdd1f4] hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#2f6fed]">
                    {grade.standard_system ?? "Acciaio"}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[#1e2b45]">{grade.designation}</h2>
                  {grade.material_number ? (
                    <p className="mt-1 text-sm text-[#68788e]">Materiale {grade.material_number}</p>
                  ) : null}
                </div>
                {grade.related_standard_count > 0 ? (
                  <span className="rounded-full bg-[#f2f5f9] px-2.5 py-1 text-[10px] font-semibold text-[#68788e]">
                    {grade.related_standard_count} norme collegate
                  </span>
                ) : null}
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#68788e]">
                {grade.short_description ?? grade.seo_description}
              </p>
              <p className="mt-5 text-xs font-semibold text-[#2f6fed]">Apri scheda grado →</p>
            </Link>
          ))}
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-[#cbd7e6] bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-[#1e2b45]">
            {query ? "Nessuna scheda pubblicata corrisponde alla ricerca" : "Le prime schede grado sono in preparazione"}
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#68788e]">
            Il modello K2 ha già creato slug, relazioni e contratto pubblico. La pubblicazione editoriale dei
            singoli materiali avverrà nel blocco dedicato ai gradi.
          </p>
          {query ? (
            <Link href="/knowledge/gradi" className="mt-4 inline-flex text-sm font-semibold text-[#2f6fed]">
              Azzera ricerca
            </Link>
          ) : null}
        </section>
      )}

      <section className="rounded-2xl border border-[#d7e5ff] bg-[#eef5ff] p-5">
        <p className="text-sm font-semibold text-[#1e2b45]">Vuoi partire dalla norma?</p>
        <p className="mt-1 text-sm leading-6 text-[#5f7088]">
          Le schede norma spiegano ambito, prodotti e relazioni con i materiali disponibili.
        </p>
        <Link href="/knowledge/norme" className="mt-3 inline-flex text-sm font-semibold text-[#2f6fed]">
          Esplora le norme →
        </Link>
      </section>
    </div>
  );
}

import Link from "next/link";

import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function KnowledgeHomePage() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  let standards = 0;
  let grades = 0;
  let dimensions = 0;
  let canonicalWeights = 0;
  let missingWeights = 0;

  if (configured) {
    const supabase = await createClient();
    const [
      standardsResult,
      gradesResult,
      dimensionsResult,
      readinessResult,
    ] = await Promise.all([
      supabase.from("steel_standards").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("steel_material_grades").select("id", { count: "exact", head: true }),
      supabase.from("steel_dimensional_rows").select("id", { count: "exact", head: true }),
      supabase.rpc("p1_shared_steel_reference_production_readiness"),
    ]);

    standards = standardsResult.count ?? 0;
    grades = gradesResult.count ?? 0;
    dimensions = dimensionsResult.count ?? 0;
    const readiness = readinessResult.data?.[0] as
      | { canonical_scope_count?: number; missing_canonical_scope_count?: number }
      | undefined;
    canonicalWeights = Number(readiness?.canonical_scope_count ?? 0);
    missingWeights = Number(readiness?.missing_canonical_scope_count ?? 0);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <section className="overflow-hidden rounded-3xl border border-[#dce7f7] bg-white shadow-[0_1px_2px_rgba(30,43,69,0.025),0_12px_36px_rgba(30,43,69,0.035)]">
        <div className="h-1 bg-[#2f6fed]" />
        <div className="p-6 sm:p-8">
          <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#2f6fed]">
            Spazio condiviso
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1e2b45] sm:text-4xl">
            Steel Knowledge
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#68788e] sm:text-base">
            La base tecnica comune del SaaS: norme, gradi, dimensioni e pesi non appartengono alla memoria
            commerciale di una singola azienda e possono essere riutilizzati in tutto il prodotto.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-[#e1e8f2] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2f6fed]">Norme & gradi</p>
          <p className="mt-3 text-3xl font-semibold text-[#1e2b45]">{standards}</p>
          <p className="mt-1 text-xs text-[#7e8da1]">{grades} gradi/materiali nel catalogo condiviso</p>
          <p className="mt-4 text-sm leading-6 text-[#68788e]">
            Ambito, applicabilità, materiali e collegamenti alle famiglie prodotto.
          </p>
        </article>

        <article className="rounded-2xl border border-[#e1e8f2] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2f6fed]">Pesi & dimensioni</p>
          <p className="mt-3 text-3xl font-semibold text-[#1e2b45]">{canonicalWeights}</p>
          <p className="mt-1 text-xs text-[#7e8da1]">
            riferimenti canonici · {dimensions} righe dimensionali
          </p>
          <p className="mt-4 text-sm leading-6 text-[#68788e]">
            Il sistema usa pesi nei calcoli solo quando il riferimento è stato promosso a canonical.
          </p>
        </article>

        <article id="tolerances" className="rounded-2xl border border-[#e1e8f2] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7f8da3]">Tolleranze</p>
          <p className="mt-3 text-lg font-semibold text-[#1e2b45]">Coverage layer da costruire</p>
          <p className="mt-2 text-sm leading-6 text-[#68788e]">
            Le tolleranze saranno una superficie Knowledge dedicata. Oggi non esiste ancora un master catalog
            strutturato sufficiente: il prodotto lo dichiara invece di mostrare dati incompleti come se fossero definitivi.
          </p>
        </article>
      </section>

      <section className="rounded-3xl border border-[#dbe7f7] bg-[#f8fbff] p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">Strumento disponibile</p>
            <h2 className="mt-2 text-xl font-semibold text-[#1e2b45]">Tubi, norme & pesi</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#68788e]">
              Consulta le norme disponibili, filtra per grado e dimensione, verifica la fonte del peso e calcola €/m
              o €/pezzo solo quando il riferimento tecnico è supportato.
            </p>
            {missingWeights > 0 ? (
              <p className="mt-2 text-xs font-semibold text-amber-700">
                {missingWeights} riferimenti peso risultano ancora da completare.
              </p>
            ) : null}
          </div>
          <Link
            href={appRoutes.knowledge.tubes}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#2f6fed] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#245ed1]"
          >
            Apri Knowledge tecnico →
          </Link>
        </div>
      </section>
    </div>
  );
}

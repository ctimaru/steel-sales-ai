import Link from "next/link";

import { GlobalSearch } from "@/components/global-search";
import {
  commercialSearchScopes,
  commercialSearchHref,
  normalizeCommercialSearchQuery,
  operationalSearchHref,
  parseCommercialSearchScope,
} from "@/lib/commercial-search-context";

export const dynamic = "force-dynamic";

export default async function GlobalSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; scope?: string }>;
}) {
  const params = await searchParams;
  const initialQuery = normalizeCommercialSearchQuery(params.q);
  const scope = parseCommercialSearchScope(params.scope);
  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#246c53]">Commercial Memory · Workspace privato</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#1d2824] sm:text-2xl">
            Cerca nello storico commerciale
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#53665b] sm:text-sm">
            Trova prodotti, clienti, richieste, offerte, ordini e documenti in un'unica ricerca privata.
            I risultati rispettano i permessi della tua organizzazione e mantengono le fonti.
          </p>
        </div>
        <Link href={operationalSearchHref(initialQuery)}
          className="inline-flex min-h-10 items-center rounded-lg border border-[#cbdad1] bg-white px-3 text-xs font-semibold text-[#173f35] hover:bg-[#edf5f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246c53]">
          RFQ fornitori e bozze →
        </Link>
      </header>
      <nav aria-label="Categorie ricerca commerciale" className="flex gap-1 overflow-x-auto rounded-lg border border-[#dce2df] bg-white p-1">
        {commercialSearchScopes.map((entry) => (
          <Link key={entry.value} href={commercialSearchHref(initialQuery, entry.value)}
            aria-current={entry.value === scope ? "page" : undefined}
            className={"inline-flex min-h-10 shrink-0 items-center rounded-md px-3 text-xs font-semibold transition " +
              (entry.value === scope ? "app-selected-solid" : "text-[#43524c] hover:bg-[#edf5f2] hover:text-[#173f35]")}>
            {entry.label}
          </Link>
        ))}
      </nav>
      <GlobalSearch key={initialQuery + ":" + scope} initialQuery={initialQuery} scope={scope} />
      <p className="text-xs leading-5 text-[#53665b]">
        Qui cerchi la <strong>memoria commerciale privata</strong>. Campagne RFQ ai fornitori,
        risposte procurement e distinte si consultano in
        {" "}<Link href={operationalSearchHref(initialQuery)} className="font-semibold text-[#173f35] underline underline-offset-2">Attività</Link>.
        Le aziende pubbliche del Network non vengono associate automaticamente al CRM.
      </p>
    </div>
  );
}

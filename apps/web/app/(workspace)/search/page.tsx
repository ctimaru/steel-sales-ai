import { GlobalSearch } from "@/components/global-search";

export const dynamic = "force-dynamic";

export default function GlobalSearchPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <p className="text-sm font-semibold text-indigo-600">Commercial Memory</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Cerca nello storico commerciale
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Trova prodotti, clienti, richieste, offerte, ordini e documenti con una sola ricerca.
          Usa i filtri tecnici solo quando servono per restringere i risultati.
        </p>
      </div>
      <div className="mt-7">
        <GlobalSearch />
      </div>
    </div>
  );
}

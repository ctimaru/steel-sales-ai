import { GlobalSearch } from "@/components/global-search";

export const dynamic = "force-dynamic";

export default function GlobalSearchPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <p className="text-sm font-semibold text-indigo-600">Commercial Memory</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Global Search</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Ricerca unica structured + semantic su documenti, prodotti, aziende ed eventi commerciali,
          con filtri tecnici specifici per il settore siderurgico.
        </p>
      </div>
      <div className="mt-7">
        <GlobalSearch />
      </div>
    </div>
  );
}

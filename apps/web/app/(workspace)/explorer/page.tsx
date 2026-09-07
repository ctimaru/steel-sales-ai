import { CommercialExplorer } from "@/components/commercial-explorer";
import { getCommercialRows } from "@/lib/data/commercial";

export default async function ExplorerPage() {
  const { mode, rows } = await getCommercialRows();

  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <p className="text-sm font-semibold text-slate-500">Commercial Intelligence</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Commercial Explorer
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          {mode === "live"
            ? "Dati live dalle tabelle app-facing protette da RLS. Cerca prodotti e ricostruisci il flusso richiesta → offerta → ordine → consegna."
            : mode === "empty"
              ? "Il collegamento Supabase è attivo, ma il dataset validato non è ancora assegnato a questo utente."
              : "Modalità demo: UX e filtri usano un campione tipizzato finché Supabase non è configurato."}
        </p>
      </div>
      <div className="mt-7">
        <CommercialExplorer rows={rows} mode={mode} />
      </div>
    </div>
  );
}

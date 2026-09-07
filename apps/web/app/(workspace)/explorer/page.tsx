import { CommercialExplorer } from "@/components/commercial-explorer";
import { commercialRows } from "@/lib/demo-data";

export default function ExplorerPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <p className="text-sm font-semibold text-slate-500">Commercial Intelligence</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Commercial Explorer
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Cerca prodotti e ricostruisci il flusso richiesta → offerta → ordine → consegna.
          Il campione attuale serve a validare UX e modello di interrogazione.
        </p>
      </div>
      <div className="mt-7">
        <CommercialExplorer rows={commercialRows} />
      </div>
    </div>
  );
}

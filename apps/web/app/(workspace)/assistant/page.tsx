import { CommercialAssistant } from "@/components/commercial-assistant";

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
          Commercial intelligence
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          AI Assistant
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Interroga il tuo storico commerciale in linguaggio naturale. Questa prima versione è
          grounded: riconosce richieste su ultimo prezzo, storico prezzi e offerte senza ordine,
          poi usa esclusivamente query strutturate owner-scoped e fonti verificabili.
        </p>
      </div>

      <CommercialAssistant />
    </div>
  );
}

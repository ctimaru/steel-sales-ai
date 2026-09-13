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
          Interroga lo storico commerciale in linguaggio naturale e continua con domande di follow-up.
          L&apos;assistente mantiene il contesto del prodotto, interpreta filtri su richieste, offerte,
          ordini e consegne e usa esclusivamente query owner-scoped con fonti verificabili.
        </p>
      </div>

      <CommercialAssistant />
    </div>
  );
}

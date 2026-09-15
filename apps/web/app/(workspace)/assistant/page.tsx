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
          Interroga dati commerciali e knowledge layer in linguaggio naturale. Prezzi e metriche restano
          deterministici e owner-scoped; le domande su email e documenti usano retrieval semantico con
          evidence, citazioni e collegamenti alla fonte. Se le fonti non bastano, l&apos;assistente lo dichiara
          invece di completare la risposta con informazioni non verificate.
        </p>
      </div>

      <CommercialAssistant />
    </div>
  );
}

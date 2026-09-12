import { PriceIntelligenceForm } from "@/components/price-intelligence-form";

export default function PriceIntelligencePage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
          Commercial intelligence
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Price Intelligence
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Cerca l&apos;ultimo prezzo realmente offerto per qualità e dimensioni. Il risultato è
          ricavato dallo storico commerciale strutturato e mantiene la provenienza fino al thread
          e al testo sorgente.
        </p>
      </div>

      <PriceIntelligenceForm />
    </div>
  );
}

import Link from "next/link";

import { GroundedAssistant } from "@/components/grounded-assistant";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
          Supporto commerciale
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Assistente
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Usa l&apos;assistente quando vuoi fare una domanda sullo storico commerciale o riassumere informazioni
          già presenti nei documenti. Per cercare direttamente un prodotto, un cliente o un&apos;offerta usa Cerca;
          per ricostruire prezzi e comparabili usa Storico prodotti.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/search" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Cerca nello storico
        </Link>
        <Link href="/products" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Apri storico prodotti
        </Link>
      </div>

      <GroundedAssistant />
    </div>
  );
}

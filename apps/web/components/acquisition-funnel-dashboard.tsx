import type { FunnelDataset } from "@/lib/seo-growth1c2-funnel-model";
import { buildOrganicFunnel } from "@/lib/seo-growth1c2-funnel-model";

type Props = { dataset: FunnelDataset; previous?: FunnelDataset | null; updatedAt?: string | null };

function count(n: number | null) {
  return n === null ? "—" : new Intl.NumberFormat("it-IT").format(n);
}
function change(now: number | null, before: number | null) {
  if (now === null || before === null) return "Confronto non disponibile";
  if (before === 0) return now === 0 ? "Nessuna variazione" : "Nuova attività";
  const pct = ((now - before) / before) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}% sul periodo precedente`;
}

/** Authenticated surfaces only: callers must enforce access and load server-side aggregates. */
export function AcquisitionFunnelDashboard({ dataset, previous, updatedAt }: Props) {
  const current = buildOrganicFunnel(dataset);
  const prior = previous ? buildOrganicFunnel(previous) : [];
  const metric = (key: string) => current.find(item => item.id === key);
  const priorValue = (key: string) => prior.find(item => item.id === key)?.value ?? null;
  const stages = [
    { id: "impressions", title: "Impressioni Google", source: "Search Console" },
    { id: "clicks", title: "Clic Google", source: "Search Console" },
    { id: "sessions", title: "Sessioni landing", source: "GA4 · tutte le sorgenti" },
    { id: "users", title: "Utenti attivi", source: "GA4 · tutte le sorgenti" },
    { id: "calculator_used", title: "Calcolatrice utilizzata", source: "GA4 · consenso" },
    { id: "rfq_bill_add", title: "Aggiunta distinta", source: "GA4 · consenso" },
    { id: "rfq_create_start", title: "Avvio RFQ", source: "GA4 · consenso" },
    { id: "signup_start", title: "Avvio registrazione", source: "GA4 · consenso" },
  ] as const;

  return (
    <section aria-label="Acquisizione organica e funnel" className="rounded-2xl border border-[#d6e5dd] bg-white p-4 text-[#173c32] sm:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#477665]">Intelligence · Acquisizione</p>
          <h2 className="mt-1 text-xl font-semibold">Dalla ricerca Google alla richiesta commerciale</h2>
          <p className="mt-1 text-xs text-[#5b6e65]">{dataset.pagePath} · {dataset.startDate} – {dataset.endDate}</p>
        </div>
        <span className="rounded-full border border-[#bed5c9] bg-[#f0f7f2] px-3 py-1 text-xs font-medium">
          {updatedAt ? `Aggiornato ${updatedAt}` : "Dati aggregati"}
        </span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stages.map(stage => {
          const item = metric(stage.id);
          const value = item?.value ?? null;
          return (
            <article key={stage.id} className="min-w-0 rounded-xl border border-[#dce8e1] bg-[#fafcfb] p-3">
              <p className="text-xs font-medium text-[#577165]">{stage.title}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{count(value)}</p>
              <p className="mt-1 text-xs text-[#60776b]">{stage.source}</p>
              <p className="mt-2 text-xs text-[#365f4c]">{change(value, priorValue(stage.id))}</p>
            </article>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-5 text-[#577165]">
        Google Search Console misura visibilità e clic; GA4 misura sessioni da tutte le sorgenti ed eventi raccolti secondo consenso.
        I conteggi non rappresentano un unico percorso utente e non consentono di dedurre una conversione individuale.
        «—» indica un dato non disponibile, non zero. Avvio RFQ e registrazione non significano completamento.
      </p>
    </section>
  );
}

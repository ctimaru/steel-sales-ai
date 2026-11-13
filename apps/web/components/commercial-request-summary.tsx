import Link from "next/link";
import type { ReactNode } from "react";
import { commercialHref, type CommercialView } from "@/lib/commercial-unified-data";
import type { CommercialRequestSummaryCounts } from "@/lib/commercial-unified-streams";

/**
 * COMM-RFQ-FIRST1 — riepilogo sotto "Crea una richiesta di offerta":
 * richieste inviate ai fornitori e ricevute dai clienti, con contatori esatti.
 * Ogni scheda apre il proprio elenco; qui non viene letto alcun dato di riga.
 */
export function CommercialRequestSummary({ view, counts, tools }: {
  view: CommercialView;
  counts: CommercialRequestSummaryCounts | null;
  tools?: ReactNode;
}) {
  const number = (value: number | undefined) => typeof value === "number" ? value : "—";
  // COMM-DESK-AI1.B: una riga per scheda (~56px) invece di una scheda alta ~120px,
  // così la tabella delle trattative sale nel primo schermo. Stessi contatori esatti.
  const stat = (label: string, value: number | undefined, warm: boolean) => (
    <span className={"inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold " +
      (warm && typeof value === "number" && value > 0
        ? "border-[#e2c27a] bg-[#fff4d6] text-[#6b4a07]"
        : "border-[#d6e5db] bg-[#f4f9f6] text-[#315c49]")}>
      {label}
      <span className="text-xs tabular-nums">{number(value)}</span>
    </span>
  );
  const card = (target: "sent" | "received", title: string, who: string, icon: string, tone: string, openLabel: string) => {
    const active = view === target;
    const data = counts?.[target];
    return (
      <Link href={active ? commercialHref("all") : commercialHref(target)} aria-current={active ? "true" : undefined}
        data-testid={"commercial-summary-" + target}
        className={"group flex min-h-14 min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border bg-white px-3 py-2 shadow-[0_10px_30px_-28px_rgba(6,50,34,.45)] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] sm:px-4 " +
          (active ? "border-[#175640] ring-2 ring-[#175640]/20" : "border-[#d6e5db] hover:border-[#9cc4ac] hover:bg-[#fbfdfc]")}>
        <span aria-hidden="true" className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold " + tone}>{icon}</span>
        <span className="shrink-0 text-2xl font-bold leading-none tracking-[-0.03em] tabular-nums text-[#0f3a2b]">{number(data?.total)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-5 tracking-tight text-[#143f30]">{title}</span>
          <span className="block truncate text-[10px] font-bold uppercase leading-4 tracking-[0.1em] text-[#4f6b5b]">{who}</span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-1.5">
          {stat(openLabel, data?.open, target === "received")}
          {stat("In scadenza", data?.due, true)}
          <span className="ml-1 text-xs font-semibold text-[#276147] group-hover:underline">
            {active ? "Mostra tutte" : <><span className="sr-only">Apri elenco </span><span aria-hidden="true">→</span></>}
          </span>
        </span>
      </Link>
    );
  };
  return (
    <section aria-labelledby="commercial-summary-heading" data-testid="commercial-request-summary" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 id="commercial-summary-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-[#315c49]">Le tue richieste</h2>
        {tools}
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {card("sent", "Richieste inviate", "Ai fornitori", "↗", "bg-[#e3f3ea] text-[#175640]", "In corso")}
        {card("received", "Richieste ricevute", "Dai clienti", "↙", "bg-[#fff1cf] text-[#7a5406]", "Aperte")}
      </div>
      {counts === null ? (
        <p role="status" className="px-1 text-xs text-[#795321]">Contatori non disponibili in questo momento: nessun numero è stato stimato.</p>
      ) : null}
    </section>
  );
}

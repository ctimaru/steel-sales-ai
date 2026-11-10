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
  const stat = (label: string, value: number | undefined, warm: boolean) => (
    <span className={"inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold " +
      (warm && typeof value === "number" && value > 0
        ? "border-[#e2c27a] bg-[#fff4d6] text-[#6b4a07]"
        : "border-[#d6e5db] bg-[#f4f9f6] text-[#315c49]")}>
      {label}
      <span className="text-sm tabular-nums">{number(value)}</span>
    </span>
  );
  const card = (target: "sent" | "received", title: string, who: string, icon: string, tone: string, openLabel: string) => {
    const active = view === target;
    const data = counts?.[target];
    return (
      <Link href={active ? commercialHref("all") : commercialHref(target)} aria-current={active ? "true" : undefined}
        data-testid={"commercial-summary-" + target}
        className={"group relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-[22px] border bg-white p-4 shadow-[0_14px_44px_-34px_rgba(6,50,34,.45)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] sm:p-5 " +
          (active ? "border-[#175640] ring-2 ring-[#175640]/20" : "border-[#d6e5db] hover:border-[#9cc4ac]")}>
        <span className="flex min-w-0 items-center gap-4">
          <span aria-hidden="true" className={"flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-bold " + tone}>{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#4f6b5b]">{who}</span>
            <span className="block truncate text-base font-semibold tracking-tight text-[#143f30] sm:text-lg">{title}</span>
          </span>
          <span className="shrink-0 text-[2.6rem] font-bold leading-none tracking-[-0.04em] tabular-nums text-[#0f3a2b]">{number(data?.total)}</span>
        </span>
        <span className="flex flex-wrap items-center gap-2 border-t border-[#e6efe9] pt-3">
          {stat(openLabel, data?.open, target === "received")}
          {stat("In scadenza", data?.due, true)}
          <span className="ml-auto text-xs font-semibold text-[#276147] group-hover:underline">{active ? "Mostra tutte" : "Apri elenco →"}</span>
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
      <div className="grid gap-3 md:grid-cols-2">
        {card("sent", "Richieste inviate", "Ai fornitori", "↗", "bg-[#e3f3ea] text-[#175640]", "In corso")}
        {card("received", "Richieste ricevute", "Dai clienti", "↙", "bg-[#fff1cf] text-[#7a5406]", "Aperte")}
      </div>
      {counts === null ? (
        <p role="status" className="px-1 text-xs text-[#795321]">Contatori non disponibili in questo momento: nessun numero è stato stimato.</p>
      ) : null}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { prepareSavedNetworkRdo } from "@/app/(workspace)/rfq-hub/distinta/reuse-actions";
import type { NetworkRdoSavedDistinta } from "@/lib/network-rdo-saved-distintas";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(date);
}
function tonnes(value: number | null): string | null {
  return value !== null && Number.isFinite(value) && value > 0
    ? value.toLocaleString("it-IT", { maximumFractionDigits: 3 }) + " t"
    : null;
}

/**
 * The single Network -> RFQ entry point. Selecting an existing bill prepares
 * (or resumes) a private RFQ; the company is PINNED for explicit selection,
 * not added automatically. Sending remains a separate confirmed step.
 */
export function NetworkRdoDistintaPicker({
  networkCompanyId, companyName, items, newHref, embedded = false, onCreateNew, onPrepared,
}: {
  networkCompanyId: string;
  companyName: string;
  items: NetworkRdoSavedDistinta[];
  newHref: string;
  embedded?: boolean;
  onCreateNew?: () => void;
  onPrepared?: (href: string) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visible = useMemo(() => items.filter((item) =>
    item.title.toLocaleLowerCase("it-IT").includes(query.toLocaleLowerCase("it-IT").trim()),
  ), [items, query]);

  function choose(id: string) {
    if (pending) return;
    setError(null);
    setChosenId(id);
    startTransition(async () => {
      try {
        const outcome = await prepareSavedNetworkRdo({ distintaId: id, networkCompanyId });
        if (!outcome.ok) {
          setError(outcome.error);
          setChosenId(null);
          return;
        }
        if (onPrepared) onPrepared(outcome.href);
        else router.push(outcome.href);
      } catch {
        setError("Impossibile aprire la Distinta. Riprova.");
        setChosenId(null);
      }
    });
  }

  return (
    <section aria-label="Scegli una distinta esistente" data-testid="network-rdo-distinta-picker"
      className={embedded ? "min-w-0 space-y-4" : "mx-auto max-w-5xl space-y-5 py-1"}>
      {!embedded ? <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href={"/network/" + networkCompanyId}
          className="inline-flex min-h-10 items-center gap-1.5 font-semibold text-[#266044] hover:underline">
          <span aria-hidden="true">←</span> Scheda azienda
        </Link>
        <span className="rounded-full bg-[#edf5ef] px-3 py-1.5 text-xs font-semibold text-[#286347]">
          Richiesta di offerta
        </span>
      </div> : null}
      {!embedded ? <header className="min-w-0 border-b border-[#dce7df] pb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#538468]">Dal Network</p>
        <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-[#133f30] sm:text-[30px]">
          Richiedi offerta a {companyName}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#5d7265]">
          Scegli una Distinta che hai già preparato, oppure creane una nuova.
          La richiesta resta privata e nessuna email viene inviata prima della tua conferma.
        </p>
      </header> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#1a4938]">Le tue Distinte disponibili <span className="tabular-nums text-[#6b7d70]">({items.length})</span></h2>
          <p className="mt-0.5 text-xs text-[#66796c]">Solo bozze con articoli, non archiviate né già inviate.</p>
        </div>
        {embedded && onCreateNew ? (
          <button type="button" data-testid="network-rdo-new-distinta" onClick={onCreateNew}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-[#b8d4c0] bg-white px-3.5 text-sm font-bold text-[#1b583c] hover:bg-[#eff7f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176647]">
            + Nuova Distinta
          </button>
        ) : (
          <Link href={newHref} data-testid="network-rdo-new-distinta"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#176647] px-4 text-sm font-bold text-white transition-colors hover:bg-[#115436] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176647]">
            <span aria-hidden="true">+</span> Nuova Distinta
          </Link>
        )}
      </div>
      {items.length > 5 ? (
        <label className="block text-xs font-semibold text-[#4d6857]">
          Cerca nelle tue Distinte
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome della distinta…" data-testid="network-rdo-distinta-search"
            className="mt-1.5 w-full rounded-lg border border-[#c8dad0] bg-white px-3 py-2.5 text-sm text-[#193b2b] outline-none focus:border-[#176647] focus:ring-2 focus:ring-[#c6e4ce]" />
        </label>
      ) : null}
      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{error}</p> : null}
      <div className="divide-y divide-[#e2eae4] border-y border-[#d9e5dc]" role="list"
        data-testid="network-rdo-distinta-options">
        {visible.map((item) => (
          <div role="listitem" key={item.id}
            className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#1d4b37]" title={item.title}>{item.title}</p>
              <p className="mt-0.5 text-xs text-[#66796c]">
                {item.lineCount} {item.lineCount === 1 ? "articolo" : "articoli"}
                {tonnes(item.totalTonnes) ? " · " + tonnes(item.totalTonnes) : ""}
                {formatDate(item.createdAt) ? " · " + formatDate(item.createdAt) : ""}
                {item.existingRfq ? " · RDO in preparazione" : ""}
              </p>
            </div>
            <button type="button" disabled={pending} onClick={() => choose(item.id)}
              data-testid="network-rdo-use-distinta"
              aria-label={"Usa Distinta: " + item.title}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-[#b8d4c0] bg-[#f4faf5] px-4 text-sm font-bold text-[#1e5c3d] transition hover:bg-[#e6f3e9] disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176647]">
              {pending && chosenId === item.id ? "Apro RDO…" : item.existingRfq ? "Riprendi RDO →" : "Usa questa Distinta →"}
            </button>
          </div>
        ))}
        {!visible.length ? <p className="px-2 py-6 text-sm text-[#65776a]">
          Nessuna Distinta corrisponde alla ricerca. Puoi cancellare il filtro oppure crearne una nuova.
        </p> : null}
      </div>
      <p className="text-xs leading-5 text-[#617668]">
        Al passaggio successivo, {companyName} compare tra i fornitori proposti. Puoi verificarne la raggiungibilità,
        selezionarla e confermare l'invio soltanto dopo aver rivisto la richiesta.
      </p>
    </section>
  );
}

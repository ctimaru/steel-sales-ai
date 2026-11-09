import { summarizeRfqDraft, type DraftSummaryLine, type DraftSummarySupplier } from "@/lib/rfqc1-draft-summary";

/**
 * Chat RFQ, passo 3: riepilogo della bozza. Non invia nulla; porta al pannello
 * di revisione, dove l'invio richiede la conferma finale esplicita.
 */
export function Rfqc1DraftSummary({
  status, lines, suppliers, dueAt, canExecute,
}: {
  status: string;
  lines: DraftSummaryLine[];
  suppliers: DraftSummarySupplier[];
  dueAt: string | null;
  canExecute: boolean;
}) {
  const summary = summarizeRfqDraft({ status, lines, suppliers, dueAt });
  if (!summary.applies) return null;
  return (
    <section data-testid="rfqc1-draft-summary" aria-label="Riepilogo prima dell'invio"
      className="border-b border-[#e2eae5] bg-[#fbfcfb] px-3 py-3 sm:px-5">
      <p className="text-xs font-semibold text-[#143f30]">Riepilogo prima dell'invio</p>
      <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {summary.checks.map((check) => (
          <li key={check.key} className={"flex items-start gap-1.5 text-[11px] leading-4 " + (check.ok ? "text-[#2f5a45]" : check.blocking ? "text-[#9d4e28]" : "text-[#6b5b2a]")}>
            <span aria-hidden="true">{check.ok ? "✓" : check.blocking ? "✕" : "•"}</span>
            <span>{check.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {summary.ready && canExecute ? (
          <a href="#rfq-review-send" data-testid="rfqc1-draft-review-link"
            className="inline-flex min-h-9 items-center rounded-lg bg-[#175640] px-3 text-xs font-semibold text-white hover:bg-[#104632]">
            Rivedi e invia →
          </a>
        ) : null}
        <p className="text-[11px] leading-4 text-[#5c7063]">
          {!canExecute
            ? "Il tuo profilo consulta quest'area in sola lettura."
            : summary.ready
              ? "Nessuna richiesta è stata inviata: l'invio richiede la tua conferma finale."
              : "Completa i punti segnati prima di rivedere e inviare."}
        </p>
      </div>
    </section>
  );
}

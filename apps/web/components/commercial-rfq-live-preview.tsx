"use client";

import { calculateBuyerDistintaLine, calculateBuyerDistintaTotals, type BuyerDistintaDraftLine } from "@/lib/buyer-distinta";
import type { RfqAiTextDraftResult } from "@/lib/rfq-ai-free-text";

const fmt = (value: number, digits: number) =>
  value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/**
 * Commercial UI only. AI candidates are NEVER merged into approved totals
 * and cannot be persisted through this preview. Save and RFQ callbacks point
 * to the pre-existing authorized buyer Distinta builder actions.
 */
export function CommercialRfqLivePreview({
  title, onTitleChange, proposals, approvedLines, savedId,
  ready, savePending, rfqPending, saveMessage, rfqMessage,
  onSave, onCreateRfq, onOpenEditor,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  proposals: RfqAiTextDraftResult | null;
  approvedLines: BuyerDistintaDraftLine[];
  savedId: string | null;
  ready: boolean;
  savePending: boolean;
  rfqPending: boolean;
  saveMessage: string | null;
  rfqMessage: string | null;
  onSave: () => void;
  onCreateRfq: () => void;
  onOpenEditor: () => void;
}) {
  const calculated = approvedLines.map(calculateBuyerDistintaLine);
  const totals = calculateBuyerDistintaTotals(calculated);
  const allComplete = calculated.length > 0 && calculated.every((line) => line.complete);
  const canSave = ready && allComplete && !savePending && !rfqPending;
  const candidates = proposals?.candidates ?? [];

  return (
    <aside aria-label="Anteprima della distinta" data-testid="commercial-rfq-live-preview"
      className="min-w-0 rounded-2xl border border-[#cdded3] bg-white p-3 shadow-[0_8px_25px_rgba(18,61,52,0.04)] sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-[#173f35]">La tua distinta</h3>
        <span className="rounded-full bg-[#eef5f0] px-2.5 py-1 text-[11px] font-semibold text-[#315e49]">
          {savedId ? "Salvata" : "Bozza privata"}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-[#53675b]">
        Qui vedi gli articoli proposti dall’AI e quelli che hai confermato. Restano separati fino alla tua approvazione.
      </p>

      <div className="mt-3 border-t border-[#e3ebe5] pt-3">
        {candidates.length > 0 ? (
          <section aria-label="Proposte AI in attesa" className="mb-4" data-testid="commercial-rfq-ai-proposals">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-[0.07em] text-[#7d581b]">
                Da verificare
              </h4>
              <span className="text-xs font-semibold text-[#7d581b]">{candidates.length}</span>
            </div>
            <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
              {candidates.slice(0, 12).map((candidate, index) => {
                const line = candidate.proposedLine;
                return (
                  <li key={candidate.candidateId} className="rounded-lg border border-[#e9d9b4] bg-[#fffaf0] px-3 py-2">
                    <p className="break-words text-xs font-semibold leading-5 text-[#4a3a21]">
                      {index + 1}. {line.description || "Articolo da chiarire"}
                    </p>
                    <p className="mt-0.5 break-words text-[11px] text-[#67563c]">
                      {[line.standard, line.grade, line.quantity ? line.quantity + " " +
                        (line.quantityMode === "bars" ? "barre" : line.quantityMode === "meters" ? "m" : "t") : ""].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-[#8b5c1b]">
                      {candidate.status === "invalid" ? "Informazioni da correggere" :
                        candidate.status === "needs_review" ? "Richiede chiarimenti" : "In attesa di conferma"}
                    </p>
                  </li>
                );
              })}
            </ul>
            {candidates.length > 12 ? <p className="mt-2 text-xs text-[#52615b]">Altre {candidates.length - 12} proposte nel thread.</p> : null}
            <p className="mt-2 text-[11px] leading-4 text-[#715a35]">Le proposte non vengono salvate né conteggiate finché non le confermi.</p>
          </section>
        ) : null}

        <section aria-label="Articoli confermati" data-testid="commercial-rfq-approved-lines">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-[0.07em] text-[#315e49]">In distinta</h4>
            <span className="text-xs font-semibold text-[#315e49]">{approvedLines.length} righe</span>
          </div>
          {approvedLines.length === 0 ? (
            <div className="mt-3 rounded-xl bg-[#f3f7f4] px-3 py-4 text-center">
              <p className="text-sm font-semibold text-[#36584a]">Nessun articolo confermato</p>
              <p className="mt-1 text-xs leading-5 text-[#607467]">
                Scrivi una richiesta, analizzala e approva i materiali. La distinta si aggiornerà qui.
              </p>
            </div>
          ) : (
            <ul className="mt-2 max-h-72 divide-y divide-[#e1ece5] overflow-y-auto rounded-xl border border-[#e0e9e1]">
              {approvedLines.slice(0, 12).map((line, i) => {
                const calculatedLine = calculated[i];
                return (
                  <li key={line.id} className="px-3 py-2.5">
                    <p className="break-words text-xs font-semibold leading-5 text-[#173f35]">
                      {i + 1}. {line.description || "Articolo da completare"}
                    </p>
                    <p className="mt-0.5 break-words text-[11px] text-[#54665a]">
                      {[line.standard, line.grade, line.quantity ? line.quantity + " " +
                        (line.quantityMode === "bars" ? "barre" : line.quantityMode === "meters" ? "m" : "t") : ""].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-[#315e49]">
                      {calculatedLine.complete ? "Confermato · " + fmt(calculatedLine.tonnes ?? 0, 3) + " t" : "Da completare"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          {approvedLines.length > 12 ? <p className="mt-2 text-xs text-[#52615b]">Altri {approvedLines.length - 12} articoli nel carrello.</p> : null}
          {approvedLines.length > 0 ? (
            <button type="button" onClick={onOpenEditor} className="mt-2 min-h-10 text-xs font-semibold text-[#175640] underline underline-offset-4">
              Modifica gli articoli nella distinta
            </button>
          ) : null}
        </section>
      </div>

      <div className="mt-4 border-t border-[#e1e9e1] pt-3">
        <label className="block text-xs font-semibold text-[#34594c]">
          Nome della distinta
          <input value={title} onChange={(e) => onTitleChange(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-[#c1d5c9] bg-white px-3 text-sm text-[#173f35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]" />
        </label>
        {approvedLines.length > 0 ? (
          <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-[#f3f8f4] p-3">
            <div><dt className="text-[11px] text-[#54685d]">Metri</dt><dd className="text-sm font-bold tabular-nums text-[#173f35]">{fmt(totals.totalMeters, 2)} m</dd></div>
            <div><dt className="text-[11px] text-[#54685d]">Tonnellate</dt><dd className="text-sm font-bold tabular-nums text-[#173f35]">{fmt(totals.totalTonnes, 3)} t</dd></div>
          </dl>
        ) : null}
        {!allComplete && approvedLines.length > 0 ? (
          <p className="mt-2 text-xs text-[#875117]">I totali sono parziali. Correggi le righe prima di salvare.</p>
        ) : null}
        <div className="mt-3 grid gap-2">
          <button type="button" onClick={onSave} disabled={!canSave || Boolean(savedId)}
            className="min-h-11 rounded-lg bg-[#175640] px-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {savePending ? "Salvataggio…" : savedId ? "Distinta salvata ✓" : "Salva distinta privata"}
          </button>
          <button type="button" onClick={onCreateRfq} disabled={!canSave}
            className="min-h-11 rounded-lg border border-[#175640] bg-white px-3 text-sm font-bold text-[#175640] disabled:cursor-not-allowed disabled:opacity-50">
            {rfqPending ? "Creazione…" : "Crea RFQ privata →"}
          </button>
        </div>
        {saveMessage ? <p role="status" className="mt-2 text-xs text-[#315e49]">{saveMessage}</p> : null}
        {rfqMessage ? <p role="alert" className="mt-2 text-xs text-[#8c511c]">{rfqMessage}</p> : null}
        <p className="mt-3 text-[11px] leading-4 text-[#53675b]">
          Salvare o creare una RFQ privata non invia messaggi ai fornitori.
        </p>
      </div>
    </aside>
  );
}

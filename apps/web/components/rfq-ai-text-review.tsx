"use client";

import { useState } from "react";
import { calculateBuyerDistintaLine, type BuyerDistintaDraftLine } from "@/lib/buyer-distinta";
import { normalizeRfqAiCandidate, type RfqAiLineCandidate, type RfqAiRawLine } from "@/lib/rfq-ai-intake-contract";
import type { RfqAiTextDraftResult } from "@/lib/rfq-ai-free-text";

/** Explicit per-line human confirmation. No browser-generated candidate is
 * trusted by any backend; existing RFQ save actions revalidate final lines. */
export function RfqAiTextReview({
  result, onInsert, onDismiss,
}: {
  result: RfqAiTextDraftResult;
  onInsert: (rows: BuyerDistintaDraftLine[]) => void;
  onDismiss: () => void;
}) {
  const [candidates, setCandidates] = useState(result.candidates);
  const [raw, setRaw] = useState(result.rawById);
  const [lengthDisplay, setLengthDisplay] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});

  function change(candidate: RfqAiLineCandidate, patch: Partial<RfqAiRawLine>) {
    const nextRaw = { ...raw[candidate.candidateId], ...patch };
    setRaw((previous) => ({ ...previous, [candidate.candidateId]: nextRaw }));
    const next = normalizeRfqAiCandidate(
      candidate.source, candidate.candidateId, candidate.locator,
      candidate.sourceIntent, nextRaw,
    );
    // Corrected information is user-provided evidence, never an original AI
    // extraction: preserve its distinct origin for RFQAI7 audit migration.
    const evidenceKeys: Record<string, keyof typeof next.proposedLine> = {
      standard: "standard", grade: "grade", quantity: "quantity",
      quantityUnit: "quantityMode", lengthMm: "barLengthM",
    };
    for (const [key, value] of Object.entries(patch)) {
      const field = evidenceKeys[key];
      if (field) next.evidence[field] = {
        origin: "human", locator: { ...candidate.locator },
        rawValue: value === null || value === undefined ? null : String(value),
      };
    }
    setCandidates((previous) => previous.map((row) => row.candidateId === candidate.candidateId ? next : row));
    setConfirmed((previous) => ({ ...previous, [candidate.candidateId]: false }));
  }

  function canConfirm(row: RfqAiLineCandidate) {
    return row.sourceIntent === "buyer_request" &&
      row.sourceExcerpt.length > 0 &&
      row.issues.every((issue) => issue.severity !== "error") &&
      Boolean(row.proposedLine.standard && row.proposedLine.grade) &&
      calculateBuyerDistintaLine(row.proposedLine).complete;
  }
  const selected = candidates.filter((candidate) =>
    confirmed[candidate.candidateId] && canConfirm(candidate),
  );
  function insertConfirmed() {
    if (!selected.length) return;
    // The existing Distinta builder will create its own unique IDs and
    // clear saved RFQ state. Nothing is submitted or emailed here.
    onInsert(selected.map((row) => row.proposedLine));
  }

  return (
    <section className="rfqai3-review" aria-label="Revisione degli articoli estratti">
      <header className="rfqai3-review-heading">
        <div>
          <p className="rfqai2-panel-kicker">AI · Proposte da verificare</p>
          <h4>{candidates.length} {candidates.length === 1 ? "articolo individuato" : "articoli individuati"}</h4>
          <p>Correggi le informazioni mancanti e conferma soltanto le righe da aggiungere alla distinta.</p>
        </div>
        <button type="button" className="rfqai2-secondary-action" onClick={onDismiss}>Chiudi risultati</button>
      </header>
      {result.warnings.map((warning, i) => <p className="rfqai3-warning" key={i}>{warning}</p>)}
      {candidates.map((candidate, i) => {
        const editable = canConfirm(candidate);
        const source = raw[candidate.candidateId] ?? {};
        return (
          <article className="rfqai3-candidate" key={candidate.candidateId} aria-label={"Articolo AI " + (i + 1)}>
            <div className="rfqai3-candidate-head">
              <strong>{i + 1}. {candidate.proposedLine.description || "Geometria non riconosciuta"}</strong>
              <span>{candidate.status === "invalid" ? "Dati non validi" :
                candidate.status === "needs_review" ? "Da completare" : "Da verificare"}</span>
            </div>
            {candidate.sourceExcerpt ? (
              <p className="rfqai3-source" title="Testo originale">Fonte: “{candidate.sourceExcerpt}”</p>
            ) : (
              <p className="rfqai3-warning">Nessun estratto testuale verificabile: ricrea l'articolo nel configuratore manuale.</p>
            )}
            <div className="rfqai3-candidate-grid">
              <label>Norma
                <select value={candidate.proposedLine.standard || String(source.standard ?? "")}
                  onChange={(event) => change(candidate, { standard: event.target.value })}>
                  <option value="">Da specificare</option>
                  <option value="EN 10219">EN 10219</option>
                  <option value="EN 10210">EN 10210</option>
                </select>
              </label>
              <label>Grado
                <input value={String(source.grade ?? "")} maxLength={80}
                  onChange={(event) => change(candidate, { grade: event.target.value })}
                  placeholder="Es. S355J2H" />
              </label>
              <label>Quantità
                <input inputMode="decimal" value={String(source.quantity ?? "")} maxLength={40}
                  onChange={(event) => change(candidate, { quantity: event.target.value })}
                  placeholder="Es. 30" />
              </label>
              <label>Unità
                <select value={String(source.quantityUnit ?? "").toUpperCase() === "PACCHI" ? "" : candidate.proposedLine.quantityMode === "bars" && candidate.proposedLine.quantity ? "PZ" : candidate.proposedLine.quantityMode === "meters" ? "M" : candidate.proposedLine.quantityMode === "tonnes" ? "T" : ""}
                  onChange={(event) => change(candidate, { quantityUnit: event.target.value })}>
                  <option value="">Da specificare</option>
                  <option value="PZ">Pezzi / barre</option>
                  <option value="M">Metri</option>
                  <option value="T">Tonnellate</option>
                </select>
              </label>
              <label>Lunghezza singola barra (m)
                <input inputMode="decimal" maxLength={40} value={lengthDisplay[candidate.candidateId] ??
                  (source.lengthMm === null || source.lengthMm === undefined || source.lengthMm === "" ? "" :
                    String(Number(String(source.lengthMm).replace(",", ".")) / 1000))}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLengthDisplay((previous) => ({ ...previous, [candidate.candidateId]: value }));
                    const v = value.trim();
                    const n = v ? Number(v.replace(",", ".")) : null;
                    change(candidate, { lengthMm: n !== null && Number.isFinite(n) ? String(n * 1000) : v ? "invalid" : "" });
                  }}
                  placeholder="Es. 12" />
              </label>
              <div className="rfqai3-theoretical">
                <span>Peso teorico</span>
                <strong>{candidate.proposedLine.weightKgM || "—"} kg/m</strong>
              </div>
            </div>
            {candidate.issues.length ? (
              <ul className="rfqai3-issues" aria-label="Elementi da verificare">
                {candidate.issues.map((issue, j) => <li key={j}>
                  {issue.severity === "error" ? "Errore" : "Verifica"}: {issue.code.replaceAll("_", " ")}
                </li>)}
              </ul>
            ) : null}
            {candidate.sourceIntent !== "buyer_request" ? (
              <p className="rfqai3-warning">Non classificata come richiesta di acquisto. Non trasferibile automaticamente: usa il configuratore manuale se necessario.</p>
            ) : null}
            <label className="rfqai3-confirm">
              <input type="checkbox" checked={Boolean(confirmed[candidate.candidateId])}
                disabled={!editable}
                onChange={(event) => setConfirmed((current) => ({
                  ...current, [candidate.candidateId]: event.target.checked,
                }))}/>
              <span>Ho verificato questo articolo e confermo i dati per la distinta.</span>
            </label>
          </article>
        );
      })}
      <div className="rfqai3-review-footer">
        <span>{selected.length} articoli confermati</span>
        <button type="button" className="rfqai2-primary-link" disabled={selected.length === 0}
          onClick={insertConfirmed}>
          Inserisci {selected.length} {selected.length === 1 ? "articolo" : "articoli"} nella distinta
        </button>
      </div>
      <p className="rfqai2-privacy-note">L'importazione crea soltanto righe locali modificabili. Salvataggio e invio RFQ rimangono azioni distinte con controlli server.</p>
    </section>
  );
}

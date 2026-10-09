"use client";

import { useState } from "react";
import { calculateBuyerDistintaLine, type BuyerDistintaDraftLine } from "@/lib/buyer-distinta";
import { normalizeRfqAiCandidate, type RfqAiLineCandidate, type RfqAiRawLine } from "@/lib/rfq-ai-intake-contract";
import type { RfqAiTextDraftResult } from "@/lib/rfq-ai-free-text";

type TubeShape = "unknown" | "round" | "square" | "rectangular";
function shapeOf(raw: RfqAiRawLine): TubeShape {
  const filled = (value: unknown) => value !== null && value !== undefined && String(value).trim().length > 0;
  const od = filled(raw.outerDiameterMm);
  const w = filled(raw.widthMm), h = filled(raw.heightMm);
  if (od && !w && !h) return "round";
  if (!od && w && h) {
    const width = Number(String(raw.widthMm).replace(",", "."));
    const height = Number(String(raw.heightMm).replace(",", "."));
    return Number.isFinite(width) && width === height ? "square" : "rectangular";
  }
  return "unknown";
}

function shown(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

/** Explicit per-line human confirmation. No browser-generated candidate is
 * trusted by any backend; existing RFQ save actions revalidate final lines. */
export function RfqAiTextReview({
  result, onInsert, onDismiss,
}: {
  result: RfqAiTextDraftResult;
  onInsert: (rows: BuyerDistintaDraftLine[]) => boolean;
  onDismiss: () => void;
}) {
  const [candidates, setCandidates] = useState(result.candidates);
  const [raw, setRaw] = useState(result.rawById);
  const [lengthDisplay, setLengthDisplay] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [transferError, setTransferError] = useState("");

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
      outerDiameterMm: "description", widthMm: "description",
      heightMm: "description", thicknessMm: "description",
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
    if (!onInsert(selected.map((row) => row.proposedLine))) {
      setTransferError("Limite di 500 righe: rimuovi articoli dalla distinta prima di importare.");
    } else {
      setTransferError("");
    }
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
        const shape = shapeOf(source);
        const hasHardGeometryIssue = candidate.issues.some((issue) =>
          issue.code === "invalid_geometry" || issue.code === "ambiguous_geometry" ||
          issue.code === "missing_dimensions"
        );
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
              <label className="rfqai3-geometry-wide">Sezione del tubo
                <select value={shape} aria-label="Forma del tubo"
                  onChange={(event) => {
                    const nextShape = event.target.value as TubeShape;
                    const base = { outerDiameterMm: null, widthMm: null, heightMm: null };
                    if (nextShape === "round") {
                      change(candidate, { ...base, outerDiameterMm: source.outerDiameterMm ?? "" });
                    } else if (nextShape === "square") {
                      const side = source.widthMm ?? source.heightMm ?? "";
                      change(candidate, { ...base, widthMm: side, heightMm: side });
                    } else if (nextShape === "rectangular") {
                      change(candidate, { ...base,
                        widthMm: source.widthMm ?? "", heightMm: source.heightMm ?? "" });
                    } else {
                      change(candidate, { ...base, thicknessMm: null });
                    }
                  }}>
                  <option value="unknown">Da specificare</option>
                  <option value="round">Tondo</option>
                  <option value="square">Quadro</option>
                  <option value="rectangular">Rettangolare</option>
                </select>
              </label>
              {shape === "round" ? (
                <label>Diametro esterno (mm)
                  <input inputMode="decimal" value={shown(source.outerDiameterMm)}
                    aria-label="Diametro esterno in millimetri"
                    onChange={(event) => change(candidate, { outerDiameterMm: event.target.value })}
                    placeholder="Es. 60,3" />
                </label>
              ) : null}
              {shape === "square" || shape === "rectangular" ? (
                <>
                  <label>{shape === "square" ? "Lato (mm)" : "Larghezza (mm)"}
                    <input inputMode="decimal" value={shown(source.widthMm)}
                      aria-label={shape === "square" ? "Lato in millimetri" : "Larghezza in millimetri"}
                      onChange={(event) => {
                        const value = event.target.value;
                        change(candidate, shape === "square" ? { widthMm: value, heightMm: value } : { widthMm: value });
                      }} placeholder="Es. 100" />
                  </label>
                  {shape === "rectangular" ? (
                    <label>Altezza (mm)
                      <input inputMode="decimal" value={shown(source.heightMm)}
                        aria-label="Altezza in millimetri"
                        onChange={(event) => change(candidate, { heightMm: event.target.value })}
                        placeholder="Es. 60" />
                    </label>
                  ) : null}
                </>
              ) : null}
              <label>Spessore (mm)
                <input inputMode="decimal" value={shown(source.thicknessMm)}
                  aria-label="Spessore in millimetri"
                  onChange={(event) => change(candidate, { thicknessMm: event.target.value })}
                  placeholder="Es. 5" />
              </label>
              {hasHardGeometryIssue ? (
                <p className="rfqai3-geometry-wide rfqai3-warning">
                  Verifica forma e dimensioni sopra: il peso kg/m sarà calcolato soltanto
                  con geometria fisicamente valida e norma riconosciuta.
                </p>
              ) : null}
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
            {!editable ? (
              <p className="rfqai3-warning" role="status">
                Conferma disabilitata: completa o correggi i dati segnalati, inclusi geometria,
                norma, grado, quantità e lunghezza delle barre. Il peso teorico deve essere valido.
              </p>
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
      {transferError ? <p role="alert" className="rfqai3-warning">{transferError}</p> : null}
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

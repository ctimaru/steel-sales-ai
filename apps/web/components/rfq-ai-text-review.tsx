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

/**
 * Explain only fields genuinely absent from the current extraction.
 * This is deterministic review guidance, not AI-generated geometry.
 */
function missingFieldQuestions(raw: RfqAiRawLine, shape: TubeShape): string[] {
  const missing = (value: unknown) => value === null || value === undefined || String(value).trim() === "";
  const questions: string[] = [];
  if (shape === "unknown") questions.push("Qual è la forma del tubo: tondo, quadro o rettangolare?");
  if (shape === "round" && missing(raw.outerDiameterMm)) questions.push("Qual è il diametro esterno in mm?");
  if ((shape === "square" || shape === "rectangular") && missing(raw.widthMm)) questions.push("Qual è il lato o la larghezza in mm?");
  if (shape === "rectangular" && missing(raw.heightMm)) questions.push("Qual è l'altezza in mm?");
  if (missing(raw.thicknessMm)) questions.push("Qual è lo spessore in mm?");
  if (missing(raw.standard)) questions.push("Qual è la norma richiesta (EN 10219 o EN 10210)?");
  if (missing(raw.grade)) questions.push("Qual è il grado dell'acciaio?");
  if (missing(raw.quantity)) questions.push("Qual è la quantità richiesta?");
  if (missing(raw.quantityUnit)) questions.push("La quantità è in barre, metri o tonnellate?");
  if (missing(raw.lengthMm) && /^(BARRE|PZ|PEZZI|PEZZO)$/i.test(String(raw.quantityUnit ?? ""))) questions.push("Qual è la lunghezza di ogni barra in metri?");
  return questions;
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
  const [quickAnswers, setQuickAnswers] = useState<Record<string, string>>({});
  const [quickErrors, setQuickErrors] = useState<Record<string, string>>({});

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

  function applyQuickAnswer(candidate: RfqAiLineCandidate, field: "thicknessMm" | "lengthMm" | "standard" | "grade" | "quantity" | "quantityUnit") {
    const response = (quickAnswers[candidate.candidateId] ?? "").trim();
    if (field === "standard" || field === "quantityUnit" || field === "grade") {
      const valid = field === "standard" ? ["EN 10219", "EN 10210"].includes(response) :
        field === "quantityUnit" ? ["PZ", "M", "T"].includes(response) :
        /^S(?:235|275|355|420|460)(?:JR|J0|J2|K2|NH|NL|MH|ML|H)?$/i.test(response);
      if (!valid) {
        setQuickErrors((old) => ({ ...old, [candidate.candidateId]: "Seleziona o inserisci un valore valido." }));
        return;
      }
      change(candidate, { [field]: field === "grade" ? response.toUpperCase() : response });
      setQuickAnswers((old) => ({ ...old, [candidate.candidateId]: "" }));
      setQuickErrors((old) => ({ ...old, [candidate.candidateId]: "" }));
      return;
    }
    // Only the active question determines meaning. Reject unrelated prose.
    const normalized = response.toLowerCase().trim();
    const words: Record<string, string> = { uno: "1", una: "1", due: "2", tre: "3", quattro: "4", cinque: "5", sei: "6", sette: "7", otto: "8", nove: "9", dieci: "10", dodici: "12" };
    const numberPhrase = normalized.replace(/^(?:sono|vorrei|mi servono|direi)\s+/i, "").trim();
    const matcher = field === "lengthMm" ? /^(\d{1,4}(?:[.,]\d{1,3})?|[a-z]+)\s*(?:m|metri|metro)?$/i :
      field === "thicknessMm" ? /^(\d{1,4}(?:[.,]\d{1,3})?|[a-z]+)\s*(?:mm|millimetri|millimetro)?$/i :
      /^(\d{1,4}(?:[.,]\d{1,3})?|[a-z]+)\s*(?:barre|barra|pezzi|pezzo|pz|metri|metro|m|tonnellate|tonnellata|t)?$/i;
    const match = numberPhrase.match(matcher);
    const parsed = match ? (words[match[1]] ?? match[1]) : "";
    if (!/^(?:\d{1,4})(?:[.,]\d{1,3})?$/.test(parsed) || Number(parsed.replace(",", ".")) <= 0) {
      setQuickErrors((old) => ({ ...old, [candidate.candidateId]: "Indica un numero positivo in millimetri o metri (es. 5 oppure 6,5)." }));
      return;
    }
    const number = Number(parsed.replace(",", "."));
    change(candidate, field === "lengthMm" ? { lengthMm: String(number * 1000) } : field === "quantity" ? { quantity: parsed, ...(/\s*(?:barre|barra|pezzi|pezzo|pz)$/i.test(numberPhrase) ? { quantityUnit: "PZ" } : /\s*(?:metri|metro|m)$/i.test(numberPhrase) ? { quantityUnit: "M" } : /\s*(?:tonnellate|tonnellata|t)$/i.test(numberPhrase) ? { quantityUnit: "T" } : {}) } : { thicknessMm: parsed });
    setLengthDisplay((old) => field === "lengthMm" ? ({ ...old, [candidate.candidateId]: response }) : old);
    setQuickAnswers((old) => ({ ...old, [candidate.candidateId]: "" }));
    setQuickErrors((old) => ({ ...old, [candidate.candidateId]: "" }));
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
        const missingQuestions = missingFieldQuestions(source, shape);
        const absent = (value: unknown) => value === null || value === undefined || String(value).trim() === "";
        const nextQuickField: "thicknessMm" | "lengthMm" | "standard" | "grade" | "quantity" | "quantityUnit" | null =
          shape !== "unknown" && absent(source.thicknessMm) ? "thicknessMm" :
          shape !== "unknown" && absent(source.lengthMm) && /^(BARRE|PZ|PEZZI|PEZZO)$/i.test(String(source.quantityUnit ?? "")) ? "lengthMm" :
          absent(source.standard) ? "standard" : absent(source.grade) ? "grade" : absent(source.quantity) ? "quantity" : absent(source.quantityUnit) ? "quantityUnit" : null;

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
            <div className="mt-3 rounded-xl border border-[#cbded3] bg-white p-3" data-rfqai-commercial-summary aria-label={"Sintesi commerciale articolo " + (i + 1)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm text-[#144e37]">Sintesi commerciale</strong>
                <span className="text-xs font-semibold text-[#56675f]">{editable ? "Pronto alla conferma" : "Da completare"}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <div><dt className="text-xs text-[#56675f]">Geometria</dt><dd className="font-medium text-[#153d2c]">{candidate.proposedLine.description || "Da definire"}</dd></div>
                <div><dt className="text-xs text-[#56675f]">Norma</dt><dd className="font-medium text-[#153d2c]">{shown(source.standard) || "Da definire"}</dd></div>
                <div><dt className="text-xs text-[#56675f]">Qualità</dt><dd className="font-medium text-[#153d2c]">{shown(source.grade) || "Da definire"}</dd></div>
                <div><dt className="text-xs text-[#56675f]">Quantità</dt><dd className="font-medium text-[#153d2c]">{shown(source.quantity) || "Da definire"} {shown(source.quantityUnit)}</dd></div>
                <div><dt className="text-xs text-[#56675f]">Lunghezza barra</dt><dd className="font-medium text-[#153d2c]">{source.lengthMm === null || source.lengthMm === undefined || source.lengthMm === "" ? "Da definire" : (Number(String(source.lengthMm).replace(",", ".")) / 1000).toLocaleString("it-IT") + " m"}</dd></div>
                <div><dt className="text-xs text-[#56675f]">Peso teorico</dt><dd className="font-medium text-[#153d2c]">{editable ? candidate.proposedLine.weightKgM + " kg/m" : "Da verificare"}</dd></div>
              </dl>
              {missingQuestions.length ? <p className="mt-2 text-xs text-[#79511e]" data-rfqai-summary-missing>{missingQuestions.length} {missingQuestions.length === 1 ? "informazione mancante" : "informazioni mancanti"} · completa la richiesta prima della conferma</p> : null}
            </div>
            {candidate.sourceExcerpt ? (
              <p className="rfqai3-source" title="Testo originale">Fonte: “{candidate.sourceExcerpt}”</p>
            ) : (
              <p className="rfqai3-warning">Nessun estratto testuale verificabile: ricrea l'articolo nel configuratore manuale.</p>
            )}
            {nextQuickField ? (
              <div className="rounded-xl border border-[#b9d8c7] bg-[#f3faf6] p-3" data-rfqai-quick-reply>
                <p className="text-xs font-semibold text-[#144e37]">Assistente · Completiamo un dato alla volta</p>
                <label className="mt-2 block text-sm font-medium text-[#173f34]" htmlFor={`rfqai-reply-${candidate.candidateId}`}>
                  {nextQuickField === "thicknessMm" ? "Qual è lo spessore in millimetri?" : nextQuickField === "lengthMm" ? "Qual è la lunghezza di ogni barra in metri?" : nextQuickField === "standard" ? "Qual è la norma richiesta?" : nextQuickField === "grade" ? "Qual è il grado di acciaio?" : nextQuickField === "quantity" ? "Quanta quantità serve?" : "La quantità è in barre, metri o tonnellate?"}
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {nextQuickField === "standard" || nextQuickField === "quantityUnit" ? (
                    <select id={`rfqai-reply-${candidate.candidateId}`} className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#9fbcae] bg-white px-3 text-base text-[#173f34]"
                      value={quickAnswers[candidate.candidateId] ?? ""}
                      onChange={(event) => setQuickAnswers((old) => ({ ...old, [candidate.candidateId]: event.target.value }))}>
                      <option value="">Seleziona…</option>
                      {(nextQuickField === "standard" ? [["EN 10219", "EN 10219"], ["EN 10210", "EN 10210"]] :
                        [["PZ", "Barre / pezzi"], ["M", "Metri"], ["T", "Tonnellate"]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  ) : (
                    <input id={`rfqai-reply-${candidate.candidateId}`} type="text" inputMode={nextQuickField === "grade" ? "text" : "decimal"}
                      className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#9fbcae] bg-white px-3 text-base text-[#173f34]"
                      value={quickAnswers[candidate.candidateId] ?? ""}
                      placeholder={nextQuickField === "thicknessMm" ? "Es. 5" : nextQuickField === "lengthMm" ? "Es. 6" : nextQuickField === "grade" ? "Es. S355J2H" : "Es. 40"}
                      onChange={(event) => { setQuickAnswers((old) => ({ ...old, [candidate.candidateId]: event.target.value })); setQuickErrors((old) => ({ ...old, [candidate.candidateId]: "" })); }} />
                  )}
                  <button type="button" className="rfqai2-primary-link" onClick={() => applyQuickAnswer(candidate, nextQuickField)}>Applica risposta</button>
                </div>
                {quickErrors[candidate.candidateId] ? <p role="alert" className="rfqai3-warning">{quickErrors[candidate.candidateId]}</p> : null}
                <p className="mt-2 text-xs text-[#436554]">Aggiorna solo questo articolo. Gli altri campi restano invariati; la conferma finale è sempre manuale.</p>
              </div>
            ) : null}
            <details className="mt-3 rounded-xl border border-[#cbded3] bg-white p-3" open={!nextQuickField} data-rfqai-technical-details>
              <summary className="cursor-pointer text-sm font-semibold text-[#184d36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#236b4a]">
                Verifica e modifica tutti i dati tecnici
              </summary>
              <p className="mt-2 text-xs text-[#52675a]">I dati riconosciuti restano modificabili. Le informazioni mancanti non vengono stimate.</p>
            {missingQuestions.length > 0 ? (
              <div className="rfqai3-warning" role="group" aria-label="Domande per completare l'articolo" data-rfqai-missing-questions>
                <strong>Per completare questo articolo</strong>
                <p>Rispondi solo alle informazioni mancanti, usando i campi sottostanti. Nessun valore viene inventato.</p>
                <ul>
                  {missingQuestions.map((question) => <li key={question}>{question}</li>)}
                </ul>
              </div>
            ) : null}
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
            </details>
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

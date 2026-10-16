"use client";

/**
 * CALC-INT4.4B — Italian public calculator + inline technical bill.
 * Pure Buyer Distinta contract from 4.4A; NO RFQ creation or automatic prices.
 */
import { useEffect, useRef, useState } from "react";

import { PublicTubeWeightCalculator, type PublicTubeCalculatorInitialValues } from "@/components/public-tube-weight-calculator";
import type { PublicTubeDimensionSummary } from "@/lib/public-knowledge";
import type { CalculatorRfqItem } from "@/lib/calculator-rfq-handoff";
import type { BuyerDistintaDraftLine } from "@/lib/buyer-distinta";
import { buildBuyerDistintaPlainText, calculateBuyerDistintaLine } from "@/lib/buyer-distinta";
import { priceInputText, type PriceBasis } from "@/lib/calculator-commercial-pricing";
import {
  assignBuyerTargetToLine, buyerTargetPreview, captureBuyerTargetCandidate,
  editBuyerTargetForLine, matchesBuyerTargetWeight, pruneBuyerTargets,
  removeBuyerTarget, type BuyerTargetCandidate, type BuyerTargetState,
} from "@/lib/calculator-inline-buyer-target";
import {
  addInlineDistintaItem, duplicateInlineDistintaLine, editInlineDistintaLine,
  emptyInlineDistinta, inlineDistintaTotals, persistInlineDistintaSession,
  readInlineDistintaSession, removeInlineDistintaLine, INLINE_DISTINTA_MAX_LINES,
  type InlineDistintaResult, type InlineDistintaState,
} from "@/lib/calculator-inline-distinta";

type Editable = Pick<BuyerDistintaDraftLine,
  "quantityMode" | "quantity" | "barLengthM" | "grade" | "finish" | "note">;
const number = (value: number | null, digits: number) =>
  value === null || !Number.isFinite(value) ? "—" :
    value.toLocaleString("it-IT", { maximumFractionDigits: digits });
const control = "min-h-11 w-full rounded-lg border border-[#b8cfc3] bg-white px-3 text-sm text-[#143b2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#146747]";
const action = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b8d4c5] bg-white px-3 py-2 text-xs font-bold text-[#175840] hover:bg-[#edf7f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175840] disabled:cursor-not-allowed disabled:opacity-50";
const fieldLabels: { key: keyof Editable; label: string; type?: "number" | "text" }[] = [
  { key: "quantity", label: "Quantità" },
  { key: "barLengthM", label: "Lunghezza barra (m)" },
  { key: "grade", label: "Grado acciaio" },
  { key: "finish", label: "Finitura" },
  { key: "note", label: "Note" },
];
function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "line-" + Date.now() + "-" + Math.random().toString(36).slice(2, 12);
}

export function CalculatorInlineDistintaExperience({
  references, initialValues,
}: {
  references: PublicTubeDimensionSummary[];
  initialValues?: PublicTubeCalculatorInitialValues;
}) {
  const [state, setState] = useState<InlineDistintaState>(emptyInlineDistinta);
  const liveState = useRef<InlineDistintaState>(state);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Editable | null>(null);
  const [message, setMessage] = useState("");
  const [storageAvailable, setStorageAvailable] = useState(true);
  // Commercial rates intentionally live only in this mounted React experience.
  // Do not include them in the legacy 4.4A session draft or clipboard export.
  const [targets, setTargets] = useState<BuyerTargetState>({});
  const [pendingTarget, setPendingTarget] = useState<BuyerTargetCandidate | null>(null);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [targetRaw, setTargetRaw] = useState("");
  const [targetBasis, setTargetBasis] = useState<PriceBasis>("tonne");

  // Restore only in this browser tab, after hydration. No account, cookies or
  // URL payload; keep calculator SEO/server markup unchanged on initial render.
  useEffect(() => {
    let restored: InlineDistintaState | null = null;
    try { restored = readInlineDistintaSession(window.sessionStorage); }
    catch { /* Storage denial remains usable in memory. */ }
    if (restored?.lines.length) {
      liveState.current = restored;
      setState(restored);
      setOpen(true);
      setMessage("Distinta recuperata da questa scheda.");
    }
    setReady(true);
  }, []);

  function commit(result: InlineDistintaResult): boolean {
    if (!result.ok) {
      setMessage(result.reason === "full"
        ? "La distinta contiene già 50 righe. Elimina una riga per proseguire."
        : result.reason === "missing"
          ? "La riga non è più disponibile."
          : result.reason === "duplicate"
            ? "Questa operazione è già stata eseguita."
            : "Controlla i dati: quantità e lunghezza devono essere valide.");
      return false;
    }
    // Synchronous ref avoids lost updates on rapid clicks before React commits.
    liveState.current = result.state;
    setState(result.state);
    setTargets(current => pruneBuyerTargets(result.state, current));
    setOpen(result.state.lines.length > 0);
    let saved = false;
    try { saved = persistInlineDistintaSession(window.sessionStorage, result.state); }
    catch { /* sessionStorage property itself may be denied */ }
    if (!saved) setStorageAvailable(false);
    setMessage(saved
      ? "Distinta aggiornata. Nessuna RFQ è stata inviata."
      : "Distinta aggiornata. La memorizzazione della scheda non è disponibile: copia la distinta prima di uscire.");
    return true;
  }

  function add(item: CalculatorRfqItem): boolean {
    if (!ready) return false;
    const result = addInlineDistintaItem(liveState.current, item);
    return commit(result);
  }

  function beginEdit(line: BuyerDistintaDraftLine) {
    setEditingId(line.id);
    setDraft({
      quantityMode: line.quantityMode, quantity: line.quantity,
      barLengthM: line.barLengthM, grade: line.grade,
      finish: line.finish, note: line.note,
    });
    setMessage("");
  }

  function saveEdit(id: string) {
    if (!draft || !commit(editInlineDistintaLine(liveState.current, id, draft))) return;
    setEditingId(null);
    setDraft(null);
  }

  function chooseBuyerTarget(value: { basis: PriceBasis; raw: string; weightKgM: number }) {
    const candidate = captureBuyerTargetCandidate(value.raw, value.basis, value.weightKgM);
    if (!candidate) { setMessage("Prezzo non valido: inserisci un importo maggiore di zero."); return; }
    setPendingTarget(candidate);
    setOpen(true);
    setMessage("Target pronto. Seleziona esplicitamente la riga della distinta; nessun prezzo è stato salvato.");
  }

  function assignTarget(id: string) {
    if (!pendingTarget) return;
    const result = assignBuyerTargetToLine(liveState.current, targets, id, pendingTarget);
    if (!result.ok) {
      setMessage(result.reason === "weight-mismatch"
        ? "Il kg/m della riga non coincide con la misura usata nel convertitore. Seleziona la riga corretta."
        : "Target non valido oppure riga non trovata.");
      return;
    }
    setTargets(result.targets);
    setPendingTarget(null);
    setEditingTargetId(null);
    setMessage("Target buyer interno associato solo a questa riga, in memoria. Nessun dato inviato.");
  }

  function startTargetEdit(line: BuyerDistintaDraftLine) {
    const preview = buyerTargetPreview(line, targets);
    setEditingTargetId(line.id);
    setTargetBasis("tonne");
    setTargetRaw(preview ? priceInputText(preview.eurT, "it") : "");
  }

  function saveTargetEdit(id: string) {
    const result = editBuyerTargetForLine(liveState.current, targets, id, targetRaw, targetBasis);
    if (!result.ok) { setMessage("Controlla l'importo: deve essere un numero maggiore di zero."); return; }
    setTargets(result.targets);
    setEditingTargetId(null);
    setMessage("Target interno modificato. Resta solo in questa schermata, non nella copia tecnica.");
  }

  function copyBill() {
    const calculated = liveState.current.lines.map(calculateBuyerDistintaLine);
    if (!calculated.length || calculated.some(line => !line.complete)) {
      setMessage("Completa le righe prima di copiare la distinta.");
      return;
    }
    // Canonical 4.4A rows have blank targetEurT even if opt-in memory state has
    // private targets. Public clipboard/export NEVER uses the private map.
    const plain = buildBuyerDistintaPlainText("Richiesta di offerta", calculated);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      void navigator.clipboard.writeText(plain).then(
        () => setMessage("Distinta tecnica copiata. Nessun messaggio è stato inviato."),
        () => setMessage("Copia non riuscita: verifica i permessi degli appunti."),
      );
    } catch { setMessage("Copia non riuscita: verifica i permessi degli appunti."); }
  }

  const totals = inlineDistintaTotals(state);
  const count = state.lines.length;
  const bill = (
    <section id="distinta-inline" aria-labelledby="distinta-inline-title"
      className="mt-4 scroll-mt-24 rounded-[1.35rem] border border-[#c7ded0] bg-white shadow-[0_8px_30px_rgba(20,70,43,0.07)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#31755a]">CALCOLATORE → DISTINTA</p>
          <h2 id="distinta-inline-title" className="mt-1 text-lg font-bold text-[#123b30]">La tua distinta</h2>
          <p className="mt-1 text-xs leading-5 text-[#52685b]">
            {count ? `${count} ${count === 1 ? "articolo" : "articoli"} · ${number(totals?.totalMeters ?? null, 2)} m · ${number(totals?.totalTonnes ?? null, 4)} t`
              : "Aggiungi una misura dal calcolatore: comparirà qui senza cambiare pagina."}
          </p>
        </div>
        {count > 0 ? (
          <button type="button" className={action} aria-expanded={open} aria-controls="distinta-inline-lines"
            onClick={() => setOpen(v => !v)}>{open ? "Comprimi distinta" : `Mostra ${count} righe`}</button>
        ) : <span className="rounded-lg bg-[#edf5f0] px-3 py-2 text-xs font-semibold text-[#347055]">Gratuita · nessun login</span>}
      </div>

      {count > 0 && open ? (
        <div id="distinta-inline-lines" className="border-t border-[#dce9df] p-3 sm:p-5">
          {pendingTarget ? (
            <div data-target-pending className="mb-4 rounded-xl border border-[#c8d8a4] bg-[#f5f7eb] p-3 text-sm text-[#31452a]">
              <strong>Target da assegnare:</strong> {number(pendingTarget.priceEurT, 2)} €/t
              <p className="mt-1 text-xs">Calcolato sul peso {number(pendingTarget.sourceKgM, 3)} kg/m.
                Scegli qui sotto la riga corrispondente. Nessun trasferimento automatico.</p>
              <button type="button" className={action} onClick={() => setPendingTarget(null)}>Annulla selezione</button>
            </div>
          ) : null}
          <div className="space-y-3">
            {state.lines.map((line, index) => {
              const computed = calculateBuyerDistintaLine(line);
              const editing = editingId === line.id;
              const privateTarget = buyerTargetPreview(line, targets);
              const matchingPending = pendingTarget && matchesBuyerTargetWeight(line, pendingTarget);
              return <article key={line.id} className="rounded-xl border border-[#d5e4dc] bg-[#f7faf8] p-3 sm:p-4"
                aria-label={`Riga ${index + 1}: ${line.description}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[#e2f2e8] px-2 py-1 text-xs font-bold text-[#145a41]">{index + 1}</span>
                      <strong className="break-words text-sm leading-6 text-[#163b2d]">{line.description}</strong>
                    </div>
                    <p className="mt-1 text-xs text-[#496757]">{line.standard}{line.grade ? ` · ${line.grade}` : " · Grado da confermare"}</p>
                    <p className="mt-2 text-xs leading-6 text-[#365748]">
                      <strong>{number(computed.quantity, 2)}</strong> {line.quantityMode === "bars" ? "barre" : line.quantityMode === "meters" ? "m" : "t"}
                      {line.quantityMode === "bars" ? ` × ${number(computed.barLengthM, 2)} m` : ""}
                      {" · "}{number(computed.meters, 2)} m
                      {" · "}{number(computed.weightKgM, 3)} kg/m
                      {" · "}<strong>{number(computed.tonnes, 4)} t</strong>
                    </p>
                    {privateTarget ? (
                      <p data-buyer-target className="mt-2 rounded-lg bg-[#e6f3ea] px-3 py-2 text-xs font-semibold text-[#14553c]">
                        Target buyer riservato · {number(privateTarget.eurT, 2)} €/t · {number(privateTarget.eurM, 4)} €/m
                        <span className="block font-normal">Stima {number(privateTarget.estimatedTotal, 2)} € per questa riga, solo in questa schermata.</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={action} aria-expanded={editing}
                      aria-controls={`distinta-inline-edit-${line.id}`}
                      onClick={() => {
                        if (editing) { setEditingId(null); setDraft(null); }
                        else beginEdit(line);
                      }}>
                      {editing ? "Chiudi" : "Modifica"}
                    </button>
                    <button type="button" className={action} disabled={count >= INLINE_DISTINTA_MAX_LINES}
                      aria-label={`Duplica riga ${index + 1}`}
                      onClick={() => commit(duplicateInlineDistintaLine(liveState.current, line.id, makeId()))}>Duplica</button>
                    <button type="button" className={action} aria-label={`Rimuovi riga ${index + 1}`}
                      onClick={() => {
                        if (commit(removeInlineDistintaLine(liveState.current, line.id)) && editing) {
                          setEditingId(null); setDraft(null);
                        }
                      }}>Rimuovi</button>
                  </div>
                </div>
                {pendingTarget && matchingPending ? (
                  <button type="button" data-apply-private-target className={action + " mt-3"}
                    onClick={() => assignTarget(line.id)}>Associa target interno alla riga {index + 1}</button>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={action}
                    aria-expanded={editingTargetId === line.id}
                    aria-controls={`private-target-edit-${line.id}`}
                    onClick={() => editingTargetId === line.id ? setEditingTargetId(null) : startTargetEdit(line)}>
                    {privateTarget ? "Modifica target interno" : "Imposta target interno"}
                  </button>
                  {privateTarget ? <button type="button" className={action} onClick={() => {
                    setTargets(current => removeBuyerTarget(current, line.id));
                    setEditingTargetId(null);
                    setMessage("Target interno eliminato dalla riga.");
                  }}>Rimuovi target</button> : null}
                </div>
                {editingTargetId === line.id ? (
                  <div id={`private-target-edit-${line.id}`} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-[#d7e5dc] bg-white p-3">
                    <label className="text-xs font-bold text-[#315846]">Unità target
                      <select className={control} value={targetBasis}
                        onChange={e => { setTargetBasis(e.target.value as PriceBasis); setTargetRaw(""); }}>
                        <option value="tonne">€/ton</option><option value="metre">€/m</option>
                      </select>
                    </label>
                    <label className="text-xs font-bold text-[#315846]">Importo riservato
                      <input type="text" inputMode="decimal" autoComplete="off" className={control}
                        value={targetRaw} onChange={e => setTargetRaw(e.target.value)} placeholder="es. 850,00"/>
                    </label>
                    <button type="button" className={action} onClick={() => saveTargetEdit(line.id)}>Salva target</button>
                    <button type="button" className={action} onClick={() => setEditingTargetId(null)}>Annulla</button>
                    <p className="w-full text-xs text-[#526657]">Target di lavoro: non è un prezzo offerto dal fornitore,
                      non viene incluso nella copia e si perde al ricaricamento.</p>
                  </div>
                ) : null}
                {editing && draft ? <div id={`distinta-inline-edit-${line.id}`}
                  className="mt-4 grid gap-3 border-t border-[#d7e5dc] pt-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-[#315846]">
                    Unità quantità
                    <select className={control} value={draft.quantityMode}
                      onChange={event => setDraft(v => v ? { ...v, quantityMode: event.target.value as Editable["quantityMode"] } : v)}>
                      <option value="bars">Barre</option><option value="meters">Metri</option><option value="tonnes">Tonnellate</option>
                    </select>
                  </label>
                  {fieldLabels.map(({key,label}) => {
                    if (key === "barLengthM" && draft.quantityMode !== "bars") return null;
                    return <label key={key} className={`text-xs font-semibold text-[#315846] ${key === "note" ? "sm:col-span-2" : ""}`}>
                      {label}
                      <input type="text" className={control} value={draft[key]} maxLength={key === "note" ? 1200 : 150}
                        inputMode={key === "quantity" || key === "barLengthM" ? "decimal" : "text"}
                        onChange={event => setDraft(v => v ? { ...v, [key]: event.target.value } : v)}/>
                    </label>;
                  })}
                  <div className="sm:col-span-2 flex flex-wrap gap-2">
                    <button type="button" className="inline-flex min-h-11 items-center rounded-lg bg-[#176647] px-5 py-2 text-sm font-bold text-white hover:bg-[#104d35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176647]"
                      onClick={() => saveEdit(line.id)}>Salva riga</button>
                    <button type="button" className={action} onClick={() => {setEditingId(null);setDraft(null);}}>Annulla</button>
                  </div>
                  <p className="sm:col-span-2 text-xs leading-5 text-[#66796c]">
                    Per cambiare norma, sagoma, dimensioni o kg/m, prepara una nuova misura nel calcolatore.
                  </p>
                </div> : null}
              </article>;
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#eaf5ee] p-4">
            <div>
              <p className="text-xs font-bold text-[#29644c]">Totale distinta · peso teorico</p>
              <p className="mt-1 text-lg font-bold text-[#123c2c]">
                {number(totals?.totalMeters ?? null, 2)} m · {number(totals?.totalTonnes ?? null, 4)} t
              </p>
              <p className="mt-1 text-xs text-[#476658]">Il prezzo rapido passa al target buyer solo con due scelte esplicite. I target non sono inclusi nella copia e non vengono salvati nel browser.</p>
            </div>
            <button type="button" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#166346] px-5 py-3 text-sm font-bold text-white hover:bg-[#0e5035] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166346]"
              onClick={copyBill}>Copia distinta</button>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#577263]">
            La creazione della RFQ privata direttamente da qui arriverà con CALC-INT4.4D.
            Per ora puoi copiare gratuitamente le righe, senza inviarle a fornitori.
          </p>
        </div>
      ) : null}
      <p aria-live="polite" role="status" className="px-4 pb-3 text-xs font-semibold text-[#246044] sm:px-5">
        {message || (!ready ? "Preparazione della distinta…" : !storageAvailable ? "La memoria della scheda non è disponibile." : "")}
      </p>
    </section>
  );

  return <>
    <PublicTubeWeightCalculator references={references} initialValues={initialValues} locale="it"
      onAddToDistinta={add} canAddToDistinta={ready && count < INLINE_DISTINTA_MAX_LINES}
      inlinePublicDistinta inlineBillCount={count} onChooseBuyerTarget={chooseBuyerTarget} />
    {bill}
  </>;
}

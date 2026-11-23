"use client";

import Link from "next/link";
import { useState } from "react";

import { appRoutes } from "@/lib/routes";
import { guidedTubeGrades } from "@/lib/buyer-tube-guidance";
import { formatBuyerDocumentRequirements, type BuyerDistintaDocumentRequirements } from "@/lib/buyer-distinta-documents";
import type { BuyerDistintaCalculatedLine, BuyerDistintaDraftLine, BuyerQuantityMode } from "@/lib/buyer-distinta";

const unitShort: Record<BuyerQuantityMode, string> = { bars: "barre", meters: "m", tonnes: "t" };

function fmt(value: number | null, digits: number) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function missingText(line: BuyerDistintaDraftLine, calc: BuyerDistintaCalculatedLine) {
  const missing = [
    !line.description.trim() ? "articolo" : "",
    calc.quantity === null ? "quantità" : "",
    line.quantityMode === "bars" && calc.barLengthM === null ? "lunghezza barra" : "",
    calc.weightKgM === null ? "peso kg/m" : "",
    line.targetEurT.trim() && calc.targetEurT === null ? "target €/t valido" : "",
  ].filter(Boolean);
  return missing.length ? "Manca: " + missing.join(", ") : "Da completare";
}

/**
 * DISTINTA-SMART1: the Distinta is the centre of step 1. One compact row per
 * article (quantity editable in place), details on click, one primary action.
 * No drawer, no second «aggiungi» entry point: articles come from the box above.
 * Save and RFQ callbacks are the existing authorized builder actions.
 */
export function DistintaSheet({
  lines, calculated, totalMeters, totalTonnes, title, onTitleChange, ready,
  onUpdateLine, onChangeStandard, onDuplicate, onRemove,
  documents, onDocumentsChange,
  savedId, savePending, rfqPending, saveMessage, rfqMessage, onSave, onCreateRfq,
}: {
  lines: BuyerDistintaDraftLine[];
  calculated: BuyerDistintaCalculatedLine[];
  totalMeters: number;
  totalTonnes: number;
  title: string;
  onTitleChange: (value: string) => void;
  ready: boolean;
  onUpdateLine: (id: string, patch: Partial<BuyerDistintaDraftLine>) => void;
  onChangeStandard: (id: string, standard: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  documents: BuyerDistintaDocumentRequirements;
  onDocumentsChange: (next: BuyerDistintaDocumentRequirements) => void;
  savedId: string | null;
  savePending: boolean;
  rfqPending: boolean;
  saveMessage: string | null;
  rfqMessage: string | null;
  onSave: () => void;
  onCreateRfq: () => void;
}) {
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const allComplete = calculated.length > 0 && calculated.every((line) => line.complete);
  const incomplete = calculated.filter((line) => !line.complete).length;
  const busy = !ready || savePending || rfqPending;
  const documentsText = formatBuyerDocumentRequirements(documents);
  const input = "h-10 w-full rounded-lg border border-[#bfd0c5] bg-white px-2.5 text-sm text-[#173f35] outline-none focus:border-[#175640] focus:ring-2 focus:ring-[#175640]/15";
  const label = "block text-[11px] font-semibold text-[#3f564a]";

  return (
    <section aria-labelledby="distinta-sheet-title" data-testid="distinta-sheet"
      className="rounded-2xl border border-[#bfd0c5] bg-white shadow-[0_1px_3px_rgba(15,46,35,0.08)]">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-[#d3e0d7] px-3 py-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <label htmlFor="distinta-sheet-title" className="sr-only">Nome della distinta</label>
          {/* Disabled until the tab draft decision, so early keystrokes are never overwritten. */}
          <input id="distinta-sheet-title" value={title} disabled={!ready}
            onChange={(event) => onTitleChange(event.target.value)}
            className="distinta-bare-field w-full max-w-md rounded-md border bg-transparent px-1 py-0.5 text-base font-bold text-[#0f2e23]" />
          <p className="px-1 text-xs text-[#3f564a]">
            {lines.length} {lines.length === 1 ? "articolo" : "articoli"} · clic su una riga per norma, grado e note
          </p>
        </div>
        <span className="rounded-full border border-[#9fb4a7] bg-[#eef5f0] px-2.5 py-1 text-[11px] font-semibold text-[#175640]">
          {savedId ? "Salvata" : "Bozza privata"}
        </span>
      </header>

      <ol aria-label="Articoli della distinta" data-testid="distinta-sheet-lines" className="divide-y divide-[#d3e0d7]">
        {lines.map((line, index) => {
          const calc = calculated[index];
          const open = openRows[line.id] ?? !calc.complete;
          const detailsId = "distinta-row-details-" + line.id;
          return (
            <li key={line.id} id={"buyer-row-" + line.id} tabIndex={-1} data-complete={calc.complete ? "true" : "false"}
              className="px-3 py-2.5 sm:px-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto_4.5rem_auto]">
                <button type="button" aria-expanded={open} aria-controls={detailsId}
                  onClick={() => setOpenRows((current) => ({ ...current, [line.id]: !open }))}
                  className="min-w-0 rounded-md px-1 py-0.5 text-left hover:bg-[#f4f8f5]">
                  <span className="block truncate text-sm font-semibold text-[#173f35]">
                    <span className="mr-1.5 text-xs font-normal text-[#4a6155]">{index + 1}</span>
                    {line.description.trim() || "Articolo da compilare"}
                  </span>
                  <span className={"block truncate text-xs " + (calc.complete ? "text-[#3f564a]" : "font-semibold text-[#8c511c]")}>
                    {calc.complete
                      ? [line.standard || "Norma da indicare", line.grade, line.quantityMode === "bars" ? "barre da " + line.barLengthM + " m" : ""].filter(Boolean).join(" · ")
                      : missingText(line, calc)}
                  </span>
                </button>
                <span className="inline-flex items-center gap-1">
                  <label className="sr-only" htmlFor={"buyer-quantity-" + line.id}>Quantità riga {index + 1}</label>
                  <input id={"buyer-quantity-" + line.id} inputMode="decimal" autoComplete="off" value={line.quantity}
                    disabled={!ready} placeholder="0"
                    onChange={(event) => onUpdateLine(line.id, { quantity: event.target.value })}
                    className="h-9 w-16 rounded-lg border border-[#bfd0c5] bg-white px-2 text-right text-sm tabular-nums text-[#173f35] outline-none focus:border-[#175640]" />
                  <span className="w-9 text-xs text-[#3f564a]">{unitShort[line.quantityMode]}</span>
                </span>
                <span className="hidden text-right text-sm tabular-nums text-[#173f35] sm:block">{fmt(calc.tonnes, 2)} t</span>
                <button type="button" onClick={() => onRemove(line.id)} aria-label={"Rimuovi riga " + (index + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[#4a6155] hover:bg-[#fbefe9] hover:text-[#8c431e]">×</button>
              </div>

              <div id={detailsId} hidden={!open} className="mt-2 grid gap-2 rounded-xl bg-[#f6faf7] p-3 sm:grid-cols-3">
                <label className={label + " sm:col-span-3"}>
                  Articolo
                  <input value={line.description} onChange={(event) => onUpdateLine(line.id, { description: event.target.value })}
                    placeholder="Tubo quadro 100 × 100 × 4 mm" className={input + " mt-1"} />
                </label>
                <label className={label}>
                  Norma
                  <select aria-label={"Norma della riga " + (index + 1)} value={line.standard}
                    onChange={(event) => onChangeStandard(line.id, event.target.value)} className={input + " mt-1"}>
                    <option value="">Scegli</option>
                    <option value="EN 10219">EN 10219</option>
                    <option value="EN 10210">EN 10210</option>
                    {line.standard && !["EN 10219", "EN 10210"].includes(line.standard)
                      ? <option value={line.standard}>{line.standard}</option> : null}
                  </select>
                </label>
                <label className={label}>
                  Grado
                  <input list="distinta-sheet-grades" aria-label={"Grado della riga " + (index + 1)} value={line.grade}
                    onChange={(event) => onUpdateLine(line.id, { grade: event.target.value })}
                    placeholder="S355J2H" className={input + " mt-1"} />
                </label>
                <label className={label}>
                  Unità
                  <select value={line.quantityMode}
                    onChange={(event) => onUpdateLine(line.id, { quantityMode: event.target.value as BuyerQuantityMode })}
                    className={input + " mt-1"}>
                    <option value="bars">Barre</option>
                    <option value="meters">Metri</option>
                    <option value="tonnes">Tonnellate</option>
                  </select>
                </label>
                {line.quantityMode === "bars" ? (
                  <label className={label}>
                    Lunghezza barra (m)
                    <input inputMode="decimal" value={line.barLengthM}
                      onChange={(event) => onUpdateLine(line.id, { barLengthM: event.target.value })}
                      placeholder="12" className={input + " mt-1"} />
                  </label>
                ) : null}
                <label className={label}>
                  Peso kg/m
                  <input inputMode="decimal" value={line.weightKgM}
                    onChange={(event) => onUpdateLine(line.id, { weightKgM: event.target.value })}
                    placeholder="kg/m" className={input + " mt-1"} />
                </label>
                <label className={label}>
                  Finitura
                  <input list="distinta-sheet-finishes" value={line.finish}
                    onChange={(event) => onUpdateLine(line.id, { finish: event.target.value })}
                    placeholder="Nero / zincato" className={input + " mt-1"} />
                </label>
                <label className={label}>
                  Target €/t (facoltativo)
                  <input inputMode="decimal" value={line.targetEurT}
                    onChange={(event) => onUpdateLine(line.id, { targetEurT: event.target.value })}
                    placeholder="Facoltativo" className={input + " mt-1"} />
                </label>
                <label className={label + " sm:col-span-2"}>
                  Note
                  <input value={line.note} onChange={(event) => onUpdateLine(line.id, { note: event.target.value })}
                    placeholder="Tolleranze, consegna…" className={input + " mt-1"} />
                </label>
                <div className="flex items-end justify-between gap-2 sm:col-span-3">
                  <span className="text-xs text-[#3f564a]">{fmt(calc.meters, 2)} m · {fmt(calc.tonnes, 3)} t</span>
                  <button type="button" onClick={() => onDuplicate(line.id)}
                    disabled={!line.description.trim() || lines.length >= 500}
                    className="min-h-9 rounded-lg px-2 text-xs font-semibold text-[#175640] underline underline-offset-4 disabled:opacity-40">
                    Duplica riga
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <datalist id="distinta-sheet-grades">{guidedTubeGrades.map((value) => <option key={value} value={value} />)}</datalist>
      <datalist id="distinta-sheet-finishes"><option value="Nero" /><option value="Zincato" /><option value="Decapato" /></datalist>

      <footer className="space-y-3 border-t border-[#d3e0d7] px-3 py-3 sm:px-4">
        <details className="group text-xs text-[#36584a]">
          <summary className="inline-flex min-h-8 cursor-pointer items-center gap-1 font-semibold">
            Documenti richiesti {documentsText ? "· " + documentsText : "· facoltativi"}
            <span aria-hidden="true" className="text-[#4a6155] group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-2 grid gap-2 rounded-xl bg-[#f6faf7] p-3 sm:grid-cols-3">
            <label className={label}>
              Certificato EN 10204
              <select value={documents.inspectionDocument}
                onChange={(event) => onDocumentsChange({ ...documents, inspectionDocument: event.target.value as BuyerDistintaDocumentRequirements["inspectionDocument"] })}
                className={input + " mt-1"}>
                <option value="">Non specificato</option>
                <option value="2.1">2.1 · Dichiarazione conformità</option>
                <option value="2.2">2.2 · Rapporto di prova</option>
                <option value="3.1">3.1 · Certificato materiale</option>
                <option value="3.2">3.2 · Con ispezione indipendente</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-[#36584a]">
              <input type="checkbox" checked={documents.ceDop}
                onChange={(event) => onDocumentsChange({ ...documents, ceDop: event.target.checked })} />
              Marcatura CE + DoP, se applicabili
            </label>
            <label className="flex items-center gap-2 text-xs text-[#36584a]">
              <input type="checkbox" checked={documents.iso9001}
                onChange={(event) => onDocumentsChange({ ...documents, iso9001: event.target.checked })} />
              Produttore certificato UNI EN ISO 9001
            </label>
            <p className="text-[11px] text-[#3f564a] sm:col-span-3">Vale per tutta la richiesta, non per il singolo articolo.</p>
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#36584a]">
            {fmt(totalMeters, 0)} m · <span className="font-bold tabular-nums text-[#143f30]">{fmt(totalTonnes, 2)} t</span>
            {incomplete ? <span className="ml-2 text-xs font-semibold text-[#8c511c]">{incomplete === 1 ? "1 riga da completare" : incomplete + " righe da completare"}</span> : null}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {savedId ? (
              <Link href={appRoutes.rfqHub.savedDistinta(savedId)} data-testid="comm-rfq-saved-distinta-link"
                className="text-xs font-semibold text-[#175640] underline underline-offset-4">
                Distinta salvata ✓
              </Link>
            ) : (
              <button type="button" onClick={onSave} disabled={busy || !allComplete}
                className="min-h-10 text-xs font-semibold text-[#175640] underline underline-offset-4 disabled:text-[#9aaba1] disabled:no-underline">
                {savePending ? "Salvataggio…" : "Salva solo la distinta"}
              </button>
            )}
            <button type="button" onClick={onCreateRfq} disabled={busy} data-testid="distinta-choose-suppliers"
              className="inline-flex min-h-11 items-center rounded-xl bg-[#175640] px-5 text-sm font-bold text-white hover:bg-[#104632] disabled:cursor-not-allowed disabled:opacity-60">
              {rfqPending ? "Preparazione…" : "Scegli i fornitori →"}
            </button>
          </div>
        </div>
        {saveMessage ? <p role="status" className="text-xs text-[#315e49]">{saveMessage}</p> : null}
        {rfqMessage ? <p role="alert" className="text-xs font-semibold text-[#8c511c]">{rfqMessage}</p> : null}
        <p className="text-[11px] text-[#3f564a]">Scegliere i fornitori non invia nulla: l’invio parte solo dopo la tua conferma.</p>
      </footer>
    </section>
  );
}

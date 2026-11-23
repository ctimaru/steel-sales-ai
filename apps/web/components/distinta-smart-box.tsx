"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import type { BuyerDistintaCatalogOption } from "@/lib/buyer-distinta-catalog";
import type { BuyerQuantityMode } from "@/lib/buyer-distinta";
import { guidedTubeGrades, type GuidedTubeStandard } from "@/lib/buyer-tube-guidance";
import { buildQuickAddIndex, parseQuickAddMeasure, suggestQuickAdd, type QuickAddSuggestion } from "@/lib/distinta-quick-add";
import { readSmartBoxHints, smartBoxIntent } from "@/lib/distinta-smart-box";
import type { FocusedAiControls } from "@/components/rfq-ai-intake-ux";

export const DISTINTA_SMART_BOX_ID = "distinta-smart-box";

export type DistintaSmartArticle = {
  description: string;
  /** null only for a free row: the kg/m is completed on the row. */
  weightKgM: number | null;
  standard: GuidedTubeStandard;
  grade: string;
  quantityMode: BuyerQuantityMode;
  quantity: string;
  barLengthM: string;
  catalog: BuyerDistintaCatalogOption | null;
  source: QuickAddSuggestion["kind"];
};

type ListItem = QuickAddSuggestion | { kind: "ai"; key: "ai"; description: string };

const unitLabels: Record<BuyerQuantityMode, string> = { bars: "barre", meters: "metri", tonnes: "tonnellate" };
const shapeMarks = { round_tube: "○", square_tube: "□", rectangular_tube: "▭" } as const;
const searchExamples = ["quadro 100x100x5", "tondo 60,3x3"];
const aiExample = "40 barre quadro 100x100x5 S355J2H da 12 m";

function fmt(value: number, digits = 3) {
  return value.toLocaleString("it-IT", { maximumFractionDigits: digits });
}

/**
 * DISTINTA-SMART1 (founder decision, 23 Nov 2026): the only input of step 1.
 * A size shows the catalog; picking it asks only the quantity (unit, bar length,
 * norm and grade keep the last values and stay editable). A request with
 * quantities or several articles goes to the AI assistant with Enter, and its
 * proposals are reviewed right below before they enter the Distinta.
 * Nothing is saved or sent from here.
 */
export function DistintaSmartBox({
  ai, aiEnabled, catalogOptions, onAdd, disabled = false, autoFocus = false,
  initialQuery = "", initialStandard, corner,
}: {
  ai: FocusedAiControls;
  /** The assistant reads Italian only: other languages search sizes. */
  aiEnabled: boolean;
  catalogOptions: BuyerDistintaCatalogOption[];
  /** Returns false when the Distinta is full or not ready. */
  onAdd: (article: DistintaSmartArticle) => boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  initialQuery?: string;
  initialStandard?: GuidedTubeStandard;
  /** Small control at the end of the box footer (the bill language). */
  corner?: ReactNode;
}) {
  const listId = useId();
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<QuickAddSuggestion | null>(null);
  const [standard, setStandard] = useState<GuidedTubeStandard>(initialStandard ?? "EN 10219");
  const [grade, setGrade] = useState("");
  const [quantity, setQuantity] = useState("");
  const [quantityMode, setQuantityMode] = useState<BuyerQuantityMode>("bars");
  const [barLengthM, setBarLengthM] = useState("12");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const prefilled = useRef(false);

  // A site-search size handoff starts in the box, never analysed automatically.
  useEffect(() => {
    if (prefilled.current || !initialQuery) return;
    prefilled.current = true;
    ai.onChange(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const frame = window.requestAnimationFrame(() => boxRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus, disabled]);

  const value = ai.value;

  // Grows with pasted multi-line requests (up to ~7 lines), back to one line when emptied.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = Math.min(box.scrollHeight, 176) + "px";
  }, [value]);
  const intent = ai.hasProposals ? "correction" : smartBoxIntent(value, aiEnabled);
  const index = useMemo(() => buildQuickAddIndex(catalogOptions), [catalogOptions]);
  const deferredValue = useDeferredValue(value);
  const hints = useMemo(() => readSmartBoxHints(deferredValue), [deferredValue]);
  const searchStandard = hints.standard ?? standard;
  const items = useMemo<ListItem[]>(() => {
    if (selected || ai.hasProposals || smartBoxIntent(deferredValue, aiEnabled) !== "search") return [];
    const found: ListItem[] = suggestQuickAdd(index, hints.query, searchStandard, 8);
    if (aiEnabled && deferredValue.trim().length >= 12) {
      found.push({ kind: "ai", key: "ai", description: deferredValue.trim() });
    }
    return found;
  }, [selected, ai.hasProposals, deferredValue, aiEnabled, index, hints.query, searchStandard]);
  const showList = open && items.length > 0 && value.trim().length > 0;
  const activeIndex = Math.min(active, Math.max(0, items.length - 1));

  function changeText(next: string) {
    ai.onChange(next);
    setSelected(null);
    setActive(0);
    setOpen(true);
    setMessage(null);
  }

  function choose(item: ListItem) {
    if (item.kind === "ai") { analyze(); return; }
    // Norm and grade typed next to the size apply to this and the next articles.
    if (hints.standard) setStandard(hints.standard);
    if (hints.grade) setGrade(hints.grade);
    setSelected(item);
    ai.onChange(item.description);
    setOpen(false);
    setMessage(null);
    // Synchronous: a deferred focus could steal keystrokes typed meanwhile.
    quantityRef.current?.focus();
  }

  function analyze() {
    if (disabled || ai.pending || value.trim().length < 3) return;
    setOpen(false);
    setMessage(null);
    ai.onAnalyze();
  }

  function resetSelection() {
    ai.onChange("");
    setSelected(null);
    setActive(0);
    boxRef.current?.focus();
  }

  function submit() {
    if (disabled || !selected) return;
    const amount = Number(quantity.trim().replace(",", "."));
    if (!quantity.trim() || !Number.isFinite(amount) || amount <= 0) {
      setMessage({ tone: "error", text: "Inserisci la quantità." });
      quantityRef.current?.focus();
      return;
    }
    if (quantityMode === "bars" && !Number.isInteger(amount)) {
      setMessage({ tone: "error", text: "Le barre sono un numero intero." });
      quantityRef.current?.focus();
      return;
    }
    const length = Number(barLengthM.trim().replace(",", "."));
    if (quantityMode === "bars" && (!Number.isFinite(length) || length <= 0)) {
      setOptionsOpen(true);
      setMessage({ tone: "error", text: "Indica la lunghezza della barra in metri." });
      return;
    }
    // A theoretical (unpublished) size follows the norm chosen after picking it.
    const weightKgM = selected.kind === "free" ? null
      : selected.kind === "computed" ? parseQuickAddMeasure(selected.description, standard)?.weightKgM ?? selected.weightKgM
        : selected.weightKgM;
    const added = onAdd({
      description: selected.description,
      weightKgM,
      standard,
      grade: grade.trim(),
      quantityMode,
      quantity: quantity.trim(),
      barLengthM: barLengthM.trim() || "12",
      catalog: selected.kind === "catalog" ? selected.option : null,
      source: selected.kind,
    });
    if (!added) {
      setMessage({ tone: "error", text: "Distinta piena o non pronta: rimuovi una riga e riprova." });
      return;
    }
    setMessage({
      tone: "ok",
      text: "Aggiunto: " + selected.description + " · " + quantity.trim() + " " + unitLabels[quantityMode] +
        (selected.kind === "free" ? ". Completa il peso sulla riga." : "."),
    });
    setQuantity("");
    setOptionsOpen(false);
    resetSelection();
  }

  function onBoxKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") { setOpen(false); return; }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && items.length && !selected) {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
      return;
    }
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (selected) { quantityRef.current?.focus(); return; }
    if (intent === "ai" || intent === "correction") { analyze(); return; }
    const pick = items[activeIndex];
    if (pick) choose(pick);
    else if (value.trim()) setMessage({ tone: "error", text: "Nessuna misura trovata: prova ad esempio quadro 100x100x5." });
  }

  function onFieldEnter(event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  }

  const field = "h-10 rounded-lg border border-[#c9dccf] bg-white px-2.5 text-sm text-[#173f35] outline-none focus:border-[#175640] focus:ring-2 focus:ring-[#175640]/15 disabled:opacity-50";
  const placeholder = ai.hasProposals ? "Correggi una proposta, ad esempio: riga 2: 20 barre"
    : aiEnabled ? "Cerca una misura o scrivi la richiesta: 40 barre quadro 100x100x5, S355, 12 m"
      : "Cerca una misura: quadro 100x100x5, tondo 60,3x3";
  const recentTurns = ai.turns.slice(-3);
  const optionsSummary = (quantityMode === "bars" ? "barre da " + (barLengthM.trim() || "12") + " m" : unitLabels[quantityMode]) +
    " · " + standard + (grade.trim() ? " · " + grade.trim() : "");

  return (
    <section data-testid="distinta-smart-box" aria-label="Aggiungi articoli alla distinta"
      className="rounded-2xl border border-[#d6e5db] bg-white p-3 sm:p-4">
      <div className="relative">
        <label htmlFor={DISTINTA_SMART_BOX_ID} className="sr-only">
          {aiEnabled ? "Cerca una misura o scrivi la richiesta" : "Cerca una misura"}
        </label>
        <div className={"flex items-start gap-2 rounded-xl border bg-white px-3 py-2 transition focus-within:ring-2 focus-within:ring-[#175640]/15 " +
          (selected ? "border-[#175640]" : "border-[#b8d2c4] focus-within:border-[#175640]")}>
          <span aria-hidden="true" className="pt-1 text-[#6b8475]">
            {selected && selected.kind !== "free" ? shapeMarks[selected.family] : "⌕"}
          </span>
          <textarea
            ref={boxRef}
            id={DISTINTA_SMART_BOX_ID}
            rows={1}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            aria-activedescendant={showList ? listId + "-" + activeIndex : undefined}
            autoComplete="off"
            spellCheck={false}
            maxLength={12000}
            disabled={disabled || ai.pending}
            value={value}
            placeholder={placeholder}
            onClick={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onChange={(event) => changeText(event.target.value)}
            onKeyDown={onBoxKeyDown}
            className={"max-h-44 min-h-7 w-full flex-1 resize-none border-0 bg-transparent py-0.5 text-[15px] leading-6 text-[#173f35] outline-none placeholder:text-[#7b8f82] disabled:opacity-60 " +
              (selected ? "font-semibold" : "")}
          />
          {selected ? (
            <button type="button" onClick={resetSelection} aria-label="Cambia articolo"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#52695b] hover:bg-[#eef5f0]">×</button>
          ) : intent === "ai" || intent === "correction" ? (
            <button type="button" onClick={analyze} disabled={disabled || ai.pending || value.trim().length < 3}
              aria-label={ai.hasProposals ? "Correggi proposta" : "Analizza la richiesta con l'assistente"}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[#175640] px-3 text-xs font-bold text-white hover:bg-[#104632] disabled:opacity-50">
              {ai.pending ? "Analisi…" : ai.hasProposals ? "Correggi" : "Analizza"} <span aria-hidden="true">↵</span>
            </button>
          ) : null}
        </div>

        {showList ? (
          <ul id={listId} role="listbox" aria-label="Articoli trovati"
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-[#cfe0d5] bg-white p-1 shadow-[0_14px_36px_rgba(19,65,43,0.16)]">
            {items.map((item, i) => (
              <li key={item.key} id={listId + "-" + i} role="option" aria-selected={i === activeIndex}
                onPointerDown={(event) => event.preventDefault()}
                onPointerMove={() => { if (activeIndex !== i) setActive(i); }}
                onClick={() => choose(item)}
                className={"flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5 text-sm " +
                  (i === activeIndex ? "bg-[#eaf4ee] " : "") +
                  (item.kind === "free" || item.kind === "ai" ? "mt-1 border-t border-[#e3ece6] pt-2 text-[#175640]" : "text-[#173f35]")}>
                <span aria-hidden="true" className="w-4 shrink-0 text-center text-[#6b8475]">
                  {item.kind === "ai" ? "✦" : item.kind === "free" ? "＋" : shapeMarks[item.family]}
                </span>
                {item.kind === "ai" ? (
                  <span className="min-w-0 truncate">Chiedi all’assistente: «{item.description}»</span>
                ) : item.kind === "free" ? (
                  <span className="min-w-0 truncate">Aggiungi «<strong>{item.description}</strong>» come riga libera</span>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate font-semibold">{item.description}</span>
                    <span className="shrink-0 text-xs tabular-nums text-[#52695b]">{fmt(item.weightKgM)} kg/m</span>
                    {item.kind === "computed" ? (
                      <span className="shrink-0 rounded-full bg-[#fff4e0] px-2 py-0.5 text-[10px] font-semibold text-[#7a5418]">calcolato</span>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {selected ? (
        <div data-testid="distinta-smart-quantity" className="mt-2 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={listId + "-qty"}>Quantità</label>
          <input ref={quantityRef} id={listId + "-qty"} inputMode="decimal" autoComplete="off" disabled={disabled}
            value={quantity} onChange={(event) => { setQuantity(event.target.value); setMessage(null); }}
            onKeyDown={onFieldEnter} placeholder="Quantità"
            className={field + " w-28 text-right tabular-nums"} />
          <button type="button" onClick={() => setOptionsOpen((current) => !current)} aria-expanded={optionsOpen}
            aria-controls={listId + "-options"}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm text-[#36584a] hover:bg-[#f2f8f4]">
            {optionsSummary} <span aria-hidden="true" className="text-xs text-[#6b8475]">{optionsOpen ? "▴" : "▾"}</span>
          </button>
          <button type="button" onClick={submit} disabled={disabled}
            className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#175640] px-4 text-sm font-bold text-white hover:bg-[#104632] disabled:opacity-50">
            Aggiungi <span aria-hidden="true">↵</span>
          </button>
          {optionsOpen ? (
            <div id={listId + "-options"} className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-[#f5f9f6] p-2">
              <label className="sr-only" htmlFor={listId + "-unit"}>Unità</label>
              <select id={listId + "-unit"} value={quantityMode} onChange={(event) => setQuantityMode(event.target.value as BuyerQuantityMode)}
                className={field + " w-32"}>
                <option value="bars">barre</option>
                <option value="meters">metri</option>
                <option value="tonnes">tonnellate</option>
              </select>
              {quantityMode === "bars" ? (
                <span className="inline-flex items-center gap-1 text-xs text-[#52695b]">
                  da
                  <input aria-label="Lunghezza barra in metri" inputMode="decimal" value={barLengthM}
                    onChange={(event) => setBarLengthM(event.target.value)} onKeyDown={onFieldEnter}
                    className={field + " w-14 text-right tabular-nums"} />
                  m
                </span>
              ) : null}
              <select aria-label="Norma" value={standard} onChange={(event) => setStandard(event.target.value as GuidedTubeStandard)}
                className={field + " w-28"}>
                <option value="EN 10219">EN 10219</option>
                <option value="EN 10210">EN 10210</option>
              </select>
              <input aria-label="Grado" list={listId + "-grades"} value={grade} placeholder="Grado (facoltativo)"
                onChange={(event) => setGrade(event.target.value)} onKeyDown={onFieldEnter}
                className={field + " w-40"} />
              <datalist id={listId + "-grades"}>{guidedTubeGrades.map((value) => <option key={value} value={value} />)}</datalist>
              <p className="w-full text-[11px] text-[#5c7063]">Valgono anche per i prossimi articoli. Ogni riga resta modificabile nella distinta.</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
        {!selected && !value.trim() && !ai.turns.length && !message ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#6b7f73]">Esempi:</span>
            {[...searchExamples, ...(aiEnabled ? [aiExample] : [])].map((example) => (
              <button key={example} type="button" disabled={disabled}
                onClick={() => { changeText(example); boxRef.current?.focus(); }}
                className="min-h-7 rounded-full border border-[#d6e5db] bg-white px-2.5 text-[11px] font-medium text-[#175640] hover:bg-[#eef7f1]">
                {example}
              </button>
            ))}
          </div>
        ) : !selected && value.trim() && !message ? (
          <p className="min-w-0 flex-1 px-1 text-[11px] leading-4 text-[#5c7063]">
            {intent === "correction" ? "Correggi una riga alla volta (es. riga 2: 20 barre) e confermala qui sotto."
              : intent === "ai" ? "Invio: l’assistente prepara gli articoli, tu li controlli prima che entrino in distinta. Maiusc+Invio per andare a capo."
                : "Scegli la misura con le frecce e Invio."}
          </p>
        ) : <span />}
        {corner ? <div className="ml-auto shrink-0">{corner}</div> : null}
      </div>

      <p role="status" aria-live="polite"
        className={"min-h-0 px-1 text-xs font-semibold empty:hidden " + (message?.tone === "error" ? "mt-1.5 text-[#8c431e]" : "mt-1.5 text-[#1d5748]")}>
        {message ? (message.tone === "ok" ? "✓ " : "") + message.text : ""}
      </p>

      {recentTurns.length || ai.pending || ai.review || ai.error ? (
        <div role="log" aria-label="Assistente della distinta" aria-live="polite" aria-relevant="additions"
          data-testid="distinta-smart-thread" className="mt-3 space-y-2 border-t border-[#e3ece6] pt-3">
          {recentTurns.map((turn) => (
            <div key={turn.id} className={turn.role === "user" ? "flex justify-end" : "flex items-start gap-2"}>
              {turn.role === "assistant" ? (
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#175640] text-[11px] text-white">✦</span>
              ) : null}
              <p className={turn.role === "user"
                ? "max-w-[88%] whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-[#eaf3ee] px-3 py-2 text-sm leading-5 text-[#173f35]"
                : "max-w-[calc(100%-2rem)] whitespace-pre-wrap break-words text-sm leading-5 text-[#2c4738]"}>
                {turn.content}
              </p>
            </div>
          ))}
          {ai.pending ? (
            <p role="status" className="flex items-center gap-2 text-sm text-[#52695b]">
              <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-[#175640] text-[11px] text-white">✦</span>
              Sto leggendo la richiesta…
            </p>
          ) : null}
          {ai.review ? <div data-testid="distinta-smart-review" className="min-w-0">{ai.review}</div> : null}
          {ai.error ? (
            <p role="alert" className="rounded-lg border border-[#e8cbb4] bg-[#fff8f2] px-3 py-2 text-sm text-[#8c431e]">
              {ai.error} Il testo resta nella casella per correggerlo.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

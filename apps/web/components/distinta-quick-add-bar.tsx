"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import type { BuyerDistintaCatalogOption } from "@/lib/buyer-distinta-catalog";
import type { BuyerQuantityMode } from "@/lib/buyer-distinta";
import { guidedTubeGrades, type GuidedTubeStandard } from "@/lib/buyer-tube-guidance";
import {
  buildQuickAddIndex,
  suggestQuickAdd,
  type QuickAddSuggestion,
} from "@/lib/distinta-quick-add";

export const DISTINTA_QUICK_ADD_SEARCH_ID = "distinta-quick-add-search";

export type DistintaQuickAddArticle = {
  description: string;
  /** null only for a free row: the kg/m is completed in the Distinta editor. */
  weightKgM: number | null;
  standard: GuidedTubeStandard;
  grade: string;
  quantityMode: BuyerQuantityMode;
  quantity: string;
  barLengthM: string;
  catalog: BuyerDistintaCatalogOption | null;
  source: QuickAddSuggestion["kind"];
};

const unitLabels: Record<BuyerQuantityMode, string> = { bars: "barre", meters: "metri", tonnes: "tonnellate" };
const shapeMarks = { round_tube: "○", square_tube: "□", rectangular_tube: "▭" } as const;
const examples = ["quadro 100x100x5", "tondo 60,3x3", "120x80x4"];

function fmt(value: number, digits = 2) {
  return value.toLocaleString("it-IT", { maximumFractionDigits: digits });
}

/**
 * DISTINTA-QUICK1: one row to add an article. Type a size, pick it with the
 * arrows, write the quantity, press Enter. The focus returns to the search so
 * the next article starts immediately. Nothing is saved or sent from here.
 */
export function DistintaQuickAddBar({
  catalogOptions, grade, onGradeChange, onAdd, disabled = false, autoFocus = false, initialQuery = "",
  initialStandard,
}: {
  catalogOptions: BuyerDistintaCatalogOption[];
  grade: string;
  onGradeChange: (value: string) => void;
  /** Returns false when the Distinta is full or not ready. */
  onAdd: (article: DistintaQuickAddArticle) => boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  initialQuery?: string;
  initialStandard?: GuidedTubeStandard;
}) {
  const listId = useId();
  const gradeListId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<QuickAddSuggestion | null>(null);
  const [standard, setStandard] = useState<GuidedTubeStandard>(initialStandard ?? "EN 10219");
  const [quantity, setQuantity] = useState("");
  const [quantityMode, setQuantityMode] = useState<BuyerQuantityMode>("bars");
  const [barLengthM, setBarLengthM] = useState("12");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Built once per catalog: each keystroke only compares precomputed strings.
  const index = useMemo(() => buildQuickAddIndex(catalogOptions), [catalogOptions]);
  const deferredQuery = useDeferredValue(query);
  const suggestions = useMemo(
    () => (selected ? [] : suggestQuickAdd(index, deferredQuery, standard, 8)),
    [index, deferredQuery, standard, selected],
  );
  const showList = open && !selected && suggestions.length > 0 && query.trim().length > 0;
  const activeIndex = Math.min(active, Math.max(0, suggestions.length - 1));

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus({ preventScroll: true });
      searchRef.current?.scrollIntoView({ block: "center", behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus, disabled]);

  function choose(suggestion: QuickAddSuggestion) {
    setSelected(suggestion);
    setQuery(suggestion.description);
    setOpen(false);
    setMessage(null);
    // Synchronous: a deferred focus could steal keystrokes typed into another field meanwhile.
    quantityRef.current?.focus();
  }

  function clearSelection() {
    setSelected(null);
    setActive(0);
  }

  function submit() {
    if (disabled) return;
    const pick = selected ?? (query.trim() ? suggestions[activeIndex] ?? null : null);
    if (!pick) {
      setMessage({ tone: "error", text: "Scrivi una misura, ad esempio quadro 100x100x5." });
      searchRef.current?.focus();
      return;
    }
    const amount = Number(quantity.trim().replace(",", "."));
    if (!quantity.trim() || !Number.isFinite(amount) || amount <= 0) {
      if (!selected) choose(pick);
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
      setMessage({ tone: "error", text: "Indica la lunghezza della barra in metri." });
      return;
    }
    const added = onAdd({
      description: pick.description,
      weightKgM: pick.kind === "free" ? null : pick.weightKgM,
      standard,
      grade: grade.trim(),
      quantityMode,
      quantity: quantity.trim(),
      barLengthM: barLengthM.trim() || "12",
      catalog: pick.kind === "catalog" ? pick.option : null,
      source: pick.kind,
    });
    if (!added) {
      setMessage({ tone: "error", text: "Distinta piena o non pronta: rimuovi una riga e riprova." });
      return;
    }
    setMessage({
      tone: "ok",
      text: "Aggiunto: " + pick.description + " · " + quantity.trim() + " " + unitLabels[quantityMode] +
        (pick.kind === "free" ? ". Completa il peso nella distinta." : "."),
    });
    setQuery("");
    setQuantity("");
    setSelected(null);
    setActive(0);
    searchRef.current?.focus();
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!suggestions.length) return;
      event.preventDefault();
      setOpen(true);
      setActive((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (selected) { quantityRef.current?.focus(); return; }
      const pick = suggestions[activeIndex];
      if (pick) choose(pick);
    }
  }

  function onFieldEnter(event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  }

  const field = "h-11 rounded-xl border border-[#c9dccf] bg-white px-3 text-sm text-[#173f35] outline-none transition focus:border-[#175640] focus:ring-2 focus:ring-[#175640]/15 disabled:opacity-50";

  return (
    <section data-testid="distinta-quick-add" aria-labelledby={listId + "-title"}
      className="mb-3 rounded-2xl border border-[#cfe0d5] bg-gradient-to-b from-white to-[#f6faf7] p-3 shadow-[0_6px_22px_rgba(19,65,43,0.05)]">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id={listId + "-title"} className="text-sm font-bold text-[#143f30]">Aggiungi articolo</h3>
        <p className="hidden text-[11px] text-[#5c7063] sm:block">Misura, quantità, Invio. Per più righe insieme scrivi alla chat qui sotto.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative min-w-0">
          <label htmlFor={DISTINTA_QUICK_ADD_SEARCH_ID} className="sr-only">Cerca una misura o scrivi un articolo</label>
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6b8475]">
            {selected && selected.kind !== "free" ? shapeMarks[selected.family] : "⌕"}
          </span>
          <input
            ref={searchRef}
            id={DISTINTA_QUICK_ADD_SEARCH_ID}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            aria-activedescendant={showList ? listId + "-" + activeIndex : undefined}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            value={query}
            placeholder="Es. quadro 100x100x5, tondo 60,3x3, 120x80x4"
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onChange={(event) => {
              setQuery(event.target.value);
              clearSelection();
              setOpen(true);
              setMessage(null);
            }}
            onKeyDown={onSearchKeyDown}
            className={field + " w-full pl-9 " + (selected ? "pr-9 font-semibold" : "")}
          />
          {selected ? (
            <button type="button" onClick={() => { setQuery(""); clearSelection(); searchRef.current?.focus(); }}
              aria-label="Cambia articolo"
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#52695b] hover:bg-[#eef5f0]">
              ×
            </button>
          ) : null}
          {showList ? (
            <ul id={listId} role="listbox" aria-label="Articoli trovati"
              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-[#cfe0d5] bg-white p-1 shadow-[0_14px_36px_rgba(19,65,43,0.16)]">
              {suggestions.map((suggestion, i) => (
                <li key={suggestion.key} id={listId + "-" + i} role="option" aria-selected={i === activeIndex}
                  onPointerDown={(event) => event.preventDefault()}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => choose(suggestion)}
                  className={"flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5 text-sm " +
                    (i === activeIndex ? "bg-[#eaf4ee]" : "") +
                    (suggestion.kind === "free" ? " mt-1 border-t border-[#e3ece6] pt-2 text-[#175640]" : " text-[#173f35]")}>
                  <span aria-hidden="true" className="w-4 shrink-0 text-center text-[#6b8475]">
                    {suggestion.kind === "free" ? "＋" : shapeMarks[suggestion.family]}
                  </span>
                  {suggestion.kind === "free" ? (
                    <span className="min-w-0 truncate">Aggiungi «<strong>{suggestion.description}</strong>» come riga libera</span>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate font-semibold">{suggestion.description}</span>
                      <span className="shrink-0 text-xs tabular-nums text-[#52695b]">{fmt(suggestion.weightKgM, 3)} kg/m</span>
                      {suggestion.kind === "computed" ? (
                        <span className="shrink-0 rounded-full bg-[#fff4e0] px-2 py-0.5 text-[10px] font-semibold text-[#7a5418]">calcolato</span>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={listId + "-qty"}>Quantità</label>
          <input ref={quantityRef} id={listId + "-qty"} inputMode="decimal" autoComplete="off" disabled={disabled}
            value={quantity} onChange={(event) => { setQuantity(event.target.value); setMessage(null); }}
            onKeyDown={onFieldEnter} placeholder="Q.tà"
            className={field + " w-20 text-right tabular-nums"} />
          <label className="sr-only" htmlFor={listId + "-unit"}>Unità</label>
          <select id={listId + "-unit"} value={quantityMode} disabled={disabled}
            onChange={(event) => setQuantityMode(event.target.value as BuyerQuantityMode)}
            className={field + " w-[7.5rem] pr-2"}>
            <option value="bars">barre</option>
            <option value="meters">metri</option>
            <option value="tonnes">tonnellate</option>
          </select>
          {quantityMode === "bars" ? (
            <span className="inline-flex items-center gap-1">
              <label className="sr-only" htmlFor={listId + "-len"}>Lunghezza barra in metri</label>
              <span aria-hidden="true" className="text-xs text-[#52695b]">da</span>
              <input id={listId + "-len"} inputMode="decimal" autoComplete="off" disabled={disabled}
                value={barLengthM} onChange={(event) => setBarLengthM(event.target.value)} onKeyDown={onFieldEnter}
                className={field + " w-14 px-2 text-right tabular-nums"} />
              <span aria-hidden="true" className="text-xs text-[#52695b]">m</span>
            </span>
          ) : null}
          <button type="button" onClick={submit} disabled={disabled}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#175640] px-4 text-sm font-bold text-white hover:bg-[#104632] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:cursor-not-allowed disabled:opacity-50">
            Aggiungi <span aria-hidden="true">↵</span>
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#4f6b5b]">
        <div role="group" aria-label="Norma" className="inline-flex rounded-full border border-[#d6e5db] bg-white p-0.5">
          {(["EN 10219", "EN 10210"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={standard === value} disabled={disabled}
              onClick={() => setStandard(value)}
              className={"min-h-7 rounded-full px-2.5 font-semibold transition " +
                (standard === value ? "bg-[#175640] text-white" : "text-[#4f6b5b] hover:text-[#143f30]")}>
              {value}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1.5">
          <span>Grado</span>
          <input list={gradeListId} value={grade} disabled={disabled} aria-label="Grado"
            onChange={(event) => onGradeChange(event.target.value)} onKeyDown={onFieldEnter}
            placeholder="facoltativo"
            className="h-7 w-28 rounded-lg border border-[#d6e5db] bg-white px-2 text-xs text-[#173f35] outline-none focus:border-[#175640]" />
          <datalist id={gradeListId}>{guidedTubeGrades.map((value) => <option key={value} value={value} />)}</datalist>
        </label>
        <span className="hidden text-[11px] text-[#6b7f73] sm:inline">Valgono per i prossimi articoli.</span>
        {!query.trim() && !message ? (
          <span className="hidden flex-wrap items-center gap-1.5 sm:flex">
            <span className="text-[11px] text-[#6b7f73]">Prova:</span>
            {examples.map((example) => (
              <button key={example} type="button" disabled={disabled}
                onClick={() => { setQuery(example); clearSelection(); setOpen(true); searchRef.current?.focus(); }}
                className="min-h-7 rounded-full border border-[#d6e5db] bg-white px-2.5 text-[11px] font-medium text-[#175640] hover:bg-[#eef7f1]">
                {example}
              </button>
            ))}
          </span>
        ) : null}
      </div>

      <p role="status" aria-live="polite"
        className={"min-h-4 pt-1.5 text-xs font-semibold " + (message?.tone === "error" ? "text-[#8c431e]" : "text-[#1d5748]")}>
        {message ? (message.tone === "ok" ? "✓ " : "") + message.text : ""}
      </p>
    </section>
  );
}

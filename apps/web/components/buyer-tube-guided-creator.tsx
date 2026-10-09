"use client";

import { guidedTubeToBuyerLine } from "@/lib/buyer-guided-commercial-line";

import { useEffect, useId, useState } from "react";

import type { BuyerDistintaCatalogOption } from "@/lib/buyer-distinta-catalog";
import {
  guidedTubeGrades,
  guidedTubeMeasurement,
  
  newGuidedTubeDraft,
  suggestedGuidedDimensions,
  type GuidedDimension,
  type GuidedTubeDraft,
  type GuidedTubeFamily,
  type GuidedTubeStandard,
} from "@/lib/buyer-tube-guidance";

function GuidedDimensionInput({
  label, field, value, draft, catalogOptions, onChange,
}: {
  label: string;
  field: GuidedDimension;
  value: string;
  draft: GuidedTubeDraft;
  catalogOptions: BuyerDistintaCatalogOption[];
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const [focused, setFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const suggestions = suggestedGuidedDimensions(catalogOptions, draft, field, value);
  return (
    <label className="bd6-dimension-field">
      <span>{label} <span className="font-normal">mm</span></span>
      <input
        aria-label={label + " in millimetri"}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-controls={focused && suggestions.length ? listId : undefined}
        aria-activedescendant={focused && suggestions.length ? listId + "-option-" + Math.min(activeSuggestion, suggestions.length - 1) : undefined}
        aria-expanded={focused && suggestions.length > 0}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onFocus={() => { setActiveSuggestion(0); setFocused(true); }}
        onBlur={() => setFocused(false)}
        onChange={(event) => { setActiveSuggestion(0); onChange(event.target.value); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setFocused(false); return; }
          if (!suggestions.length || !focused) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveSuggestion((index) => (index + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveSuggestion((index) => (index - 1 + suggestions.length) % suggestions.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            onChange(suggestions[Math.min(activeSuggestion, suggestions.length - 1)]);
            setFocused(false);
          }
        }}
        placeholder="Inizia a scrivere…"
        className="bd6-input"
      />
      {focused && suggestions.length ? (
        <div id={listId} role="listbox" aria-label={"Suggerimenti " + label} className="bd6-suggestions">
          {suggestions.map((suggestion, index) => (
            <button
              type="button"
              role="option"
              id={listId + "-option-" + index}
              aria-selected={index === Math.min(activeSuggestion, suggestions.length - 1)}
              key={suggestion}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(suggestion);
                setFocused(false);
              }}
              className="bd6-suggestion"
            >
              {suggestion} <span className="text-xs font-normal">mm</span>
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}

export function BuyerTubeGuidedCreator({
  catalogOptions, onAdd, onDraftChange, canAdd, initialDraft,
}: {
  catalogOptions: BuyerDistintaCatalogOption[];
  initialDraft?: GuidedTubeDraft | null;
  onAdd: (draft: GuidedTubeDraft) => void;
  onDraftChange: (draft: GuidedTubeDraft) => void;
  canAdd: boolean;
}) {
  const [draft, setDraft] = useState<GuidedTubeDraft>(() => initialDraft ?? newGuidedTubeDraft());
  useEffect(() => { onDraftChange(draft); }, [draft, onDraftChange]);
  const measurement = guidedTubeMeasurement(draft);
  const completeLine = guidedTubeToBuyerLine(draft, "guided-preview");
  const chooseFamily = (family: GuidedTubeFamily) => {
    setDraft((current) => ({
      ...current, family, diameter: "", side: "", width: "", height: "", thickness: "",
    }));
  };
  const chooseStandard = (standard: GuidedTubeStandard) => {
    setDraft((current) => ({ ...current, standard }));
  };
  const patch = (next: Partial<GuidedTubeDraft>) =>
    setDraft((current) => ({ ...current, ...next }));
  const dimension = (label: string, field: GuidedDimension) => (
    <GuidedDimensionInput
      key={field}
      label={label}
      field={field}
      value={draft[field]}
      draft={draft}
      catalogOptions={catalogOptions}
      onChange={(value) => patch({ [field]: value })}
    />
  );

  return (
    <section className="bd6-configurator bd91-compact-configurator" aria-labelledby="bd6-config-title">
      <div className="bd6-config-head">
        <div>
          <p className="bd6-eyebrow">Configuratore commerciale · assistito</p>
          <h3 id="bd6-config-title" className="text-base font-extrabold text-[var(--brand-deep)]">
            Configura un articolo
          </h3>

        </div>
        <span className="bd6-step-indicator">Norma per articolo · mista consentita</span>
      </div>

      <div className="bd6-wizard-sections">
        <fieldset className="bd6-wizard-section">
          <legend className="bd6-wizard-label"><span>01</span> Tipo di tubo</legend>
          <div className="bd6-choice-grid bd6-choice-family">
            {([
              ["round_tube", "◯", "Tondo"],
              ["square_tube", "□", "Quadro"],
              ["rectangular_tube", "▭", "Rettangolare"],
            ] as const).map(([family, symbol, label]) => (
              <button
                key={family}
                type="button"
                aria-pressed={draft.family === family}
                onClick={() => chooseFamily(family)}
                className="bd6-choice"
              >
                <span className="bd6-shape-mark" aria-hidden="true">{symbol}</span>{label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="bd6-wizard-section" disabled={!draft.family}>
          <legend className="bd6-wizard-label"><span>02</span> Norma</legend>
          <div className="bd6-choice-grid bd6-choice-standard">
            {(["EN 10219", "EN 10210"] as const).map((standard) => (
              <button
                key={standard}
                type="button"
                aria-pressed={draft.standard === standard}
                disabled={!draft.family}
                onClick={() => chooseStandard(standard)}
                className="bd6-choice"
              >
                {standard}
                <small>{standard === "EN 10219" ? "Formati a freddo" : "Finiti a caldo"}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="bd6-wizard-section" disabled={!draft.standard}>
          <legend className="bd6-wizard-label"><span>03</span> Grado acciaio</legend>
          <label className="bd6-dimension-field">
            <span className="sr-only">Grado strutturale</span>
            <input
              list="bd6-grade-suggestions"
              value={draft.grade}
              disabled={!draft.standard}
              onChange={(event) => patch({ grade: event.target.value })}
              placeholder="Es. S355J2H"
              className="bd6-input"
            />
          </label>
          <datalist id="bd6-grade-suggestions">
            {guidedTubeGrades.map((grade) => <option key={grade} value={grade} />)}
          </datalist>
        </fieldset>

        <fieldset className="bd6-wizard-section bd6-dimensions" disabled={!draft.grade.trim()}>
          <legend className="bd6-wizard-label"><span>04</span> Dimensioni assistite</legend>

          <div className="bd6-dimension-grid">
            {draft.family === "round_tube" ? dimension("Diametro esterno", "diameter") : null}
            {draft.family === "square_tube" ? dimension("Lato", "side") : null}
            {draft.family === "rectangular_tube" ? (
              <>
                {dimension("Base", "width")}
                {dimension("Altezza", "height")}
              </>
            ) : null}
            {dimension("Spessore", "thickness")}
          </div>
          {draft.thickness.trim() && !measurement && draft.family && draft.standard && draft.grade.trim() ? (
            <p className="mt-2 text-xs font-semibold text-[var(--semantic-warning)]">
              Verifica le dimensioni: lo spessore deve essere positivo e inferiore a metà del lato minore.
            </p>
          ) : null}
        </fieldset>

        <fieldset className="bd6-wizard-section bd10-commercial-step" disabled={!measurement}>
          <legend className="bd6-wizard-label"><span>05</span> Quantità e condizioni</legend>
          <div className="bd10-commercial-grid">
            <label className="bd6-dimension-field">
              Quantità *
              <input
                inputMode="decimal"
                aria-label="Quantità articolo da inserire"
                value={draft.quantity}
                disabled={!measurement}
                onChange={(event) => patch({ quantity: event.target.value })}
                placeholder="Es. 20"
                className="bd6-input"
              />
            </label>
            <label className="bd6-dimension-field">
              Unità
              <select
                value={draft.quantityMode}
                disabled={!measurement}
                onChange={(event) => patch({ quantityMode: event.target.value as GuidedTubeDraft["quantityMode"] })}
                className="bd6-input"
              >
                <option value="bars">Barre / pezzi</option>
                <option value="meters">Metri</option>
                <option value="tonnes">Tonnellate</option>
              </select>
            </label>
            {draft.quantityMode === "bars" ? (
              <label className="bd6-dimension-field">
                Lunghezza barra (m) *
                <input
                  inputMode="decimal"
                  aria-label="Lunghezza barra in metri"
                  value={draft.barLengthM}
                  disabled={!measurement}
                  onChange={(event) => patch({ barLengthM: event.target.value })}
                  className="bd6-input"
                />
              </label>
            ) : null}
            <div className="bd10-weight-result" aria-label="Peso teorico calcolato">
              <span>Peso teorico</span>
              <strong>{measurement ? measurement.weightKgM.toLocaleString("it-IT", { maximumFractionDigits: 3 }) + " kg/m" : "— kg/m"}</strong>
            </div>
          </div>
          <details className="bd10-commercial-optional">
            <summary>Finitura, target prezzo e note · facoltativi</summary>
            <div className="bd10-commercial-grid">
              <label className="bd6-dimension-field">
                Finitura
                <input value={draft.finish} onChange={(event) => patch({ finish: event.target.value })}
                  placeholder="Nero / zincato" className="bd6-input" />
              </label>
              <label className="bd6-dimension-field">
                Target €/t
                <input inputMode="decimal" value={draft.targetEurT}
                  onChange={(event) => patch({ targetEurT: event.target.value })}
                  placeholder="Facoltativo" className="bd6-input" />
              </label>
              <label className="bd6-dimension-field">
                Note articolo
                <input value={draft.note} onChange={(event) => patch({ note: event.target.value })}
                  placeholder="Tolleranze, consegna…" className="bd6-input" />
              </label>
            </div>
          </details>
          {draft.quantity.trim() && !completeLine ? (
            <p className="mt-1 text-xs text-[var(--semantic-warning)]">
              Verifica quantità, lunghezza barra e target prezzo: devono essere positivi; le barre richiedono un numero intero.
            </p>
          ) : null}
        </fieldset>
      </div>

      <div className="bd6-wizard-result">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Anteprima articolo</p>
          <p className="mt-1 truncate text-sm font-bold text-[var(--brand-deep)]">
            {measurement ? `${measurement.description} · ${draft.standard} · ${draft.grade}` : "Seleziona i campi in sequenza"}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {completeLine ? `${draft.quantity} ${draft.quantityMode === "bars" ? "barre" : draft.quantityMode === "meters" ? "m" : "t"} · ${completeLine.weightKgM} kg/m · pronta per la distinta` : measurement ? "Indica la quantità per completare l’articolo." : "Seleziona forma, norma, grado e dimensioni."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!completeLine || !canAdd) return;
            onAdd(draft);
            setDraft((current) => ({
              ...current, standard: "", diameter: "", side: "", width: "", height: "", thickness: "", quantity: "", targetEurT: "", note: "", family: "", grade: "", finish: "",
            }));
          }}
          disabled={!completeLine || !canAdd}
          className="bd6-add-button"
        >
          Inserisci articolo completo
        </button>
      </div>
    </section>
  );
}

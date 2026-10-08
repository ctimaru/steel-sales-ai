"use client";

import { useId, useState } from "react";

import type { BuyerDistintaCatalogOption } from "@/lib/buyer-distinta-catalog";
import {
  guidedDocumentsNote,
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
        aria-controls={focused && suggestions.length ? listId : undefined}
        aria-expanded={focused && suggestions.length > 0}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onFocus={() => setFocused(true)}
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
        }
        placeholder="Inizia a scrivere…"
        className="bd6-input"
      />
      {focused && suggestions.length ? (
        <div id={listId} role="listbox" aria-label={"Suggerimenti " + label} className="bd6-suggestions">
          {suggestions.map((suggestion, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === activeSuggestion}
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
  catalogOptions, onAdd,
}: {
  catalogOptions: BuyerDistintaCatalogOption[];
  onAdd: (draft: GuidedTubeDraft) => void;
}) {
  const [draft, setDraft] = useState<GuidedTubeDraft>(newGuidedTubeDraft);
  const measurement = guidedTubeMeasurement(draft);
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
    <section className="bd6-configurator" aria-labelledby="bd6-config-title">
      <div className="bd6-config-head">
        <div>
          <p className="bd6-eyebrow">Configuratore commerciale · assistito</p>
          <h3 id="bd6-config-title" className="text-lg font-extrabold text-[var(--brand-deep)]">
            1. Componi il tuo tubo
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            Segui la sequenza: tipologia, norma, grado, dimensioni e documentazione.
            Il peso teorico dipende dalla norma selezionata, come nel calcolatore.
          </p>
        </div>
        <span className="bd6-step-indicator">Articolo assistito</span>
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
            <span>Grado strutturale</span>
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
          <p className="mb-2 text-xs text-[var(--text-secondary)]">
            Digita anche solo <strong>1</strong>: i suggerimenti arrivano dalle misure pubblicate in Knowledge.
            Puoi sempre inserire una misura diversa, da verificare con il fornitore.
          </p>
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

        <fieldset className="bd6-wizard-section" disabled={!measurement}>
          <legend className="bd6-wizard-label"><span>05</span> Documentazione richiesta</legend>
          <div className="bd6-documents">
            <label className="bd6-dimension-field">
              <span>Certificato di controllo EN 10204</span>
              <select
                value={draft.inspectionDocument}
                onChange={(event) => patch({ inspectionDocument: event.target.value })}
                disabled={!measurement}
                className="bd6-input"
              >
                <option value="">Non specificato</option>
                <option value="2.1">2.1 · Dichiarazione conformità</option>
                <option value="2.2">2.2 · Rapporto di prova</option>
                <option value="3.1">3.1 · Certificato materiale</option>
                <option value="3.2">3.2 · Con ispezione indipendente</option>
              </select>
            </label>
            <label className="bd6-check">
              <input type="checkbox" checked={draft.ceDop}
                disabled={!measurement}
                onChange={(event) => patch({ ceDop: event.target.checked })} />
              Marcatura CE + DoP, se applicabili
            </label>
            <label className="bd6-check">
              <input type="checkbox" checked={draft.iso9001}
                disabled={!measurement}
                onChange={(event) => patch({ iso9001: event.target.checked })} />
              Produttore certificato ISO 9001
            </label>
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            CE/DoP, certificati EN 10204 e ISO 9001 hanno scopi diversi; sono richieste al fornitore, non certificazioni emesse da Smart Steel Sales.
          </p>
        </fieldset>
      </div>

      <div className="bd6-wizard-result">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Anteprima articolo</p>
          <p className="mt-1 truncate text-sm font-bold text-[var(--brand-deep)]">
            {measurement ? `${measurement.description} · ${draft.standard} · ${draft.grade}` : "Seleziona i campi in sequenza"}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {measurement ? `Peso teorico ${measurement.weightKgM.toLocaleString("it-IT", { maximumFractionDigits: 3 })} kg/m · ${draft.standard}` : "Le dimensioni e il peso saranno calcolati appena completata la selezione."}
          </p>
          {guidedDocumentsNote(draft) ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{guidedDocumentsNote(draft)}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => {
            if (!measurement) return;
            onAdd(draft);
            setDraft((current) => ({
              ...current, diameter: "", side: "", width: "", height: "", thickness: "",
            }));
          }}
          disabled={!measurement}
          className="bd6-add-button"
        >
          + Aggiungi alla distinta
        </button>
      </div>
    </section>
  );
}

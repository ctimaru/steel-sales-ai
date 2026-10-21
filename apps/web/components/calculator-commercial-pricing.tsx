"use client";

import { useId, useState } from "react";
import { convertCommercialRate, parseCommercialRate, priceInputText, type PriceBasis } from "@/lib/calculator-commercial-pricing";
import type { TubeCalculatorLocale } from "@/lib/tube-calculator-locale";

const copy: Record<TubeCalculatorLocale, {
  title: string; private: string; tonne: string; metre: string;
  example: string; weight: string; unavailable: string; inputError: string;
  note: string; optInMessage: string; optInAction: string;
}> = {
  it: {
    optInMessage: "Il prezzo resta privato. Non entra nella distinta senza scegliere esplicitamente una riga.", optInAction: "Usa come target interno → scegli la riga",
    title: "Prezzo rapido", private: "Solo in questa schermata",
    tonne: "Prezzo €/ton", metre: "Prezzo €/m",
    example: "es. 850,00", weight: "Conversione su", unavailable: "Inserisci una misura valida",
    inputError: "Usa un importo valido, senza separatori delle migliaia.",
    note: "Stima da peso teorico · esclusa da link, storico e distinta",
  },
  en: {
    optInMessage: "This price stays private. Choose a bill line explicitly before assigning a buyer target.", optInAction: "Use as private target → select a line",
    title: "Quick price", private: "This screen only",
    tonne: "Price €/t", metre: "Price €/m",
    example: "e.g. 850.00", weight: "Based on", unavailable: "Enter valid dimensions",
    inputError: "Enter a valid amount, without thousands separators.",
    note: "Theoretical mass estimate · excluded from links, history and RFQ bill",
  },
  de: {
    optInMessage: "Dieser Preis bleibt privat. Erst nach ausdrücklicher Auswahl einer Position wird er zum Einkaufzielpreis.", optInAction: "Als privaten Zielpreis nutzen → Position wählen",
    title: "Schnellpreis", private: "Nur auf dieser Seite",
    tonne: "Preis €/t", metre: "Preis €/m",
    example: "z. B. 850,00", weight: "Basis", unavailable: "Gültige Maße eingeben",
    inputError: "Gültigen Betrag ohne Tausendertrennzeichen eingeben.",
    note: "Schätzung anhand theoretischer Masse · nicht in Links, Verlauf oder Stückliste",
  },
  fr: {
    optInMessage: "Ce prix reste privé. Choisissez explicitement une ligne avant de définir un prix cible acheteur.", optInAction: "Utiliser comme prix cible privé → choisir la ligne",
    title: "Prix rapide", private: "Uniquement sur cet écran",
    tonne: "Prix €/t", metre: "Prix €/m",
    example: "ex. 850,00", weight: "Calcul basé sur", unavailable: "Saisir des dimensions valides",
    inputError: "Saisir un montant valide, sans séparateur de milliers.",
    note: "Estimation sur masse théorique · exclue des liens, historique et devis",
  },
  es: {
    optInMessage: "Este precio sigue siendo privado. Elige expresamente una línea antes de asignar un objetivo de compra.", optInAction: "Usar como objetivo privado → elegir línea",
    title: "Precio rápido", private: "Solo en esta pantalla",
    tonne: "Precio €/t", metre: "Precio €/m",
    example: "p. ej. 850,00", weight: "Según", unavailable: "Introduce medidas válidas",
    inputError: "Introduce un importe válido, sin separadores de miles.",
    note: "Estimación por peso teórico · excluida de enlaces, historial y lista RFQ",
  },
};

/** Never store commercial prices outside React's ephemeral component state. */
export function CalculatorCommercialPricing({
  weightKgM,
  locale,
  onChooseBuyerTarget,
}: {
  weightKgM: number | null;
  locale: TubeCalculatorLocale;
  /** Opt-in only; pricing inputs remain ephemeral unless user selects a bill line. */
  onChooseBuyerTarget?: (value: {basis: PriceBasis; raw: string; weightKgM: number}) => void;
}) {
  const labels = copy[locale];
  const id = useId();
  // Keep the LAST edited unit as source of truth. Changes to kg/m recalculate
  // only the other unit; no two-way effects or rounded feedback loops.
  const [source, setSource] = useState<{ basis: PriceBasis; raw: string }>({
    basis: "tonne", raw: "",
  });
  const other = convertCommercialRate(source.raw, source.basis, weightKgM, locale);
  const perTonne = source.basis === "tonne" ? source.raw : other === null ? "" : priceInputText(other, locale);
  const perMetre = source.basis === "metre" ? source.raw : other === null ? "" : priceInputText(other, locale);
  const hasRaw = source.raw.trim().length > 0;
  const invalidRate = hasRaw && parseCommercialRate(source.raw, locale) === null;
  const validWeight = weightKgM !== null && Number.isFinite(weightKgM) && weightKgM > 0;
  const validBuyerTarget = validWeight && !invalidRate && hasRaw &&
    parseCommercialRate(source.raw, locale)! > 0 && other !== null && other > 0;
  const priceInputClass = "mt-1 block h-11 w-full min-w-0 rounded-xl border border-[#b7d2c5] bg-white px-3 text-base font-semibold tabular-nums text-[#163c2e] outline-none transition-colors placeholder:font-normal placeholder:text-[#6b8276] hover:border-[#6b9c87] focus-visible:border-[#166f4b] focus-visible:ring-2 focus-visible:ring-[#96d5b6] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <details data-commercial-price className="group/price mt-2 rounded-lg border border-[#9ecab4]/45 bg-[#e7f3eb] text-[#173f31]">
      <summary className="flex min-h-10 cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166f4b]">
        <span id={id}>{labels.title} <span className="ml-1 text-[10px] font-medium text-[#4a6b5b]">· {labels.private}</span></span>
        <span aria-hidden="true" className="transition-transform group-open/price:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-[#bfdcca] px-3 pb-3 pt-2">
      <div className="grid grid-cols-2 gap-2.5">
        <label htmlFor={id+"-tonne"} className="min-w-0 text-[11px] font-bold text-[#2b5744]">
          {labels.tonne}
          <input
            id={id+"-tonne"}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={perTonne}
            onChange={event => setSource({ basis: "tonne", raw: event.target.value })}
            placeholder={labels.example}
            aria-invalid={invalidRate && source.basis === "tonne"}
            aria-describedby={id+"-note"}
            className={priceInputClass}
          />
        </label>
        <label htmlFor={id+"-metre"} className="min-w-0 text-[11px] font-bold text-[#2b5744]">
          {labels.metre}
          <input
            id={id+"-metre"}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={perMetre}
            onChange={event => setSource({ basis: "metre", raw: event.target.value })}
            placeholder="—"
            aria-invalid={invalidRate && source.basis === "metre"}
            aria-describedby={id+"-note"}
            className={priceInputClass}
          />
        </label>
      </div>
      <p id={id+"-note"} className="mt-2 text-[10px] leading-4 text-[#405e4c]" aria-live="polite">
        {invalidRate ? labels.inputError
          : !validWeight ? labels.unavailable
          : `${labels.weight} ${new Intl.NumberFormat(
              { it:"it-IT", en:"en-GB", de:"de-DE", fr:"fr-FR", es:"es-ES" }[locale],
              { maximumFractionDigits: 3 },
            ).format(weightKgM)} kg/m.`}
        <span className="block text-[#547061]">{onChooseBuyerTarget
          ? labels.optInMessage
          : labels.note}</span>
      </p>
      {onChooseBuyerTarget ? (
        <button type="button" data-target-opt-in
          disabled={!validBuyerTarget || weightKgM === null}
          onClick={() => {
            if (!validBuyerTarget || weightKgM === null) return;
            onChooseBuyerTarget({ basis: source.basis, raw: source.raw, weightKgM });
          }}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#277a58] bg-white px-3 py-2 text-sm font-bold text-[#13543c] hover:bg-[#f2fbf5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13543c] disabled:cursor-not-allowed disabled:opacity-45">
          {labels.optInAction}
        </button>
      ) : null}
      </div>
    </details>
  );
}

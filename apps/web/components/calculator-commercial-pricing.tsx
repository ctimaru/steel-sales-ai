"use client";

import { useId, useState } from "react";
import { convertCommercialRate, parseCommercialRate, priceInputText, type PriceBasis } from "@/lib/calculator-commercial-pricing";
import type { TubeCalculatorLocale } from "@/lib/tube-calculator-locale";

const copy: Record<TubeCalculatorLocale, {
  title: string; private: string; tonne: string; metre: string;
  example: string; weight: string; unavailable: string; inputError: string;
  note: string;
}> = {
  it: {
    title: "Prezzo rapido", private: "Solo in questa schermata",
    tonne: "Prezzo €/ton", metre: "Prezzo €/m",
    example: "es. 850,00", weight: "Conversione su", unavailable: "Inserisci una misura valida",
    inputError: "Usa un importo valido, senza separatori delle migliaia.",
    note: "Stima da peso teorico · esclusa da link, storico e distinta",
  },
  en: {
    title: "Quick price", private: "This screen only",
    tonne: "Price €/t", metre: "Price €/m",
    example: "e.g. 850.00", weight: "Based on", unavailable: "Enter valid dimensions",
    inputError: "Enter a valid amount, without thousands separators.",
    note: "Theoretical mass estimate · excluded from links, history and RFQ bill",
  },
  de: {
    title: "Schnellpreis", private: "Nur auf dieser Seite",
    tonne: "Preis €/t", metre: "Preis €/m",
    example: "z. B. 850,00", weight: "Basis", unavailable: "Gültige Maße eingeben",
    inputError: "Gültigen Betrag ohne Tausendertrennzeichen eingeben.",
    note: "Schätzung anhand theoretischer Masse · nicht in Links, Verlauf oder Stückliste",
  },
  fr: {
    title: "Prix rapide", private: "Uniquement sur cet écran",
    tonne: "Prix €/t", metre: "Prix €/m",
    example: "ex. 850,00", weight: "Calcul basé sur", unavailable: "Saisir des dimensions valides",
    inputError: "Saisir un montant valide, sans séparateur de milliers.",
    note: "Estimation sur masse théorique · exclue des liens, historique et devis",
  },
  es: {
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
}: {
  weightKgM: number | null;
  locale: TubeCalculatorLocale;
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
  const priceInputClass = "mt-1 block h-11 w-full min-w-0 rounded-xl border border-[#b7d2c5] bg-white px-3 text-base font-semibold tabular-nums text-[#163c2e] outline-none transition-colors placeholder:font-normal placeholder:text-[#6b8276] hover:border-[#6b9c87] focus-visible:border-[#166f4b] focus-visible:ring-2 focus-visible:ring-[#96d5b6] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section data-commercial-price aria-labelledby={id} className="mt-3 rounded-2xl border border-[#9ecab4]/45 bg-[#e7f3eb] p-3 text-[#173f31] shadow-[0_2px_12px_rgba(0,0,0,0.05)] sm:p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-1.5">
        <h3 id={id} className="text-[13px] font-bold tracking-tight">{labels.title}</h3>
        <span className="text-[10px] font-medium text-[#4a6b5b]">{labels.private}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2.5">
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
        <span className="block text-[#547061]">{labels.note}</span>
      </p>
    </section>
  );
}

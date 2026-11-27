"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { parseTypedDimension } from "@/lib/calculator-dimension-discovery";
import { calculateTubeSection } from "@/lib/international-tube-mass";
import styles from "./home-quick-weight.module.css";

/**
 * HOME-CALC1: the public home starts with the product's simplest promise —
 * type a size, read the weight. Same engine as /knowledge/tubes (EN 10219,
 * 7.850 kg/m³). Nothing is stored or sent; the full calculator opens
 * prefilled for standards, lengths, quantities and the bill.
 */
const examples = ["168,3x6", "100x100x4", "200x100x5"] as const;
const BAR_LENGTH_M = 12;

const fixed = (value: number, digits: number) =>
  new Intl.NumberFormat("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const plain = (value: number) => String(value).replace(".", ",");

export function HomeQuickWeight() {
  const inputId = useId();
  const resultId = useId();
  const [query, setQuery] = useState<string>(examples[0]);

  const result = useMemo(() => {
    const size = parseTypedDimension(query);
    if (!size) return null;
    const shape = size.family === "round_tube" ? "round" : size.family === "square_tube" ? "square" : "rectangular";
    const section = calculateTubeSection({
      shape,
      standard: "en10219",
      outerDiameterMm: shape === "round" ? size.primaryMm : undefined,
      widthMm: shape === "round" ? undefined : size.primaryMm,
      heightMm: shape === "rectangular" ? size.secondaryMm : shape === "square" ? size.primaryMm : undefined,
      thicknessMm: size.thicknessMm,
    });
    if (!section.ok) return null;
    const params = new URLSearchParams({ standard: "en10219", family: size.family, thickness: plain(size.thicknessMm),
      source: "home", surface: "hero" });
    if (shape === "round") params.set("od", plain(size.primaryMm));
    else {
      params.set("width", plain(size.primaryMm));
      if (shape === "rectangular") params.set("height", plain(size.secondaryMm));
    }
    const label = shape === "round"
      ? `Ø ${plain(size.primaryMm)} × ${plain(size.thicknessMm)} mm`
      : `${plain(size.primaryMm)} × ${plain(shape === "square" ? size.primaryMm : size.secondaryMm)} × ${plain(size.thicknessMm)} mm`;
    return {
      label,
      kgM: section.weightKgM,
      kgBar: section.weightKgM * BAR_LENGTH_M,
      href: `/knowledge/tubes?${params.toString()}#calcolatore-pesi`,
    };
  }, [query]);

  return (
    <form className={styles.card} data-home-quick-weight role="search" aria-label="Calcolo rapido del peso"
      onSubmit={(event) => event.preventDefault()}>
      <label htmlFor={inputId} className={styles.label}>Scrivi la misura del tubo</label>
      <div className={styles.inputRow}>
        <input id={inputId} value={query} onChange={(event) => setQuery(event.target.value)}
          inputMode="decimal" autoComplete="off" spellCheck={false}
          placeholder="168,3x6 · 100x100x4 · 200x100x5" aria-describedby={resultId}
          className={styles.input} />
        <span className={styles.unit} aria-hidden="true">mm</span>
      </div>
      <div className={styles.examples} aria-label="Esempi">
        {examples.map((example) => (
          <button key={example} type="button" aria-pressed={query === example}
            onClick={() => setQuery(example)} className={styles.example}>{example}</button>
        ))}
      </div>
      <div id={resultId} aria-live="polite" className={styles.result} data-home-quick-result>
        {result ? (
          <>
            <p className={styles.size}>{result.label} · EN 10219</p>
            <p className={styles.kgm}><strong>{fixed(result.kgM, 2)}</strong> kg/m</p>
            <p className={styles.bar}>Barra da {BAR_LENGTH_M} m: <strong>{fixed(result.kgBar, 1)} kg</strong></p>
          </>
        ) : (
          <p className={styles.hint}>Diametro × spessore (tondi) oppure lato × lato × spessore (quadri e rettangolari), in mm.</p>
        )}
      </div>
      <Link href={result?.href ?? "/knowledge/tubes?source=home&surface=hero#calcolatore-pesi"} className={styles.open}>
        Apri la calcolatrice completa <span aria-hidden="true">→</span>
      </Link>
      <p className={styles.note}>Peso teorico · gratis, senza account.</p>
    </form>
  );
}

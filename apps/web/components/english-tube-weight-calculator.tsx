"use client";

import { useMemo, useState } from "react";
import {
  estimatePublicTubeMass,
  formatEnglishMass,
  parseTubeNumber,
  type PublicTubeShape,
  type PublicTubeStandard,
} from "@/lib/international-tube-mass";

const fieldStyle =
  "mt-1 block h-11 w-full rounded-xl border border-[#c7d7cf] bg-white px-3 text-base text-[#123b34] focus:border-[#1f6b5a] focus:outline-none focus:ring-2 focus:ring-[#b9d7cb]";
const labelStyle = "block text-xs font-semibold text-[#405049]";

export function EnglishTubeWeightCalculator() {
  const [shape, setShape] = useState<PublicTubeShape>("square");
  const [standard, setStandard] = useState<PublicTubeStandard>("en10219");
  const [diameter, setDiameter] = useState("168.3");
  const [width, setWidth] = useState("100");
  const [height, setHeight] = useState("60");
  const [thickness, setThickness] = useState("5");
  const [length, setLength] = useState("12");
  const [bars, setBars] = useState("10");
  const [density, setDensity] = useState("7850");
  const [copied, setCopied] = useState(false);

  const result = useMemo(
    () =>
      estimatePublicTubeMass({
        shape,
        standard,
        outerDiameterMm: parseTubeNumber(diameter),
        widthMm: parseTubeNumber(width),
        heightMm: parseTubeNumber(height),
        thicknessMm: parseTubeNumber(thickness),
        lengthM: parseTubeNumber(length),
        bars: parseTubeNumber(bars),
        densityKgM3: parseTubeNumber(density),
      }),
    [shape, standard, diameter, width, height, thickness, length, bars, density],
  );

  const numberField = (id: string, title: string, value: string, setter: (next: string) => void, unit: string) => (
    <label htmlFor={id} key={id} className={labelStyle}>
      {title} <span className="font-normal text-[#66736e]">({unit})</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => { setter(event.target.value); setCopied(false); }}
        className={fieldStyle}
        autoComplete="off"
      />
    </label>
  );

  async function copyCalculation() {
    if (!result.ok) return;
    const shapeText = shape === "round" ? `CHS Ø${diameter} × ${thickness}`
      : shape === "square" ? `SHS ${width} × ${width} × ${thickness}`
      : `RHS ${width} × ${height} × ${thickness}`;
    const text = [
      "Smart Steel Sales — theoretical tube mass estimate",
      `${shapeText} mm — ${standard === "geometric" ? "Geometric calculation" : standard.toUpperCase().replace("EN", "EN ")}`,
      `${bars} bars × ${length} m`,
      `Theoretical mass: ${formatEnglishMass(result.weightKgM, 3)} kg/m`,
      `Per bar: ${formatEnglishMass(result.weightKgBar, 2)} kg`,
      `Total: ${formatEnglishMass(result.totalKg, 2)} kg (${formatEnglishMass(result.totalTonnes, 4)} t)`,
      "Indicative only; confirm dimensions, mass tolerances and order conditions with supplier.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section aria-label="Interactive tube mass calculator" className="overflow-hidden rounded-3xl border border-[#d0e2d8] bg-white shadow-[0_16px_35px_rgba(18,59,52,0.07)]">
      <div className="border-b border-[#e4ece7] px-5 py-5 sm:px-7">
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#1f6b5a]">Live calculator · no account required</p>
        <h2 className="mt-1 text-2xl font-semibold text-[#123b34]">Calculate theoretical steel tube weight</h2>
        <p className="mt-2 text-sm leading-6 text-[#52615b]">Enter nominal outside dimensions in millimetres, plus bar length and quantity.</p>
      </div>

      <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="tube-shape-en" className={labelStyle}>
              Section type
              <select id="tube-shape-en" className={fieldStyle} value={shape} onChange={(event) => { setShape(event.target.value as PublicTubeShape); setCopied(false); }}>
                <option value="round">Circular hollow section (CHS)</option>
                <option value="square">Square hollow section (SHS)</option>
                <option value="rectangular">Rectangular hollow section (RHS)</option>
              </select>
            </label>
            <label htmlFor="tube-standard-en" className={labelStyle}>
              Calculation method
              <select id="tube-standard-en" className={fieldStyle} value={standard} onChange={(event) => { setStandard(event.target.value as PublicTubeStandard); setCopied(false); }}>
                <option value="en10219">EN 10219 (cold-formed)</option>
                <option value="en10210">EN 10210 (hot-finished)</option>
                <option value="geometric">Free geometric calculation</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {shape === "round"
              ? numberField("tube-od-en", "Outside diameter", diameter, setDiameter, "mm")
              : numberField("tube-width-en", shape === "square" ? "Outside side" : "Outside width", width, setWidth, "mm")}
            {shape === "rectangular" ? numberField("tube-height-en", "Outside height", height, setHeight, "mm") : null}
            {numberField("tube-thickness-en", "Wall thickness", thickness, setThickness, "mm")}
            {numberField("tube-length-en", "Bar length", length, setLength, "m")}
            {numberField("tube-bars-en", "Quantity", bars, setBars, "bars")}
            {standard === "geometric" ? numberField("tube-density-en", "Material density", density, setDensity, "kg/m³") : null}
          </div>
          <p className="text-xs leading-5 text-[#66736e]">
            EN 10210 and EN 10219 estimates use nominal corner-radius rules for SHS and RHS, and 7,850 kg/m³.
            Free geometric mode ignores rounded corners and accepts a different density.
          </p>
        </div>

        <div aria-live="polite" className="flex flex-col rounded-2xl bg-[#123b34] p-5 text-white sm:p-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#a6d8c5]">Calculated result</p>
          {result.ok ? (
            <>
              <div className="mt-4">
                <p className="text-xs text-[#d4e6de]">Theoretical linear mass</p>
                <p className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">{formatEnglishMass(result.weightKgM)} <span className="text-base font-medium">kg/m</span></p>
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-white/20 pt-5 text-sm">
                <div><dt className="text-[#c2d8ce]">Weight per bar</dt><dd className="mt-1 font-bold">{formatEnglishMass(result.weightKgBar, 2)} kg</dd></div>
                <div><dt className="text-[#c2d8ce]">Total metres</dt><dd className="mt-1 font-bold">{formatEnglishMass(result.totalMeters, 2)} m</dd></div>
                <div><dt className="text-[#c2d8ce]">Total weight</dt><dd className="mt-1 font-bold">{formatEnglishMass(result.totalKg, 2)} kg</dd></div>
                <div><dt className="text-[#c2d8ce]">Total tonnes</dt><dd className="mt-1 font-bold">{formatEnglishMass(result.totalTonnes, 4)} t</dd></div>
              </dl>
              <button type="button" onClick={copyCalculation} className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#123b34] hover:bg-[#e6f3ed]">
                {copied ? "Copied to clipboard" : "Copy calculation"}
              </button>
            </>
          ) : (
            <p role="alert" className="mt-5 rounded-lg bg-white/10 p-4 text-sm font-semibold leading-6">{result.error}</p>
          )}
          <p className="mt-4 text-xs leading-5 text-[#c2d8ce]">
            Estimates only. Not a certified, published or verified weight reference.
          </p>
        </div>
      </div>
    </section>
  );
}

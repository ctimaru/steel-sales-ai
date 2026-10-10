"use client";

import { useMemo, useRef, useState } from "react";
import {
  estimatePublicTubeMass,
  formatEnglishMass,
  parseTubeNumber,
  type PublicTubeShape,
  type PublicTubeStandard,
} from "@/lib/international-tube-mass";

type RfqLine = {
  id: number;
  shape: PublicTubeShape;
  standard: PublicTubeStandard;
  grade: string;
  diameter: string;
  width: string;
  height: string;
  thickness: string;
  bars: string;
  length: string;
  targetPricePerTonne: string;
};

const createLine = (id: number): RfqLine => ({
  id, shape: "square", standard: "en10219", grade: "S355J2H",
  diameter: "168.3", width: "100", height: "60", thickness: "5",
  bars: "10", length: "12", targetPricePerTonne: "",
});

const control = "mt-1 w-full min-w-0 rounded-lg border border-[#c7d7cf] bg-white px-2.5 py-2.5 text-sm text-[#123b34] focus:border-[#1f6b5a] focus:outline-none focus:ring-2 focus:ring-[#b9d7cb]";
const label = "block min-w-0 text-xs font-semibold text-[#52615b]";

function describeLine(line: RfqLine) {
  const geometry = line.shape === "round"
    ? `CHS Ø${line.diameter} × ${line.thickness}`
    : line.shape === "square"
      ? `SHS ${line.width} × ${line.width} × ${line.thickness}`
      : `RHS ${line.width} × ${line.height} × ${line.thickness}`;
  return `${geometry} mm, ${line.grade}, ${line.standard.toUpperCase().replace("EN", "EN ")}`;
}

export function EnglishRfqBillBuilder() {
  const nextId = useRef(2);
  const [lines, setLines] = useState<RfqLine[]>([createLine(1)]);
  const [currency, setCurrency] = useState<"EUR" | "USD" | "GBP">("EUR");
  const [notes, setNotes] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const calculated = useMemo(
    () =>
      lines.map((line) => ({
        line,
        mass: estimatePublicTubeMass({
          shape: line.shape,
          standard: line.standard,
          outerDiameterMm: parseTubeNumber(line.diameter),
          widthMm: parseTubeNumber(line.width),
          heightMm: parseTubeNumber(line.height),
          thicknessMm: parseTubeNumber(line.thickness),
          bars: parseTubeNumber(line.bars),
          lengthM: parseTubeNumber(line.length),
        }),
      })),
    [lines],
  );

  const invalidCount = calculated.filter((item) => !item.mass.ok).length;
  const valid = calculated.filter((item) => item.mass.ok);
  const totalTonnes = valid.reduce((sum, item) => sum + (item.mass.ok ? item.mass.totalTonnes : 0), 0);
  const totalMeters = valid.reduce((sum, item) => sum + (item.mass.ok ? item.mass.totalMeters : 0), 0);

  function updateLine(id: number, patch: Partial<RfqLine>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
    setCopyState("idle");
  }
  function addLine() {
    setLines((current) => [...current, createLine(nextId.current++)]);
    setCopyState("idle");
  }
  function removeLine(id: number) {
    setLines((current) => current.length === 1 ? current : current.filter((line) => line.id !== id));
    setCopyState("idle");
  }
  function field(item: RfqLine, key: keyof Pick<RfqLine, "grade" | "diameter" | "width" | "height" | "thickness" | "bars" | "length" | "targetPricePerTonne">, title: string, placeholder?: string) {
    const inputId = `rfq-en-${item.id}-${key}`;
    return (
      <label key={key} htmlFor={inputId} className={label}>
        {title}
        <input
          id={inputId}
          type="text"
          inputMode={key === "grade" ? "text" : "decimal"}
          autoComplete="off"
          className={control}
          placeholder={placeholder}
          value={item[key]}
          onChange={(event) => updateLine(item.id, { [key]: event.target.value })}
        />
      </label>
    );
  }

  async function copyRfq() {
    if (invalidCount || !calculated.length) return;
    const rows = calculated.map(({ line, mass }, index) => {
      if (!mass.ok) return "";
      const target = line.targetPricePerTonne.trim();
      const targetText = target ? ` | Target ${currency}/t: ${target}` : "";
      return [
        `${index + 1}. ${describeLine(line)}`,
        `   ${line.bars} bars × ${line.length} m | ${formatEnglishMass(mass.totalMeters, 2)} m | ${formatEnglishMass(mass.weightKgM, 3)} kg/m | ${formatEnglishMass(mass.totalTonnes, 4)} t${targetText}`,
      ].join("\n");
    });
    const emailText = [
      "Subject: Request for quotation — steel tubes",
      "",
      "Dear Supplier,",
      "Please quote the following steel tube requirements:",
      "",
      ...rows,
      "",
      `Estimated total: ${formatEnglishMass(totalMeters, 2)} m / ${formatEnglishMass(totalTonnes, 4)} t`,
      notes.trim() ? `\nAdditional requirements:\n${notes.trim()}\n` : "",
      "Please confirm availability, delivery lead time, applicable standards, certificates and commercial terms.",
      "Theoretical weights are indicative and require supplier confirmation.",
      "",
      "Best regards,",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(emailText);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <section aria-label="English RFQ bill of materials builder" className="space-y-5">
      <div className="rounded-2xl border border-[#dce5e0] bg-white px-5 py-5 sm:px-7">
        <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-[#1f6b5a]">Free public tool · no account required</p>
        <h2 className="mt-2 text-2xl font-bold text-[#123b34]">Prepare an RFQ bill of materials</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52615b]">
          Add mixed products and standards, calculate indicative tonnage, and copy a supplier-ready RFQ email.
          This public tool does not send an enquiry, store a commercial record or publish it on a marketplace.
        </p>
      </div>

      {calculated.map(({ line, mass }, index) => (
        <article key={line.id} className="rounded-2xl border border-[#dce5e0] bg-white p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold text-[#123b34]">Item {index + 1}</h3>
            <button type="button" onClick={() => removeLine(line.id)} disabled={lines.length === 1}
              className="min-h-10 rounded-lg border border-[#d4ddd8] px-3 text-xs font-semibold text-[#52615b] hover:bg-[#f2f4f3] disabled:cursor-not-allowed disabled:opacity-40">
              Remove item
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={label}>
              Section type
              <select className={control} value={line.shape} onChange={(event) => updateLine(line.id, { shape: event.target.value as PublicTubeShape })}>
                <option value="round">CHS — circular</option>
                <option value="square">SHS — square</option>
                <option value="rectangular">RHS — rectangular</option>
              </select>
            </label>
            <label className={label}>
              Standard
              <select className={control} value={line.standard} onChange={(event) => updateLine(line.id, { standard: event.target.value as PublicTubeStandard })}>
                <option value="en10219">EN 10219</option>
                <option value="en10210">EN 10210</option>
                <option value="geometric">Geometric estimate</option>
              </select>
            </label>
            {field(line, "grade", "Steel grade")}
            {line.shape === "round"
              ? field(line, "diameter", "Outside diameter (mm)")
              : field(line, "width", line.shape === "square" ? "Outside side (mm)" : "Outside width (mm)")}
            {line.shape === "rectangular" ? field(line, "height", "Outside height (mm)") : null}
            {field(line, "thickness", "Wall thickness (mm)")}
            {field(line, "length", "Bar length (m)")}
            {field(line, "bars", "Quantity (bars)")}
            {field(line, "targetPricePerTonne", `Optional target (${currency}/t)`, "Not specified")}
          </div>
          <div aria-live="polite" className="mt-4 rounded-xl bg-[#f0f6f2] px-4 py-3 text-xs text-[#123b34]">
            {mass.ok ? (
              <p><strong>{describeLine(line)}</strong> · {formatEnglishMass(mass.weightKgM, 3)} kg/m · {formatEnglishMass(mass.totalMeters, 2)} m · <strong>{formatEnglishMass(mass.totalTonnes, 4)} t</strong></p>
            ) : (
              <p role="alert" className="font-semibold text-[#9a4e22]">{mass.error}</p>
            )}
          </div>
        </article>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={addLine} className="inline-flex min-h-11 items-center rounded-xl border border-[#99b8aa] bg-white px-5 text-sm font-bold text-[#123b34] hover:bg-[#edf5f1]">
          + Add another item
        </button>
        <label className="text-xs font-semibold text-[#52615b]">
          Target price currency
          <select aria-label="Target price currency" className="ml-2 rounded-lg border border-[#c7d7cf] bg-white px-3 py-2 text-sm" value={currency} onChange={(event) => { setCurrency(event.target.value as "EUR" | "USD" | "GBP"); setCopyState("idle"); }}>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </label>
      </div>

      <label className="block text-sm font-semibold text-[#123b34]">
        Additional requirements (optional)
        <textarea value={notes} onChange={(event) => { setNotes(event.target.value); setCopyState("idle"); }}
          rows={3} maxLength={5000} placeholder="E.g. delivery destination, EN 10204 3.1 certificate, surface finish, requested delivery date…"
          className="mt-2 block w-full rounded-xl border border-[#c7d7cf] bg-white px-4 py-3 text-sm font-normal text-[#123b34] focus:border-[#1f6b5a] focus:outline-none focus:ring-2 focus:ring-[#b9d7cb]" />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-[#123b34] px-5 py-5 text-white sm:px-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#b4e0d0]">Bill summary</p>
          <p className="mt-1 text-xl font-bold">{lines.length} item{lines.length === 1 ? "" : "s"} · {formatEnglishMass(totalMeters, 2)} m · {formatEnglishMass(totalTonnes, 4)} t</p>
          {invalidCount ? <p role="alert" className="mt-2 text-xs text-[#ffdec8]">Correct {invalidCount} invalid item{invalidCount === 1 ? "" : "s"} to enable copying.</p> : null}
          <p className="mt-2 text-xs text-[#dbeae4]">Values are not stored on the server. Supplier quotations must confirm all quantities and weights.</p>
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" disabled={invalidCount > 0} onClick={copyRfq}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-[#123b34] hover:bg-[#e6f3ed] disabled:cursor-not-allowed disabled:opacity-40">
            {copyState === "copied" ? "RFQ copied" : "Copy RFQ email"}
          </button>
          {copyState === "failed" ? <p role="alert" className="text-xs text-[#ffdec8]">Clipboard unavailable. Check browser clipboard permissions.</p> : null}
        </div>
      </div>
    </section>
  );
}

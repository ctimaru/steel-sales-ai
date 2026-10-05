"use client";

import { useState } from "react";

import {
  buildPricingCsv,
  buildPricingEmailHtml,
  buildPricingEmailPlainText,
  type EmailExportSummary,
} from "@/lib/pricing-export";
import type { PricingSessionSnapshot } from "@/lib/pricing-session";

function formatQuantity(
  mode: PricingSessionSnapshot["lines"][number]["quantity_mode"],
  quantity: number,
  barLengthM: number | null,
) {
  if (mode === "meters") return quantity.toLocaleString("it-IT") + " m";
  if (mode === "tonnes") return quantity.toLocaleString("it-IT") + " t";
  return (
    quantity.toLocaleString("it-IT") +
    " barre × " +
    (barLengthM ?? 0).toLocaleString("it-IT") +
    " m"
  );
}

function exportSummary(session: PricingSessionSnapshot): EmailExportSummary {
  return {
    title: session.title,
    listName: session.list_name_snapshot,
    versionCode: session.manufacturer_version_snapshot,
    sourceDate: session.source_date_snapshot,
    currencyCode: session.currency_code,
    lines: session.lines.map((line) => ({
      position: line.line_position,
      dimension: line.dimension_label_snapshot,
      grade: line.grade_code_snapshot,
      finish: line.finish_code_snapshot,
      quantityLabel: formatQuantity(
        line.quantity_mode,
        Number(line.quantity),
        line.bar_length_m === null ? null : Number(line.bar_length_m),
      ),
      meters: Number(line.line_meters),
      tonnes: line.line_tonnes === null ? null : Number(line.line_tonnes),
      netEurM: Number(line.net_eur_m),
      netEurT: line.net_eur_t === null ? null : Number(line.net_eur_t),
      lineTotalEur: Number(line.line_total),
    })),
    totalMeters: Number(session.total_meters),
    totalTonnes: Number(session.total_tonnes),
    totalValueEur: Number(session.total_value),
    weightedAverageEurT:
      session.weighted_average_eur_t === null
        ? null
        : Number(session.weighted_average_eur_t),
  };
}

export function SavedPricingSessionActions({
  session,
}: {
  session: PricingSessionSnapshot;
}) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const summary = exportSummary(session);

  async function copyForEmail() {
    const plain = buildPricingEmailPlainText(summary);
    const html = buildPricingEmailHtml(summary);

    try {
      if (
        navigator.clipboard &&
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard.write
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([plain], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ]);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(plain);
      } else {
        throw new Error("clipboard_unavailable");
      }
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2200);
    } catch {
      setCopyStatus("error");
      window.setTimeout(() => setCopyStatus("idle"), 2600);
    }
  }

  function downloadCsv() {
    const csv = buildPricingCsv(summary);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      session.manufacturer_version_snapshot.replaceAll(/[^a-zA-Z0-9_-]+/g, "-") +
      "-distinta-salvata.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={copyForEmail}
        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white hover:bg-[#245747]"
      >
        {copyStatus === "copied"
          ? "✓ Copiata per email"
          : copyStatus === "error"
            ? "Copia non riuscita"
            : "Copia per email"}
      </button>
      <button
        type="button"
        onClick={downloadCsv}
        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#d7dfdb] bg-white px-4 text-sm font-semibold text-[#52615b] hover:border-[#9ebfb3] hover:text-[#173f35]"
      >
        Scarica CSV
      </button>
    </div>
  );
}

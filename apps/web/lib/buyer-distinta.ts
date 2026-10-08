export type BuyerQuantityMode = "meters" | "bars" | "tonnes";

export type BuyerDistintaDraftLine = {
  id: string;
  description: string;
  standard: string;
  grade: string;
  finish: string;
  quantityMode: BuyerQuantityMode;
  quantity: string;
  barLengthM: string;
  weightKgM: string;
  targetEurT: string;
  note: string;
};

export type BuyerDistintaCalculatedLine = {
  id: string;
  description: string;
  standard: string;
  grade: string;
  finish: string;
  quantityMode: BuyerQuantityMode;
  quantity: number | null;
  barLengthM: number | null;
  weightKgM: number | null;
  targetEurT: number | null;
  targetEurM: number | null;
  meters: number | null;
  tonnes: number | null;
  targetTotalEur: number | null;
  note: string;
  complete: boolean;
};

function parsePositive(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function calculateBuyerDistintaLine(
  input: BuyerDistintaDraftLine,
): BuyerDistintaCalculatedLine {
  const quantity = parsePositive(input.quantity);
  const barLengthM = parsePositive(input.barLengthM);
  const weightKgM = parsePositive(input.weightKgM);
  const targetEurT = parsePositive(input.targetEurT);
  // An absent target is valid; a supplied but invalid/nonpositive target is not.
  const targetValid = input.targetEurT.trim() === "" || targetEurT !== null;
  const targetEurM =
    weightKgM !== null && targetEurT !== null
      ? (targetEurT * weightKgM) / 1000
      : null;

  let meters: number | null = null;
  let tonnes: number | null = null;

  if (quantity !== null) {
    if (input.quantityMode === "meters") {
      meters = quantity;
    } else if (input.quantityMode === "bars") {
      if (barLengthM !== null && Number.isInteger(quantity)) {
        meters = quantity * barLengthM;
      }
    } else {
      tonnes = quantity;
      if (weightKgM !== null) meters = (quantity * 1000) / weightKgM;
    }
  }

  if (tonnes === null && meters !== null && weightKgM !== null) {
    tonnes = (meters * weightKgM) / 1000;
  }

  const targetTotalEur =
    tonnes !== null && targetEurT !== null
      ? tonnes * targetEurT
      : meters !== null && targetEurM !== null
        ? meters * targetEurM
        : null;

  return {
    id: input.id,
    description: input.description.trim(),
    standard: input.standard.trim(),
    grade: input.grade.trim(),
    finish: input.finish.trim(),
    quantityMode: input.quantityMode,
    quantity,
    barLengthM,
    weightKgM,
    targetEurT,
    targetEurM,
    meters,
    tonnes,
    targetTotalEur,
    note: input.note.trim(),
    complete:
      input.description.trim().length > 0 &&
      quantity !== null &&
      weightKgM !== null &&
      targetValid &&
      meters !== null &&
      tonnes !== null,
  };
}

export function calculateBuyerDistintaTotals(lines: BuyerDistintaCalculatedLine[]) {
  const everyLineHasTarget = lines.length > 0 && lines.every((line) => line.targetTotalEur !== null);
  return {
    totalMeters: lines.reduce((sum, line) => sum + (line.meters ?? 0), 0),
    totalTonnes: lines.reduce((sum, line) => sum + (line.tonnes ?? 0), 0),
    // A total price target is meaningful only when every requested line has one.
    targetTotalEur: everyLineHasTarget
      ? lines.reduce((sum, line) => sum + (line.targetTotalEur ?? 0), 0)
      : null,
    completeLines: lines.filter((line) => line.complete).length,
  };
}

function formatNumber(value: number | null, digits: number) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function safeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function quantityLabel(line: BuyerDistintaCalculatedLine) {
  if (line.quantity === null) return "—";
  if (line.quantityMode === "meters") return formatNumber(line.quantity, 2) + " m";
  if (line.quantityMode === "tonnes") return formatNumber(line.quantity, 3) + " t";
  return (
    formatNumber(line.quantity, 0) +
    " barre × " +
    formatNumber(line.barLengthM, 2) +
    " m"
  );
}

export function buildBuyerDistintaPlainText(
  title: string,
  lines: BuyerDistintaCalculatedLine[],
) {
  const totals = calculateBuyerDistintaTotals(lines);
  return [
    title.trim() || "Richiesta di offerta",
    "",
    ["Articolo", "Norma", "Grado", "Finitura", "Quantità", "kg/m", "Target €/t", "Target €/m", "Note"].join("\t"),
    ...lines.map((line) =>
      [
        line.description,
        line.standard,
        line.grade,
        line.finish,
        quantityLabel(line),
        formatNumber(line.weightKgM, 3),
        formatNumber(line.targetEurT, 2),
        formatNumber(line.targetEurM, 4),
        line.note,
      ].join("\t"),
    ),
    "",
    "Metri totali: " + formatNumber(totals.totalMeters, 2),
    "Tonnellate totali: " + formatNumber(totals.totalTonnes, 3),
    "",
    "Distinta creata con Smart Steel Sales",
  ].join("\n");
}

export function buildBuyerDistintaHtml(
  title: string,
  lines: BuyerDistintaCalculatedLine[],
) {
  const totals = calculateBuyerDistintaTotals(lines);
  const rows = lines
    .map(
      (line) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeHtml(line.description)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${safeHtml(line.standard)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${safeHtml(line.grade)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${safeHtml(line.finish)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${safeHtml(quantityLabel(line))}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatNumber(line.weightKgM, 3)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatNumber(line.targetEurT, 2)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatNumber(line.targetEurM, 4)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${safeHtml(line.note)}</td>
        </tr>`,
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.4;">
      <div style="font-size:17px;font-weight:700;margin-bottom:14px;">${safeHtml(title.trim() || "Richiesta di offerta")}</div>
      <table style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead>
          <tr style="background:#f3f6f4;">
            <th style="padding:8px;text-align:left;">Articolo</th>
            <th style="padding:8px;text-align:left;">Norma</th>
            <th style="padding:8px;text-align:left;">Grado</th>
            <th style="padding:8px;text-align:left;">Finitura</th>
            <th style="padding:8px;text-align:left;">Quantità</th>
            <th style="padding:8px;text-align:right;">kg/m</th>
            <th style="padding:8px;text-align:right;">Target €/t</th>
            <th style="padding:8px;text-align:right;">Target €/m</th>
            <th style="padding:8px;text-align:left;">Note</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:14px;padding:12px;background:#f7faf8;border:1px solid #dce7e2;border-radius:8px;font-size:12px;">
        <div><strong>Metri totali:</strong> ${formatNumber(totals.totalMeters, 2)}</div>
        <div><strong>Tonnellate totali:</strong> ${formatNumber(totals.totalTonnes, 3)}</div>
      </div>
      <div style="margin-top:12px;font-size:10px;color:#6b7280;">Distinta creata con Smart Steel Sales</div>
    </div>`;
}

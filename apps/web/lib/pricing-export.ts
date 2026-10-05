export type EmailExportLine = {
  position: number;
  dimension: string;
  grade: string | null;
  finish: string | null;
  quantityLabel: string;
  meters: number | null;
  tonnes: number | null;
  netEurM: number | null;
  netEurT: number | null;
  lineTotalEur: number | null;
};

export type EmailExportSummary = {
  title: string;
  listName: string;
  versionCode: string;
  sourceDate: string | null;
  currencyCode: string;
  lines: EmailExportLine[];
  totalMeters: number;
  totalTonnes: number;
  totalValueEur: number;
  weightedAverageEurT: number | null;
};

function formatNumber(value: number | null, digits: number) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function safeText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildPricingEmailPlainText(input: EmailExportSummary) {
  const lines = [
    input.title,
    input.listName + " · " + input.versionCode,
    input.sourceDate ? "Listino del " + input.sourceDate : "",
    "",
    [
      "Articolo",
      "Grado / finitura",
      "Quantità",
      "Metri",
      "Tonnellate",
      "€/m",
      "€/t",
      "Totale €",
    ].join("\t"),
    ...input.lines.map((line) =>
      [
        line.dimension,
        [line.grade, line.finish].filter(Boolean).join(" · "),
        line.quantityLabel,
        formatNumber(line.meters, 2),
        formatNumber(line.tonnes, 3),
        formatNumber(line.netEurM, 4),
        formatNumber(line.netEurT, 2),
        formatNumber(line.lineTotalEur, 2),
      ].join("\t"),
    ),
    "",
    "Metri totali: " + formatNumber(input.totalMeters, 2),
    "Tonnellate totali: " + formatNumber(input.totalTonnes, 3),
    "Valore totale: € " + formatNumber(input.totalValueEur, 2),
    "€/t medio ponderato: " + formatNumber(input.weightedAverageEurT, 2),
    "",
    "Elaborato con Smart Steel Sales",
  ];

  return lines.filter((line, index) => line !== "" || index > 1).join("\n");
}

export function buildPricingEmailHtml(input: EmailExportSummary) {
  const rows = input.lines
    .map(
      (line) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${safeText(line.dimension)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${safeText([line.grade, line.finish].filter(Boolean).join(" · "))}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${safeText(line.quantityLabel)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatNumber(line.meters, 2)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatNumber(line.tonnes, 3)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatNumber(line.netEurM, 4)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatNumber(line.netEurT, 2)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatNumber(line.lineTotalEur, 2)}</td>
        </tr>`,
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.4;">
      <div style="font-size:16px;font-weight:700;margin-bottom:4px;">${safeText(input.title)}</div>
      <div style="font-size:13px;color:#4b5563;margin-bottom:16px;">${safeText(input.listName)} · ${safeText(input.versionCode)}${input.sourceDate ? " · " + safeText(input.sourceDate) : ""}</div>
      <table style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead>
          <tr style="background:#f3f6f4;">
            <th style="padding:8px;text-align:left;">Articolo</th>
            <th style="padding:8px;text-align:left;">Grado / finitura</th>
            <th style="padding:8px;text-align:left;">Quantità</th>
            <th style="padding:8px;text-align:right;">Metri</th>
            <th style="padding:8px;text-align:right;">Tonnellate</th>
            <th style="padding:8px;text-align:right;">€/m</th>
            <th style="padding:8px;text-align:right;">€/t</th>
            <th style="padding:8px;text-align:right;">Totale €</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:16px;padding:12px;background:#f7faf8;border:1px solid #dce7e2;border-radius:8px;font-size:12px;">
        <div><strong>Metri totali:</strong> ${formatNumber(input.totalMeters, 2)}</div>
        <div><strong>Tonnellate totali:</strong> ${formatNumber(input.totalTonnes, 3)}</div>
        <div><strong>Valore totale:</strong> € ${formatNumber(input.totalValueEur, 2)}</div>
        <div><strong>€/t medio ponderato:</strong> ${formatNumber(input.weightedAverageEurT, 2)}</div>
      </div>
      <div style="margin-top:12px;font-size:10px;color:#6b7280;">Elaborato con Smart Steel Sales</div>
    </div>`;
}

export function buildPricingCsv(input: EmailExportSummary) {
  const rows = [
    [
      "Pos.",
      "Articolo",
      "Grado",
      "Finitura",
      "Quantità",
      "Metri",
      "Tonnellate",
      "€/m",
      "€/t",
      "Totale €",
    ],
    ...input.lines.map((line) => [
      String(line.position),
      line.dimension,
      line.grade ?? "",
      line.finish ?? "",
      line.quantityLabel,
      line.meters === null ? "" : String(line.meters),
      line.tonnes === null ? "" : String(line.tonnes),
      line.netEurM === null ? "" : String(line.netEurM),
      line.netEurT === null ? "" : String(line.netEurT),
      line.lineTotalEur === null ? "" : String(line.lineTotalEur),
    ]),
    [],
    ["Metri totali", String(input.totalMeters)],
    ["Tonnellate totali", String(input.totalTonnes)],
    ["Valore totale €", String(input.totalValueEur)],
    ["€/t medio ponderato", input.weightedAverageEurT === null ? "" : String(input.weightedAverageEurT)],
  ];

  const escapeCell = (value: string) =>
    '"' + value.replaceAll('"', '""') + '"';

  return "\uFEFF" + rows.map((row) => row.map(escapeCell).join(";")).join("\r\n");
}

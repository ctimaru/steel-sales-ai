export type DistintaQuantityMode = "meters" | "bars" | "tonnes";

export type DistintaLineInput = {
  quantityMode: DistintaQuantityMode;
  quantity: number;
  barLengthM: number;
  weightKgM: number | null;
  netEurM: number | null;
};

export type DistintaLineCalculation = {
  meters: number | null;
  tonnes: number | null;
  bars: number | null;
  lineTotalEur: number | null;
  issue:
    | "quantity_required"
    | "bar_length_required"
    | "bars_must_be_integer"
    | "weight_required"
    | "price_unavailable"
    | null;
};

function positiveFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function calculateDistintaLine(
  input: DistintaLineInput,
): DistintaLineCalculation {
  if (!positiveFinite(input.quantity)) {
    return {
      meters: null,
      tonnes: null,
      bars: null,
      lineTotalEur: null,
      issue: "quantity_required",
    };
  }

  let meters: number | null = null;
  let tonnes: number | null = null;
  let bars: number | null = null;

  if (input.quantityMode === "meters") {
    meters = input.quantity;
  }

  if (input.quantityMode === "bars") {
    if (!Number.isInteger(input.quantity)) {
      return {
        meters: null,
        tonnes: null,
        bars: null,
        lineTotalEur: null,
        issue: "bars_must_be_integer",
      };
    }
    if (!positiveFinite(input.barLengthM)) {
      return {
        meters: null,
        tonnes: null,
        bars: null,
        lineTotalEur: null,
        issue: "bar_length_required",
      };
    }
    bars = input.quantity;
    meters = input.quantity * input.barLengthM;
  }

  if (input.quantityMode === "tonnes") {
    if (!positiveFinite(input.weightKgM)) {
      return {
        meters: null,
        tonnes: input.quantity,
        bars: null,
        lineTotalEur: null,
        issue: "weight_required",
      };
    }
    tonnes = input.quantity;
    meters = (input.quantity * 1000) / input.weightKgM;
  }

  if (tonnes === null && meters !== null && positiveFinite(input.weightKgM)) {
    tonnes = (meters * input.weightKgM) / 1000;
  }

  const lineTotalEur =
    meters !== null && Number.isFinite(input.netEurM ?? Number.NaN)
      ? meters * (input.netEurM as number)
      : null;

  return {
    meters,
    tonnes,
    bars,
    lineTotalEur,
    issue: lineTotalEur === null ? "price_unavailable" : null,
  };
}

export function distintaIssueLabel(issue: DistintaLineCalculation["issue"]) {
  if (issue === "quantity_required") return "Inserisci una quantità.";
  if (issue === "bar_length_required") return "Inserisci la lunghezza barra.";
  if (issue === "bars_must_be_integer") return "Il numero di barre deve essere intero.";
  if (issue === "weight_required") return "Il peso kg/m è necessario per inserire tonnellate.";
  if (issue === "price_unavailable") return "Prezzo €/m non disponibile per questa riga.";
  return null;
}


export type DistintaTotals = {
  lineCount: number;
  completeValueLineCount: number;
  weightedReadyLineCount: number;
  totalMeters: number;
  totalTonnes: number;
  totalValueEur: number;
  weightedAverageEurT: number | null;
  metersComplete: boolean;
  tonnesComplete: boolean;
  valueComplete: boolean;
  weightedAverageStatus:
    | "empty"
    | "incomplete_lines"
    | "missing_weight"
    | "no_tonnage"
    | "ready";
};

export function calculateDistintaTotals(
  calculations: DistintaLineCalculation[],
): DistintaTotals {
  const lineCount = calculations.length;
  const completeValueLines = calculations.filter(
    (line) => line.lineTotalEur !== null,
  );
  const weightedReadyLines = completeValueLines.filter(
    (line) => line.tonnes !== null && line.tonnes > 0,
  );

  const totalMeters = calculations.reduce(
    (sum, line) => sum + (line.meters ?? 0),
    0,
  );
  const totalTonnes = calculations.reduce(
    (sum, line) => sum + (line.tonnes ?? 0),
    0,
  );
  const totalValueEur = calculations.reduce(
    (sum, line) => sum + (line.lineTotalEur ?? 0),
    0,
  );

  const metersComplete =
    lineCount > 0 && calculations.every((line) => line.meters !== null);
  const tonnesComplete =
    lineCount > 0 && calculations.every((line) => line.tonnes !== null);
  const valueComplete =
    lineCount > 0 &&
    completeValueLines.length === lineCount;

  let weightedAverageStatus: DistintaTotals["weightedAverageStatus"] = "empty";

  if (lineCount > 0 && !valueComplete) {
    weightedAverageStatus = "incomplete_lines";
  } else if (
    lineCount > 0 &&
    weightedReadyLines.length !== lineCount
  ) {
    weightedAverageStatus = "missing_weight";
  } else if (lineCount > 0 && totalTonnes <= 0) {
    weightedAverageStatus = "no_tonnage";
  } else if (lineCount > 0) {
    weightedAverageStatus = "ready";
  }

  const weightedAverageEurT =
    weightedAverageStatus === "ready"
      ? totalValueEur / totalTonnes
      : null;

  return {
    lineCount,
    completeValueLineCount: completeValueLines.length,
    weightedReadyLineCount: weightedReadyLines.length,
    totalMeters,
    totalTonnes,
    totalValueEur,
    weightedAverageEurT,
    metersComplete,
    tonnesComplete,
    valueComplete,
    weightedAverageStatus,
  };
}

export function weightedAverageStatusLabel(
  status: DistintaTotals["weightedAverageStatus"],
  lineCount: number,
  weightedReadyLineCount: number,
) {
  if (status === "empty") return "Aggiungi articoli per calcolare il riepilogo.";
  if (status === "incomplete_lines") {
    return "Completa quantità e prezzo di tutte le righe per ottenere il €/t medio.";
  }
  if (status === "missing_weight") {
    const missing = Math.max(0, lineCount - weightedReadyLineCount);
    return (
      "€/t medio non disponibile: " +
      missing +
      (missing === 1
        ? " riga non ha un peso kg/m governato."
        : " righe non hanno un peso kg/m governato.")
    );
  }
  if (status === "no_tonnage") return "La distinta non contiene tonnellaggio calcolabile.";
  return "Media ponderata = valore totale ÷ tonnellate totali.";
}

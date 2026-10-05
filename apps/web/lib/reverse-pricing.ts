export type ReverseDiscountStatus =
  | "ready"
  | "invalid_target"
  | "unsupported_formula"
  | "missing_weight"
  | "invalid_base"
  | "invalid_extra"
  | "target_below_fixed_extra"
  | "target_above_gross_price";

export type ReverseDiscountInput = {
  formula: string | null;
  targetEurT: number;
  baseEurM: number | null;
  fixedExtraEurM: number | null;
  weightKgM: number | null;
  pricePerTReady: boolean;
};

export type ReverseDiscountResult = {
  status: ReverseDiscountStatus;
  discountPct: number | null;
  targetEurM: number | null;
  grossEurM: number | null;
};

function finiteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function solveDiscountForTargetEurT(
  input: ReverseDiscountInput,
): ReverseDiscountResult {
  if (!finiteNumber(input.targetEurT) || input.targetEurT <= 0) {
    return {
      status: "invalid_target",
      discountPct: null,
      targetEurM: null,
      grossEurM: null,
    };
  }

  if (input.formula !== "discounted_base_plus_fixed_extra") {
    return {
      status: "unsupported_formula",
      discountPct: null,
      targetEurM: null,
      grossEurM: null,
    };
  }

  if (
    !input.pricePerTReady ||
    !finiteNumber(input.weightKgM) ||
    input.weightKgM <= 0
  ) {
    return {
      status: "missing_weight",
      discountPct: null,
      targetEurM: null,
      grossEurM: null,
    };
  }

  if (!finiteNumber(input.baseEurM) || input.baseEurM <= 0) {
    return {
      status: "invalid_base",
      discountPct: null,
      targetEurM: null,
      grossEurM: null,
    };
  }

  if (!finiteNumber(input.fixedExtraEurM) || input.fixedExtraEurM < 0) {
    return {
      status: "invalid_extra",
      discountPct: null,
      targetEurM: null,
      grossEurM: null,
    };
  }

  const targetEurM = (input.targetEurT * input.weightKgM) / 1000;
  const grossEurM = input.baseEurM + input.fixedExtraEurM;

  if (targetEurM < input.fixedExtraEurM) {
    return {
      status: "target_below_fixed_extra",
      discountPct: null,
      targetEurM,
      grossEurM,
    };
  }

  if (targetEurM > grossEurM) {
    return {
      status: "target_above_gross_price",
      discountPct: null,
      targetEurM,
      grossEurM,
    };
  }

  const discountPct =
    (1 - (targetEurM - input.fixedExtraEurM) / input.baseEurM) * 100;

  if (discountPct < 0 || discountPct > 100) {
    return {
      status:
        discountPct > 100
          ? "target_below_fixed_extra"
          : "target_above_gross_price",
      discountPct: null,
      targetEurM,
      grossEurM,
    };
  }

  return {
    status: "ready",
    discountPct,
    targetEurM,
    grossEurM,
  };
}

export function reverseDiscountStatusLabel(status: ReverseDiscountStatus) {
  if (status === "invalid_target") return "Inserisci un target €/t maggiore di zero.";
  if (status === "unsupported_formula") {
    return "Reverse pricing non disponibile per questa formula commerciale.";
  }
  if (status === "missing_weight") {
    return "Target €/t non disponibile: manca un kg/m governato.";
  }
  if (status === "invalid_base") return "Base €/m non valida per il reverse pricing.";
  if (status === "invalid_extra") return "Extra €/m non valido per il reverse pricing.";
  if (status === "target_below_fixed_extra") {
    return "Target impossibile: è inferiore all'Extra fisso anche con sconto 100%.";
  }
  if (status === "target_above_gross_price") {
    return "Target superiore al prezzo lordo: richiederebbe uno sconto negativo.";
  }
  return "Sconto calcolato esattamente dal target €/t.";
}

/** COMM-UX7.B: display only numeric, tenant-authorized commercial facts. */
export type CommercialRowFacts = {
  counterparty?: string;
  material?: string;
  quantity?: string;
  totalEur?: unknown;
  dueAt?: string;
};

function positiveMetric(value: unknown): number | null {
  const valid = typeof value === "number" ||
    (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim()));
  if (!valid) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function commercialRowAmount(value: unknown): string | null {
  const amount = positiveMetric(value);
  return amount === null ? null : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);
}

export function commercialRowQuantity(tonnes: unknown, meters: unknown): string | null {
  const mass = positiveMetric(tonnes);
  if (mass !== null) return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(mass) + " t";
  const length = positiveMetric(meters);
  return length === null ? null : new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(length) + " m";
}

/** CALC-UX4: one auditable source of truth for a requested quantity and full commercial bars.
 * A requested length/tonnage never turns into an invisible fractional bar.
 * The canonical bill quantity is the number of whole bars; requested and actual
 * quantities are separate and the rounding surplus is shown in the cockpit.
 */
export type CommercialQuantityBasis = "metres" | "tonnes";

export type CommercialBarResolution = {
  bars: number;
  requestedMetres: number;
  requestedTonnes: number;
  actualMetres: number;
  actualTonnes: number;
  surplusMetres: number;
};

export function resolveCommercialBarQuantity(
  mode: CommercialQuantityBasis,
  raw: string,
  kgM: number,
  barLengthM: number,
): CommercialBarResolution | null {
  if (!raw.trim() || !/^\d+(?:[.,]\d+)?$/.test(raw.trim())) return null;
  const requested = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(requested) || requested <= 0 ||
      !Number.isFinite(kgM) || kgM <= 0 ||
      !Number.isFinite(barLengthM) || barLengthM <= 0) return null;
  const requestedMetres = mode === "metres" ? requested : requested * 1000 / kgM;
  const unroundedBars = requestedMetres / barLengthM;
  if (!Number.isFinite(unroundedBars) || unroundedBars <= 0 || unroundedBars > 1_000_000) return null;
  // A tiny floating-point tolerance only prevents 4.000000000000001 from becoming 5.
  // Never round down a materially incomplete bar.
  const bars = Math.ceil(unroundedBars - 1e-10);
  if (!Number.isSafeInteger(bars) || bars < 1 || bars > 1_000_000) return null;
  const actualMetres = bars * barLengthM;
  const actualTonnes = actualMetres * kgM / 1000;
  return {
    bars, requestedMetres, requestedTonnes: requestedMetres * kgM / 1000,
    actualMetres, actualTonnes,
    surplusMetres: Math.max(0, actualMetres - requestedMetres),
  };
}

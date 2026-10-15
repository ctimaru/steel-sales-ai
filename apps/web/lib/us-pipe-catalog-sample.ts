/**
 * CALC-INT3 — a deliberately small, source-located public manufacturer sample.
 *
 * Values mirror the pre-existing SK4.4b/4c U.S. Steel NPS/Schedule seeds:
 * - supabase/migrations/20260920174500_seed_us_api_nps_schedule_sample.sql
 * - supabase/migrations/20260920180000_expand_us_api_nps_schedule_sample.sql
 *
 * These are NOT ASME normative tables or proof of API/ASTM applicability.
 * Source weights are catalog-published lb/ft and independently converted
 * catalog kg/m; theoretical weights come from the shared pure engine.
 * No automatic canonical promotion is allowed.
 */
export const US_PIPE_MANUFACTURER_SOURCE =
  "https://www.ussteel.com/documents/40705/12686766/Standard%2Band%2BLine%2BPipe%2BCatalog.pdf/4eef8247-d217-2e20-0eb3-dd427cf4aa58";

export type UsPipeCatalogRow = {
  id: string;
  nps: string;
  schedule: string;
  outerDiameterMm: number;
  thicknessMm: number;
  publishedWeightKgM: number;
  publishedWeightLbFt: number;
  sourcePage: number;
  /** Identifies manufacturer's naming; does not establish a normative mapping. */
  classLabel?: string;
};

export const US_PIPE_MANUFACTURER_SAMPLE: readonly UsPipeCatalogRow[] = [
  { id:"6-40", nps:"6", schedule:"40", classLabel:"STD", outerDiameterMm:168.30, thicknessMm:7.11, publishedWeightLbFt:18.99, publishedWeightKgM:28.26, sourcePage:49 },
  { id:"6-80", nps:"6", schedule:"80", classLabel:"XS", outerDiameterMm:168.30, thicknessMm:10.97, publishedWeightLbFt:28.60, publishedWeightKgM:42.56, sourcePage:50 },
  { id:"6-120", nps:"6", schedule:"120", outerDiameterMm:168.30, thicknessMm:14.27, publishedWeightLbFt:36.43, publishedWeightKgM:54.21, sourcePage:50 },
  { id:"6-160", nps:"6", schedule:"160", outerDiameterMm:168.30, thicknessMm:18.26, publishedWeightLbFt:45.39, publishedWeightKgM:67.55, sourcePage:50 },
  { id:"8-60", nps:"8", schedule:"60", outerDiameterMm:219.10, thicknessMm:10.31, publishedWeightLbFt:35.67, publishedWeightKgM:53.08, sourcePage:53 },
  { id:"8-80", nps:"8", schedule:"80", classLabel:"XS", outerDiameterMm:219.10, thicknessMm:12.70, publishedWeightLbFt:43.43, publishedWeightKgM:64.63, sourcePage:53 },
  { id:"8-100", nps:"8", schedule:"100", outerDiameterMm:219.10, thicknessMm:15.09, publishedWeightLbFt:51.00, publishedWeightKgM:75.90, sourcePage:54 },
  { id:"10-20", nps:"10", schedule:"20", outerDiameterMm:273.10, thicknessMm:6.35, publishedWeightLbFt:28.06, publishedWeightKgM:41.76, sourcePage:56 },
  { id:"10-40", nps:"10", schedule:"40", classLabel:"STD", outerDiameterMm:273.10, thicknessMm:9.27, publishedWeightLbFt:40.52, publishedWeightKgM:60.30, sourcePage:56 },
  { id:"10-140", nps:"10", schedule:"140", classLabel:"XXS", outerDiameterMm:273.10, thicknessMm:25.40, publishedWeightLbFt:104.23, publishedWeightKgM:155.11, sourcePage:58 },
  { id:"12-STD", nps:"12", schedule:"STD", classLabel:"STD", outerDiameterMm:323.90, thicknessMm:9.53, publishedWeightLbFt:49.61, publishedWeightKgM:73.83, sourcePage:61 },
  { id:"12-60", nps:"12", schedule:"60", outerDiameterMm:323.90, thicknessMm:14.27, publishedWeightLbFt:73.22, publishedWeightKgM:108.96, sourcePage:62 },
  { id:"12-100", nps:"12", schedule:"100", outerDiameterMm:323.90, thicknessMm:21.44, publishedWeightLbFt:107.42, publishedWeightKgM:159.86, sourcePage:63 },
] as const;

export const US_PIPE_MASS_CONVERSION = 1.48816394357; // kg/m per lb/ft, physical unit conversion only

export function findUsPipeSample(id: string): UsPipeCatalogRow | null {
  return US_PIPE_MANUFACTURER_SAMPLE.find((row) => row.id === id) ?? null;
}
export function availableUsNps(): string[] {
  return [...new Set(US_PIPE_MANUFACTURER_SAMPLE.map((row) => row.nps))];
}
export function rowsForNps(nps: string): UsPipeCatalogRow[] {
  return US_PIPE_MANUFACTURER_SAMPLE.filter((row) => row.nps === nps);
}

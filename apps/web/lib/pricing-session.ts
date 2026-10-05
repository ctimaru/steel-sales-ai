import type { DistintaQuantityMode, DistintaTotals } from "@/lib/distinta";

export type PricingSessionMode = "manual" | "saved" | "target";

export type PricingSessionSaveLineInput = {
  itemId: string;
  quantityMode: DistintaQuantityMode;
  quantity: number;
  barLengthM: number | null;
};

export type PricingSessionSaveInput = {
  versionId: string;
  title?: string | null;
  pricingMode: PricingSessionMode;
  manualDiscountPct: number | null;
  targetEurT: number | null;
  lines: PricingSessionSaveLineInput[];
};

export type PricingSessionSummary = {
  id: string;
  title: string;
  price_list_version_id: string;
  pricing_mode: PricingSessionMode;
  currency_code: string;
  list_name_snapshot: string;
  list_code_snapshot: string;
  manufacturer_version_snapshot: string;
  source_date_snapshot: string | null;
  line_count: number;
  total_meters: number;
  total_tonnes: number;
  total_value: number;
  weighted_average_eur_t: number | null;
  weighted_average_status: DistintaTotals["weightedAverageStatus"];
  created_at: string;
};

export type PricingSessionLineSnapshot = {
  id: string;
  line_position: number;
  price_list_item_id: string;
  dimension_label_snapshot: string;
  shape_code_snapshot: string;
  standard_code_snapshot: string | null;
  grade_code_snapshot: string | null;
  finish_code_snapshot: string | null;
  thickness_mm_snapshot: number;
  note_snapshot: string | null;
  quantity_mode: DistintaQuantityMode;
  quantity: number;
  bar_length_m: number | null;
  line_meters: number;
  weight_kg_m_snapshot: number | null;
  line_tonnes: number | null;
  base_eur_m_snapshot: number;
  fixed_extra_eur_m_snapshot: number;
  applied_discount_pct: number;
  discount_source: "manual" | "saved_profile" | "target";
  discount_profile_id: string | null;
  net_eur_m: number;
  net_eur_t: number | null;
  line_total: number;
  price_per_t_ready_snapshot: boolean;
  price_per_t_status_snapshot: string;
};

export type PricingSessionSnapshot = PricingSessionSummary & {
  pricing_formula: string;
  manual_discount_pct: number | null;
  target_eur_t: number | null;
  manufacturer_revision_snapshot: string | null;
  meters_complete: boolean;
  tonnes_complete: boolean;
  value_complete: boolean;
  lines: PricingSessionLineSnapshot[];
};

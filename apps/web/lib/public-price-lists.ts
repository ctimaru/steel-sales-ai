import { createPublicSupabaseClient } from "@/lib/supabase/public";

export type PriceListCatalogEntry = {
  version_id: string;
  price_list_id: string;
  list_name: string;
  list_code: string;
  manufacturer_version_code: string;
  manufacturer_revision_code: string | null;
  source_date: string | null;
  version_status: string;
  publication_scope: string;
  currency_code: string;
  default_price_unit: string;
  source_terms_raw: string | null;
  item_count: number;
  price_per_t_ready_count: number;
  shape_codes: string[];
  grade_codes: string[];
  finish_codes: string[];
  pricing_formula: string | null;
  is_internal_preview: boolean;
  published_at: string | null;
};

export type PriceListExplorerItem = {
  item_id: string;
  section_id: string;
  shape_code: string;
  standard_code: string | null;
  standard_raw: string | null;
  grade_code: string | null;
  grade_raw: string | null;
  finish_code: string | null;
  finish_raw: string | null;
  dimension_label: string;
  thickness_mm: number;
  outer_diameter_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  base_eur_m: number;
  fixed_extra_eur_m: number;
  price_per_m_ready: boolean;
  resolved_weight_kg_m: number | null;
  price_per_t_status: string;
  price_per_t_ready: boolean;
  weight_resolution_mode: string | null;
  note_raw: string | null;
  source_page: number | null;
  section_sort_order: number;
  row_sort_order: number;
};

function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export async function listPublicPriceLists(): Promise<PriceListCatalogEntry[]> {
  if (!isConfigured()) return [];
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("pl1_price_list_catalog", {
    p_include_internal: false,
  });

  if (error) {
    console.error("PL1 public catalogue failed:", error.message);
    return [];
  }

  return Array.isArray(data) ? (data as PriceListCatalogEntry[]) : [];
}


export type PriceListPublicNotice = {
  notice_code: string;
  title: string;
  body: string;
  severity: "warning" | "info" | string;
  calculation_order: number;
};

export type PriceListPublicationIssue = {
  code: string;
  message: string;
  count?: number;
  ready?: number;
  total?: number;
  missing?: number;
  decision?: string | null;
  structured_visibility?: string | null;
  status?: string;
  publication_scope?: string;
};

export type PriceListPublicationReadiness = {
  version_id: string;
  manufacturer_version_code: string;
  status: string;
  publication_scope: string;
  ready_to_publish: boolean;
  metrics: {
    item_count: number;
    price_per_m_ready: number;
    price_per_t_ready: number;
    price_per_t_missing: number;
    price_per_t_coverage_pct: number;
    import_error_items: number;
    import_review_items: number;
    review_required_rules: number;
  };
  source_governance: {
    decision: string | null;
    structured_visibility: string | null;
    sha256_ready: boolean;
  };
  blockers: PriceListPublicationIssue[];
  warnings: PriceListPublicationIssue[];
};

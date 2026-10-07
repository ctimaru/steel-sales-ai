export type ProcurementIntelligenceSummary = {
  rfq_count?: number;
  supplier_count?: number;
  supplier_invite_count?: number;
  supplier_response_count?: number;
  response_rate_pct?: number | string;
  comparable_quote_count?: number;
  complete_quote_count?: number;
  quote_coverage_pct?: number | string;
  avg_lead_time_days?: number | string | null;
  award_count?: number;
  awarded_total_eur?: number | string;
  target_total_eur?: number | string;
  savings_eur?: number | string;
  savings_pct?: number | string | null;
  price_sample_count?: number;
};

export type ProcurementSupplierPerformance = {
  profile_id: string | null;
  name: string;
  email: string | null;
  preferred: boolean;
  tags: string[];
  rfq_count: number;
  responded_rfq_count: number;
  response_rate_pct: number | string;
  avg_response_hours: number | string | null;
  quoted_rfq_count: number;
  complete_quote_count: number;
  avg_quote_coverage_pct: number | string | null;
  avg_lead_time_days: number | string | null;
  award_count: number;
  award_rate_pct: number | string;
  awarded_total_eur: number | string;
  savings_total_eur: number | string;
  po_count: number;
  confirmed_po_count: number;
  po_confirmation_rate_pct: number | string;
  last_response_at: string | null;
  last_quote_at: string | null;
  last_award_at: string | null;
  last_po_at: string | null;
};

export type ProcurementArticleIntelligence = {
  article_key: string;
  description: string;
  standard_code: string | null;
  grade_code: string | null;
  finish_code: string | null;
  sample_count: number;
  supplier_count: number;
  min_eur_t: number | string | null;
  max_eur_t: number | string | null;
  avg_eur_t: number | string | null;
  latest_at: string | null;
  latest_eur_t: number | string | null;
  previous_eur_t: number | string | null;
  change_eur_t: number | string | null;
  change_pct: number | string | null;
  latest_eur_m: number | string | null;
};

export type ProcurementPriceHistoryRow = {
  profile_id: string | null;
  supplier_name: string;
  rfq_id: string;
  rfq_title: string;
  quote_id: string;
  revision_no: number;
  submitted_at: string;
  line_position: number;
  description: string;
  standard_code: string | null;
  grade_code: string | null;
  finish_code: string | null;
  eur_t: number | string | null;
  eur_m: number | string | null;
  lead_time_days: number | null;
};

export type ProcurementAwardIntelligence = {
  award_id: string;
  rfq_id: string;
  rfq_title: string;
  award_mode: string;
  supplier_count: number;
  confirmed_at: string;
  total_eur: number | string;
  target_total_eur: number | string;
  savings_eur: number | string;
  savings_pct: number | string | null;
};

export type ProcurementIntelligenceData = {
  contract?: string;
  period?: {
    days?: number;
    cutoff?: string | null;
  };
  summary?: ProcurementIntelligenceSummary;
  supplier_performance?: ProcurementSupplierPerformance[];
  articles?: ProcurementArticleIntelligence[];
  price_history?: ProcurementPriceHistoryRow[];
  awards?: ProcurementAwardIntelligence[];
};

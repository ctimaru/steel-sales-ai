"use server";

import { createClient } from "@/lib/supabase/server";

export type DemandWindow = 30 | 90;

export type DemandQuantitySummary = {
  unit: string;
  total_quantity: number;
  line_count: number;
};

export type DemandEvidence = {
  rfq_id: string;
  rfq_line_id: string;
  company_id: string | null;
  company_name: string | null;
  requested_at: string | null;
  raw_spec_text: string | null;
  requested_grade: string | null;
  requested_standard: string | null;
  requested_quantity: number | null;
  quantity_unit: string | null;
};

export type DemandSignal = {
  signal_type: "repeated_account" | "multi_account";
  canonical_product_id: string;
  canonical_product_key: string | null;
  product_label: string;
  company_id: string | null;
  company_name: string | null;
  company_names: string[];
  distinct_rfq_count: number;
  distinct_company_count: number;
  first_requested_at: string | null;
  latest_requested_at: string | null;
  quantity_summaries: DemandQuantitySummary[];
  evidence: DemandEvidence[];
};

export type DemandPayload = {
  summary: {
    normalized_line_count: number;
    distinct_rfq_count: number;
    distinct_product_count: number;
    attributed_line_count: number;
    unattributed_line_count: number;
    attributed_rfq_count: number;
    unattributed_rfq_count: number;
    distinct_company_count: number;
    signal_count: number;
    repeated_account_signal_count: number;
    multi_account_signal_count: number;
    first_requested_at: string | null;
    latest_requested_at: string | null;
  };
  signals: DemandSignal[];
  policy: {
    window_days: DemandWindow;
    supported_windows: DemandWindow[];
    canonical_product_required: boolean;
    company_attribution_required_for_signals: boolean;
    repeated_account_min_distinct_rfqs: number;
    multi_account_min_distinct_companies: number;
    quantity_aggregation: string;
    predictive_score: boolean;
    external_market_data: boolean;
    cross_tenant_benchmark: boolean;
    language: string;
  };
  error?: string;
};

const EMPTY_PAYLOAD: DemandPayload = {
  summary: {
    normalized_line_count: 0,
    distinct_rfq_count: 0,
    distinct_product_count: 0,
    attributed_line_count: 0,
    unattributed_line_count: 0,
    attributed_rfq_count: 0,
    unattributed_rfq_count: 0,
    distinct_company_count: 0,
    signal_count: 0,
    repeated_account_signal_count: 0,
    multi_account_signal_count: 0,
    first_requested_at: null,
    latest_requested_at: null,
  },
  signals: [],
  policy: {
    window_days: 30,
    supported_windows: [30, 90],
    canonical_product_required: true,
    company_attribution_required_for_signals: true,
    repeated_account_min_distinct_rfqs: 2,
    multi_account_min_distinct_companies: 2,
    quantity_aggregation: "per_unit_only",
    predictive_score: false,
    external_market_data: false,
    cross_tenant_benchmark: false,
    language: "account_demand_or_multi_account_demand",
  },
};

export async function loadDemandSignals(windowDays: DemandWindow): Promise<DemandPayload> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return {
      ...EMPTY_PAYLOAD,
      policy: { ...EMPTY_PAYLOAD.policy, window_days: windowDays },
      error: "Dati non configurati.",
    };
  }

  const client = await createClient();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    return {
      ...EMPTY_PAYLOAD,
      policy: { ...EMPTY_PAYLOAD.policy, window_days: windowDays },
      error: "Sessione non valida.",
    };
  }

  const { data: memberships, error: membershipError } = await client
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) {
    return {
      ...EMPTY_PAYLOAD,
      policy: { ...EMPTY_PAYLOAD.policy, window_days: windowDays },
      error: "Workspace non disponibile.",
    };
  }

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership?.organization_id) {
    return {
      ...EMPTY_PAYLOAD,
      policy: { ...EMPTY_PAYLOAD.policy, window_days: windowDays },
      error: "Nessuna organizzazione attiva.",
    };
  }

  const { data, error } = await client.rpc("p2_demand_signals", {
    p_organization_id: membership.organization_id,
    p_window_days: windowDays,
    p_limit: 100,
    p_offset: 0,
  });

  if (error || !data || typeof data !== "object") {
    return {
      ...EMPTY_PAYLOAD,
      policy: { ...EMPTY_PAYLOAD.policy, window_days: windowDays },
      error: "Impossibile caricare i segnali di domanda.",
    };
  }

  const payload = data as Partial<DemandPayload>;
  const summary = payload.summary;
  const policy = payload.policy;

  return {
    summary: {
      normalized_line_count: Number(summary?.normalized_line_count ?? 0),
      distinct_rfq_count: Number(summary?.distinct_rfq_count ?? 0),
      distinct_product_count: Number(summary?.distinct_product_count ?? 0),
      attributed_line_count: Number(summary?.attributed_line_count ?? 0),
      unattributed_line_count: Number(summary?.unattributed_line_count ?? 0),
      attributed_rfq_count: Number(summary?.attributed_rfq_count ?? 0),
      unattributed_rfq_count: Number(summary?.unattributed_rfq_count ?? 0),
      distinct_company_count: Number(summary?.distinct_company_count ?? 0),
      signal_count: Number(summary?.signal_count ?? 0),
      repeated_account_signal_count: Number(summary?.repeated_account_signal_count ?? 0),
      multi_account_signal_count: Number(summary?.multi_account_signal_count ?? 0),
      first_requested_at: summary?.first_requested_at ?? null,
      latest_requested_at: summary?.latest_requested_at ?? null,
    },
    signals: Array.isArray(payload.signals) ? payload.signals as DemandSignal[] : [],
    policy: {
      window_days: policy?.window_days === 90 ? 90 : 30,
      supported_windows: [30, 90],
      canonical_product_required: policy?.canonical_product_required !== false,
      company_attribution_required_for_signals:
        policy?.company_attribution_required_for_signals !== false,
      repeated_account_min_distinct_rfqs:
        Number(policy?.repeated_account_min_distinct_rfqs ?? 2),
      multi_account_min_distinct_companies:
        Number(policy?.multi_account_min_distinct_companies ?? 2),
      quantity_aggregation: String(policy?.quantity_aggregation ?? "per_unit_only"),
      predictive_score: policy?.predictive_score === true,
      external_market_data: policy?.external_market_data === true,
      cross_tenant_benchmark: policy?.cross_tenant_benchmark === true,
      language: String(policy?.language ?? "account_demand_or_multi_account_demand"),
    },
  };
}

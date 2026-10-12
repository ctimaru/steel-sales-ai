"use server";

import { createClient } from "@/lib/supabase/server";

export type ReengagementEvidence = {
  event_type: "conversation" | "rfq" | "offer" | "order";
  event_id: string;
  event_at: string | null;
};

export type ReengagementSignal = {
  company_id: string;
  name: string;
  company_type: string | null;
  country: string | null;
  website: string | null;
  verified: boolean;
  signal_state: "watch" | "dormant";
  inactive_days: number;
  last_activity_at: string;
  conversation_count: number;
  rfq_count: number;
  offer_count: number;
  order_count: number;
  has_order_history: boolean;
  reason_codes: string[];
  latest_evidence: ReengagementEvidence | null;
};

export type ReengagementPayload = {
  summary: {
    total: number;
    watch: number;
    dormant: number;
    with_order_history: number;
  };
  signals: ReengagementSignal[];
  policy: {
    watch_after_days: number;
    dormant_after_days: number;
    verified_companies_only: boolean;
    historical_activity_required: boolean;
    ranking: string;
    predictive_score: boolean;
    cross_tenant_data: boolean;
  };
  error?: string;
};

const EMPTY_PAYLOAD: ReengagementPayload = {
  summary: { total: 0, watch: 0, dormant: 0, with_order_history: 0 },
  signals: [],
  policy: {
    watch_after_days: 45,
    dormant_after_days: 90,
    verified_companies_only: true,
    historical_activity_required: true,
    ranking: "order_history_then_offer_count_then_rfq_count_then_inactive_days",
    predictive_score: false,
    cross_tenant_data: false,
  },
};

export async function loadReengagementSignals(): Promise<ReengagementPayload> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return { ...EMPTY_PAYLOAD, error: "Dati non configurati." };
  }

  const client = await createClient();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    return { ...EMPTY_PAYLOAD, error: "Sessione non valida." };
  }

  const { data: memberships, error: membershipError } = await client
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) {
    return { ...EMPTY_PAYLOAD, error: "Workspace non disponibile." };
  }

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership?.organization_id) {
    return { ...EMPTY_PAYLOAD, error: "Nessuna organizzazione attiva." };
  }

  const { data, error } = await client.rpc("p2_reengagement_signals", {
    p_organization_id: membership.organization_id,
    p_watch_after_days: 45,
    p_dormant_after_days: 90,
    p_limit: 100,
    p_offset: 0,
  });

  if (error || !data || typeof data !== "object") {
    return { ...EMPTY_PAYLOAD, error: "Impossibile caricare i segnali di riattivazione." };
  }

  const payload = data as Partial<ReengagementPayload>;
  return {
    summary: {
      total: Number(payload.summary?.total ?? 0),
      watch: Number(payload.summary?.watch ?? 0),
      dormant: Number(payload.summary?.dormant ?? 0),
      with_order_history: Number(payload.summary?.with_order_history ?? 0),
    },
    signals: Array.isArray(payload.signals) ? payload.signals as ReengagementSignal[] : [],
    policy: {
      watch_after_days: Number(payload.policy?.watch_after_days ?? 45),
      dormant_after_days: Number(payload.policy?.dormant_after_days ?? 90),
      verified_companies_only: payload.policy?.verified_companies_only !== false,
      historical_activity_required: payload.policy?.historical_activity_required !== false,
      ranking: String(payload.policy?.ranking ?? EMPTY_PAYLOAD.policy.ranking),
      predictive_score: payload.policy?.predictive_score === true,
      cross_tenant_data: payload.policy?.cross_tenant_data === true,
    },
  };
}

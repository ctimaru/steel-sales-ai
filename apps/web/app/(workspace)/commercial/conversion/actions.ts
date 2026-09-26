"use server";

import { createClient } from "@/lib/supabase/server";

export type ConversionOutcome = {
  entity_type: "offer" | "order";
  entity_id: string;
  event_at: string | null;
  status: string | null;
  company_id: string | null;
  company_name: string | null;
  conversation_id: string | null;
  rfq_id: string | null;
  offer_id: string | null;
  line_count: number;
  canonical_line_count: number;
  linked_order_count: number;
  analysis_status:
    | "identity_gap"
    | "unverified_company"
    | "relationship_gap"
    | "relationship_company_gap"
    | "open_offer"
    | "converted"
    | "linked_order";
};

export type ConversionPayload = {
  summary: {
    rfq_count: number;
    offer_count: number;
    order_count: number;
    attributed_rfq_count: number;
    attributed_offer_count: number;
    attributed_order_count: number;
    canonical_offer_line_count: number;
    canonical_order_line_count: number;
    offer_rfq_linked_count: number;
    order_offer_linked_count: number;
    order_rfq_linked_count: number;
    conversion_eligible_offer_count: number;
    converted_offer_count: number;
    open_offer_followup_count: number;
    identity_gap_offer_count: number;
    identity_gap_order_count: number;
    relationship_gap_offer_count: number;
    relationship_gap_order_count: number;
    outcome_conversation_count: number;
    outcome_company_conversation_count: number;
    outcome_recovered_message_count: number;
    outcome_recovered_conversation_count: number;
    relationship_ready_count: number;
    conversion_rate_pct: number | null;
  };
  outcomes: ConversionOutcome[];
  policy: {
    verified_company_required: boolean;
    explicit_relationship_required_for_conversion: boolean;
    conversion_denominator: string;
    missing_identity_is_not_loss: boolean;
    missing_relationship_is_not_loss: boolean;
    conversion_rate_nullable: boolean;
    predictive_score: boolean;
    cross_thread_similarity: boolean;
    email_domain_inference: boolean;
    filename_inference: boolean;
    subject_inference: boolean;
    bulk_relationship_activation: boolean;
  };
  error?: string;
};

const EMPTY: ConversionPayload = {
  summary: {
    rfq_count: 0,
    offer_count: 0,
    order_count: 0,
    attributed_rfq_count: 0,
    attributed_offer_count: 0,
    attributed_order_count: 0,
    canonical_offer_line_count: 0,
    canonical_order_line_count: 0,
    offer_rfq_linked_count: 0,
    order_offer_linked_count: 0,
    order_rfq_linked_count: 0,
    conversion_eligible_offer_count: 0,
    converted_offer_count: 0,
    open_offer_followup_count: 0,
    identity_gap_offer_count: 0,
    identity_gap_order_count: 0,
    relationship_gap_offer_count: 0,
    relationship_gap_order_count: 0,
    outcome_conversation_count: 0,
    outcome_company_conversation_count: 0,
    outcome_recovered_message_count: 0,
    outcome_recovered_conversation_count: 0,
    relationship_ready_count: 0,
    conversion_rate_pct: null,
  },
  outcomes: [],
  policy: {
    verified_company_required: true,
    explicit_relationship_required_for_conversion: true,
    conversion_denominator: "verified_company_plus_same_company_rfq_link",
    missing_identity_is_not_loss: true,
    missing_relationship_is_not_loss: true,
    conversion_rate_nullable: true,
    predictive_score: false,
    cross_thread_similarity: false,
    email_domain_inference: false,
    filename_inference: false,
    subject_inference: false,
    bulk_relationship_activation: false,
  },
};

export async function loadConversionFoundation(): Promise<ConversionPayload> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return { ...EMPTY, error: "Dati non configurati." };
  }

  const client = await createClient();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    return { ...EMPTY, error: "Sessione non valida." };
  }

  const { data: memberships, error: membershipError } = await client
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) {
    return { ...EMPTY, error: "Workspace non disponibile." };
  }

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership?.organization_id) {
    return { ...EMPTY, error: "Nessuna organizzazione attiva." };
  }

  const { data, error } = await client.rpc("p2_commercial_conversion_foundation", {
    p_organization_id: membership.organization_id,
    p_limit: 100,
    p_offset: 0,
  });

  if (error || !data || typeof data !== "object") {
    return { ...EMPTY, error: "Impossibile caricare la foundation conversione." };
  }

  const payload = data as Partial<ConversionPayload>;
  const summary = payload.summary;

  return {
    summary: {
      rfq_count: Number(summary?.rfq_count ?? 0),
      offer_count: Number(summary?.offer_count ?? 0),
      order_count: Number(summary?.order_count ?? 0),
      attributed_rfq_count: Number(summary?.attributed_rfq_count ?? 0),
      attributed_offer_count: Number(summary?.attributed_offer_count ?? 0),
      attributed_order_count: Number(summary?.attributed_order_count ?? 0),
      canonical_offer_line_count: Number(summary?.canonical_offer_line_count ?? 0),
      canonical_order_line_count: Number(summary?.canonical_order_line_count ?? 0),
      offer_rfq_linked_count: Number(summary?.offer_rfq_linked_count ?? 0),
      order_offer_linked_count: Number(summary?.order_offer_linked_count ?? 0),
      order_rfq_linked_count: Number(summary?.order_rfq_linked_count ?? 0),
      conversion_eligible_offer_count: Number(summary?.conversion_eligible_offer_count ?? 0),
      converted_offer_count: Number(summary?.converted_offer_count ?? 0),
      open_offer_followup_count: Number(summary?.open_offer_followup_count ?? 0),
      identity_gap_offer_count: Number(summary?.identity_gap_offer_count ?? 0),
      identity_gap_order_count: Number(summary?.identity_gap_order_count ?? 0),
      relationship_gap_offer_count: Number(summary?.relationship_gap_offer_count ?? 0),
      relationship_gap_order_count: Number(summary?.relationship_gap_order_count ?? 0),
      outcome_conversation_count: Number(summary?.outcome_conversation_count ?? 0),
      outcome_company_conversation_count: Number(summary?.outcome_company_conversation_count ?? 0),
      outcome_recovered_message_count: Number(summary?.outcome_recovered_message_count ?? 0),
      outcome_recovered_conversation_count: Number(summary?.outcome_recovered_conversation_count ?? 0),
      relationship_ready_count: Number(summary?.relationship_ready_count ?? 0),
      conversion_rate_pct:
        summary?.conversion_rate_pct === null || summary?.conversion_rate_pct === undefined
          ? null
          : Number(summary.conversion_rate_pct),
    },
    outcomes: Array.isArray(payload.outcomes) ? payload.outcomes as ConversionOutcome[] : [],
    policy: {
      verified_company_required: payload.policy?.verified_company_required !== false,
      explicit_relationship_required_for_conversion:
        payload.policy?.explicit_relationship_required_for_conversion !== false,
      conversion_denominator: String(
        payload.policy?.conversion_denominator ?? "verified_company_plus_same_company_rfq_link",
      ),
      missing_identity_is_not_loss: payload.policy?.missing_identity_is_not_loss !== false,
      missing_relationship_is_not_loss: payload.policy?.missing_relationship_is_not_loss !== false,
      conversion_rate_nullable: payload.policy?.conversion_rate_nullable !== false,
      predictive_score: payload.policy?.predictive_score === true,
      cross_thread_similarity: payload.policy?.cross_thread_similarity === true,
      email_domain_inference: payload.policy?.email_domain_inference === true,
      filename_inference: payload.policy?.filename_inference === true,
      subject_inference: payload.policy?.subject_inference === true,
      bulk_relationship_activation: payload.policy?.bulk_relationship_activation === true,
    },
  };
}

"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { appRoutes } from "@/lib/routes";

export type CrossThreadLineEvidence = {
  source_line_id: string;
  target_line_id: string;
  source_canonical_product_key: string;
  target_canonical_product_key: string;
  geometry_key: string;
  canonical_match: boolean;
  source_text: string | null;
  target_text: string | null;
};

export type CrossThreadCandidate = {
  relationship_type: "offer_rfq" | "order_offer" | "order_rfq";
  source_kind: "offer" | "order";
  target_kind: "rfq" | "offer";
  source_entity_id: string;
  target_entity_id: string;
  company_id: string;
  company_name: string | null;
  source_conversation_id: string;
  target_conversation_id: string;
  source_evidence_at: string;
  target_evidence_at: string;
  gap_hours: number;
  gap_days: number;
  source_contact_id: string | null;
  target_contact_id: string | null;
  shared_contact: boolean;
  exact_product_overlap_count: number;
  geometry_overlap_count: number;
  evidence_class: "strong_review" | "review";
  reason_codes: string[];
  line_evidence: CrossThreadLineEvidence[];
};

export type CrossThreadPayload = {
  summary: {
    pending_total: number;
    strong_review_count: number;
    review_count: number;
    offer_rfq_pending: number;
    order_offer_pending: number;
    order_rfq_pending: number;
    accepted_total: number;
    rejected_total: number;
  };
  candidates: CrossThreadCandidate[];
  policy: {
    window_days: number;
    verified_same_company_required: boolean;
    distinct_conversation_required: boolean;
    chronological_order_required: boolean;
    canonical_or_exact_geometry_overlap_required: boolean;
    strong_review_max_days: number;
    human_decision_required: boolean;
    automatic_activation: boolean;
    email_domain_inference: boolean;
    filename_inference: boolean;
    subject_similarity: boolean;
    embedding_similarity: boolean;
    fuzzy_dimension_tolerance: boolean;
    geometry_only_line_fk: boolean;
  };
  error?: string;
};

export type CrossThreadDecisionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const EMPTY: CrossThreadPayload = {
  summary: {
    pending_total: 0,
    strong_review_count: 0,
    review_count: 0,
    offer_rfq_pending: 0,
    order_offer_pending: 0,
    order_rfq_pending: 0,
    accepted_total: 0,
    rejected_total: 0,
  },
  candidates: [],
  policy: {
    window_days: 90,
    verified_same_company_required: true,
    distinct_conversation_required: true,
    chronological_order_required: true,
    canonical_or_exact_geometry_overlap_required: true,
    strong_review_max_days: 30,
    human_decision_required: true,
    automatic_activation: false,
    email_domain_inference: false,
    filename_inference: false,
    subject_similarity: false,
    embedding_similarity: false,
    fuzzy_dimension_tolerance: false,
    geometry_only_line_fk: false,
  },
};

async function activeOrganizationId() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { client, organizationId: null as string | null };

  const { data: memberships } = await client
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  return { client, organizationId: membership?.organization_id ?? null };
}

export async function loadCrossThreadRelationshipEvidence(
  windowDays = 90,
): Promise<CrossThreadPayload> {
  const { client, organizationId } = await activeOrganizationId();
  if (!organizationId) return { ...EMPTY, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p2_cross_thread_relationship_evidence", {
    p_organization_id: organizationId,
    p_window_days: windowDays,
    p_limit: 100,
    p_offset: 0,
  });

  if (error || !data || typeof data !== "object") {
    return { ...EMPTY, error: error?.message ?? "Evidence cross-thread non disponibile." };
  }

  const payload = data as Partial<CrossThreadPayload>;
  const summary = payload.summary;

  return {
    summary: {
      pending_total: Number(summary?.pending_total ?? 0),
      strong_review_count: Number(summary?.strong_review_count ?? 0),
      review_count: Number(summary?.review_count ?? 0),
      offer_rfq_pending: Number(summary?.offer_rfq_pending ?? 0),
      order_offer_pending: Number(summary?.order_offer_pending ?? 0),
      order_rfq_pending: Number(summary?.order_rfq_pending ?? 0),
      accepted_total: Number(summary?.accepted_total ?? 0),
      rejected_total: Number(summary?.rejected_total ?? 0),
    },
    candidates: Array.isArray(payload.candidates)
      ? payload.candidates as CrossThreadCandidate[]
      : [],
    policy: {
      ...EMPTY.policy,
      ...(payload.policy ?? {}),
      window_days: Number(payload.policy?.window_days ?? windowDays),
      strong_review_max_days: Number(payload.policy?.strong_review_max_days ?? 30),
    },
  };
}

export async function decideCrossThreadRelationship(
  _previous: CrossThreadDecisionState,
  formData: FormData,
): Promise<CrossThreadDecisionState> {
  const relationshipType = String(formData.get("relationship_type") ?? "");
  const sourceEntityId = String(formData.get("source_entity_id") ?? "");
  const targetEntityId = String(formData.get("target_entity_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (
    !["offer_rfq", "order_offer", "order_rfq"].includes(relationshipType) ||
    !["accepted", "rejected"].includes(decision) ||
    !uuid.test(sourceEntityId) ||
    !uuid.test(targetEntityId)
  ) {
    return { status: "error", message: "Decisione relazione non valida." };
  }

  const { client, organizationId } = await activeOrganizationId();
  if (!organizationId) return { status: "error", message: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p2_decide_cross_thread_relationship", {
    p_organization_id: organizationId,
    p_relationship_type: relationshipType,
    p_source_entity_id: sourceEntityId,
    p_target_entity_id: targetEntityId,
    p_decision: decision,
    p_note: note || null,
  });

  if (error || !data || typeof data !== "object") {
    return {
      status: "error",
      message: error?.message ?? "Decisione cross-thread non riuscita.",
    };
  }

  const result = data as Record<string, unknown>;
  const status = String(result.status ?? "");

  if (status === "blocked") {
    return {
      status: "error",
      message: `Relazione bloccata: ${String(result.reason ?? "evidence non più valida")}.`,
    };
  }

  if (status === "already_decided") {
    return {
      status: "error",
      message: "Questo candidato è già stato revisionato.",
    };
  }

  revalidatePath(appRoutes.commercial.crossThreadRelationships);
  revalidatePath(appRoutes.commercial.conversion);

  if (status === "rejected") {
    return {
      status: "success",
      message: "Candidato rifiutato. Nessuna relazione commerciale è stata modificata.",
    };
  }

  if (status === "applied") {
    const linkedLines = Number(result.linked_line_count ?? 0);
    return {
      status: "success",
      message: `Relazione confermata e attivata. ${linkedLines} linee collegate solo tramite canonical key esatto; la conversion intelligence è stata aggiornata.`,
    };
  }

  return { status: "error", message: "Risposta decisione non riconosciuta." };
}

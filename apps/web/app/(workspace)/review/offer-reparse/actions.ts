"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReparseTargetObservation = {
  observation_id: number;
  source_text: string | null;
  current_values: Record<string, unknown>;
  adoptable_fields: string[];
  conflicting_fields: string[];
  equal_fields: string[];
};

export type ReparseCandidateDecision = {
  id: number;
  decision: "adopted" | "rejected";
  target_observation_id: number | null;
  selected_fields: string[];
  review_id: number | null;
  correction_event_id: number | null;
  decided_at: string;
};

export type ReparseCandidateReviewItem = {
  candidate_id: number;
  run_id: number;
  thread_id: string;
  candidate_index: number;
  source_text: string | null;
  item_role: string | null;
  candidate_evidence: Record<string, unknown>;
  comparison_snapshot: Record<string, unknown>;
  review_status: "pending_review" | "accepted" | "rejected";
  decision: ReparseCandidateDecision | null;
  target_observations: ReparseTargetObservation[];
};

export type ReparseCandidateReviewPayload = {
  summary: {
    candidate_count: number;
    pending_review: number;
    accepted: number;
    rejected: number;
  };
  items: ReparseCandidateReviewItem[];
  policy: {
    explicit_target_required: boolean;
    explicit_fields_required: boolean;
    automatic_candidate_match: boolean;
    overwrite_non_null_fields: boolean;
    reuse_human_correction_loop: boolean;
    automatic_remediation_resolution: boolean;
  };
};

async function activeOrganization() {
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

export async function loadOfferReparseCandidateReview(): Promise<{
  data: ReparseCandidateReviewPayload | null;
  error?: string;
}> {
  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_offer_reparse_candidate_review", {
    p_organization_id: organizationId,
    p_limit: 200,
  });

  if (error || !data || typeof data !== "object") {
    return {
      data: null,
      error: error?.message ?? "Review delle candidate reparse non disponibile.",
    };
  }

  return { data: data as unknown as ReparseCandidateReviewPayload };
}

export async function adoptOfferReparseCandidate(input: {
  candidateId: number;
  targetObservationId: number;
  selectedFields: string[];
  note?: string;
}): Promise<{ ok: boolean; status?: string; error?: string }> {
  if (!Number.isInteger(input.candidateId) || input.candidateId <= 0) {
    return { ok: false, error: "Candidate non valida." };
  }
  if (!Number.isInteger(input.targetObservationId) || input.targetObservationId <= 0) {
    return { ok: false, error: "Observation target non valida." };
  }
  if (!input.selectedFields.length) {
    return { ok: false, error: "Seleziona almeno un campo da adottare." };
  }

  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { ok: false, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_adopt_offer_reparse_candidate", {
    p_organization_id: organizationId,
    p_candidate_id: input.candidateId,
    p_target_observation_id: input.targetObservationId,
    p_selected_fields: input.selectedFields,
    p_note: input.note?.trim() || null,
  });

  if (error || !data || typeof data !== "object") {
    return { ok: false, error: error?.message ?? "Adozione candidate non riuscita." };
  }

  const result = data as Record<string, unknown>;
  const status = typeof result.status === "string" ? result.status : undefined;
  const ok = status === "adopted" || status === "already_decided";

  if (ok) {
    revalidatePath("/review/offer-reparse");
    revalidatePath("/review/offer-remediation");
    revalidatePath("/review");
  }

  return {
    ok,
    status,
    error: ok
      ? undefined
      : typeof result.reason === "string"
        ? result.reason
        : "Candidate non adottabile.",
  };
}

export async function rejectOfferReparseCandidate(input: {
  candidateId: number;
  note?: string;
}): Promise<{ ok: boolean; status?: string; error?: string }> {
  if (!Number.isInteger(input.candidateId) || input.candidateId <= 0) {
    return { ok: false, error: "Candidate non valida." };
  }

  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { ok: false, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_reject_offer_reparse_candidate", {
    p_organization_id: organizationId,
    p_candidate_id: input.candidateId,
    p_note: input.note?.trim() || null,
  });

  if (error || !data || typeof data !== "object") {
    return { ok: false, error: error?.message ?? "Rifiuto candidate non riuscito." };
  }

  const result = data as Record<string, unknown>;
  const status = typeof result.status === "string" ? result.status : undefined;
  const ok = status === "rejected" || status === "already_decided";

  if (ok) {
    revalidatePath("/review/offer-reparse");
    revalidatePath("/review/offer-remediation");
  }

  return {
    ok,
    status,
    error: ok
      ? undefined
      : typeof result.reason === "string"
        ? result.reason
        : "Candidate non rifiutabile.",
  };
}

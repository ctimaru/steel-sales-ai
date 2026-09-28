"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

function trustPath(key?: "message" | "error", message?: string) {
  const base = "/platform/network-trust";
  if (!key || !message) return base;
  return `${base}?${key}=${encodeURIComponent(message)}`;
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseJson(raw: string, label: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    redirect(trustPath("error", `${label}: JSON non valido.`));
  }
}

async function finish(message: string) {
  revalidatePath("/platform");
  revalidatePath("/platform/network-trust");
  revalidatePath("/network");
  redirect(trustPath("message", message));
}

export async function createNetworkTrustAssertion(formData: FormData) {
  await requirePlatformPermission("network_trust.assert");

  const entityType = value(formData, "entity_type");
  const entityId = value(formData, "entity_id");
  const fieldPath = value(formData, "field_path");
  const rawValue = value(formData, "asserted_value_json");
  const sourceType = value(formData, "source_type") || "public_web";
  const sourceReference = value(formData, "source_reference");
  const ownershipType = value(formData, "ownership_type") || "platform_curated";
  const reviewState = value(formData, "review_state") || "accepted";
  const confidenceRaw = value(formData, "confidence");

  if (
    ![
      "company",
      "facility",
      "facility_capability",
      "company_certification",
    ].includes(entityType)
  ) {
    redirect(trustPath("error", "Tipo entità di verifica non valido."));
  }
  if (!entityId || !fieldPath || !rawValue || !sourceReference) {
    redirect(
      trustPath(
        "error",
        "Entity ID, field path, valore e riferimento fonte sono obbligatori.",
      ),
    );
  }
  if (!["platform_curated", "public_web", "document", "manual_review"].includes(sourceType)) {
    redirect(trustPath("error", "Tipo fonte non consentito per lo staff Network Trust."));
  }
  if (!["platform_curated", "platform_verified"].includes(ownershipType)) {
    redirect(trustPath("error", "Ownership type non consentito."));
  }
  if (!["pending", "accepted"].includes(reviewState)) {
    redirect(trustPath("error", "Review state non consentito."));
  }

  const confidence = confidenceRaw ? Number(confidenceRaw) : null;
  if (
    confidence !== null &&
    (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
  ) {
    redirect(trustPath("error", "Confidence deve essere compresa tra 0 e 1."));
  }

  const assertedValue = parseJson(rawValue, "Asserted value");
  const supabase = await createClient();
  const { error } = await supabase.rpc("m4_create_data_assertion", {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_field_path: fieldPath,
    p_asserted_value: assertedValue,
    p_source_type: sourceType,
    p_source_reference: sourceReference,
    p_ownership_type: ownershipType,
    p_confidence: confidence,
    p_review_state: reviewState,
  });

  if (error) redirect(trustPath("error", error.message));
  await finish("Evidenza Network aggiunta al ledger append-only.");
}

export async function recordNetworkVerification(formData: FormData) {
  const status = value(formData, "status");
  const permission =
    status === "revoked" || status === "expired"
      ? "network_trust.revoke"
      : "network_trust.verify";
  await requirePlatformPermission(permission);

  const scope = value(formData, "scope");
  const targetId = value(formData, "target_id");
  const assertionId = value(formData, "evidence_assertion_id");
  const note = value(formData, "note") || null;
  const expiresAt = value(formData, "expires_at") || null;

  if (
    !["company", "facility", "facility_capability", "company_certification"].includes(
      scope,
    )
  ) {
    redirect(trustPath("error", "Scope di verifica non valido."));
  }
  if (!["pending", "verified", "rejected", "expired", "revoked"].includes(status)) {
    redirect(trustPath("error", "Stato di verifica non valido."));
  }
  if (!targetId || !assertionId) {
    redirect(trustPath("error", "Target ed evidenza sono obbligatori."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("m4_record_verification", {
    p_scope: scope,
    p_target_id: targetId,
    p_status: status,
    p_evidence_assertion_id: assertionId,
    p_expires_at: expiresAt,
    p_note: note,
  });

  if (error) redirect(trustPath("error", error.message));
  await finish(
    status === "verified"
      ? "Verifica Network registrata."
      : status === "revoked"
        ? "Verifica Network revocata mantenendo lo storico."
        : `Stato Network impostato a ${status}.`,
  );
}

export async function openNetworkChangeReview(formData: FormData) {
  await requirePlatformPermission("network_trust.review_changes");

  const companyId = value(formData, "network_company_id");
  const assertionId = value(formData, "assertion_id");
  const fieldPath = value(formData, "field_path");
  const previousRaw = value(formData, "previous_value_json");
  const proposedRaw = value(formData, "proposed_value_json");

  if (!companyId || !assertionId || !fieldPath || !previousRaw || !proposedRaw) {
    redirect(trustPath("error", "Completa tutti i campi del change review."));
  }

  const previousValue = parseJson(previousRaw, "Previous value");
  const proposedValue = parseJson(proposedRaw, "Proposed value");

  const supabase = await createClient();
  const { error } = await supabase.rpc("m4_open_change_review", {
    p_network_company_id: companyId,
    p_assertion_id: assertionId,
    p_field_path: fieldPath,
    p_previous_value: previousValue,
    p_proposed_value: proposedValue,
  });

  if (error) redirect(trustPath("error", error.message));
  await finish("Change review aperta. Nessun dato sorgente è stato sovrascritto.");
}

export async function decideNetworkChangeReview(formData: FormData) {
  await requirePlatformPermission("network_trust.review_changes");

  const reviewId = value(formData, "review_id");
  const decision = value(formData, "decision");
  const note = value(formData, "note") || null;

  if (!reviewId || !["accepted", "rejected", "superseded"].includes(decision)) {
    redirect(trustPath("error", "Decisione change review non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("m4_decide_change_review", {
    p_review_id: reviewId,
    p_decision: decision,
    p_note: note,
  });

  if (error) redirect(trustPath("error", error.message));
  await finish(
    "Decisione provenance registrata. Nessun overwrite automatico è stato eseguito.",
  );
}

export async function refreshNetworkIdentityCandidates() {
  await requirePlatformPermission("network_trust.identity_refresh");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("m5_refresh_identity_candidates");

  if (error) redirect(trustPath("error", error.message));

  const payload = (data ?? {}) as {
    upserted_candidates?: number;
    active_candidates?: number;
  };
  await finish(
    `Identity scan aggiornato: ${Number(
      payload.active_candidates ?? 0,
    )} candidati attivi. Nessun merge automatico.`,
  );
}

export async function reviewNetworkIdentityCandidate(formData: FormData) {
  await requirePlatformPermission("network_trust.identity_review");

  const candidateId = value(formData, "candidate_id");
  const decision = value(formData, "decision");
  const note = value(formData, "note") || null;

  if (!candidateId || !["confirmed_match", "dismissed"].includes(decision)) {
    redirect(trustPath("error", "Decisione identity candidate non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("m5_review_identity_candidate", {
    p_candidate_id: candidateId,
    p_decision: decision,
    p_note: note,
  });

  if (error) redirect(trustPath("error", error.message));

  await finish(
    decision === "confirmed_match"
      ? "Match confermato come evidenza. Nessun merge automatico è stato eseguito."
      : "Identity candidate archiviato come non corrispondente.",
  );
}

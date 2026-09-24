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

export type ReparseRemediationClosureItem = {
  remediation_queue_id: number;
  thread_id: string;
  subject: string | null;
  remediation_status: "pending" | "resolved" | "dismissed";
  run_id: number | null;
  run_status: "queued" | "processing" | "completed" | "failed" | null;
  candidate_count: number;
  pending_candidate_count: number;
  accepted_count: number;
  rejected_count: number;
  decision_count: number;
  residual_gaps: {
    quantity: number;
    price: number;
    currency: number;
  };
  unresolved_conflict_count: number;
  unresolved_conflicts: Array<Record<string, unknown>>;
  closure_status: string;
  recommended_outcome: "resolved" | "dismissed" | null;
  resolution_reason: string | null;
  requires_explicit_close: boolean;
  automatic_closure: boolean;
};

export type ReparseRemediationClosurePayload = {
  summary: {
    remediation_count: number;
    ready_resolve: number;
    ready_dismiss: number;
    waiting_on_run: number;
    run_failed: number;
    candidate_decisions_pending: number;
    conflict_review_required: number;
    residual_evidence_gap: number;
    already_closed: number;
  };
  items: ReparseRemediationClosureItem[];
  policy: {
    explicit_close_required: boolean;
    automatic_closure: boolean;
    all_candidates_terminal_required: boolean;
    resolved_requires_recovered_required_evidence: boolean;
    dismissal_requires_explicit_note: boolean;
    non_null_conflicts_block_resolution: boolean;
    failed_run_does_not_close_remediation: boolean;
    observation_mutation: boolean;
    promotion_mutation: boolean;
  };
};

async function activeOrganization() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { client, organizationId: null as string | null, userId: null as string | null };

  const { data: memberships } = await client
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  return {
    client,
    organizationId: membership?.organization_id ?? null,
    userId: user.id,
  };
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


export async function loadOfferReparseRemediationClosureReadiness(): Promise<{
  data: ReparseRemediationClosurePayload | null;
  error?: string;
}> {
  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_offer_reparse_remediation_closure_readiness", {
    p_organization_id: organizationId,
    p_limit: 200,
  });

  if (error || !data || typeof data !== "object") {
    return {
      data: null,
      error: error?.message ?? "Closure readiness non disponibile.",
    };
  }

  return { data: data as unknown as ReparseRemediationClosurePayload };
}

export async function closeOfferReparseRemediation(input: {
  remediationQueueId: number;
  note?: string;
}): Promise<{ ok: boolean; status?: string; reason?: string; error?: string }> {
  if (!Number.isInteger(input.remediationQueueId) || input.remediationQueueId <= 0) {
    return { ok: false, error: "Remediation non valida." };
  }

  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { ok: false, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_close_offer_reparse_remediation", {
    p_organization_id: organizationId,
    p_remediation_queue_id: input.remediationQueueId,
    p_note: input.note?.trim() || null,
  });

  if (error || !data || typeof data !== "object") {
    return { ok: false, error: error?.message ?? "Chiusura remediation non riuscita." };
  }

  const result = data as Record<string, unknown>;
  const status = typeof result.status === "string" ? result.status : undefined;
  const reason = typeof result.reason === "string" ? result.reason : undefined;
  const ok = status === "resolved" || status === "dismissed" || status === "already_closed";

  if (ok) {
    revalidatePath("/review/offer-reparse");
    revalidatePath("/review/offer-remediation");
    revalidatePath("/review/coverage");
    revalidatePath("/review");
  }

  return {
    ok,
    status,
    reason,
    error: ok ? undefined : reason ?? "Remediation non chiudibile.",
  };
}


export type SourceReingestItem = {
  remediation_queue_id: number;
  thread_id: string;
  subject: string | null;
  source_conversation_id: string | null;
  invalidated_run_id: number | null;
  reingest_id: number | null;
  reingest_status: "requested" | "uploading" | "consumed" | "failed" | null;
  source_job_id: string | null;
  successor_run_id: number | null;
  filename: string | null;
  error: string | null;
  expected_source_filenames: string[];
  offered_source_filenames: string[];
  preferred_source_filename: string | null;
  selected_source_filename?: string | null;
  source_selection_mode?: "unique_offered_source" | "manual_offered_source" | null;
  source_selection_status:
    | "unique_offered_source"
    | "ambiguous_offered_source"
    | "manually_selected_offered_source"
    | "missing_offered_source";
  action_status:
    | "not_required"
    | "needs_reingest"
    | "awaiting_upload"
    | "uploading"
    | "recovered"
    | "retry_allowed";
};

export type SourceReingestPayload = {
  summary: {
    target_threads: number;
    needs_reingest: number;
    requested: number;
    uploading: number;
    recovered: number;
    failed: number;
    batch_auto_match_ready: number;
    batch_ambiguous: number;
  };
  items: SourceReingestItem[];
  policy: {
    allowed_extensions: string[];
    source_only: boolean;
    thread_binding_required: boolean;
    checksum_required: boolean;
    observation_mutation: boolean;
    automatic_promotion: boolean;
    successor_run_candidate_only: boolean;
    bulk_archive_extension: string;
    batch_auto_match_requires_unique_offered_source: boolean;
    ambiguous_source_requires_manual_selection: boolean;
  };
};

export type SourceReingestActionState = {
  status: "idle" | "success" | "error";
  message: string;
  successorRunId?: number;
};

export type RecoveryMatchingTarget = {
  observation_id: number;
  source_text: string | null;
  identity_equal_count: number;
  identity_conflict_count: number;
  identity_equal_fields: string[];
  identity_conflicting_fields: string[];
  recoverable_gap_fields: string[];
  recoverable_gap_count: number;
  compatible: boolean;
  identity_anchored: boolean;
};

export type RecoveryMatchingReadinessItem = {
  candidate_id: number;
  run_id: number;
  reingest_id: number;
  thread_id: string;
  candidate_index: number;
  source_text: string | null;
  candidate_evidence: Record<string, unknown>;
  review_status: string;
  source_binding_status: string;
  matching_status: string;
  offered_target_count: number;
  anchored_compatible_target_count: number;
  nonconflicting_target_count: number;
  gap_fill_target_count: number;
  target_observations: RecoveryMatchingTarget[];
};

export type RecoveryMatchingReadinessPayload = {
  summary: {
    candidate_count: number;
    single_anchored_compatible_target: number;
    multiple_anchored_compatible_targets: number;
    single_unanchored_nonconflicting_target: number;
    multiple_unanchored_nonconflicting_targets: number;
    no_compatible_target: number;
    no_offered_target: number;
  };
  items: RecoveryMatchingReadinessItem[];
  policy: {
    recovery_successor_only: boolean;
    offered_candidates_only: boolean;
    offered_observations_only: boolean;
    identity_conflict_blocks_compatibility: boolean;
    identity_anchor_requires_equal_identity_field: boolean;
    single_compatible_target_is_not_automatic_match: boolean;
    explicit_target_selection_required: boolean;
    explicit_field_selection_required: boolean;
    automatic_candidate_match: boolean;
    automatic_candidate_adoption: boolean;
    automatic_remediation_closure: boolean;
    control_phase: string;
  };
};

export async function loadOfferRecoveryMatchingReadiness(): Promise<{
  data: RecoveryMatchingReadinessPayload | null;
  error?: string;
}> {
  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc(
    "p1_offer_recovery_matching_readiness",
    {
      p_organization_id: organizationId,
      p_limit: 200,
    },
  );

  if (error || !data || typeof data !== "object") {
    return {
      data: null,
      error: error?.message ?? "Matching readiness recovery non disponibile.",
    };
  }

  return { data: data as unknown as RecoveryMatchingReadinessPayload };
}

export type RecoveryCandidateReentryItem = {
  remediation_queue_id: number;
  thread_id: string;
  subject: string | null;
  remediation_status: string;
  invalidated_predecessor_run_id: number | null;
  reingest_id: number | null;
  reingest_status: string | null;
  requested_from_run_id: number | null;
  selected_source_filename: string | null;
  source_selection_mode: string | null;
  offered_source_filenames: string[];
  successor_run_id: number | null;
  successor_status: string | null;
  successor_source_job_id: string | null;
  successor_binding_status: string | null;
  successor_invalidation_id: number | null;
  successor_invalidation_reason: string | null;
  candidate_count: number;
  offered_candidate_count: number;
  pending_review_count: number;
  decision_count: number;
  reentry_status: string;
};

export type RecoveryOutcomeReconciliationItem = {
  remediation_queue_id: number;
  thread_id: string;
  subject: string | null;
  remediation_status: string;
  reingest_id: number | null;
  reingest_status: string | null;
  selected_source_filename: string | null;
  source_selection_mode: string | null;
  successor_run_id: number | null;
  successor_status: string | null;
  successor_binding_status: string | null;
  successor_invalidation_id: number | null;
  candidate_count: number;
  offered_candidate_count: number;
  original_gap_counts: { price: number; currency: number; quantity: number };
  recovered_signal_counts: { price: number; currency: number; quantity: number };
  required_evidence_types: { price: boolean; currency: boolean; quantity: boolean };
  recovered_evidence_types: { price: boolean; currency: boolean; quantity: boolean };
  required_evidence_type_count: number;
  recovered_evidence_type_count: number;
  reconciliation_status: string;
};

export type RecoveryOutcomeReconciliationPayload = {
  summary: {
    target_threads: number;
    recovery_not_started: number;
    recovery_in_progress: number;
    recovery_failed: number;
    completed_no_candidates: number;
    completed_no_offered_candidates: number;
    no_required_evidence_recovered: number;
    partial_required_evidence_recovered: number;
    all_required_evidence_types_present: number;
    total_successor_candidates: number;
    total_offered_successor_candidates: number;
  };
  items: RecoveryOutcomeReconciliationItem[];
  policy: {
    evidence_type_presence_is_not_gap_resolution: boolean;
    candidate_observation_matching_required_before_resolution: boolean;
    offered_candidates_only_for_recovery_signals: boolean;
    invalidated_successor_evidence_allowed: boolean;
    automatic_candidate_adoption: boolean;
    automatic_remediation_closure: boolean;
    observation_mutation: boolean;
    promotion_mutation: boolean;
    control_phase: string;
  };
};

export async function loadOfferRecoveryOutcomeReconciliation(): Promise<{
  data: RecoveryOutcomeReconciliationPayload | null;
  error?: string;
}> {
  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc(
    "p1_offer_recovery_outcome_reconciliation",
    {
      p_organization_id: organizationId,
      p_limit: 200,
    },
  );

  if (error || !data || typeof data !== "object") {
    return {
      data: null,
      error: error?.message ?? "Riconciliazione recovery non disponibile.",
    };
  }

  return { data: data as unknown as RecoveryOutcomeReconciliationPayload };
}

export type RecoveryCandidateReentryPayload = {
  summary: {
    target_threads: number;
    reingest_not_started: number;
    ambiguous_selection_required: number;
    reingest_in_progress: number;
    recovery_failed: number;
    successor_in_progress: number;
    completed_no_candidates: number;
    candidate_review_ready: number;
    candidate_review_terminal: number;
    candidate_review_incomplete: number;
    total_successor_candidates: number;
    total_pending_review_candidates: number;
  };
  items: RecoveryCandidateReentryItem[];
  policy: {
    reentry_requires_consumed_reingest: boolean;
    reentry_requires_completed_successor: boolean;
    reentry_requires_valid_thread_binding: boolean;
    reentry_requires_successor_chain_match: boolean;
    reentry_requires_source_job_match: boolean;
    invalidated_successor_review_allowed: boolean;
    invalidated_predecessor_candidates_remain_quarantined: boolean;
    automatic_candidate_adoption: boolean;
    automatic_remediation_closure: boolean;
    observation_mutation: boolean;
    promotion_mutation: boolean;
    control_phase: string;
  };
};

export async function loadOfferRecoveryCandidateReentryAudit(): Promise<{
  data: RecoveryCandidateReentryPayload | null;
  error?: string;
}> {
  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc(
    "p1_offer_recovery_candidate_reentry_audit",
    {
      p_organization_id: organizationId,
      p_limit: 200,
    },
  );

  if (error || !data || typeof data !== "object") {
    return {
      data: null,
      error: error?.message ?? "Audit del candidate re-entry non disponibile.",
    };
  }

  return { data: data as unknown as RecoveryCandidateReentryPayload };
}

export async function loadOfferSourceReingestReadiness(): Promise<{
  data: SourceReingestPayload | null;
  error?: string;
}> {
  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc("p1_offer_source_reingest_readiness", {
    p_organization_id: organizationId,
    p_limit: 200,
  });

  if (error || !data || typeof data !== "object") {
    return {
      data: null,
      error: error?.message ?? "Recovery delle sorgenti non disponibile.",
    };
  }
  return { data: data as unknown as SourceReingestPayload };
}

export async function reingestOfferSource(
  _previousState: SourceReingestActionState,
  formData: FormData,
): Promise<SourceReingestActionState> {
  const threadId = String(formData.get("thread_id") ?? "").trim();
  const selectedSourceFilename = String(formData.get("selected_source_filename") ?? "").trim();
  const file = formData.get("file");

  if (!threadId) {
    return { status: "error", message: "Thread non valido." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Seleziona il file EML originale." };
  }
  if (!file.name.toLowerCase().endsWith(".eml")) {
    return { status: "error", message: "PA2.30.3 accetta solo il file EML originale." };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { status: "error", message: "Il file supera il limite di 25 MB." };
  }

  const { client, organizationId, userId } = await activeOrganization();
  if (!organizationId || !userId) {
    return { status: "error", message: "Workspace o sessione non disponibile." };
  }

  const requestRpc = selectedSourceFilename
    ? "p1_request_offer_source_reingest_selection"
    : "p1_request_offer_source_reingest";
  const requestArgs = selectedSourceFilename
    ? {
        p_organization_id: organizationId,
        p_thread_id: threadId,
        p_source_filename: selectedSourceFilename,
        p_note: "PA2.30.4 explicit ambiguous source selection",
      }
    : {
        p_organization_id: organizationId,
        p_thread_id: threadId,
        p_note: "PA2.30.3 source provenance recovery",
      };

  if (
    selectedSourceFilename &&
    file.name.toLowerCase() !== selectedSourceFilename.split("/").pop()?.toLowerCase()
  ) {
    return {
      status: "error",
      message: "Il file EML caricato non corrisponde alla sorgente offered selezionata.",
    };
  }

  const { data: requestData, error: requestError } = await client.rpc(
    requestRpc,
    requestArgs,
  );

  if (requestError || !requestData || typeof requestData !== "object") {
    return {
      status: "error",
      message: requestError?.message ?? "Impossibile aprire il source re-ingest.",
    };
  }

  const request = requestData as Record<string, unknown>;
  const requestStatus = typeof request.status === "string" ? request.status : "";
  const reingestId =
    typeof request.reingest_id === "number" ? request.reingest_id : null;

  if (!reingestId || !["requested", "already_requested"].includes(requestStatus)) {
    return {
      status: "error",
      message:
        typeof request.reason === "string"
          ? request.reason
          : "Il thread non è eleggibile per il source re-ingest.",
    };
  }

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  const workerToken = process.env.WORKER_INTERNAL_TOKEN;
  if (!workerUrl || !workerToken) {
    return { status: "error", message: "Worker di recovery non configurato." };
  }

  const upload = new FormData();
  upload.append("upload", file, file.name);
  upload.append("owner_id", userId);

  try {
    const response = await fetch(
      `${workerUrl}/v1/remediation/offer-source-reingest/${reingestId}`,
      {
        method: "POST",
        headers: { "x-worker-token": workerToken },
        body: upload,
        cache: "no-store",
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | {
          detail?: string;
          status?: string;
          successor_run_id?: number;
          reparse?: { status?: string; extraction_count?: number };
        }
      | null;

    if (!response.ok || payload?.status !== "consumed" || !payload.successor_run_id) {
      return {
        status: "error",
        message: payload?.detail ?? "Il worker non ha completato il source recovery.",
      };
    }

    revalidatePath("/review/offer-reparse");
    revalidatePath("/review/offer-remediation");
    revalidatePath("/review");

    const extracted = payload.reparse?.extraction_count;
    return {
      status: "success",
      successorRunId: payload.successor_run_id,
      message:
        typeof extracted === "number"
          ? `Sorgente recuperata. Nuovo run #${payload.successor_run_id}: ${extracted} candidate estratte.`
          : `Sorgente recuperata. Nuovo run #${payload.successor_run_id} creato.`,
    };
  } catch {
    return {
      status: "error",
      message: "Connessione al worker di source recovery non riuscita.",
    };
  }
}


export type BulkSourceReingestActionState = {
  status: "idle" | "success" | "error";
  message: string;
  recovered?: number;
  missing?: number;
  failed?: number;
  ambiguousSkipped?: number;
};

export async function bulkReingestOfferSources(
  _previousState: BulkSourceReingestActionState,
  formData: FormData,
): Promise<BulkSourceReingestActionState> {
  const archive = formData.get("archive");
  if (!(archive instanceof File) || archive.size === 0) {
    return { status: "error", message: "Seleziona l’archivio ZIP originale." };
  }
  if (!archive.name.toLowerCase().endsWith(".zip")) {
    return { status: "error", message: "Il recovery bulk richiede un archivio ZIP." };
  }
  if (archive.size > 50 * 1024 * 1024) {
    return { status: "error", message: "L’archivio supera il limite di 50 MB." };
  }

  const { client, organizationId, userId } = await activeOrganization();
  if (!organizationId || !userId) {
    return { status: "error", message: "Workspace o sessione non disponibile." };
  }

  const { data: readinessData, error: readinessError } = await client.rpc(
    "p1_offer_source_reingest_readiness",
    { p_organization_id: organizationId, p_limit: 200 },
  );
  if (readinessError || !readinessData || typeof readinessData !== "object") {
    return {
      status: "error",
      message: readinessError?.message ?? "Readiness del recovery bulk non disponibile.",
    };
  }

  const readiness = readinessData as unknown as SourceReingestPayload;
  const candidates = readiness.items.filter(
    (item) =>
      item.invalidated_run_id !== null &&
      item.source_selection_status === "unique_offered_source" &&
      typeof item.preferred_source_filename === "string" &&
      ["needs_reingest", "retry_allowed", "awaiting_upload"].includes(item.action_status),
  );

  if (!candidates.length) {
    return {
      status: "error",
      message: "Non ci sono thread con una sorgente offered univoca recuperabile automaticamente.",
      ambiguousSkipped: readiness.summary.batch_ambiguous,
    };
  }

  const manifest: Array<{ reingest_id: number; expected_source_filename: string }> = [];
  for (const item of candidates) {
    const { data: requestData, error: requestError } = await client.rpc(
      "p1_request_offer_source_reingest",
      {
        p_organization_id: organizationId,
        p_thread_id: item.thread_id,
        p_note: "PA2.30.3b bulk archive provenance recovery",
      },
    );
    if (requestError || !requestData || typeof requestData !== "object") continue;
    const request = requestData as Record<string, unknown>;
    const requestStatus = typeof request.status === "string" ? request.status : "";
    const reingestId =
      typeof request.reingest_id === "number" ? request.reingest_id : null;
    if (
      reingestId &&
      ["requested", "already_requested"].includes(requestStatus) &&
      item.preferred_source_filename
    ) {
      manifest.push({
        reingest_id: reingestId,
        expected_source_filename: item.preferred_source_filename,
      });
    }
  }

  if (!manifest.length) {
    return {
      status: "error",
      message: "Nessun source re-ingest è stato aperto per il batch.",
      ambiguousSkipped: readiness.summary.batch_ambiguous,
    };
  }

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  const workerToken = process.env.WORKER_INTERNAL_TOKEN;
  if (!workerUrl || !workerToken) {
    return { status: "error", message: "Worker di recovery non configurato." };
  }

  const upload = new FormData();
  upload.append("upload", archive, archive.name);
  upload.append("owner_id", userId);
  upload.append("manifest", JSON.stringify(manifest));

  try {
    const response = await fetch(
      `${workerUrl}/v1/remediation/offer-source-reingest-batch`,
      {
        method: "POST",
        headers: { "x-worker-token": workerToken },
        body: upload,
        cache: "no-store",
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | {
          detail?: string;
          status?: string;
          recovered?: number;
          missing?: number;
          failed?: number;
        }
      | null;

    if (!response.ok || payload?.status !== "completed") {
      return {
        status: "error",
        message: payload?.detail ?? "Recovery bulk non completato dal worker.",
        ambiguousSkipped: readiness.summary.batch_ambiguous,
      };
    }

    revalidatePath("/review/offer-reparse");
    revalidatePath("/review/offer-remediation");
    revalidatePath("/review");

    return {
      status: "success",
      recovered: payload.recovered ?? 0,
      missing: payload.missing ?? 0,
      failed: payload.failed ?? 0,
      ambiguousSkipped: readiness.summary.batch_ambiguous,
      message:
        `Recovery bulk completato: ${payload.recovered ?? 0} recuperati, ` +
        `${payload.missing ?? 0} mancanti nell’archivio, ${payload.failed ?? 0} falliti. ` +
        `${readiness.summary.batch_ambiguous} thread ambigui lasciati alla review manuale.`,
    };
  } catch {
    return {
      status: "error",
      message: "Connessione al worker di recovery bulk non riuscita.",
      ambiguousSkipped: readiness.summary.batch_ambiguous,
    };
  }
}


export type RecoveryCandidateDecisionTarget = {
  observation_id: number;
  source_text: string | null;
  identity_equal_count: number;
  identity_conflict_count: number;
  identity_anchored: boolean;
  compatible: boolean;
  fields_available_to_adopt: string[];
};

export type RecoveryCandidateDecisionReadinessItem = {
  candidate_id: number;
  run_id: number;
  remediation_queue_id: number;
  reingest_id: number;
  thread_id: string;
  candidate_index: number;
  source_text: string | null;
  item_role: string | null;
  candidate_evidence: Record<string, unknown>;
  review_status: string;
  decision_readiness:
    | "decision_terminal"
    | "preserved_out_of_scope_role"
    | "offered_no_target"
    | "offered_explicit_decision_ready"
    | "offered_manual_target_selection"
    | "offered_manual_confirmation_required"
    | "offered_no_compatible_target";
  source_binding_status: string;
  offered_target_count: number;
  anchored_target_count: number;
  nonconflicting_target_count: number;
  decision: {
    id: number;
    decision: string;
    target_observation_id: number | null;
    selected_fields: string[];
    decided_at: string;
  } | null;
  target_observations: RecoveryCandidateDecisionTarget[];
};

export type RecoveryCandidateDecisionReadinessPayload = {
  summary: {
    candidate_count: number;
    offered_candidate_count: number;
    out_of_scope_role_count: number;
    decision_terminal: number;
    offered_explicit_decision_ready: number;
    offered_manual_confirmation_required: number;
    offered_manual_target_selection: number;
    offered_no_target: number;
    offered_no_compatible_target: number;
  };
  items: RecoveryCandidateDecisionReadinessItem[];
  policy: {
    recovery_successor_only: boolean;
    offer_decision_scope_role: string;
    out_of_scope_roles_are_preserved: boolean;
    out_of_scope_roles_are_not_rejected: boolean;
    explicit_target_selection_required: boolean;
    explicit_field_selection_required: boolean;
    automatic_candidate_adoption: boolean;
    automatic_candidate_rejection: boolean;
    automatic_remediation_closure: boolean;
    control_phase: string;
  };
};

export async function loadOfferRecoveryCandidateDecisionReadiness(): Promise<{
  data: RecoveryCandidateDecisionReadinessPayload | null;
  error?: string;
}> {
  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc(
    "p1_offer_recovery_candidate_decision_readiness",
    {
      p_organization_id: organizationId,
      p_limit: 200,
    },
  );

  if (error || !data || typeof data !== "object") {
    return {
      data: null,
      error: error?.message ?? "Decision readiness recovery non disponibile.",
    };
  }

  return { data: data as unknown as RecoveryCandidateDecisionReadinessPayload };
}


export type RecoveryRemediationDispositionItem = {
  remediation_queue_id: number;
  thread_id?: string;
  subject?: string | null;
  remediation_status?: string;
  run_id?: number | null;
  run_status?: string | null;
  offered_candidate_count?: number;
  out_of_scope_candidate_count?: number;
  pending_candidate_count?: number;
  accepted_count?: number;
  rejected_count?: number;
  decision_count?: number;
  decision_scope_role?: string;
  out_of_scope_candidates_preserved?: boolean;
  disposition_status: string;
  closure_status: string;
  recommended_outcome?: string | null;
  resolution_reason?: string | null;
  requires_explicit_close?: boolean;
  automatic_closure?: boolean;
};

export type RecoveryRemediationDispositionPayload = {
  summary: {
    remediation_count: number;
    recovery_not_ready: number;
    recovery_in_progress: number;
    ready_dismiss_no_offered_evidence: number;
    offer_decision_required: number;
    offer_decisions_incomplete: number;
    ready_resolve: number;
    ready_dismiss_no_recovery: number;
    residual_evidence_gap: number;
    conflict_review_required: number;
    already_closed: number;
    total_offered_candidates: number;
    total_preserved_out_of_scope_candidates: number;
  };
  items: RecoveryRemediationDispositionItem[];
  policy: {
    recovery_successor_required: boolean;
    decision_scope_role: string;
    out_of_scope_candidates_preserved: boolean;
    out_of_scope_candidates_do_not_block_offer_disposition: boolean;
    no_offered_candidate_recovery_requires_explicit_dismissal: boolean;
    dismissal_note_required: boolean;
    automatic_candidate_rejection: boolean;
    automatic_remediation_closure: boolean;
    control_phase: string;
  };
};

export async function loadOfferRecoveryRemediationDispositionReadiness(): Promise<{
  data: RecoveryRemediationDispositionPayload | null;
  error?: string;
}> {
  const { client, organizationId } = await activeOrganization();
  if (!organizationId) return { data: null, error: "Workspace non disponibile." };

  const { data, error } = await client.rpc(
    "p1_offer_recovery_remediation_disposition_readiness",
    {
      p_organization_id: organizationId,
      p_limit: 200,
    },
  );

  if (error || !data || typeof data !== "object") {
    return {
      data: null,
      error: error?.message ?? "Disposition readiness recovery non disponibile.",
    };
  }

  return { data: data as unknown as RecoveryRemediationDispositionPayload };
}

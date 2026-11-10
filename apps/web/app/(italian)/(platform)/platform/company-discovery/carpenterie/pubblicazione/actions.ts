"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/user-facing-error";

const ROUTE = "/platform/company-discovery/carpenterie/pubblicazione";

function nextPath(kind: "message" | "error", message: string) {
  return `${ROUTE}?${kind}=${encodeURIComponent(message)}`;
}

type QueueRow = {
  candidate_id: string;
  run_id: string;
};

async function selectedQueue() {
  await requirePlatformPermission("discovery.governance_review");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("net_it_pub1_review_queue");
  if (error || !data || (data as { contract?: string }).contract !== "net-it-pub1-review-v1") {
    redirect(nextPath("error", "La revisione mirata non è ancora disponibile."));
  }
  const rows = (data as { items?: QueueRow[] }).items ?? [];
  const minimalPublisherEnabled = (data as { minimal_publisher_enabled?: boolean }).minimal_publisher_enabled === true;
  if (!Array.isArray(rows) || rows.length !== 5) {
    redirect(nextPath("error", "Il lotto non contiene cinque aziende riconciliate."));
  }
  return { supabase, rows, minimalPublisherEnabled };
}

export async function reviewNetItPub1Source(formData: FormData) {
  const { supabase, rows } = await selectedQueue();
  const runId = String(formData.get("run_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const termsStatus = String(formData.get("terms_status") ?? "").trim();
  const databaseRightsStatus = String(formData.get("database_rights_status") ?? "").trim();
  const personalDataPolicy = String(formData.get("personal_data_policy") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!rows.some((row) => row.run_id === runId)) {
    redirect(nextPath("error", "La fonte non appartiene al lotto selezionato."));
  }
  if (
    !["approved", "restricted", "blocked"].includes(decision) ||
    !["allows_reuse", "allows_limited_reuse", "restricts_reuse", "unknown"].includes(termsStatus) ||
    !["low_risk", "licensed", "restricted", "unknown"].includes(databaseRightsStatus) ||
    !["company_data_only", "exclude_personal_data", "legal_review_required"].includes(personalDataPolicy) ||
    note.length < 20 || note.length > 4000
  ) {
    redirect(nextPath("error", "Compila tutte le decisioni e una nota di verifica reale (minimo 20 caratteri)."));
  }

  const { error } = await supabase.rpc("pa1_5_review_discovery_run_governance", {
    p_run_id: runId,
    p_decision: decision,
    p_terms_status: termsStatus,
    p_database_rights_status: databaseRightsStatus,
    p_personal_data_policy: personalDataPolicy,
    p_note: note,
  });
  if (error) {
    redirect(nextPath("error", safeErrorMessage(error, "Revisione fonte non registrata: verifica termini, riuso e dati personali.")));
  }
  revalidatePath(ROUTE);
  revalidatePath("/platform/company-discovery/governance");
  redirect(nextPath("message", "Decisione sulla fonte registrata."));
}

export async function reviewNetItPub1Candidate(formData: FormData) {
  const { supabase, rows, minimalPublisherEnabled } = await selectedQueue();
  if (formData.get("confirmed") !== "on") {
    redirect(nextPath("error", "Conferma la pubblicazione dopo aver verificato la scheda."));
  }
  if (!minimalPublisherEnabled) {
    redirect(nextPath("error", "Il pubblicatore minimale è ancora disattivato. Nessuna azienda è stata pubblicata."));
  }
  const candidateId = String(formData.get("candidate_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const personalDataDetected = formData.get("personal_data_detected") === "on";
  const personalDataFields = Array.from(new Set(
    String(formData.get("personal_data_fields") ?? "")
      .split(",").map((item) => item.trim()).filter(Boolean),
  ));
  const note = String(formData.get("note") ?? "").trim();

  if (!rows.some((row) => row.candidate_id === candidateId)) {
    redirect(nextPath("error", "L'azienda non appartiene al lotto selezionato."));
  }
  if (!["approved_company_data", "needs_legal_review", "blocked"].includes(decision) ||
      personalDataFields.length > 32 || note.length < 20 || note.length > 4000 ||
      (decision === "approved_company_data" && (personalDataDetected || personalDataFields.length > 0))) {
    redirect(nextPath("error", "Verifica la decisione, gli eventuali dati personali e la nota (minimo 20 caratteri)."));
  }

  const { error } = await supabase.rpc("pa1_5_review_discovery_candidate_governance", {
    p_candidate_id: candidateId,
    p_decision: decision,
    p_personal_data_detected: personalDataDetected,
    p_personal_data_fields: personalDataFields,
    p_note: note,
  });
  if (error) {
    redirect(nextPath("error", safeErrorMessage(error, "Non è possibile approvare questa scheda prima della fonte o con dati personali da escludere.")));
  }
  revalidatePath(ROUTE);
  revalidatePath("/platform/company-discovery/governance");
  redirect(nextPath("message", "Decisione sulla scheda registrata."));
}

/**
 * One explicit Platform decision: the database atomically publishes five
 * APPROVED candidates by using the EXISTING minimal publisher. The original
 * feature switch is temporarily enabled only inside the same transaction
 * and is restored to OFF before commit. No partial publication can occur.
 */
export async function publishNetItPub1All(formData: FormData) {
  await requirePlatformPermission("discovery.publish");
  const { supabase, rows } = await selectedQueue();
  const fingerprint = String(formData.get("manifest_fingerprint") ?? "").trim();
  const note = String(formData.get("review_note") ?? "").trim();
  const attested = formData.get("attested") === "on";
  if (!attested || !/^[a-f0-9]{64}$/.test(fingerprint) || note.length < 80 || note.length > 2000) {
    redirect(nextPath("error", "Conferma la revisione e inserisci una nota di 80–2000 caratteri."));
  }

  const eligible = rows.every((row) => {
    const item = row as QueueRow & {
      source_status?: string;
      candidate_status?: string;
      review_status?: string;
      publisher_eligibility_reason?: string;
      canonical_collision?: boolean;
      personal_data_detected?: boolean;
      already_published?: boolean;
    };
    return item.source_status === "approved" &&
      item.candidate_status === "approved_company_data" &&
      item.review_status === "pending_review" &&
      item.publisher_eligibility_reason === "eligible_minimal_preview" &&
      !item.canonical_collision && !item.personal_data_detected && !item.already_published;
  });
  if (!eligible) {
    redirect(nextPath("error", "Le cinque schede non risultano tutte approvate e prive di duplicati."));
  }

  const { data, error } = await supabase.rpc("net_it_pub1_release", {
    p_expected_fingerprint: fingerprint,
    p_attested: true,
    p_review_note: note,
    p_commit: true,
  });
  if (error) {
    redirect(nextPath("error", safeErrorMessage(
      error,
      "Nessun profilo pubblicato. Controlla le approvazioni, il riepilogo e riprova dopo una nuova anteprima.",
    )));
  }
  const result = data as { status?: string; published_count?: number } | null;
  if (result?.status !== "published" || result.published_count !== 5) {
    redirect(nextPath("error", "Il database non ha confermato la pubblicazione atomica delle cinque schede."));
  }

  revalidatePath(ROUTE);
  revalidatePath("/platform/company-discovery/carpenterie");
  revalidatePath("/platform/company-discovery");
  revalidatePath("/network");
  redirect(nextPath("message", "Cinque profili minimi pubblicati. Controlla le nuove schede nel Network."));
}

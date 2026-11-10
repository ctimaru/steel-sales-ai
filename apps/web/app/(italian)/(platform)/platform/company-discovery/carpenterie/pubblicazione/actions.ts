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
  if (!Array.isArray(rows) || rows.length !== 5) {
    redirect(nextPath("error", "Il lotto non contiene cinque aziende riconciliate."));
  }
  return { supabase, rows };
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
  const { supabase, rows } = await selectedQueue();
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

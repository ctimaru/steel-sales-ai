"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

function pathFor(rfqId: string) {
  return "/marketplace/rfq-hub/" + rfqId;
}

function message(error: string | undefined) {
  if (!error) return "Operazione RFQH13 non riuscita.";
  if (error.includes("Organization admin")) return "Serve un amministratore dell'azienda.";
  if (error.includes("owner or organization admin")) return "Solo l'owner RFQ o un admin azienda può gestire il team.";
  if (error.includes("Requester cannot")) return "Chi richiede un'approvazione non può approvare la propria richiesta.";
  if (error.includes("expired")) return "La richiesta di approvazione è scaduta.";
  if (error.includes("stale yet")) return "Il dispatch non è ancora considerato bloccato.";
  if (error.includes("provider evidence")) return "Il dispatch ha già evidenza provider e non può essere forzato in failed.";
  return error;
}

export async function setRfqh13TeamMember(input: {
  rfqId: string;
  userId: string;
  role: "collaborator" | "approver";
  status?: "active" | "revoked";
}) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, error: "Accedi per gestire il team procurement." };

  const { error } = await supabase.rpc("rfqh13_set_team_member", {
    p_rfq_id: input.rfqId,
    p_user_id: input.userId,
    p_role: input.role,
    p_status: input.status ?? "active",
  });
  if (error) return { ok: false, error: message(error.message) };

  revalidatePath(pathFor(input.rfqId));
  return { ok: true };
}

export async function updateRfqh13Governance(input: {
  rfqId: string;
  organizationId: string;
  requireAwardApproval: boolean;
  requirePoApproval: boolean;
  approvalExpiryHours: number;
  operationalEventRetentionDays: number;
  webhookPayloadRetentionDays: number;
  commercialRecordRetentionDays: number | null;
}) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, error: "Accedi per modificare la governance procurement." };

  const { error } = await supabase.rpc("rfqh13_set_governance", {
    p_organization_id: input.organizationId,
    p_require_award_approval: input.requireAwardApproval,
    p_require_po_approval: input.requirePoApproval,
    p_approval_expiry_hours: input.approvalExpiryHours,
    p_operational_event_retention_days: input.operationalEventRetentionDays,
    p_webhook_payload_retention_days: input.webhookPayloadRetentionDays,
    p_commercial_record_retention_days: input.commercialRecordRetentionDays,
  });
  if (error) return { ok: false, error: message(error.message) };

  revalidatePath(pathFor(input.rfqId));
  return { ok: true };
}

export async function decideRfqh13Approval(input: {
  rfqId: string;
  approvalId: string;
  decision: "approved" | "rejected";
  note?: string | null;
}) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, error: "Accedi per decidere l'approvazione." };

  const { error } = await supabase.rpc("rfqh13_decide_approval", {
    p_approval_id: input.approvalId,
    p_decision: input.decision,
    p_note: input.note?.trim() || null,
  });
  if (error) return { ok: false, error: message(error.message) };

  revalidatePath(pathFor(input.rfqId));
  return { ok: true };
}

export async function recoverRfqh13StaleDispatch(input: {
  rfqId: string;
  dispatchId: string;
  reason?: string | null;
}) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, error: "Accedi per eseguire il recovery." };

  const { error } = await supabase.rpc("rfqh13_mark_stale_dispatch_failed", {
    p_dispatch_id: input.dispatchId,
    p_reason: input.reason?.trim() || "Recovery manuale RFQH13",
  });
  if (error) return { ok: false, error: message(error.message) };

  revalidatePath(pathFor(input.rfqId));
  return { ok: true };
}

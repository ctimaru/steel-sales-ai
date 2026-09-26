"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

export type HumanEvidenceState = {
  status: "idle" | "success" | "error";
  message: string;
};

const allowedTasks = new Set([
  "search","product_lookup","company_lookup","price_lookup","evidence_check","correction","other",
]);
const allowedComparison = new Set(["faster","same","slower"]);
const allowedConfidence = new Set(["low","medium","high"]);

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function recordHumanTimeEvidence(
  _previousState: HumanEvidenceState,
  formData: FormData,
): Promise<HumanEvidenceState> {
  await requireWorkspaceAdmin();
  const taskType = text(formData, "task_type");
  const comparison = text(formData, "comparison");
  const confidence = text(formData, "confidence") || "medium";
  const steelMinutes = Number(text(formData, "steel_minutes").replace(",", "."));
  const previousMinutes = Number(text(formData, "previous_minutes").replace(",", "."));

  if (!allowedTasks.has(taskType)) return { status: "error", message: "Seleziona un'attività valida." };
  if (!allowedComparison.has(comparison)) return { status: "error", message: "Seleziona il confronto percepito." };
  if (!allowedConfidence.has(confidence)) return { status: "error", message: "Seleziona il livello di confidenza." };
  if (!Number.isFinite(steelMinutes) || steelMinutes <= 0 || steelMinutes > 120) {
    return { status: "error", message: "Inserisci un tempo Steel Sales AI tra 0 e 120 minuti." };
  }
  if (!Number.isFinite(previousMinutes) || previousMinutes <= 0 || previousMinutes > 240) {
    return { status: "error", message: "Inserisci una stima del metodo precedente tra 0 e 240 minuti." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Sessione non valida. Accedi di nuovo." };

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership?.organization_id) {
    return { status: "error", message: "Workspace attivo non disponibile." };
  }

  const { error } = await supabase.rpc("p1_record_pilot_human_evidence", {
    p_organization_id: membership.organization_id,
    p_task_type: taskType,
    p_steel_sales_seconds: Math.max(1, Math.round(steelMinutes * 60)),
    p_previous_method_seconds: Math.max(1, Math.round(previousMinutes * 60)),
    p_comparison: comparison,
    p_confidence: confidence,
  });

  if (error) return { status: "error", message: "Evidenza non salvata. Riprova tra poco." };

  revalidatePath("/pilot-analytics");
  return { status: "success", message: "Caso registrato. Verrà incluso nel prossimo checkpoint del pilot." };
}

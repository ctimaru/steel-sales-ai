"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

function pilotPath(key?: "message" | "error", message?: string) {
  const base = "/platform/pilot";
  if (!key || !message) return base;
  return `${base}?${key}=${encodeURIComponent(message)}`;
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function finish(message: string) {
  revalidatePath("/platform");
  revalidatePath("/platform/pilot");
  redirect(pilotPath("message", message));
}

export async function startMarketplacePilot(formData: FormData) {
  await requirePlatformSuperadmin();

  const label = value(formData, "label") || "P5.6 Commercial Pilot";
  const plannedEnd = value(formData, "planned_ends_at") || null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_6a_start_pilot", {
    p_label: label,
    p_planned_ends_at: plannedEnd,
  });

  if (error) redirect(pilotPath("error", error.message));
  await finish("Pilot P5.6 avviato. Il cohort resta vuoto finché non selezioni aziende reali.");
}

export async function addMarketplacePilotParticipant(formData: FormData) {
  await requirePlatformSuperadmin();

  const organizationId = value(formData, "organization_id");
  const participantRole = value(formData, "participant_role");

  if (!organizationId || !["buyer", "supplier", "both"].includes(participantRole)) {
    redirect(pilotPath("error", "Organization o ruolo pilot non valido."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_6a_upsert_participant", {
    p_organization_id: organizationId,
    p_participant_role: participantRole,
  });

  if (error) redirect(pilotPath("error", error.message));
  await finish("Azienda aggiunta al cohort come candidata. La readiness resta separata dall’attivazione.");
}

export async function transitionMarketplacePilotParticipant(formData: FormData) {
  await requirePlatformSuperadmin();

  const participantId = value(formData, "participant_id");
  const action = value(formData, "action");

  if (
    !participantId ||
    !["activate", "resume", "pause", "complete", "remove"].includes(action)
  ) {
    redirect(pilotPath("error", "Azione pilot non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p5_6a_transition_participant", {
    p_participant_id: participantId,
    p_action: action,
  });

  if (error) redirect(pilotPath("error", error.message));

  const labels: Record<string, string> = {
    activate: "Partecipante attivato nel pilot.",
    resume: "Partecipante riattivato dopo nuovo controllo readiness.",
    pause: "Partecipante sospeso dal pilot.",
    complete: "Partecipazione pilot completata.",
    remove: "Partecipante rimosso dal cohort.",
  };

  await finish(labels[action] ?? "Stato pilot aggiornato.");
}

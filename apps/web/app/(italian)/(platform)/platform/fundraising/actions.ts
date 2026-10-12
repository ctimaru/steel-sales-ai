"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/user-facing-error";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullable(value: string) {
  return value ? value : null;
}

function fundraisingPath(key?: "message" | "error", message?: string) {
  const base = appRoutes.platform.fundraising;
  if (!key || !message) return base;
  return `${base}?${key}=${encodeURIComponent(message)}`;
}

function parseOptionalDateTime(raw: string) {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function upsertInvestorOutreachTarget(formData: FormData) {
  await requirePlatformSuperadmin();

  const targetId = value(formData, "target_id");
  const investorName = value(formData, "investor_name");
  if (!investorName) {
    redirect(fundraisingPath("error", "Inserisci il nome dell'investitore."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mkt8_investor_outreach_target_upsert", {
    p_target_id: targetId || null,
    p_investor_name: investorName,
    p_firm_name: nullable(value(formData, "firm_name")),
    p_investor_email: nullable(value(formData, "investor_email").toLowerCase()),
    p_investor_type: value(formData, "investor_type") || "vc",
    p_geography: nullable(value(formData, "geography")),
    p_thesis_fit: nullable(value(formData, "thesis_fit")),
    p_source: nullable(value(formData, "source")),
    p_stage: value(formData, "stage") || "target",
    p_priority: value(formData, "priority") || "medium",
    p_invite_id: nullable(value(formData, "invite_id")),
    p_next_follow_up_at: parseOptionalDateTime(value(formData, "next_follow_up_at")),
    p_notes: nullable(value(formData, "notes")),
  });

  if (error) {
    redirect(
      fundraisingPath(
        "error",
        safeErrorMessage(error, "Non è stato possibile salvare il target investor."),
      ),
    );
  }

  revalidatePath(appRoutes.platform.fundraising);
  redirect(
    fundraisingPath(
      "message",
      targetId ? "Target investor aggiornato." : "Target investor creato.",
    ),
  );
}

export async function logInvestorOutreachEvent(formData: FormData) {
  await requirePlatformSuperadmin();

  const targetId = value(formData, "target_id");
  const eventType = value(formData, "event_type");
  const summary = value(formData, "summary");

  if (!targetId || !eventType || !summary) {
    redirect(
      fundraisingPath(
        "error",
        "Target, tipo evento e nota sono obbligatori.",
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mkt8_investor_outreach_log_event", {
    p_target_id: targetId,
    p_event_type: eventType,
    p_summary: summary,
    p_occurred_at: parseOptionalDateTime(value(formData, "occurred_at")),
    p_metadata: {},
  });

  if (error) {
    redirect(
      fundraisingPath(
        "error",
        safeErrorMessage(error, "Non è stato possibile registrare l'evento."),
      ),
    );
  }

  revalidatePath(appRoutes.platform.fundraising);
  redirect(fundraisingPath("message", "Evento investor registrato."));
}

export async function archiveInvestorOutreachTarget(formData: FormData) {
  await requirePlatformSuperadmin();

  const targetId = value(formData, "target_id");
  if (!targetId) {
    redirect(fundraisingPath("error", "Target investor non valido."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mkt8_investor_outreach_archive", {
    p_target_id: targetId,
  });

  if (error) {
    redirect(
      fundraisingPath(
        "error",
        safeErrorMessage(error, "Non è stato possibile archiviare il target."),
      ),
    );
  }

  revalidatePath(appRoutes.platform.fundraising);
  redirect(fundraisingPath("message", "Target investor archiviato."));
}

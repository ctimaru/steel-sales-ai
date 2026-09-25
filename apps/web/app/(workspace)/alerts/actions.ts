"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type OperationalAlertActionResult = {
  ok: boolean;
  status?: "acknowledged" | "resolved";
  error?: string;
};

function validAlertId(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

async function authenticatedContext() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!configured) {
    return { client: null, organizationId: null, error: "Connessione ai dati non configurata." };
  }

  const client = await createClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return { client: null, organizationId: null, error: "Sessione scaduta o non valida." };
  }

  const { data: memberships, error: membershipError } = await client
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) {
    return { client: null, organizationId: null, error: "Workspace non disponibile." };
  }

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership?.organization_id) {
    return { client: null, organizationId: null, error: "Nessuna organizzazione attiva." };
  }

  return { client, organizationId: membership.organization_id as string, error: null };
}

function revalidateAlertSurfaces() {
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
}

export async function acknowledgeOperationalAlert(
  alertId: number,
): Promise<OperationalAlertActionResult> {
  if (!validAlertId(alertId)) return { ok: false, error: "Alert non valido." };

  try {
    const context = await authenticatedContext();
    if (!context.client || !context.organizationId) {
      return { ok: false, error: context.error ?? "Sessione non valida." };
    }

    const { data, error } = await context.client.rpc("p1_acknowledge_operational_alert", {
      p_alert_id: alertId,
      p_note: null,
    });

    if (error) return { ok: false, error: "Presa in carico non salvata." };
    if (
      !data ||
      typeof data !== "object" ||
      Number((data as { alert_id?: unknown }).alert_id) !== alertId ||
      (data as { status?: unknown }).status !== "acknowledged"
    ) {
      return { ok: false, error: "Lo stato dell'alert non è stato aggiornato." };
    }

    revalidateAlertSurfaces();
    return { ok: true, status: "acknowledged" };
  } catch {
    return { ok: false, error: "Non è stato possibile prendere in carico l'alert." };
  }
}

export async function resolveOperationalAlert(
  alertId: number,
  note: string,
): Promise<OperationalAlertActionResult> {
  if (!validAlertId(alertId)) return { ok: false, error: "Alert non valido." };
  const cleanNote = note.trim();
  if (!cleanNote) return { ok: false, error: "Inserisci una nota di risoluzione." };

  try {
    const context = await authenticatedContext();
    if (!context.client || !context.organizationId) {
      return { ok: false, error: context.error ?? "Sessione non valida." };
    }

    const { data, error } = await context.client.rpc("p1_resolve_operational_alert", {
      p_alert_id: alertId,
      p_note: cleanNote,
    });

    if (error) return { ok: false, error: "Risoluzione non salvata." };
    if (
      !data ||
      typeof data !== "object" ||
      Number((data as { alert_id?: unknown }).alert_id) !== alertId ||
      (data as { status?: unknown }).status !== "resolved"
    ) {
      return { ok: false, error: "Lo stato dell'alert non è stato aggiornato." };
    }

    revalidateAlertSurfaces();
    return { ok: true, status: "resolved" };
  } catch {
    return { ok: false, error: "Non è stato possibile risolvere l'alert." };
  }
}

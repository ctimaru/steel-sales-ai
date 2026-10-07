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

function selectedScopes(formData: FormData) {
  const scopes = ["business_plan", "marketing", "kpi"].filter(
    (scope) => formData.get(scope) === "on",
  );
  return scopes;
}

function investorAccessPath(
  key?: "message" | "error",
  message?: string,
) {
  const base = appRoutes.platform.investorAccess;
  if (!key || !message) return base;
  return `${base}?${key}=${encodeURIComponent(message)}`;
}

export async function createInvestorAccessInvite(formData: FormData) {
  await requirePlatformSuperadmin();

  const label = value(formData, "label");
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  const expiresOn = value(formData, "expires_on");
  const scopes = selectedScopes(formData);

  if (!label) {
    redirect(investorAccessPath("error", "Inserisci un nome per l'invito."));
  }
  if (password.length < 12) {
    redirect(
      investorAccessPath(
        "error",
        "La password investor deve avere almeno 12 caratteri.",
      ),
    );
  }
  if (!expiresOn) {
    redirect(investorAccessPath("error", "Seleziona una data di scadenza."));
  }
  if (scopes.length === 0) {
    redirect(
      investorAccessPath(
        "error",
        "Seleziona almeno una sezione: Business Plan, Marketing o KPI.",
      ),
    );
  }

  const expiresAt = new Date(`${expiresOn}T23:59:59.999Z`);
  if (Number.isNaN(expiresAt.getTime())) {
    redirect(investorAccessPath("error", "Data di scadenza non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("l272d2_create_investor_access_invite", {
    p_label: label,
    p_investor_email: email || null,
    p_password: password,
    p_expires_at: expiresAt.toISOString(),
    p_scopes: scopes,
  });

  if (error) {
    redirect(
      investorAccessPath(
        "error",
        safeErrorMessage(error, "Non è stato possibile creare l'accesso investor."),
      ),
    );
  }

  revalidatePath(appRoutes.platform.investorAccess);
  redirect(
    investorAccessPath(
      "message",
      "Invito creato. Condividi link e password tramite canali separati.",
    ),
  );
}

export async function updateInvestorAccessScopes(formData: FormData) {
  await requirePlatformSuperadmin();

  const inviteId = value(formData, "invite_id");
  const scopes = selectedScopes(formData);

  if (!inviteId) {
    redirect(investorAccessPath("error", "Invito investor non valido."));
  }
  if (scopes.length === 0) {
    redirect(
      investorAccessPath(
        "error",
        "Seleziona almeno una sezione per l'accesso investor.",
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("l272d2_update_investor_access_scopes", {
    p_invite_id: inviteId,
    p_scopes: scopes,
  });

  if (error) {
    redirect(
      investorAccessPath(
        "error",
        safeErrorMessage(error, "Non è stato possibile aggiornare i permessi investor."),
      ),
    );
  }

  revalidatePath(appRoutes.platform.investorAccess);
  redirect(
    investorAccessPath(
      "message",
      "Permessi aggiornati. Le sessioni precedenti sono state invalidate.",
    ),
  );
}

export async function revokeInvestorAccessInvite(formData: FormData) {
  await requirePlatformSuperadmin();

  const inviteId = value(formData, "invite_id");
  const reason = value(formData, "reason") || "Accesso revocato dal Platform Owner.";

  if (!inviteId) {
    redirect(investorAccessPath("error", "Invito investor non valido."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "l272a_revoke_investor_business_plan_invite",
    {
      p_invite_id: inviteId,
      p_reason: reason,
    },
  );

  if (error) {
    redirect(
      investorAccessPath(
        "error",
        safeErrorMessage(error, "Non è stato possibile revocare l'accesso investor."),
      ),
    );
  }

  revalidatePath(appRoutes.platform.investorAccess);
  redirect(investorAccessPath("message", "Accesso investor revocato."));
}

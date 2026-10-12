"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/user-facing-error";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function businessPlanPath(
  key?: "message" | "error",
  message?: string,
) {
  const base = "/platform/business-plan";
  if (!key || !message) return base;
  return `${base}?${key}=${encodeURIComponent(message)}#investor-access`;
}

export async function createInvestorBusinessPlanInvite(formData: FormData) {
  await requirePlatformSuperadmin();

  const label = value(formData, "label");
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  const expiresOn = value(formData, "expires_on");

  if (!label) {
    redirect(businessPlanPath("error", "Inserisci un nome per l'invito."));
  }
  if (password.length < 12) {
    redirect(
      businessPlanPath(
        "error",
        "La password investor deve avere almeno 12 caratteri.",
      ),
    );
  }
  if (!expiresOn) {
    redirect(businessPlanPath("error", "Seleziona una data di scadenza."));
  }

  const expiresAt = new Date(`${expiresOn}T23:59:59.999Z`);
  if (Number.isNaN(expiresAt.getTime())) {
    redirect(businessPlanPath("error", "Data di scadenza non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "l272a_create_investor_business_plan_invite",
    {
      p_label: label,
      p_investor_email: email || null,
      p_password: password,
      p_expires_at: expiresAt.toISOString(),
    },
  );

  if (error) {
    redirect(
      businessPlanPath(
        "error",
        safeErrorMessage(
          error,
          "Non è stato possibile creare l'accesso investor.",
        ),
      ),
    );
  }

  revalidatePath("/platform/business-plan");
  redirect(
    businessPlanPath(
      "message",
      "Invito creato. Condividi il link e la password tramite canali separati.",
    ),
  );
}

export async function revokeInvestorBusinessPlanInvite(formData: FormData) {
  await requirePlatformSuperadmin();

  const inviteId = value(formData, "invite_id");
  const reason = value(formData, "reason") || "Accesso revocato dal Platform Owner.";

  if (!inviteId) {
    redirect(businessPlanPath("error", "Invito investor non valido."));
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
      businessPlanPath(
        "error",
        safeErrorMessage(
          error,
          "Non è stato possibile revocare l'accesso investor.",
        ),
      ),
    );
  }

  revalidatePath("/platform/business-plan");
  redirect(businessPlanPath("message", "Accesso investor revocato."));
}

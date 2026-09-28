"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  PLATFORM_STAFF_ROLE_TEMPLATES,
  type PlatformStaffRoleKey,
} from "@/lib/platform-access-contract";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

const ROLE_KEYS = new Set<PlatformStaffRoleKey>(
  PLATFORM_STAFF_ROLE_TEMPLATES.map((role) => role.key),
);

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function peoplePath(
  key: "message" | "warning" | "error",
  message: string,
) {
  return `/platform/people?${key}=${encodeURIComponent(message)}`;
}

function roleKeys(formData: FormData) {
  const roles = formData
    .getAll("roles")
    .map((item) => String(item).trim() as PlatformStaffRoleKey)
    .filter((item): item is PlatformStaffRoleKey => ROLE_KEYS.has(item));

  return [...new Set(roles)];
}

async function sendPlatformStaffInviteEmail(email: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke(
    "sa3-platform-staff-invite",
    {
      body: { email },
    },
  );

  if (error) {
    return {
      delivery: "failed" as const,
      detail: error.message,
    };
  }

  const payload = (data ?? {}) as {
    delivery?: "sent" | "existing_user";
    detail?: string;
  };

  return {
    delivery: payload.delivery ?? ("failed" as const),
    detail: payload.detail ?? null,
  };
}

export async function createPlatformStaffInvitation(formData: FormData) {
  await requirePlatformSuperadmin();

  const email = value(formData, "email").toLowerCase();
  const roles = roleKeys(formData);
  const reason = value(formData, "reason") || null;

  if (!email || !email.includes("@")) {
    redirect(peoplePath("error", "Inserisci un indirizzo email valido."));
  }

  if (!roles.length) {
    redirect(peoplePath("error", "Seleziona almeno un ruolo Platform Staff."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa2_create_platform_staff_invitation", {
    p_email: email,
    p_role_keys: roles,
    p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    p_reason: reason,
  });

  if (error) {
    redirect(peoplePath("error", error.message));
  }

  const delivery = await sendPlatformStaffInviteEmail(email);

  revalidatePath("/platform/people");

  if (delivery.delivery === "sent") {
    redirect(
      peoplePath(
        "message",
        `Invito creato per ${email}. L'email di attivazione è stata inviata.`,
      ),
    );
  }

  if (delivery.delivery === "existing_user") {
    redirect(
      peoplePath(
        "warning",
        `Invito creato per ${email}. L'account esiste già: al prossimo accesso l'invito Platform verrà acquisito automaticamente.`,
      ),
    );
  }

  redirect(
    peoplePath(
      "warning",
      `Invito creato per ${email}, ma l'email di attivazione non è stata inviata. Puoi ritentare dalla coda inviti.`,
    ),
  );
}

export async function resendPlatformStaffInvitation(formData: FormData) {
  await requirePlatformSuperadmin();

  const email = value(formData, "email").toLowerCase();
  if (!email) {
    redirect(peoplePath("error", "Email invito mancante."));
  }

  const delivery = await sendPlatformStaffInviteEmail(email);

  if (delivery.delivery === "sent") {
    redirect(
      peoplePath("message", `Email di attivazione reinviata a ${email}.`),
    );
  }

  if (delivery.delivery === "existing_user") {
    redirect(
      peoplePath(
        "warning",
        `${email} ha già un account. È sufficiente che effettui l'accesso per acquisire l'invito Platform pendente.`,
      ),
    );
  }

  redirect(
    peoplePath(
      "error",
      "Non è stato possibile inviare l'email di attivazione. L'invito database resta pendente.",
    ),
  );
}

export async function revokePlatformStaffInvitation(formData: FormData) {
  await requirePlatformSuperadmin();

  const invitationId = value(formData, "invitation_id");
  const reason = value(formData, "reason");

  if (!invitationId || !reason) {
    redirect(
      peoplePath(
        "error",
        "Per revocare un invito servono identificativo e motivazione.",
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "sa2_revoke_platform_staff_invitation",
    {
      p_invitation_id: invitationId,
      p_reason: reason,
    },
  );

  if (error) {
    redirect(peoplePath("error", error.message));
  }

  revalidatePath("/platform/people");
  redirect(peoplePath("message", "Invito Platform Staff revocato."));
}

export async function updatePlatformStaffRoles(formData: FormData) {
  await requirePlatformSuperadmin();

  const userId = value(formData, "user_id");
  const roles = roleKeys(formData);
  const reason = value(formData, "reason");

  if (!userId || !roles.length || !reason) {
    redirect(
      peoplePath(
        "error",
        "Seleziona almeno un ruolo e indica una motivazione per la modifica.",
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa2_set_platform_staff_roles", {
    p_user_id: userId,
    p_role_keys: roles,
    p_reason: reason,
  });

  if (error) {
    redirect(peoplePath("error", error.message));
  }

  revalidatePath("/platform/people");
  redirect(peoplePath("message", "Ruoli Platform Staff aggiornati."));
}

export async function setPlatformStaffStatus(formData: FormData) {
  await requirePlatformSuperadmin();

  const userId = value(formData, "user_id");
  const status = value(formData, "status");
  const reason = value(formData, "reason");

  if (
    !userId ||
    !["active", "suspended", "revoked"].includes(status) ||
    !reason
  ) {
    redirect(
      peoplePath(
        "error",
        "Stato o motivazione non validi per la modifica dello staff.",
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa2_set_platform_staff_status", {
    p_user_id: userId,
    p_status: status,
    p_reason: reason,
  });

  if (error) {
    redirect(peoplePath("error", error.message));
  }

  revalidatePath("/platform/people");

  const label =
    status === "active"
      ? "riattivato"
      : status === "suspended"
        ? "sospeso"
        : "revocato";

  redirect(peoplePath("message", `Accesso Platform Staff ${label}.`));
}

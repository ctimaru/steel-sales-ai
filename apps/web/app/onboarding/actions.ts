"use server";

import { safeErrorMessage } from "@/lib/user-facing-error";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

async function origin() {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const proto =
    incoming.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function onboardingRedirect(
  message: string,
  kind: "message" | "error" = "message",
): never {
  redirect(`/onboarding?${kind}=${encodeURIComponent(message)}#team-access`);
}

function invitationErrorMessage(status: number, detail?: string): string {
  const normalized = (detail ?? "").toLowerCase();

  if (status === 409 || normalized.includes("active organization membership")) {
    return "Questa persona ha già un accesso attivo all’azienda.";
  }
  if (status === 403 || normalized.includes("admin role required")) {
    return "Solo un admin aziendale può gestire gli inviti.";
  }
  if (status === 400) {
    return "Controlla email, ruolo e destinazione dell’invito.";
  }
  if (normalized.includes("rate") || normalized.includes("too many")) {
    return "Troppi invii ravvicinati. Attendi qualche minuto e riprova.";
  }

  return "Invio dell’invito non riuscito. Riprova tra poco.";
}

async function sendInvitation(input: {
  actorUserId: string;
  organizationId: string;
  email: string;
  role: string;
  businessRole: string | null;
}) {
  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  const workerToken = process.env.WORKER_INTERNAL_TOKEN;
  if (!workerUrl || !workerToken) {
    onboardingRedirect("Servizio inviti non configurato.", "error");
  }

  const response = await fetch(`${workerUrl}/v1/admin/organization-invitations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-token": workerToken,
    },
    body: JSON.stringify({
      actor_user_id: input.actorUserId,
      organization_id: input.organizationId,
      email: input.email,
      role: input.role,
      business_role: input.businessRole,
      redirect_to: `${await origin()}/auth/finish?invited=1`,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    onboardingRedirect(
      invitationErrorMessage(response.status, payload?.detail),
      "error",
    );
  }
}

function revalidateTeam() {
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
}

export async function completeOnboarding(formData: FormData) {
  const context = await requireWorkspaceAdmin(
    "/onboarding?error=" +
      encodeURIComponent("Solo un admin aziendale può modificare il setup."),
  );
  const supabase = await createClient();
  const sources = formData.getAll("sources").map(String);
  const accepted = formData.get("consent") === "on";

  const { error } = await supabase.rpc("update_organization_onboarding", {
    p_organization_id: context.organizationId,
    p_name: String(formData.get("name") ?? "").trim(),
    p_country_code: String(formData.get("country_code") ?? "").trim() || null,
    p_industry: String(formData.get("industry") ?? "").trim() || null,
    p_source_preferences: sources,
    p_accept_consent: accepted,
    p_complete: true,
  });
  if (error) onboardingRedirect(safeErrorMessage(error, "Operazione di onboarding non completata. Aggiorna la pagina e riprova."), "error");

  await supabase.rpc("hp7_company_setup_state", {
    p_organization_id: context.organizationId,
  });

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  redirect(
    "/onboarding?message=" +
      encodeURIComponent(
        "Fonti e autorizzazione salvate. Il workspace resta disponibile mentre completi gli altri passaggi.",
      ),
  );
}

export async function inviteMember(formData: FormData) {
  const context = await requireWorkspaceAdmin(
    "/onboarding?error=" +
      encodeURIComponent("Solo un admin può invitare utenti."),
  );
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "member");
  const businessRole =
    String(formData.get("business_role") ?? "").trim() || null;

  await sendInvitation({
    actorUserId: context.userId,
    organizationId: context.organizationId,
    email,
    role,
    businessRole,
  });

  revalidateTeam();
  onboardingRedirect(`Invito inviato a ${email}.`);
}

export async function resendInvitation(formData: FormData) {
  const context = await requireWorkspaceAdmin(
    "/onboarding?error=" +
      encodeURIComponent("Solo un admin può reinviare inviti."),
  );
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "member");
  const businessRole =
    String(formData.get("business_role") ?? "").trim() || null;

  await sendInvitation({
    actorUserId: context.userId,
    organizationId: context.organizationId,
    email,
    role,
    businessRole,
  });

  revalidateTeam();
  onboardingRedirect(`Invito reinviato a ${email}.`);
}

export async function revokeInvitation(formData: FormData) {
  const context = await requireWorkspaceAdmin(
    "/onboarding?error=" +
      encodeURIComponent("Solo un admin può revocare inviti."),
  );
  const invitationId = String(formData.get("invitation_id") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.rpc("hp8_revoke_organization_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) onboardingRedirect(safeErrorMessage(error, "Operazione di onboarding non completata. Aggiorna la pagina e riprova."), "error");

  revalidateTeam();
  onboardingRedirect("Invito revocato.");
}

export async function changeMemberRole(formData: FormData) {
  const context = await requireWorkspaceAdmin(
    "/onboarding?error=" +
      encodeURIComponent("Solo un admin può modificare i ruoli."),
  );
  const supabase = await createClient();
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "member");

  const { error } = await supabase.rpc("set_organization_member_role", {
    p_organization_id: context.organizationId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) onboardingRedirect(safeErrorMessage(error, "Operazione di onboarding non completata. Aggiorna la pagina e riprova."), "error");

  revalidateTeam();
  onboardingRedirect("Permesso aggiornato.");
}

export async function changeMemberBusinessRole(formData: FormData) {
  const context = await requireWorkspaceAdmin(
    "/onboarding?error=" +
      encodeURIComponent("Solo un admin può modificare i ruoli."),
  );
  const supabase = await createClient();
  const userId = String(formData.get("user_id") ?? "");
  const businessRole = String(formData.get("business_role") ?? "").trim();

  const { error } = await supabase.rpc("set_organization_member_business_role", {
    p_organization_id: context.organizationId,
    p_user_id: userId,
    p_business_role: businessRole || null,
  });
  if (error) onboardingRedirect(safeErrorMessage(error, "Operazione di onboarding non completata. Aggiorna la pagina e riprova."), "error");

  revalidateTeam();
  onboardingRedirect("Ruolo commerciale aggiornato.");
}

export async function changeMemberStatus(formData: FormData) {
  const context = await requireWorkspaceAdmin(
    "/onboarding?error=" +
      encodeURIComponent("Solo un admin può modificare gli accessi."),
  );
  const supabase = await createClient();
  const userId = String(formData.get("user_id") ?? "");
  const status = String(formData.get("status") ?? "");

  const { error } = await supabase.rpc("hp8_set_organization_member_status", {
    p_organization_id: context.organizationId,
    p_user_id: userId,
    p_status: status,
  });
  if (error) onboardingRedirect(safeErrorMessage(error, "Operazione di onboarding non completata. Aggiorna la pagina e riprova."), "error");

  revalidateTeam();
  onboardingRedirect(
    status === "suspended" ? "Accesso sospeso." : "Accesso riattivato.",
  );
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}

async function origin() {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const proto = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function onboardingRedirect(message: string, kind: "message" | "error" = "message"): never {
  redirect(`/onboarding?${kind}=${encodeURIComponent(message)}`);
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
  if (error) onboardingRedirect(error.message, "error");

  await supabase.rpc("hp7_company_setup_state", {
    p_organization_id: context.organizationId,
  });

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  redirect(
    "/onboarding?message=" +
      encodeURIComponent("Fonti e autorizzazione salvate. Il workspace resta disponibile mentre completi gli altri passaggi."),
  );
}

export async function inviteMember(formData: FormData) {
  const context = await requireWorkspaceAdmin(
    "/onboarding?error=" + encodeURIComponent("Solo un admin può invitare utenti."),
  );
  const supabase = await createClient();
  const organizationId = context.organizationId;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "member");

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
      actor_user_id: context.userId,
      organization_id: organizationId,
      email,
      role,
      redirect_to: `${await origin()}/auth/finish?invited=1`,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    onboardingRedirect(payload?.detail ?? "Invio dell’invito non riuscito.", "error");
  }

  revalidatePath("/onboarding");
  onboardingRedirect(`Invito inviato a ${email}.`);
}

export async function changeMemberRole(formData: FormData) {
  const context = await requireWorkspaceAdmin(
    "/onboarding?error=" + encodeURIComponent("Solo un admin può modificare i ruoli."),
  );
  const supabase = await createClient();
  const organizationId = context.organizationId;
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "member");

  const { error } = await supabase.rpc("set_organization_member_role", {
    p_organization_id: organizationId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) onboardingRedirect(error.message, "error");
  revalidatePath("/onboarding");
  onboardingRedirect("Ruolo aggiornato.");
}


export async function changeMemberBusinessRole(formData: FormData) {
  const context = await requireWorkspaceAdmin(
    "/onboarding?error=" + encodeURIComponent("Solo un admin può modificare i ruoli."),
  );
  const supabase = await createClient();
  const organizationId = context.organizationId;
  const userId = String(formData.get("user_id") ?? "");
  const businessRole = String(formData.get("business_role") ?? "").trim();

  const { error } = await supabase.rpc("set_organization_member_business_role", {
    p_organization_id: organizationId,
    p_user_id: userId,
    p_business_role: businessRole || null,
  });
  if (error) onboardingRedirect(error.message, "error");
  revalidatePath("/onboarding");
  onboardingRedirect("Ruolo commerciale aggiornato.");
}

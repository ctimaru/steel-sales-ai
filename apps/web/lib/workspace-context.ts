import { redirect } from "next/navigation";
import { cache } from "react";

import { canAdministerCompany, canWriteWorkspace, type OrganizationRole } from "@/lib/access-policy";
import { createClient } from "@/lib/supabase/server";
import {
  sessionRecoveryPath,
  toUserFacingIssue,
} from "@/lib/user-facing-error";

export type WorkspaceContext = {
  userId: string;
  viewerLabel: string;
  organizationId: string;
  organizationName: string;
  role: string;
  isDefault: boolean;
  platformSuperadmin: boolean;
  platformConsoleAccess: boolean;
  platformOwner: boolean;
  onboardingStatus: string;
  guidedSetupComplete: boolean;
  commercialMemoryReady: boolean;
};

export const getWorkspaceContext = cache(async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError) {
    const issue = toUserFacingIssue(authError);
    if (issue.code === "session_expired" || issue.code === "permission_denied") {
      redirect(sessionRecoveryPath());
    }
    throw new Error("workspace_auth_unavailable");
  }
  if (!user) redirect("/login");

  const { data: lifecycleData } = await supabase.rpc("lr5_account_lifecycle_state");
  const lifecycle = (lifecycleData ?? {}) as { access_suspended?: boolean };
  if (lifecycle.access_suspended === true) {
    await supabase.auth.signOut({ scope: "global" });
    redirect("/account-closure?requested=1");
  }

  await supabase.rpc("claim_pending_organization_invitations");

  const [{ data: memberships, error: membershipError }, { data: platformAccessData }] =
    await Promise.all([
      supabase
        .from("organization_memberships")
        .select("organization_id,role,is_default,status")
        .eq("user_id", user.id)
        .eq("status", "active"),
      supabase.rpc("platform_access_context"),
    ]);

  const platformAccess = (platformAccessData ?? {}) as {
    is_platform_owner?: boolean;
    permissions?: string[];
  };
  const platformOwner = platformAccess.is_platform_owner === true;
  const platformConsoleAccess =
    platformAccess.permissions?.includes("platform.console.access") ?? false;

  if (membershipError) throw new Error("workspace_membership_unavailable");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership) redirect("/onboarding");

  const { data: legalData } = await supabase.rpc("lr5_current_legal_acceptance_state");
  const legal = (legalData ?? {}) as { accepted?: boolean };
  if (legal.accepted !== true) {
    redirect("/legal/accept?next=" + encodeURIComponent("/dashboard"));
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("name,onboarding_status,source_preferences,consent_version,consent_accepted_at,guided_setup_completed_at")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (organizationError) throw new Error("workspace_organization_unavailable");
  if (!organization) redirect("/login?error=Workspace%20non%20disponibile");

  const commercialMemoryReady =
    (organization.source_preferences?.length ?? 0) > 0 &&
    Boolean(organization.consent_version) &&
    Boolean(organization.consent_accepted_at);

  return {
    userId: user.id,
    viewerLabel: user.email ?? "Utente autenticato",
    organizationId: membership.organization_id,
    organizationName: organization.name ?? "Workspace azienda",
    role: membership.role,
    isDefault: membership.is_default,
    platformSuperadmin: platformOwner,
    platformConsoleAccess,
    platformOwner,
    onboardingStatus: organization.onboarding_status,
    guidedSetupComplete: Boolean(organization.guided_setup_completed_at),
    commercialMemoryReady,
  };
});

export async function requirePlatformContext() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("is_platform_superadmin");
  if (error || data !== true) redirect("/dashboard");

  return {
    userId: user.id,
    viewerLabel: user.email ?? "Platform Owner",
  };
}


export async function requireWorkspaceRole(
  allowedRoles: OrganizationRole[],
  fallback = "/dashboard",
): Promise<WorkspaceContext> {
  const context = await getWorkspaceContext();
  if (!allowedRoles.includes(context.role as OrganizationRole)) redirect(fallback);
  return context;
}

export async function requireWorkspaceWriteRole(
  fallback = "/dashboard",
): Promise<WorkspaceContext> {
  const context = await getWorkspaceContext();
  if (!canWriteWorkspace(context.role)) redirect(fallback);
  return context;
}

export async function requireWorkspaceAdmin(
  fallback = "/dashboard",
): Promise<WorkspaceContext> {
  const context = await getWorkspaceContext();
  if (!canAdministerCompany(context.role)) redirect(fallback);
  return context;
}


export async function requireCommercialMemoryReady(
  fallback = "/onboarding?error=" +
    encodeURIComponent(
      "Configura prima fonti e autorizzazione al trattamento per usare la Commercial Memory.",
    ),
): Promise<WorkspaceContext> {
  const context = await requireWorkspaceWriteRole(fallback);
  if (!context.commercialMemoryReady) redirect(fallback);
  return context;
}

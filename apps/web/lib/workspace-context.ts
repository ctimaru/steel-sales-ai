import { redirect } from "next/navigation";

import { canAdministerCompany, canWriteWorkspace, type OrganizationRole } from "@/lib/access-policy";
import { createClient } from "@/lib/supabase/server";

export type WorkspaceContext = {
  userId: string;
  viewerLabel: string;
  organizationId: string;
  organizationName: string;
  role: string;
  isDefault: boolean;
  platformSuperadmin: boolean;
};

export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) redirect("/login");

  await supabase.rpc("claim_pending_organization_invitations");

  const [{ data: memberships, error: membershipError }, { data: superadminFlag }] =
    await Promise.all([
      supabase
        .from("organization_memberships")
        .select("organization_id,role,is_default,status")
        .eq("user_id", user.id)
        .eq("status", "active"),
      supabase.rpc("is_platform_superadmin"),
    ]);

  if (membershipError) throw new Error(membershipError.message);

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership) redirect("/onboarding");

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("name,onboarding_status")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (organizationError) throw new Error(organizationError.message);
  if (!organization || organization.onboarding_status !== "completed") redirect("/onboarding");

  return {
    userId: user.id,
    viewerLabel: user.email ?? "Utente autenticato",
    organizationId: membership.organization_id,
    organizationName: organization.name ?? "Workspace azienda",
    role: membership.role,
    isDefault: membership.is_default,
    platformSuperadmin: superadminFlag === true,
  };
}

export async function requirePlatformContext() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("is_platform_superadmin");
  if (error || data !== true) redirect("/dashboard");

  return {
    userId: user.id,
    viewerLabel: user.email ?? "Platform Superadmin",
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

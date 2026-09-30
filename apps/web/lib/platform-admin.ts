import { redirect } from "next/navigation";

import type { PlatformPermissionKey, PlatformStaffRoleKey } from "@/lib/platform-access-contract";
import type { RegistrationApplicationStatus } from "@/lib/registration-state";
import { createClient } from "@/lib/supabase/server";

export type PlatformAccessContext = {
  user_id: string;
  authority_type: "platform_owner" | "platform_staff" | "none";
  is_platform_owner: boolean;
  is_platform_staff: boolean;
  staff_status: "active" | "suspended" | "revoked" | null;
  roles: Array<PlatformStaffRoleKey | "platform_owner">;
  permissions: PlatformPermissionKey[];
};

export async function hasPlatformPermission(permission: PlatformPermissionKey) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_platform_permission", {
    p_permission_key: permission,
  });
  return !error && data === true;
}

export async function getPlatformAccessContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_access_context");
  if (error || !data) return null;
  return data as PlatformAccessContext;
}

export async function requirePlatformPermission(
  permission: PlatformPermissionKey,
  fallback = "/platform",
) {
  const allowed = await hasPlatformPermission(permission);
  if (!allowed) redirect(fallback);
}

export async function requirePlatformConsoleContext() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("platform_access_context");
  if (error || !data) redirect("/dashboard");

  const context = data as PlatformAccessContext;
  if (!context.permissions.includes("platform.console.access")) {
    redirect(context.is_platform_staff ? "/staff/access" : "/dashboard");
  }

  return {
    ...context,
    viewerLabel: user.email ?? "Platform user",
  };
}

export type PlatformStaffDirectoryItem = {
  user_id: string;
  email: string;
  status: "active" | "suspended" | "revoked";
  roles: PlatformStaffRoleKey[];
  activated_at: string;
  suspended_at: string | null;
  revoked_at: string | null;
  updated_at: string;
};

export type PlatformStaffInvitationItem = {
  invitation_id: string;
  email: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  roles: PlatformStaffRoleKey[];
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  expired_at: string | null;
  reason: string | null;
};

export async function getPlatformStaffDirectory() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa2_platform_staff_directory");
  if (error) {
    if (error.code === "42501") redirect("/dashboard");
    throw new Error(error.message);
  }
  return (data ?? []) as PlatformStaffDirectoryItem[];
}

export async function getPlatformStaffInvitations() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa2_platform_staff_invitation_queue");
  if (error) {
    if (error.code === "42501") redirect("/dashboard");
    throw new Error(error.message);
  }
  return (data ?? []) as PlatformStaffInvitationItem[];
}

export type RegistrationQueueItem = {
  id: string;
  applicant_user_id: string;
  applicant_email: string;
  legal_name: string;
  trading_name: string | null;
  country_code: string;
  vat_id: string | null;
  primary_company_type: string;
  application_status: RegistrationApplicationStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  activated_organization_id: string | null;
  matched_network_company_id: string | null;
  created_at: string;
  updated_at: string;
};

export type RegistrationEvent = {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  actor_type: string;
  from_status: string | null;
  to_status: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

export type RegistrationApplicationDetail = {
  id: string;
  applicant_user_id: string;
  applicant_email_snapshot: string;
  legal_name: string;
  trading_name: string | null;
  country_code: string;
  vat_id: string | null;
  registration_id: string | null;
  website_url: string | null;
  primary_company_type: string;
  secondary_company_types: string[];
  contact_name: string;
  contact_phone: string | null;
  short_description: string | null;
  application_status: string;
  submitted_at: string | null;
  email_verified_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason_code: string | null;
  rejection_note: string | null;
  activated_organization_id: string | null;
  matched_network_company_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function isPlatformSuperadmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_platform_superadmin");
  return !error && data === true;
}

export async function requirePlatformSuperadmin(fallback = "/platform") {
  const allowed = await isPlatformSuperadmin();
  if (!allowed) redirect(fallback);
}

export async function getRegistrationQueue(
  status?: RegistrationApplicationStatus | null,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p0a_admin_registration_queue", {
    p_status: status || null,
  });

  if (error) {
    if (error.code === "42501") redirect("/dashboard");
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as {
    count?: number;
    applications?: RegistrationQueueItem[];
  };

  return {
    count: Number(payload.count ?? 0),
    applications: payload.applications ?? [],
  };
}

export async function getRegistrationDetail(applicationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p0a_admin_registration_detail", {
    p_application_id: applicationId,
  });

  if (error) {
    if (error.code === "42501") redirect("/dashboard");
    return null;
  }

  const payload = data as {
    application?: RegistrationApplicationDetail;
    events?: RegistrationEvent[];
  };

  if (!payload?.application) return null;

  return {
    application: payload.application,
    events: payload.events ?? [],
  };
}


export type RegistrationNetworkCandidate = {
  network_company_id: string;
  legal_name: string;
  country_code: string;
  website_domain: string | null;
  publication_status: string;
  verification_status: string;
  signals: string[];
  match_score: number;
};

export async function getRegistrationNetworkCandidates(applicationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("m7_registration_network_candidates", {
    p_application_id: applicationId,
  });

  if (error) {
    if (error.code === "42501") redirect("/dashboard");
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as { candidates?: RegistrationNetworkCandidate[] };
  return payload.candidates ?? [];
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordPilotUsageEvent } from "@/app/(workspace)/telemetry/actions";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAdmin, requireWorkspaceWriteRole } from "@/lib/workspace-context";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function requestNetworkClaim(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  const organizationId = textValue(formData, "organization_id");

  if (!companyId || !organizationId) redirect("/network?error=Claim%20non%20valido");

  const supabase = await createClient();
  const { error } = await supabase.rpc("m4_request_company_claim", {
    p_network_company_id: companyId,
    p_organization_id: organizationId,
    p_note: "Requested from M8 Network profile",
  });

  if (error) {
    redirect("/network/" + companyId + "?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/network/" + companyId);
  revalidatePath("/network/manage");
  redirect("/network/" + companyId + "?message=" + encodeURIComponent("Claim inviato al Platform Superadmin."));
}

export async function updateManagedNetworkProfile(formData: FormData) {
  await requireWorkspaceAdmin();
  const companyId = textValue(formData, "network_company_id");
  if (!companyId) redirect("/network/manage?error=Profilo%20non%20valido");

  const supabase = await createClient();
  const { error } = await supabase.rpc("m8_update_managed_network_company", {
    p_network_company_id: companyId,
    p_trading_name: textValue(formData, "trading_name") || null,
    p_website_url: textValue(formData, "website_url") || null,
    p_description: textValue(formData, "description") || null,
  });

  if (error) {
    redirect("/network/manage?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/network/manage");
  revalidatePath("/network/" + companyId);
  redirect("/network/manage?message=Profilo%20Network%20aggiornato");
}


async function activeOrganizationId() {
  await requireWorkspaceWriteRole();
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) redirect("/login");

  const { data: memberships, error } = await supabase
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw new Error(error.message);
  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership) redirect("/network?error=Nessuna%20organization%20attiva");

  return { supabase, userId, organizationId: membership.organization_id };
}

export async function saveNetworkCompany(formData: FormData) {
  const companyId = textValue(formData, "network_company_id");
  if (!companyId) redirect("/network?error=Azienda%20non%20valida");

  const { supabase, userId, organizationId } = await activeOrganizationId();
  const { error } = await supabase.from("network_saved_companies").upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      network_company_id: companyId,
    },
    { onConflict: "organization_id,user_id,network_company_id", ignoreDuplicates: true },
  );

  if (error) {
    redirect("/network/" + companyId + "?error=" + encodeURIComponent(error.message));
  }

  await recordPilotUsageEvent({
    eventName: "network_saved_created",
    entityType: "network_company",
    entityId: companyId,
    metadata: { surface: "network_company_profile" },
  });
  revalidatePath("/network/" + companyId);
  revalidatePath("/network/saved");
  redirect("/network/" + companyId + "?message=Azienda%20salvata");
}

export async function removeSavedNetworkCompany(formData: FormData) {
  const companyId = textValue(formData, "network_company_id");
  if (!companyId) redirect("/network/saved?error=Azienda%20non%20valida");

  const { supabase, userId, organizationId } = await activeOrganizationId();
  const { error } = await supabase
    .from("network_saved_companies")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("network_company_id", companyId);

  if (error) {
    redirect("/network/saved?error=" + encodeURIComponent(error.message));
  }

  await recordPilotUsageEvent({
    eventName: "network_saved_removed",
    entityType: "network_company",
    entityId: companyId,
    metadata: { surface: "network_saved_companies" },
  });
  revalidatePath("/network/" + companyId);
  revalidatePath("/network/saved");
  redirect("/network/saved?message=Azienda%20rimossa%20dai%20salvati");
}


export async function submitNetworkInquiry(formData: FormData) {
  await requireWorkspaceWriteRole();
  const companyId = textValue(formData, "network_company_id");
  const organizationId = textValue(formData, "organization_id");
  const subject = textValue(formData, "subject");
  const body = textValue(formData, "body");

  if (!companyId || !organizationId) {
    redirect("/network?error=Inquiry%20non%20valida");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p4_submit_inquiry", {
    p_sender_organization_id: organizationId,
    p_recipient_network_company_id: companyId,
    p_subject: subject,
    p_body: body,
  });

  if (error) {
    redirect("/network/" + companyId + "/inquiry?error=" + encodeURIComponent(error.message));
  }

  await recordPilotUsageEvent({
    eventName: "network_inquiry_submitted",
    entityType: "network_company",
    entityId: companyId,
    metadata: { surface: "network_inquiry_compose" },
  });
  revalidatePath("/network/inquiries");
  redirect("/network/inquiries?box=sent&message=Inquiry%20inviata");
}

export async function transitionNetworkInquiry(formData: FormData) {
  await requireWorkspaceWriteRole();
  const inquiryId = textValue(formData, "inquiry_id");
  const organizationId = textValue(formData, "organization_id");
  const newStatus = textValue(formData, "new_status");
  const box = textValue(formData, "box") === "sent" ? "sent" : "received";

  if (!inquiryId || !organizationId || !newStatus) {
    redirect("/network/inquiries?error=Transizione%20non%20valida");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p4_transition_inquiry", {
    p_inquiry_id: inquiryId,
    p_actor_organization_id: organizationId,
    p_new_status: newStatus,
  });

  if (error) {
    redirect("/network/inquiries?box=" + box + "&error=" + encodeURIComponent(error.message));
  }

  await recordPilotUsageEvent({
    eventName: "network_inquiry_state_changed",
    entityType: "network_inquiry",
    entityId: inquiryId,
    metadata: { surface: "network_inquiries" },
  });
  revalidatePath("/network/inquiries");
  redirect("/network/inquiries?box=" + box + "&message=Stato%20inquiry%20aggiornato");
}

export async function reportNetworkInquiry(formData: FormData) {
  await requireWorkspaceWriteRole();
  const inquiryId = textValue(formData, "inquiry_id");
  const organizationId = textValue(formData, "organization_id");
  const reason = textValue(formData, "reason");
  const details = textValue(formData, "details");
  const box = textValue(formData, "box") === "sent" ? "sent" : "received";

  const supabase = await createClient();
  const { error } = await supabase.rpc("p4_report_inquiry", {
    p_inquiry_id: inquiryId,
    p_reporter_organization_id: organizationId,
    p_reason: reason,
    p_details: details || null,
  });

  if (error) {
    redirect("/network/inquiries?box=" + box + "&error=" + encodeURIComponent(error.message));
  }

  redirect("/network/inquiries?box=" + box + "&message=Segnalazione%20inviata");
}

export async function setInquiryPreferences(formData: FormData) {
  await requireWorkspaceAdmin();
  const organizationId = textValue(formData, "organization_id");
  const enabled = textValue(formData, "inquiries_enabled") === "true";

  const supabase = await createClient();
  const { error } = await supabase.rpc("p4_set_inquiry_preferences", {
    p_organization_id: organizationId,
    p_inquiries_enabled: enabled,
  });

  if (error) {
    redirect("/network/manage?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/network/manage");
  redirect("/network/manage?message=Preferenze%20inquiry%20aggiornate");
}

export async function blockInquirySenderOrganization(formData: FormData) {
  await requireWorkspaceWriteRole();
  const blockingOrganizationId = textValue(formData, "blocking_organization_id");
  const blockedOrganizationId = textValue(formData, "blocked_organization_id");

  const supabase = await createClient();
  const { error } = await supabase.rpc("p4_block_organization", {
    p_blocking_organization_id: blockingOrganizationId,
    p_blocked_organization_id: blockedOrganizationId,
  });

  if (error) {
    redirect("/network/inquiries?box=received&error=" + encodeURIComponent(error.message));
  }

  redirect("/network/inquiries?box=received&message=Organizzazione%20bloccata");
}


export async function followNetworkCompany(formData: FormData) {
  const companyId = textValue(formData, "network_company_id");
  if (!companyId) redirect("/network?error=Azienda%20non%20valida");

  const { supabase, organizationId } = await activeOrganizationId();
  const { error } = await supabase.rpc("p4_follow_company", {
    p_organization_id: organizationId,
    p_network_company_id: companyId,
  });

  if (error) {
    redirect("/network/" + companyId + "?error=" + encodeURIComponent(error.message));
  }

  await recordPilotUsageEvent({
    eventName: "network_follow_created",
    entityType: "network_company",
    entityId: companyId,
    metadata: { surface: "network_company_profile" },
  });
  revalidatePath("/network/" + companyId);
  revalidatePath("/network/following");
  revalidatePath("/network/activity");
  redirect("/network/" + companyId + "?message=Azienda%20seguita");
}

export async function unfollowNetworkCompany(formData: FormData) {
  const companyId = textValue(formData, "network_company_id");
  if (!companyId) redirect("/network/following?error=Azienda%20non%20valida");

  const { supabase, organizationId } = await activeOrganizationId();
  const { error } = await supabase.rpc("p4_unfollow_company", {
    p_organization_id: organizationId,
    p_network_company_id: companyId,
  });

  if (error) {
    redirect("/network/following?error=" + encodeURIComponent(error.message));
  }

  await recordPilotUsageEvent({
    eventName: "network_follow_removed",
    entityType: "network_company",
    entityId: companyId,
    metadata: { surface: "network_following" },
  });
  revalidatePath("/network/" + companyId);
  revalidatePath("/network/following");
  revalidatePath("/network/activity");
  redirect("/network/following?message=Follow%20rimosso");
}

export async function markNetworkActivityRead(formData: FormData) {
  const activityEventId = textValue(formData, "activity_event_id");
  const companyId = textValue(formData, "network_company_id");
  if (!activityEventId) redirect("/network/activity?error=Activity%20non%20valida");

  const { supabase, organizationId } = await activeOrganizationId();
  const { error } = await supabase.rpc("p4_mark_activity_read", {
    p_organization_id: organizationId,
    p_activity_event_id: activityEventId,
  });

  if (error) {
    redirect("/network/activity?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/network/activity");
  if (companyId) {
    await recordPilotUsageEvent({
      eventName: "network_activity_item_opened",
      entityType: "network_company",
      entityId: companyId,
      metadata: { surface: "network_activity" },
    });
    redirect("/network/" + companyId);
  }
  redirect("/network/activity");
}

export async function markAllNetworkActivityRead() {
  const { supabase, organizationId } = await activeOrganizationId();
  const { error } = await supabase.rpc("p4_mark_all_activity_read", {
    p_organization_id: organizationId,
  });

  if (error) {
    redirect("/network/activity?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/network/activity");
  redirect("/network/activity?message=Activity%20segnate%20come%20lette");
}

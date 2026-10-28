"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

const PAGE = "/platform/pilot/readiness";

export async function reviewPilotAdmission(formData: FormData) {
  await requirePlatformSuperadmin();
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();
  const basis = String(formData.get("basis_reference") ?? "").trim();
  const notice = String(formData.get("notice_version") ?? "").trim();
  const terms = String(formData.get("terms_version") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(organizationId) ||
      !["review", "verify", "approve", "suspend", "withdraw"].includes(action) ||
      [basis, notice, terms].some((x) => x.length > 120)) {
    redirect(PAGE + "?result=invalid");
  }
  const client = await createClient();
  const { error } = await client.rpc("prod_next1e_review_admission", {
    p_organization_id: organizationId,
    p_action: action,
    p_basis_reference: basis || null,
    p_notice_version: notice || null,
    p_terms_version: terms || null,
  });
  if (error) redirect(PAGE + "?result=blocked");
  revalidatePath(PAGE);
  redirect(PAGE + "?result=saved");
}

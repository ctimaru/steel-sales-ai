"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

/**
 * SELFVER1: an organization admin asks platform staff to verify the company.
 * The RPC re-checks admin membership in SQL; staff decides in the trust queue.
 */
export async function requestCompanyVerification(formData: FormData) {
  const context = await requireWorkspaceAdmin("/dashboard");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  let outcome: "requested" | "error" = "error";
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("selfver1_request_manual_verification", {
      p_organization_id: context.organizationId,
      p_note: note || null,
    });
    const result = (data ?? {}) as { requested?: boolean; already_pending?: boolean; verification_status?: string };
    if (!error && (result.requested || result.already_pending || result.verification_status === "verified")) outcome = "requested";
  } catch {
    outcome = "error";
  }
  revalidatePath("/dashboard");
  redirect("/dashboard?verification=" + outcome + "#home-verification");
}

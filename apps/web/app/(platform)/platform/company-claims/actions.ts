"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformContext } from "@/lib/workspace-context";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function claimsPath(key: "message" | "error", message: string) {
  return `/platform/company-claims?${key}=${encodeURIComponent(message)}`;
}

export async function reviewCompanyClaimProof(formData: FormData) {
  await requirePlatformContext();
  const claimId = value(formData, "claim_id");
  const decision = value(formData, "decision");
  const note = value(formData, "note") || null;

  if (!claimId || !["verified", "rejected"].includes(decision)) {
    redirect(claimsPath("error", "Decisione ownership non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_6_review_claim_proof", {
    p_claim_id: claimId,
    p_decision: decision,
    p_note: note,
  });

  if (error) redirect(claimsPath("error", error.message));

  revalidatePath("/platform/company-claims");
  redirect(
    claimsPath(
      "message",
      decision === "verified"
        ? "Ownership proof verificata. Il claim può ora essere approvato."
        : "Ownership proof rifiutata.",
    ),
  );
}

export async function reviewCompanyClaim(formData: FormData) {
  await requirePlatformContext();
  const claimId = value(formData, "claim_id");
  const decision = value(formData, "decision");
  const note = value(formData, "note") || null;

  if (!claimId || !["under_review", "approved", "rejected", "revoked"].includes(decision)) {
    redirect(claimsPath("error", "Decisione claim non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("m4_review_company_claim", {
    p_claim_id: claimId,
    p_decision: decision,
    p_note: note,
  });

  if (error) redirect(claimsPath("error", error.message));

  revalidatePath("/platform/company-claims");
  revalidatePath("/network");
  revalidatePath("/network/manage");
  redirect(
    claimsPath(
      "message",
      decision === "approved"
        ? "Claim approvato: controllo azienda attivato."
        : decision === "revoked"
          ? "Claim revocato: controllo azienda rimosso."
          : decision === "rejected"
            ? "Claim rifiutato."
            : "Claim preso in revisione.",
    ),
  );
}

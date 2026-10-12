"use server";

import { redirect } from "next/navigation";

import { safeInternalNext } from "@/lib/auth-next";
import { createClient } from "@/lib/supabase/server";

function checked(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}

export async function acceptCurrentLegalTerms(formData: FormData) {
  const privacyAcknowledged = checked(formData.get("privacy_acknowledged"));
  const termsAccepted = checked(formData.get("terms_accepted"));
  const source = String(formData.get("source") ?? "first_login").trim();
  const nextPath = safeInternalNext(formData.get("next"), "/dashboard");

  if (!privacyAcknowledged || !termsAccepted) {
    redirect(
      "/legal/accept?error=" +
        encodeURIComponent("Conferma separatamente informativa privacy e Termini d’uso.") +
        "&next=" +
        encodeURIComponent(nextPath),
    );
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    redirect("/login?next=" + encodeURIComponent("/legal/accept?next=" + encodeURIComponent(nextPath)));
  }

  const { error } = await supabase.rpc("lr5_record_legal_acceptance", {
    p_privacy_acknowledged: true,
    p_terms_accepted: true,
    p_source: source === "team_invite" ? "team_invite" : "first_login",
  });

  if (error) {
    redirect(
      "/legal/accept?error=" +
        encodeURIComponent("Non è stato possibile registrare le accettazioni. Riprova.") +
        "&next=" +
        encodeURIComponent(nextPath),
    );
  }

  redirect(nextPath);
}

"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function blockerMessage(code?: string) {
  if (code === "platform_superadmin_protected") {
    return "L’account Platform Owner non può essere chiuso senza prima trasferire la responsabilità della piattaforma.";
  }
  if (code === "platform_staff_protected") {
    return "Revoca prima l’accesso Platform Staff associato a questo account.";
  }
  if (code === "last_organization_member") {
    return "Invita almeno un altro membro attivo nell’azienda prima di chiudere l’ultimo account.";
  }
  if (code === "last_organization_admin") {
    return "Promuovi prima un altro amministratore attivo dell’azienda.";
  }
  return "La chiusura dell’account richiede una verifica manuale.";
}

export async function requestAccountErasure(formData: FormData) {
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (confirmation !== "CANCELLA ACCOUNT") {
    redirect(
      "/account?error=" +
        encodeURIComponent('Scrivi esattamente "CANCELLA ACCOUNT" per confermare.'),
    );
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const { data, error } = await supabase.rpc("lr5_request_account_erasure", {
    p_confirmation: "DELETE_MY_ACCOUNT",
  });

  if (error) {
    redirect(
      "/account?error=" +
        encodeURIComponent("Non è stato possibile avviare la chiusura dell’account."),
    );
  }

  const result = (data ?? {}) as {
    requested?: boolean;
    blocked?: boolean;
    code?: string;
  };

  if (result.requested !== true) {
    redirect("/account?error=" + encodeURIComponent(blockerMessage(result.code)));
  }

  await supabase.auth.signOut({ scope: "global" });
  redirect("/account-closure?requested=1");
}

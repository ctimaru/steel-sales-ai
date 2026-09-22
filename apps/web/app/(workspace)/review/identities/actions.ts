"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type IdentityConfirmState = {
  status: "idle" | "success" | "error";
  message: string;
};

function validUuid(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function confirmIdentityMapping(
  _previousState: IdentityConfirmState,
  formData: FormData,
): Promise<IdentityConfirmState> {
  const contactId = formData.get("contact_id");
  const companyId = formData.get("company_id");

  if (!validUuid(contactId) || !validUuid(companyId)) {
    return { status: "error", message: "Selezione non valida. Aggiorna la pagina e riprova." };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { status: "error", message: "Sessione scaduta o non valida." };
    }

    const { data, error } = await supabase.rpc("confirm_contact_company_mapping", {
      p_contact_id: contactId,
      p_company_id: companyId,
      p_metadata: {
        source: "identity_confirmation_ui",
        path: "/review/identities",
      },
    });

    if (error) {
      return { status: "error", message: "Conferma non salvata. Verifica che la Company sia già verificata." };
    }

    if (!data || typeof data !== "object" || (data as { status?: unknown }).status !== "confirmed") {
      return { status: "error", message: "La conferma non è stata applicata." };
    }

    revalidatePath("/review/identities");
    revalidatePath("/review");
    revalidatePath("/search");
    revalidatePath("/dashboard");

    const linkedRfqs = Number((data as { linked_rfqs?: unknown }).linked_rfqs ?? 0);
    return {
      status: "success",
      message: linkedRfqs > 0
        ? `Identità confermata e propagata a ${linkedRfqs} RFQ.`
        : "Identità confermata e propagata ai messaggi collegati.",
    };
  } catch {
    return { status: "error", message: "Non è stato possibile completare la conferma." };
  }
}

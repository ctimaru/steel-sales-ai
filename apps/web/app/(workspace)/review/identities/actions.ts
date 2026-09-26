"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type IdentityConfirmState = {
  status: "idle" | "success" | "error";
  message: string;
  companyId?: string;
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
    revalidatePath("/customers");
    revalidatePath(`/customers/${companyId}`);
    revalidatePath("/commercial/companies");
    revalidatePath(`/commercial/companies/${companyId}`);
    revalidatePath("/commercial/demand");
    revalidatePath("/commercial/reengagement");

    const result = data as {
      linked_rfqs?: unknown;
      activated_conversations?: unknown;
      resolved_messages?: unknown;
    };
    const linkedRfqs = Number(result.linked_rfqs ?? 0);
    const activatedConversations = Number(result.activated_conversations ?? 0);
    const resolvedMessages = Number(result.resolved_messages ?? 0);

    return {
      status: "success",
      message: `Identità confermata: ${resolvedMessages} messaggi, ${activatedConversations} conversazioni e ${linkedRfqs} RFQ attivate. Company 360 e intelligence aggiornate.`,
      companyId,
    };
  } catch {
    return { status: "error", message: "Non è stato possibile completare la conferma." };
  }
}

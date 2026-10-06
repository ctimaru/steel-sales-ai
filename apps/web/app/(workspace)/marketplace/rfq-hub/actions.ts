"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type AddSupplierInput = {
  rfqId: string;
  supplierName: string;
  supplierEmail: string;
};

export async function addSupplierToBuyerRfq(
  input: AddSupplierInput,
): Promise<{ ok: boolean; supplierId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, error: "Accedi per modificare il RFQ." };
  }

  const rfqId = input.rfqId.trim();
  const supplierName = input.supplierName.trim();
  const supplierEmail = input.supplierEmail.trim();

  if (!rfqId) return { ok: false, error: "RFQ non valido." };
  if (!supplierEmail) return { ok: false, error: "Inserisci l'email del fornitore." };

  const { data, error } = await supabase.rpc("rfqh1_add_supplier", {
    p_rfq_id: rfqId,
    p_supplier_name: supplierName || null,
    p_supplier_email: supplierEmail,
    p_supplier_network_company_id: null,
    p_supplier_organization_id: null,
  });

  if (error) {
    console.error("RFQH1 add supplier failed:", error.message);
    return {
      ok: false,
      error: error.message.includes("already added")
        ? "Questo fornitore è già presente nel RFQ."
        : error.message.includes("invalid")
          ? "L'indirizzo email del fornitore non è valido."
          : "Non è stato possibile aggiungere il fornitore.",
    };
  }

  const supplierId = typeof data === "string" ? data : null;
  if (!supplierId) return { ok: false, error: "Fornitore aggiunto senza identificativo." };

  revalidatePath("/marketplace/rfq-hub");
  revalidatePath("/marketplace/rfq-hub/" + rfqId);
  return { ok: true, supplierId };
}

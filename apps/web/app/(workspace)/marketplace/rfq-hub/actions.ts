"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type SupplierCandidate = {
  identity_key: string;
  source:
    | "recent"
    | "private_contact"
    | "private_company"
    | "network_contact"
    | "network_company"
    | "platform_organization";
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  country_code: string | null;
  delivery_channel: "email" | "platform" | "both";
  supplier_company_id: string | null;
  supplier_contact_id: string | null;
  supplier_network_company_id: string | null;
  supplier_network_contact_id: string | null;
  supplier_organization_id: string | null;
  last_used_at: string | null;
};

export type SupplierCandidateResult = {
  ok: boolean;
  networkEnabled?: boolean;
  candidates?: SupplierCandidate[];
  error?: string;
};

type AddSupplierInput = {
  rfqId: string;
  identitySource?: SupplierCandidate["source"] | "manual";
  supplierName?: string | null;
  supplierEmail?: string | null;
  supplierCompanyId?: string | null;
  supplierContactId?: string | null;
  supplierNetworkCompanyId?: string | null;
  supplierNetworkContactId?: string | null;
  supplierOrganizationId?: string | null;
};

export async function searchBuyerRfqSuppliers(
  rfqId: string,
  query = "",
): Promise<SupplierCandidateResult> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, error: "Accedi per cercare i fornitori." };
  }

  const cleanRfqId = rfqId.trim();
  if (!cleanRfqId) return { ok: false, error: "RFQ non valido." };

  const { data, error } = await supabase.rpc("rfqh2_supplier_candidates", {
    p_rfq_id: cleanRfqId,
    p_query: query.trim() || null,
    p_limit: 40,
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("RFQH2 supplier candidate search failed:", error?.message);
    return { ok: false, error: "Non è stato possibile cercare i fornitori." };
  }

  const payload = data as {
    network_enabled?: unknown;
    candidates?: unknown;
  };

  const candidates = Array.isArray(payload.candidates)
    ? payload.candidates.filter(
        (candidate): candidate is SupplierCandidate =>
          Boolean(
            candidate &&
              typeof candidate === "object" &&
              !Array.isArray(candidate) &&
              typeof (candidate as SupplierCandidate).identity_key === "string",
          ),
      )
    : [];

  return {
    ok: true,
    networkEnabled: payload.network_enabled === true,
    candidates,
  };
}

export async function addSupplierToBuyerRfq(
  input: AddSupplierInput,
): Promise<{ ok: boolean; supplierId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, error: "Accedi per modificare il RFQ." };
  }

  const rfqId = input.rfqId.trim();
  const supplierName = input.supplierName?.trim() || null;
  const supplierEmail = input.supplierEmail?.trim() || null;
  const hasResolvedIdentity = Boolean(
    input.supplierCompanyId ||
      input.supplierContactId ||
      input.supplierNetworkCompanyId ||
      input.supplierNetworkContactId ||
      input.supplierOrganizationId,
  );

  if (!rfqId) return { ok: false, error: "RFQ non valido." };
  if (!supplierEmail && !hasResolvedIdentity) {
    return { ok: false, error: "Inserisci l'email del fornitore." };
  }

  const { data, error } = await supabase.rpc("rfqh2_add_supplier", {
    p_rfq_id: rfqId,
    p_identity_source: input.identitySource ?? "manual",
    p_supplier_name: supplierName,
    p_supplier_email: supplierEmail,
    p_supplier_company_id: input.supplierCompanyId ?? null,
    p_supplier_contact_id: input.supplierContactId ?? null,
    p_supplier_network_company_id: input.supplierNetworkCompanyId ?? null,
    p_supplier_network_contact_id: input.supplierNetworkContactId ?? null,
    p_supplier_organization_id: input.supplierOrganizationId ?? null,
  });

  if (error) {
    console.error("RFQH2 add supplier failed:", error.message);
    return {
      ok: false,
      error: error.message.includes("already added")
        ? "Questo fornitore è già presente nel RFQ."
        : error.message.includes("Network access required")
          ? "Il Network non è incluso nel piano attivo di questa azienda."
          : error.message.includes("no usable email")
            ? "Questo fornitore non ha ancora un canale email o un account collegato utilizzabile."
            : error.message.includes("invalid")
              ? "L'indirizzo email del fornitore non è valido."
              : "Non è stato possibile aggiungere il fornitore.",
    };
  }

  const supplierId = typeof data === "string" ? data : null;
  if (!supplierId) {
    return { ok: false, error: "Fornitore aggiunto senza identificativo." };
  }

  revalidatePath("/marketplace/rfq-hub");
  revalidatePath("/marketplace/rfq-hub/" + rfqId);
  return { ok: true, supplierId };
}

"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

function rfqh8Error(message: string) {
  if (message.includes("Network access")) return "Il Network non è incluso nel piano attivo.";
  if (message.includes("named Marketplace publication")) return "Per pubblicare con nome azienda serve un profilo Network pubblicato. Puoi usare la modalità anonima.";
  if (message.includes("already imported")) return "Questa risposta Marketplace è già stata importata.";
  if (message.includes("draft RFQ quote")) return "Il supplier ha una revisione RFQ in bozza: chiudila o inviala prima dell'import.";
  if (message.includes("non-EUR")) return "La risposta contiene prezzi non EUR o non normalizzabili.";
  if (message.includes("no priced")) return "La risposta Marketplace non contiene righe prezzate.";
  if (message.includes("no longer eligible") || message.includes("closed")) return "La RFQ non è più aperta a questa operazione.";
  return "Operazione Network / Marketplace non riuscita.";
}

export async function prepareRfqh8MarketplaceBridge(input: {
  rfqId: string;
  productFamilyKey: string;
  visibilityMode: "named" | "anonymous";
  countryCode: string;
  region?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, error: "Accedi per configurare il bridge." };

  const { error } = await supabase.rpc("rfqh8_prepare_marketplace_bridge", {
    p_rfq_id: input.rfqId.trim(),
    p_product_family_key: input.productFamilyKey.trim(),
    p_visibility_mode: input.visibilityMode,
    p_delivery_country_code: input.countryCode.trim().toUpperCase(),
    p_delivery_region: input.region?.trim() || null,
  });

  if (error) {
    console.error("RFQH8 prepare bridge failed:", error.message);
    return { ok: false, error: rfqh8Error(error.message) };
  }

  revalidatePath("/marketplace/rfq-hub/" + input.rfqId.trim());
  revalidatePath("/marketplace");
  revalidatePath("/marketplace/requests");
  return { ok: true };
}

export async function publishRfqh8MarketplaceBridge(input: {
  rfqId: string;
  durationDays: number;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, error: "Accedi per pubblicare nel Marketplace." };

  if (![1, 3, 7, 14, 30].includes(input.durationDays)) {
    return { ok: false, error: "Durata Marketplace non valida." };
  }

  const closesAt = new Date(
    Date.now() + input.durationDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await supabase.rpc("rfqh8_publish_marketplace_bridge", {
    p_rfq_id: input.rfqId.trim(),
    p_closes_at: closesAt,
  });

  if (error) {
    console.error("RFQH8 publish bridge failed:", error.message);
    return { ok: false, error: rfqh8Error(error.message) };
  }

  revalidatePath("/marketplace/rfq-hub/" + input.rfqId.trim());
  revalidatePath("/marketplace");
  revalidatePath("/marketplace/requests");
  return { ok: true };
}

export async function importRfqh8MarketplaceResponse(input: {
  rfqId: string;
  responseId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, error: "Accedi per importare la risposta." };

  const { error } = await supabase.rpc("rfqh8_import_marketplace_response", {
    p_rfq_id: input.rfqId.trim(),
    p_response_id: input.responseId.trim(),
  });

  if (error) {
    console.error("RFQH8 response import failed:", error.message);
    return { ok: false, error: rfqh8Error(error.message) };
  }

  revalidatePath("/marketplace/rfq-hub/" + input.rfqId.trim());
  revalidatePath("/marketplace/responses");
  return { ok: true };
}

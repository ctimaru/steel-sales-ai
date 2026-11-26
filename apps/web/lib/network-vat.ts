import "server-only";

import { createClient } from "@/lib/supabase/server";

/** NET-VAT1 — P.IVA of a published Network company (founder decision 26 nov 2026:
 * shown on the Network profile). Read through a SECURITY DEFINER RPC that only
 * answers authenticated users and only for published, non-archived profiles. */
export type NetworkCompanyVat = { vatId: string; viesConfirmed: boolean };

export async function getNetworkCompanyVat(companyId: string): Promise<NetworkCompanyVat | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("net_vat1_public_company_vat", {
      p_company_id: companyId,
    });
    if (error || !data) return null;
    const row = data as { vat_id?: unknown; vies_confirmed?: unknown };
    const vat = row.vat_id;
    if (typeof vat !== "string" || !/^[0-9A-Z]{4,20}$/i.test(vat)) return null;
    // NET-VAT1 fase 3: valid in VIES and registered to this same company.
    return { vatId: vat, viesConfirmed: row.vies_confirmed === true };
  } catch {
    return null;
  }
}

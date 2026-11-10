import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { getNetworkAccessState } from "@/lib/network-access";
import { listCommercialNetworkProspects } from "@/lib/commercial-network-prospect";

/**
 * AZIENDE-LISTE1 — le due liste Network mostrate nella pagina Aziende.
 * Salvate: shortlist PRIVATA dell'utente (mai quelle dei colleghi).
 * Connesse: richieste di connessione accettate dell'organizzazione (RPC esistente).
 * Nessuna delle due crea o implica una scheda azienda dello storico commerciale.
 */
export type CompanyNetworkRow = { key: string; name: string; detail: string; at: string | null; networkCompanyId: string | null };
export type CompanyNetworkLists = { saved: CompanyNetworkRow[] | null; connected: CompanyNetworkRow[] | null };

type Connection = {
  id: string; status: string; sender_name: string; recipient_name: string; company_id: string;
  created_at: string; decided_at: string | null; sender_network_company_id?: string | null;
};

export async function loadCompanyNetworkLists(organizationId: string, userId: string): Promise<CompanyNetworkLists> {
  if (!isNetworkFrontendEnabled()) return { saved: null, connected: null };
  const access = await getNetworkAccessState(organizationId).catch(() => null);
  if (!access?.can_access_network || access.organization_id !== organizationId) return { saved: null, connected: null };
  const supabase = await createClient();
  const box = async (which: "received" | "sent") => {
    const { data, error } = await supabase.rpc("netconnect1_list", {
      p_organization_id: organizationId, p_box: which, p_limit: 50, p_offset: 0,
    });
    const items = (data as { items?: Connection[] } | null)?.items;
    if (error || !Array.isArray(items)) return null;
    return items.filter((item) => item.status === "accepted").map((item): CompanyNetworkRow => ({
      key: item.id,
      name: String((which === "sent" ? item.recipient_name : item.sender_name) || "Azienda").slice(0, 115),
      detail: which === "sent" ? "Ha accettato la tua richiesta" : "Hai accettato la sua richiesta",
      at: item.decided_at || item.created_at || null,
      networkCompanyId: which === "sent" ? item.company_id : item.sender_network_company_id || null,
    }));
  };
  const [prospects, received, sent] = await Promise.all([
    listCommercialNetworkProspects(organizationId, userId).catch(() => null),
    box("received").catch(() => null),
    box("sent").catch(() => null),
  ]);
  return {
    saved: prospects ? prospects.map((item) => ({
      key: item.id, name: item.name, detail: item.country, at: item.savedAt || null, networkCompanyId: item.id,
    })) : null,
    connected: received && sent
      ? [...received, ...sent].sort((a, b) => Date.parse(b.at ?? "") - Date.parse(a.at ?? ""))
      : null,
  };
}

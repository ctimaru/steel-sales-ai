"use server";

import { revalidatePath } from "next/cache";

import { canWriteWorkspace } from "@/lib/access-policy";
import { getNetworkRecipientReadiness, type RecipientReadinessStatus } from "@/lib/network-recipient-readiness";
import { isRfqReachable, NETWORK_RFQ_HANDOFF_MAX_SUPPLIERS } from "@/lib/network-rfq-supplier-handoff";
import { getNetworkRfqReachability, type RfqChannel } from "@/lib/network-rfq-reachability";
import { trackServerProductEvent } from "@/lib/product-analytics-events.server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

import { addSupplierToBuyerRfq } from "./actions";

/** NET-AUDIT1.3b — receiver of the Network → RFQ Hub supplier selection.
 *
 * The browser handoff carries only Network company UUIDs, so nothing in it is
 * trusted: names, contactability and the target RFQ are all re-read here, in
 * the caller's authenticated context (RLS + PA1.3 entitlement + readiness).
 * Suppliers are added only on an explicit click, one by one through the
 * existing rfqh2_add_supplier path (identity, contact and dedupe resolved in
 * SQL). Nothing is launched or sent.
 * NET-CONTACT1: companies reachable through a published, LR4-reviewed company
 * email are accepted too ("email"); the address is resolved only in SQL.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPEN_STATUSES = ["draft", "ready"] as const;

export type HandoffSupplier = {
  id: string;
  name: string | null;
  status: RecipientReadinessStatus | "not_found";
  channel: RfqChannel;
  selectable: boolean;
};
export type HandoffTarget = { id: string; title: string; status: string };
export type HandoffPreview = {
  ok: boolean;
  error?: string;
  canWrite?: boolean;
  suppliers?: HandoffSupplier[];
  targets?: HandoffTarget[];
};

function cleanIds(ids: unknown): string[] | null {
  if (!Array.isArray(ids)) return null;
  const unique = [...new Set(ids.filter((id): id is string => typeof id === "string" && UUID.test(id)))];
  if (!unique.length || unique.length !== ids.length || unique.length > NETWORK_RFQ_HANDOFF_MAX_SUPPLIERS) return null;
  return unique;
}

async function resolveSuppliers(organizationId: string, ids: string[]): Promise<HandoffSupplier[]> {
  const supabase = await createClient();
  const [{ data: companies }, readiness] = await Promise.all([
    supabase.from("network_companies").select("id,legal_name,trading_name")
      .in("id", ids).eq("publication_status", "published").is("archived_at", null),
    getNetworkRecipientReadiness(organizationId, ids).catch(() => new Map<string, RecipientReadinessStatus>()),
  ]);
  const channels = await getNetworkRfqReachability(organizationId, ids, readiness)
    .catch(() => new Map<string, RfqChannel>());
  type CompanyRow = { id: string; legal_name: string | null; trading_name: string | null };
  const byId = new Map<string, string>(((companies ?? []) as CompanyRow[])
    .map((row) => [row.id, row.trading_name || row.legal_name || ""]));
  return ids.map((id) => {
    const name = byId.get(id) || null;
    const status: HandoffSupplier["status"] = name ? (readiness.get(id) ?? "unavailable") : "not_found";
    const channel: RfqChannel = name ? (channels.get(id) ?? "none") : "none";
    return { id, name, status, channel, selectable: Boolean(name) && isRfqReachable(status, channel) };
  });
}

export async function previewNetworkSupplierHandoff(companyIds: unknown): Promise<HandoffPreview> {
  const ids = cleanIds(companyIds);
  if (!ids) return { ok: false, error: "Selezione dal Network non valida o scaduta." };
  const context = await getWorkspaceContext();
  const canWrite = canWriteWorkspace(context.role);
  const supabase = await createClient();
  const [suppliers, campaigns] = await Promise.all([
    resolveSuppliers(context.organizationId, ids),
    canWrite
      ? supabase.from("buyer_rfq_campaigns").select("id,title,status")
          .eq("organization_id", context.organizationId).in("status", [...OPEN_STATUSES])
          .order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] as HandoffTarget[], error: null }),
  ]);
  return {
    ok: true, canWrite, suppliers,
    targets: (campaigns.data ?? []).map((row) => ({ id: row.id, title: row.title || "RFQ", status: row.status })),
  };
}

export async function applyNetworkSupplierHandoff(input: {
  rfqId: unknown; companyIds: unknown;
}): Promise<{ ok: boolean; added: string[]; failed: Array<{ id: string; error: string }>; error?: string }> {
  const ids = cleanIds(input.companyIds);
  const rfqId = typeof input.rfqId === "string" && UUID.test(input.rfqId) ? input.rfqId : null;
  if (!ids || !rfqId) return { ok: false, added: [], failed: [], error: "Selezione o RFQ non valida." };
  const context = await getWorkspaceContext();
  if (!canWriteWorkspace(context.role)) {
    return { ok: false, added: [], failed: [], error: "Il tuo ruolo non consente di modificare le RFQ." };
  }
  // Revalidate at click time: readiness may have changed since the preview.
  const suppliers = await resolveSuppliers(context.organizationId, ids);
  const added: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];
  for (const supplier of suppliers) {
    if (!supplier.selectable) {
      failed.push({ id: supplier.id, error: supplier.status === "not_found"
        ? "Profilo non più disponibile nel Network." : "Azienda non contattabile al momento." });
      continue;
    }
    const result = await addSupplierToBuyerRfq({
      rfqId, identitySource: "network_company", supplierName: supplier.name,
      supplierNetworkCompanyId: supplier.id, suppressAnalytics: true,
    });
    if (result.ok) added.push(supplier.id);
    else failed.push({ id: supplier.id, error: result.error || "Aggiunta non riuscita." });
  }
  if (added.length) {
    await trackServerProductEvent("rfq_supplier_added", { mode: "network_handoff", supplier_count: added.length });
    revalidatePath("/marketplace/rfq-hub/" + rfqId);
  }
  return { ok: failed.length === 0, added, failed };
}

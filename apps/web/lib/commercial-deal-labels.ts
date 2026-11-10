import "server-only";

import type { UnifiedCommercialData } from "@/lib/commercial-unified-data";
import { createClient } from "@/lib/supabase/server";

const TABLES = { "inbound-rfq": "rfqs", "inbound-offer": "offers", "inbound-order": "orders" } as const;
type InboundKind = keyof typeof TABLES;

/**
 * Applica il nome scelto dall'utente (deal_label) alle righe che non lo portano già
 * (viste Ricevute / Inviate / Bozze e storico). Legge solo id e nome, sotto RLS, e in
 * caso di errore lascia l'elenco invariato.
 */
export async function withDealLabels(data: UnifiedCommercialData, organizationId: string): Promise<UnifiedCommercialData> {
  const wanted: Record<InboundKind, string[]> = { "inbound-rfq": [], "inbound-offer": [], "inbound-order": [] };
  for (const item of data.items) {
    if (item.kind in TABLES && !item.rowFacts?.label) wanted[item.kind as InboundKind].push(item.id);
  }
  const kinds = (Object.keys(wanted) as InboundKind[]).filter((kind) => wanted[kind].length > 0);
  if (kinds.length === 0) return data;
  try {
    const db = await createClient();
    const results = await Promise.all(kinds.map((kind) =>
      db.from(TABLES[kind]).select("id,deal_label")
        .eq("organization_id", organizationId).in("id", wanted[kind].slice(0, 200))
        .not("deal_label", "is", null)));
    const labels = new Map<string, string>();
    for (const result of results) {
      if (result.error) return data;
      for (const row of (result.data ?? []) as Array<{ id: string; deal_label: string | null }>) {
        const label = typeof row.deal_label === "string" ? row.deal_label.trim() : "";
        if (label) labels.set(row.id, label);
      }
    }
    if (labels.size === 0) return data;
    return {
      ...data,
      items: data.items.map((item) => {
        const label = item.kind in TABLES ? labels.get(item.id) : undefined;
        return label ? { ...item, title: label, rowFacts: { ...item.rowFacts, label } } : item;
      }),
    };
  } catch {
    return data;
  }
}

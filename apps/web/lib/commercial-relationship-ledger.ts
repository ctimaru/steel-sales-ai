import "server-only";

import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CommercialRelationshipEvent = {
  id: string;
  actorId: string;
  kind: "created" | "note" | "call" | "meeting" | "follow_up";
  note: string | null;
  createdAt: string;
};
export type CommercialRelationship = {
  id: string;
  organizationId: string;
  networkCompanyId: string;
  createdAt: string;
  createdBy: string;
  events: CommercialRelationshipEvent[];
};
export type CommercialRelationshipState =
  | { status: "available"; relationship: CommercialRelationship | null }
  | { status: "unavailable"; relationship: null };

/**
 * Tenant-checked, entitled read of the shared organization relationship.
 * Supabase RLS enforces active membership and paid Network entitlement again.
 * Never searches Company 360 by name or exposes contacts/supplier/RFQ records.
 */
export async function getCommercialRelationshipLedger(
  organizationId: string,
  networkCompanyId: string,
): Promise<CommercialRelationshipState> {
  if (!UUID.test(organizationId) || !UUID.test(networkCompanyId))
    return { status: "unavailable", relationship: null };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_network_relationships")
    .select("id,organization_id,network_company_id,created_by,created_at")
    .eq("organization_id", organizationId)
    .eq("network_company_id", networkCompanyId)
    .maybeSingle();
  if (error) return { status: "unavailable", relationship: null };
  if (!data) return { status: "available", relationship: null };
  const { data: events, error: eventError } = await supabase
    .from("crm_network_relationship_events")
    .select("id,actor_user_id,event_type,note,created_at")
    .eq("organization_id", organizationId)
    .eq("relationship_id", data.id)
    .order("created_at", { ascending: false })
    .limit(15);
  if (eventError) return { status: "unavailable", relationship: null };
  return {
    status: "available",
    relationship: {
      id: data.id,
      organizationId: organizationId,
      networkCompanyId: networkCompanyId,
      createdBy: data.created_by,
      createdAt: data.created_at,
      events: (events ?? []).map((item) => ({
        id: item.id,
        actorId: item.actor_user_id,
        kind: item.event_type as CommercialRelationshipEvent["kind"],
        note: item.note,
        createdAt: item.created_at,
      })),
    },
  };
}

export async function listCommercialOrganizationRelationships(organizationId: string) {
  if (!UUID.test(organizationId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_network_relationships")
    .select("id,network_company_id,created_at,network_companies!inner(legal_name,trading_name,country_code,publication_status)")
    .eq("organization_id", organizationId)
    .eq("network_companies.publication_status", "published")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return null;
  return (data ?? []).flatMap((item) => {
    const company = Array.isArray(item.network_companies) ? item.network_companies[0] : item.network_companies;
    const name = String(company?.trading_name || company?.legal_name || "").trim().slice(0, 115);
    if (!UUID.test(item.network_company_id) || !name) return [];
    return [{
      id: item.network_company_id as string,
      name,
      country: String(company?.country_code ?? "—").slice(0, 2),
      createdAt: item.created_at as string,
    }];
  });
}

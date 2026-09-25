import { createClient } from "@/lib/supabase/server";

export type NetworkTaxonomyOption = { canonical_key: string; display_name: string };

export type NetworkSearchItem = {
  id: string;
  legal_name: string;
  trading_name: string | null;
  country_code: string;
  website_url: string | null;
  website_domain: string | null;
  verification_status: string;
  claimed_status: string;
  roles: { key: string; name: string; is_primary: boolean }[];
  products: { key: string; name: string; relationship_type: string }[];
  markets: { key: string; name: string }[];
  capabilities: { key: string; name: string }[];
  facility_countries: string[];
};

export type NetworkProfile = {
  company: {
    id: string;
    legal_name: string;
    trading_name: string | null;
    country_code: string;
    website_url: string | null;
    website_domain: string | null;
    description: string | null;
    verification_status: string;
    claimed_status: string;
  };
  roles: { key: string; name: string; is_primary: boolean }[];
  subtypes: { key: string; name: string }[];
  products: { key: string; name: string; relationship_type: string; facility_id: string | null }[];
  markets: { key: string; name: string }[];
  facilities: {
    id: string;
    name: string;
    facility_type: string;
    city: string | null;
    region: string | null;
    country_code: string;
    website_url: string | null;
    verification_status: string;
    capabilities: { key: string; name: string; verification_status: string }[];
  }[];
  contacts: {
    id: string;
    facility_id: string | null;
    contact_type: string;
    display_name: string | null;
    email: string | null;
    phone: string | null;
    website_url: string | null;
  }[];
  certifications: {
    id: string;
    certification_type_key: string;
    certification_type_name: string;
    issuer: string | null;
    certificate_identifier: string | null;
    valid_from: string | null;
    valid_to: string | null;
    verification_status: string;
    evidence_reference: string | null;
  }[];
};

export type ManagedNetworkCompany = {
  organization_id: string;
  network_company_id: string;
  claim_status: string;
  link_status: string;
  company: {
    id: string;
    legal_name: string;
    trading_name: string | null;
    country_code: string;
    website_url: string | null;
    description: string | null;
    publication_status: string;
    claimed_status: string;
    verification_status: string;
  };
};

export async function getNetworkTaxonomy() {
  const supabase = await createClient();
  const [roles, products, capabilities, markets] = await Promise.all([
    supabase.from("network_company_roles").select("canonical_key,display_name").eq("status", "active").order("sort_order"),
    supabase.from("network_product_families").select("canonical_key,display_name").eq("status", "active").order("sort_order"),
    supabase.from("network_capabilities").select("canonical_key,display_name").eq("status", "active").order("sort_order"),
    supabase.from("network_markets").select("canonical_key,display_name").eq("status", "active").order("sort_order"),
  ]);

  return {
    roles: (roles.data ?? []) as NetworkTaxonomyOption[],
    products: (products.data ?? []) as NetworkTaxonomyOption[],
    capabilities: (capabilities.data ?? []) as NetworkTaxonomyOption[],
    markets: (markets.data ?? []) as NetworkTaxonomyOption[],
  };
}

export async function searchNetwork(filters: {
  query?: string | null;
  role?: string | null;
  product?: string | null;
  capability?: string | null;
  country?: string | null;
  market?: string | null;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("m6_search_network", {
    p_query: filters.query || null,
    p_role_keys: filters.role ? [filters.role] : null,
    p_product_keys: filters.product ? [filters.product] : null,
    p_capability_keys: filters.capability ? [filters.capability] : null,
    p_country_codes: filters.country ? [filters.country.toUpperCase()] : null,
    p_market_keys: filters.market ? [filters.market] : null,
    p_limit: 50,
    p_offset: 0,
  });

  if (error) throw new Error(error.message);
  const payload = (data ?? {}) as { items?: NetworkSearchItem[]; total?: number };
  return { items: payload.items ?? [], total: Number(payload.total ?? 0) };
}

export async function getNetworkProfile(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("m6_network_company_profile", { p_company_id: id });
  if (error) throw new Error(error.message);
  return (data as NetworkProfile | null) ?? null;
}

export async function getManagedNetworkCompany() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("m8_my_network_company");
  if (error) throw new Error(error.message);
  return (data as ManagedNetworkCompany | null) ?? null;
}

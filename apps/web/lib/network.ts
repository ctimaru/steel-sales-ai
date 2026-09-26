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


export type SavedNetworkCompany = {
  network_company_id: string;
  created_at: string;
  company: {
    id: string;
    legal_name: string;
    trading_name: string | null;
    country_code: string;
    website_url: string | null;
    verification_status: string;
    claimed_status: string;
    publication_status: string;
  };
};

export async function getSavedNetworkCompanies() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("network_saved_companies")
    .select(
      "network_company_id,created_at,network_companies!inner(id,legal_name,trading_name,country_code,website_url,verification_status,claimed_status,publication_status)",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    network_company_id: row.network_company_id,
    created_at: row.created_at,
    company: Array.isArray(row.network_companies)
      ? row.network_companies[0]
      : row.network_companies,
  })) as SavedNetworkCompany[];
}


export type ActiveOrganizationContext = {
  organization_id: string;
  role: string;
  is_default: boolean;
};

export type NetworkInquiryItem = {
  id: string;
  sender_organization_id: string;
  sender_organization_name: string;
  sender_user_id: string;
  recipient_network_company_id: string;
  recipient_organization_id: string;
  recipient_company_name: string;
  subject: string;
  body: string;
  status: string;
  submitted_at: string;
  last_activity_at: string;
};

export async function getActiveOrganizationContext() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("organization_memberships")
    .select("organization_id,role,is_default,status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw new Error(error.message);
  const membership = data?.find((row) => row.is_default) ?? data?.[0];
  if (!membership) return null;

  return {
    organization_id: membership.organization_id,
    role: membership.role,
    is_default: membership.is_default,
  } as ActiveOrganizationContext;
}

export async function getInquiryEligibility(
  senderOrganizationId: string,
  recipientNetworkCompanyId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p4_inquiry_eligibility", {
    p_sender_organization_id: senderOrganizationId,
    p_recipient_network_company_id: recipientNetworkCompanyId,
  });

  if (error) throw new Error(error.message);
  return (data ?? { eligible: false, reason: "recipient_unavailable" }) as {
    eligible: boolean;
    reason: string;
  };
}

export async function getNetworkInquiries(
  organizationId: string,
  box: "received" | "sent",
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p4_list_inquiries", {
    p_organization_id: organizationId,
    p_box: box,
    p_limit: 100,
    p_offset: 0,
  });

  if (error) throw new Error(error.message);
  const payload = (data ?? {}) as { items?: NetworkInquiryItem[]; total?: number };
  return {
    items: payload.items ?? [],
    total: Number(payload.total ?? 0),
  };
}

export async function getInquiryPreferences(organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p4_get_inquiry_preferences", {
    p_organization_id: organizationId,
  });

  if (error) throw new Error(error.message);
  return (data ?? { organization_id: organizationId, inquiries_enabled: true }) as {
    organization_id: string;
    inquiries_enabled: boolean;
  };
}

import { createClient } from "@/lib/supabase/server";

export type MarketplaceRequestSummary = {
  id: string;
  title: string;
  visibility_mode: "named" | "anonymous";
  status: "draft" | "published" | "withdrawn";
  effective_status: "draft" | "open" | "closing_soon" | "closed" | "withdrawn";
  opens_at: string | null;
  closes_at: string | null;
  published_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
  line_count: number;
};

export type MarketplaceRequestLine = {
  id: string;
  line_number: number;
  product_family_id: string;
  product_family_key: string;
  product_family_name: string;
  standard_id: string | null;
  standard_code: string | null;
  standard_title: string | null;
  material_grade_id: string | null;
  grade_designation: string | null;
  material_number: string | null;
  manufacturing_process: string | null;
  outer_diameter_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  thickness_mm: number | null;
  length_mm: number | null;
  quantity: number;
  quantity_unit: string;
  certification: string | null;
  delivery_country_code: string;
  delivery_region: string | null;
  requested_delivery_date: string | null;
  notes: string | null;
  created_at: string;
};

export type MarketplaceRequestDetail = {
  contract: string;
  request: Omit<MarketplaceRequestSummary, "line_count"> & {
    organization_id: string;
  };
  lines: MarketplaceRequestLine[];
};

export type MarketplaceTaxonomy = {
  contract: string;
  product_families: { id: string; key: string; name: string }[];
  standards: {
    id: string;
    code: string;
    title: string;
    manufacturing_processes: string[];
    product_family_keys: string[];
  }[];
  grades: {
    standard_id: string;
    standard_code: string;
    material_grade_id: string;
    designation: string;
    material_number: string | null;
  }[];
};

export async function getMyMarketplaceRequests(organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_1_my_requests", {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(error.message);
  const payload = (data ?? {}) as { items?: MarketplaceRequestSummary[] };
  return payload.items ?? [];
}

export async function getMarketplaceRequest(requestId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_1_my_request", {
    p_request_id: requestId,
  });
  if (error) {
    if (error.code === "P0002") return null;
    throw new Error(error.message);
  }
  return (data as MarketplaceRequestDetail | null) ?? null;
}

export async function getMarketplaceTaxonomy() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_1_listing_taxonomy");
  if (error) throw new Error(error.message);
  return (data ?? {
    contract: "P5.1-taxonomy-v1",
    product_families: [],
    standards: [],
    grades: [],
  }) as MarketplaceTaxonomy;
}

export type MarketplaceFeedTeaserLine = {
  line_number: number;
  product_family_key: string;
  product_family_name: string;
  manufacturing_process?: string;
  quantity_band: string;
  delivery_country_code: string;
  delivery_region?: string;
  has_standard: boolean;
  has_grade: boolean;
  has_dimensions: boolean;
  has_certification: boolean;
};

export type MarketplaceFeedBuyer =
  | {
      visibility_mode: "anonymous";
    }
  | {
      visibility_mode: "named";
      network_company_id?: string;
      display_name?: string;
      country_code?: string;
      verification_status?: string;
      claimed_status?: string;
      profile_available?: boolean;
    };

export type MarketplaceFeedItem = {
  request_id: string;
  visibility_mode: "named" | "anonymous";
  effective_status: "open" | "closing_soon";
  opens_at: string;
  closes_at: string;
  seconds_remaining: number;
  buyer: MarketplaceFeedBuyer;
  line_count: number;
  teaser_lines: MarketplaceFeedTeaserLine[];
};

export type MarketplaceFeedResponse = {
  contract: "P5.2-feed-v1";
  generated_at: string;
  items: MarketplaceFeedItem[];
  total: number;
  limit: number;
  offset: number;
};

export async function getMarketplaceFeed(
  viewerOrganizationId: string,
  filters?: {
    productKey?: string;
    countryCode?: string;
    closingWithinHours?: number;
    limit?: number;
    offset?: number;
  },
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_2_marketplace_feed", {
    p_viewer_organization_id: viewerOrganizationId,
    p_product_keys: filters?.productKey ? [filters.productKey] : null,
    p_country_codes: filters?.countryCode
      ? [filters.countryCode.toUpperCase()]
      : null,
    p_closing_within_hours: filters?.closingWithinHours ?? null,
    p_limit: filters?.limit ?? 25,
    p_offset: filters?.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? {
    contract: "P5.2-feed-v1",
    generated_at: new Date().toISOString(),
    items: [],
    total: 0,
    limit: filters?.limit ?? 25,
    offset: filters?.offset ?? 0,
  }) as MarketplaceFeedResponse;
}

export async function getMarketplaceTeaser(
  viewerOrganizationId: string,
  requestId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_2_marketplace_teaser", {
    p_viewer_organization_id: viewerOrganizationId,
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
  return (data as MarketplaceFeedItem | null) ?? null;
}

export type MarketplaceEntitlementState = {
  contract: "P5.3-entitlement-v1";
  request_id: string;
  state: "locked" | "entitled" | "expired";
  can_view_locked_detail: boolean;
  can_respond: false;
  entitlement_key: "marketplace_access" | "opportunity_unlock" | null;
  source_kind: "subscription" | "credit" | "manual" | "pilot" | "system" | null;
  expires_at: string | null;
};

export type MarketplaceUnlockedLine = {
  line_number: number;
  product_family_key: string;
  product_family_name: string;
  standard_code?: string;
  standard_title?: string;
  grade_designation?: string;
  material_number?: string;
  manufacturing_process?: string;
  outer_diameter_mm?: number;
  width_mm?: number;
  height_mm?: number;
  thickness_mm?: number;
  length_mm?: number;
  quantity: number;
  quantity_unit: string;
  certification?: string;
  delivery_country_code: string;
  delivery_region?: string;
  requested_delivery_date?: string;
  notes?: string;
  notes_withheld_for_anonymity: boolean;
};

export type MarketplaceUnlockedDetail = {
  contract: "P5.3-detail-v1";
  request: {
    request_id: string;
    visibility_mode: "named" | "anonymous";
    effective_status: "open" | "closing_soon";
    opens_at: string;
    closes_at: string;
    seconds_remaining: number;
  };
  buyer: MarketplaceFeedBuyer;
  entitlement: MarketplaceEntitlementState;
  lines: MarketplaceUnlockedLine[];
  can_respond: false;
};

export async function getMarketplaceEntitlementState(
  supplierOrganizationId: string,
  requestId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_3_entitlement_state", {
    p_supplier_organization_id: supplierOrganizationId,
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
  return (data as MarketplaceEntitlementState | null) ?? null;
}

export async function getMarketplaceUnlockedDetail(
  supplierOrganizationId: string,
  requestId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_3_marketplace_detail", {
    p_supplier_organization_id: supplierOrganizationId,
    p_request_id: requestId,
  });

  if (error) {
    if (error.code === "42501") return null;
    throw new Error(error.message);
  }

  return (data as MarketplaceUnlockedDetail | null) ?? null;
}


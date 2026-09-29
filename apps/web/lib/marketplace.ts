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

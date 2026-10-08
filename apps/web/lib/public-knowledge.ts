import { createPublicSupabaseClient } from "@/lib/supabase/public";

export type KnowledgeEditorialSection = {
  heading: string;
  body: string;
};

export type KnowledgeFaqItem = {
  question: string;
  answer: string;
};

export type PublicKnowledgeStandardSummary = {
  standard_id: string;
  slug: string;
  code: string;
  title: string;
  standard_system: string | null;
  application_category: string | null;
  short_explanation: string | null;
  seo_title: string;
  seo_description: string;
  product_families: string[];
  related_grade_count: number;
  published_at: string;
  last_reviewed_at: string;
};

export type KnowledgeSourceReference = {
  label: string;
  publisher: string;
  url: string;
  status?: string;
};

export type PublicKnowledgeRelatedStandardPage = {
  slug: string;
  code: string;
  title: string;
  application_category: string | null;
};

export type PublicKnowledgeRelatedGrade = {
  material_grade_id: string;
  designation: string;
  material_number: string | null;
  standard_system: string | null;
  applicability_type: string;
  is_normative: boolean;
  manufacturing_processes: string[];
  slug: string | null;
};

export type PublicKnowledgeStandard = {
  standard_id: string;
  slug: string;
  code: string;
  title: string;
  standard_system: string | null;
  issuing_body: string | null;
  edition: string | null;
  part_number: string | null;
  application_category: string | null;
  manufacturing_processes: string[];
  dimensional_basis: string | null;
  short_explanation: string | null;
  scope_summary: string | null;
  seo_title: string;
  seo_description: string;
  intro: string;
  what_it_covers: string;
  how_to_read: string | null;
  typical_applications: string | null;
  editorial_sections: KnowledgeEditorialSection[];
  faq: KnowledgeFaqItem[];
  product_families: string[];
  related_grades: PublicKnowledgeRelatedGrade[];
  source_references: KnowledgeSourceReference[];
  related_standard_pages: PublicKnowledgeRelatedStandardPage[];
  published_at: string;
  last_reviewed_at: string;
};

export type PublicKnowledgeGradeSummary = {
  material_grade_id: string;
  slug: string;
  designation: string;
  material_number: string | null;
  standard_system: string | null;
  material_family: string | null;
  short_description: string | null;
  seo_title: string;
  seo_description: string;
  related_standard_count: number;
  published_at: string;
  last_reviewed_at: string;
};

export type PublicKnowledgeRelatedGradePage = {
  slug: string;
  designation: string;
  material_number: string | null;
  material_family: string | null;
  seo_title: string;
};

export type PublicKnowledgeRelatedStandard = {
  standard_id: string;
  code: string;
  title: string;
  standard_system: string | null;
  applicability_type: string;
  is_normative: boolean;
  manufacturing_processes: string[];
  slug: string | null;
};

export type PublicKnowledgeGrade = {
  material_grade_id: string;
  slug: string;
  designation: string;
  material_number: string | null;
  standard_system: string | null;
  material_family: string | null;
  density_kg_m3: number | null;
  short_description: string | null;
  seo_title: string;
  seo_description: string;
  intro: string;
  designation_explanation: string;
  typical_applications: string | null;
  editorial_sections: KnowledgeEditorialSection[];
  faq: KnowledgeFaqItem[];
  related_standards: PublicKnowledgeRelatedStandard[];
  source_references: KnowledgeSourceReference[];
  related_grade_pages: PublicKnowledgeRelatedGradePage[];
  published_at: string;
  last_reviewed_at: string;
};

function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

async function rpcRows<T>(
  functionName: string,
  args: Record<string, unknown>,
): Promise<T[]> {
  if (!isConfigured()) return [];

  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc(functionName, args);
  if (error) {
    console.error(`Public Knowledge RPC ${functionName} failed:`, error.message);
    return [];
  }

  return Array.isArray(data) ? (data as T[]) : [];
}

async function rpcPagedRows<T>(
  functionName: string,
  baseArgs: Record<string, unknown>,
  pageSize = 500,
  maxPages = 100,
): Promise<T[]> {
  if (!isConfigured()) return [];

  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];

  const rows: T[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const { data, error } = await supabase.rpc(functionName, {
      ...baseArgs,
      p_limit: pageSize,
      p_offset: page * pageSize,
    });

    if (error) {
      console.error(`Public Knowledge RPC ${functionName} failed:`, error.message);
      return rows;
    }

    const chunk = Array.isArray(data) ? (data as T[]) : [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }

  return rows;
}

export async function listPublicStandards(query?: string) {
  return rpcRows<PublicKnowledgeStandardSummary>("k2_public_knowledge_standards", {
    p_query: query?.trim() || null,
    p_limit: 250,
    p_offset: 0,
  });
}

export async function getPublicStandard(slug: string) {
  const rows = await rpcRows<PublicKnowledgeStandard>("k2_public_knowledge_standard", {
    p_slug: slug,
  });
  return rows[0] ?? null;
}

export async function listPublicGrades(query?: string) {
  return rpcRows<PublicKnowledgeGradeSummary>("k2_public_knowledge_grades", {
    p_query: query?.trim() || null,
    p_limit: 250,
    p_offset: 0,
  });
}

export async function getPublicGrade(slug: string) {
  const rows = await rpcRows<PublicKnowledgeGrade>("k2_public_knowledge_grade", {
    p_slug: slug,
  });
  return rows[0] ?? null;
}


export type PublicTubeWeightReference = {
  reference_id: string;
  geometry_id: string;
  product_family: "round_tube" | "square_tube" | "rectangular_tube";
  outer_diameter_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  thickness_mm: number;
  weight_kg_m: number;
  weight_method: string;
  density_kg_m3: number | null;
  source_provider: string | null;
  source_name: string | null;
  source_url: string | null;
};

export async function listPublicTubeWeightReferences(productFamily?: string) {
  return rpcRows<PublicTubeWeightReference>("k5_public_tube_weight_references", {
    p_product_family: productFamily?.trim() || null,
    p_limit: 500,
    p_offset: 0,
  });
}


export type PublicTubeDimensionSummary = {
  dimension_slug: string;
  reference_id: string;
  geometry_id: string;
  product_family: "round_tube" | "square_tube" | "rectangular_tube";
  outer_diameter_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  thickness_mm: number;
  weight_kg_m: number;
  weight_method: string;
  density_kg_m3: number | null;
  source_provider: string;
  source_name: string | null;
  source_url: string;
  published_at: string;
};

export type PublicTubeRelatedDimension = {
  dimension_slug: string;
  product_family: PublicTubeDimensionSummary["product_family"];
  outer_diameter_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  thickness_mm: number;
  weight_kg_m: number;
};

export type PublicTubeDimension = PublicTubeDimensionSummary & {
  related_dimensions: PublicTubeRelatedDimension[];
};

export async function listPublicTubeDimensionPages(productFamily?: string) {
  return rpcPagedRows<PublicTubeDimensionSummary>("k6_public_tube_dimension_pages", {
    p_product_family: productFamily?.trim() || null,
  });
}

/** Lightweight public selector for /distinta; only previously published Knowledge entries. */
export async function listBuyerDistintaPublicDimensions() {
  const families = ["round_tube", "square_tube", "rectangular_tube"] as const;
  const groups = await Promise.all(families.map((family) =>
    rpcRows<PublicTubeDimensionSummary>("k6_public_tube_dimension_pages", {
      p_product_family: family,
      p_limit: 350,
      p_offset: 0,
    }),
  ));
  return groups.flat();
}

export async function getPublicTubeDimension(slug: string) {
  const rows = await rpcRows<PublicTubeDimension>("k6_public_tube_dimension_page", {
    p_slug: slug,
  });
  return rows[0] ?? null;
}


export type PublicTubeFamilyHub = {
  family_slug: "tondo" | "quadro" | "rettangolare";
  product_family: PublicTubeDimensionSummary["product_family"];
  dimension_count: number;
  size_hub_count: number;
  min_thickness_mm: number;
  max_thickness_mm: number;
  min_weight_kg_m: number;
  max_weight_kg_m: number;
  source_count: number;
  published_at: string;
};

export type PublicTubeSizeHubSummary = {
  family_slug: PublicTubeFamilyHub["family_slug"];
  product_family: PublicTubeDimensionSummary["product_family"];
  size_slug: string;
  outer_diameter_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  variant_count: number;
  min_thickness_mm: number;
  max_thickness_mm: number;
  min_weight_kg_m: number;
  max_weight_kg_m: number;
  source_count: number;
  published_at: string;
};

export type PublicTubeSizeVariant = {
  dimension_slug: string;
  thickness_mm: number;
  weight_kg_m: number;
  weight_method: string;
  density_kg_m3: number | null;
  source_provider: string;
  source_name: string | null;
  source_url: string;
  published_at: string;
};

export type PublicTubeSizeHub = PublicTubeSizeHubSummary & {
  variants: PublicTubeSizeVariant[];
};

export async function listPublicTubeFamilyHubs() {
  return rpcRows<PublicTubeFamilyHub>("k7_public_tube_family_hubs", {});
}

export async function listPublicTubeSizeHubs(familySlug?: string) {
  return rpcRows<PublicTubeSizeHubSummary>("k7_public_tube_size_hubs", {
    p_family_slug: familySlug?.trim() || null,
  });
}

export async function getPublicTubeSizeHub(familySlug: string, sizeSlug: string) {
  const rows = await rpcRows<PublicTubeSizeHub>("k7_public_tube_size_hub", {
    p_family_slug: familySlug,
    p_size_slug: sizeSlug,
  });
  return rows[0] ?? null;
}

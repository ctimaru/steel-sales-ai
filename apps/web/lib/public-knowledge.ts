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
  published_at: string;
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

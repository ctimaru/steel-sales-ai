import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type KnowledgeContentType = "standard" | "grade";
export type KnowledgeWorkflowStatus =
  | "draft"
  | "in_review"
  | "changes_requested"
  | "approved";

export type KnowledgeDraftPayload = {
  seo_title?: string | null;
  seo_description?: string | null;
  intro?: string | null;
  what_it_covers?: string | null;
  designation_explanation?: string | null;
  how_to_read?: string | null;
  typical_applications?: string | null;
  editorial_sections?: Array<{ heading: string; body: string }>;
  faq?: Array<{ question: string; answer: string }>;
  source_references?: Array<{
    label: string;
    publisher?: string;
    url: string;
    status?: string;
  }>;
  related_slugs?: string[];
};

export type PlatformKnowledgeItem = {
  content_type: KnowledgeContentType;
  page_id: string;
  slug: string;
  label: string;
  subtitle: string | null;
  page_status: string;
  workflow_status: KnowledgeWorkflowStatus;
  draft_version: number;
  live_version: number;
  draft_updated_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  published_at: string | null;
  last_reviewed_at: string | null;
  ready: boolean;
  blockers: string[];
  updated_at: string;
};

export type PlatformKnowledgeQueue = {
  items: PlatformKnowledgeItem[];
  total: number;
  draft: number;
  inReview: number;
  changesRequested: number;
  approved: number;
  published: number;
};

export type PlatformKnowledgePage = {
  content_type: KnowledgeContentType;
  page_id: string;
  slug: string;
  label: string;
  subtitle: string | null;
  page_status: string;
  workflow_status: KnowledgeWorkflowStatus;
  draft_version: number;
  live_version: number;
  draft_payload: KnowledgeDraftPayload;
  live_payload: KnowledgeDraftPayload;
  ready: boolean;
  blockers: string[];
  draft_updated_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  published_at: string | null;
  last_reviewed_at: string | null;
};

export type PlatformKnowledgeQualityRow = {
  content_type: string;
  total_rows: number;
  indexable_rows: number;
  missing_sources: number;
  missing_seo: number;
  stale_rows: number;
  structural_issues: number;
  details: Record<string, unknown>;
};

export type PlatformKnowledgeQuality = {
  live_quality: PlatformKnowledgeQualityRow[];
  workflow: {
    total: number;
    ready_drafts: number;
    blocked_drafts: number;
    in_review: number;
    approved: number;
    changes_requested: number;
  };
};

export async function getPlatformKnowledgeQueue(
  workflowStatus?: string | null,
): Promise<PlatformKnowledgeQueue> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa7_knowledge_queue", {
    p_workflow_status: workflowStatus || null,
    p_limit: 300,
  });

  if (error) {
    if (error.code === "42501") redirect("/platform");
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as {
    items?: PlatformKnowledgeItem[];
    total?: number;
    draft?: number;
    in_review?: number;
    changes_requested?: number;
    approved?: number;
    published?: number;
  };

  return {
    items: payload.items ?? [],
    total: Number(payload.total ?? 0),
    draft: Number(payload.draft ?? 0),
    inReview: Number(payload.in_review ?? 0),
    changesRequested: Number(payload.changes_requested ?? 0),
    approved: Number(payload.approved ?? 0),
    published: Number(payload.published ?? 0),
  };
}

export async function getPlatformKnowledgePage(
  contentType: KnowledgeContentType,
  pageId: string,
): Promise<PlatformKnowledgePage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa7_knowledge_page", {
    p_content_type: contentType,
    p_page_id: pageId,
  });

  if (error) {
    if (error.code === "42501") redirect("/platform");
    if (error.code === "P0002") return null;
    throw new Error(error.message);
  }

  return (data as PlatformKnowledgePage | null) ?? null;
}

export async function getPlatformKnowledgeQuality(): Promise<PlatformKnowledgeQuality> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa7_knowledge_quality_audit");

  if (error) {
    if (error.code === "42501") redirect("/platform/knowledge");
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as PlatformKnowledgeQuality;
  return {
    live_quality: payload.live_quality ?? [],
    workflow: {
      total: Number(payload.workflow?.total ?? 0),
      ready_drafts: Number(payload.workflow?.ready_drafts ?? 0),
      blocked_drafts: Number(payload.workflow?.blocked_drafts ?? 0),
      in_review: Number(payload.workflow?.in_review ?? 0),
      approved: Number(payload.workflow?.approved ?? 0),
      changes_requested: Number(payload.workflow?.changes_requested ?? 0),
    },
  };
}

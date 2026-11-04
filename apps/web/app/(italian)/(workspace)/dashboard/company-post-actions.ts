"use server";

import {
  COMPANY_POSTS_PER_PAGE,
  COMPANY_POST_MAX_CHARS,
  companyPostErrorCopy,
  decodeCompanyPostsToken,
  encodeCompanyPostsToken,
  isCompanyPostReportReason,
  isCompanyPostType,
  parseCompanyPostsFeed,
  type CompanyPostItem,
  type CompanyPostType,
} from "@/lib/company-posts-model";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

/**
 * CPOST1: company posts from the Home. The organization always comes from the
 * session, never from the browser; who may publish, edit, delete or report is
 * re-checked by the cpost1_* functions in SQL (role, verified company, author).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Failure = { ok: false; error: string };

function cleanBody(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Keys each type may send; SQL re-validates and drops anything else. */
const DETAIL_KEYS: Record<CompanyPostType, readonly string[]> = {
  capacity: ["process", "process_detail", "available_from", "available_to", "quantity", "location"],
  stock: ["product", "standard", "grade", "dimensions", "quantity", "location", "certificate_31"],
  news: [],
  event: ["name", "date_from", "date_to", "location", "stand"],
};

function cleanDetails(type: CompanyPostType, value: unknown): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  const raw = value as Record<string, unknown>;
  for (const key of DETAIL_KEYS[type]) {
    const item = raw[key];
    if (key === "certificate_31") {
      if (item === true) out[key] = true;
    } else if (typeof item === "string" && item.trim()) {
      out[key] = item.trim().slice(0, 200);
    }
  }
  return out;
}

export async function createCompanyPost(
  postType: string,
  body: string,
  details: unknown,
): Promise<{ ok: true; item: CompanyPostItem | null } | Failure> {
  if (!isCompanyPostType(postType)) return { ok: false, error: companyPostErrorCopy("invalid post type") };
  const text = cleanBody(body);
  if (postType === "news" && !text) return { ok: false, error: companyPostErrorCopy("empty") };
  if (text.length > COMPANY_POST_MAX_CHARS) return { ok: false, error: companyPostErrorCopy("exceeds") };
  try {
    const context = await getWorkspaceContext();
    const db = await createClient();
    const { data, error } = await db.rpc("cpost2_create_post", {
      p_organization_id: context.organizationId,
      p_post_type: postType,
      p_body: text,
      p_details: cleanDetails(postType, details),
      p_language_code: "it",
    });
    if (error) return { ok: false, error: companyPostErrorCopy(error.message) };
    const postId = (data as { post_id?: unknown } | null)?.post_id;
    // Re-read through the feed so the card shows exactly what others will see.
    const feed = await db.rpc("cpost2_feed", { p_limit: 10 });
    const page = feed.error ? null : parseCompanyPostsFeed(feed.data);
    return { ok: true, item: page?.items.find((item) => item.id === postId) ?? null };
  } catch {
    return { ok: false, error: companyPostErrorCopy(null) };
  }
}

export async function editCompanyPost(postId: string, body: string): Promise<{ ok: true; body: string } | Failure> {
  const text = cleanBody(body);
  if (typeof postId !== "string" || !UUID.test(postId)) return { ok: false, error: companyPostErrorCopy("post not found") };
  // Typed posts may have no text; SQL rejects an empty news post.
  if (text.length > COMPANY_POST_MAX_CHARS) return { ok: false, error: companyPostErrorCopy("exceeds") };
  try {
    const db = await createClient();
    const { error } = await db.rpc("cpost1_edit_post", { p_post_id: postId, p_body: text });
    return error ? { ok: false, error: companyPostErrorCopy(error.message) } : { ok: true, body: text };
  } catch {
    return { ok: false, error: companyPostErrorCopy(null) };
  }
}

export async function deleteCompanyPost(postId: string): Promise<{ ok: true } | Failure> {
  if (typeof postId !== "string" || !UUID.test(postId)) return { ok: false, error: companyPostErrorCopy("post not found") };
  try {
    const db = await createClient();
    const { error } = await db.rpc("cpost1_delete_post", { p_post_id: postId });
    return error ? { ok: false, error: companyPostErrorCopy(error.message) } : { ok: true };
  } catch {
    return { ok: false, error: companyPostErrorCopy(null) };
  }
}

export async function reportCompanyPost(
  postId: string,
  reason: string,
  details: string,
): Promise<{ ok: true; hidden: boolean } | Failure> {
  if (typeof postId !== "string" || !UUID.test(postId)) return { ok: false, error: companyPostErrorCopy("post not found") };
  if (!isCompanyPostReportReason(reason)) return { ok: false, error: "Scegli il motivo della segnalazione." };
  const note = typeof details === "string" ? details.trim().slice(0, 2000) : "";
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("cpost1_report_post", {
      p_post_id: postId,
      p_reason: reason,
      p_details: note || null,
    });
    if (error) return { ok: false, error: companyPostErrorCopy(error.message) };
    return { ok: true, hidden: (data as { auto_hidden?: unknown } | null)?.auto_hidden === true };
  } catch {
    return { ok: false, error: companyPostErrorCopy(null) };
  }
}

/** CPOST2 type filter: one page of posts of a single type (keyset token as in the feed cursor). */
export async function loadCompanyPostsByType(
  postType: string,
  token: string,
): Promise<{ ok: true; items: CompanyPostItem[]; next: string | null } | Failure> {
  if (!isCompanyPostType(postType)) return { ok: false, error: companyPostErrorCopy("invalid post type") };
  const position = decodeCompanyPostsToken(token);
  if (position === "done") return { ok: true, items: [], next: null };
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("cpost2_feed", {
      p_limit: COMPANY_POSTS_PER_PAGE * 3,
      p_before_created_at: position === "start" ? null : position.beforeCreatedAt,
      p_before_id: position === "start" ? null : position.beforeId,
      p_post_type: postType,
    });
    const page = error ? null : parseCompanyPostsFeed(data);
    if (!page) return { ok: false, error: companyPostErrorCopy(error?.message ?? null) };
    return { ok: true, items: page.items, next: page.next ? encodeCompanyPostsToken(page.next) : null };
  } catch {
    return { ok: false, error: companyPostErrorCopy(null) };
  }
}

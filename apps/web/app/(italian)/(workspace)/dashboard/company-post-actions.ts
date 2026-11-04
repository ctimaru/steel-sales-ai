"use server";

import {
  COMPANY_POST_MAX_CHARS,
  companyPostErrorCopy,
  isCompanyPostReportReason,
  parseCompanyPostsFeed,
  type CompanyPostItem,
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

export async function createCompanyPost(body: string): Promise<{ ok: true; item: CompanyPostItem | null } | Failure> {
  const text = cleanBody(body);
  if (!text) return { ok: false, error: companyPostErrorCopy("empty") };
  if (text.length > COMPANY_POST_MAX_CHARS) return { ok: false, error: companyPostErrorCopy("exceeds") };
  try {
    const context = await getWorkspaceContext();
    const db = await createClient();
    const { data, error } = await db.rpc("cpost1_create_post", {
      p_organization_id: context.organizationId,
      p_body: text,
      p_language_code: "it",
    });
    if (error) return { ok: false, error: companyPostErrorCopy(error.message) };
    const postId = (data as { post_id?: unknown } | null)?.post_id;
    // Re-read through the feed so the card shows exactly what others will see.
    const feed = await db.rpc("cpost1_feed", { p_limit: 10 });
    const page = feed.error ? null : parseCompanyPostsFeed(feed.data);
    return { ok: true, item: page?.items.find((item) => item.id === postId) ?? null };
  } catch {
    return { ok: false, error: companyPostErrorCopy(null) };
  }
}

export async function editCompanyPost(postId: string, body: string): Promise<{ ok: true; body: string } | Failure> {
  const text = cleanBody(body);
  if (typeof postId !== "string" || !UUID.test(postId)) return { ok: false, error: companyPostErrorCopy("post not found") };
  if (!text) return { ok: false, error: companyPostErrorCopy("empty") };
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

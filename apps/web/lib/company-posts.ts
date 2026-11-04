import "server-only";

import {
  parseCompanyPostPublishState,
  parseCompanyPostQueue,
  parseCompanyPostSettings,
  type CompanyPostPublishState,
  type CompanyPostQueueItem,
  type CompanyPostSettings,
} from "@/lib/company-posts-model";
import { createClient } from "@/lib/supabase/server";

/**
 * CPOST1: may the session user publish for their own organization?
 * Fails soft: any error (or the feature switched off) hides the composer.
 */
export async function loadCompanyPostPublishState(organizationId: string): Promise<CompanyPostPublishState | null> {
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("cpost1_can_publish", { p_organization_id: organizationId });
    return error ? null : parseCompanyPostPublishState(data);
  } catch {
    return null;
  }
}

/** CPOST1 staff queue. The RPC requires network_trust.posts_read; null = not readable now. */
export async function loadCompanyPostModerationQueue(limit = 100): Promise<CompanyPostQueueItem[] | null> {
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("cpost1_staff_queue", { p_limit: limit });
    return error ? null : parseCompanyPostQueue(data);
  } catch {
    return null;
  }
}

/** CPOST1B: switch state for the console. Requires network_trust.posts_read; null = not readable now. */
export async function loadCompanyPostSettings(): Promise<CompanyPostSettings | null> {
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("cpost1_staff_settings");
    return error ? null : parseCompanyPostSettings(data);
  } catch {
    return null;
  }
}

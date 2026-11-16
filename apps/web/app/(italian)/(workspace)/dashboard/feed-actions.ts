"use server";

import { toggleNetworkSavedCompany } from "@/app/(workspace)/network/save-actions";
import { decodeHomeFeedCursor, type HomeFeedItem } from "@/lib/home-feed-model";
import { loadHomeFeedPage } from "@/lib/home-feed";
import { resolveHomeFeedViewer } from "@/lib/home-feed-viewer";


export async function loadMoreHomeFeed(cursor: string): Promise<{
  items: HomeFeedItem[];
  nextCursor: string | null;
  unavailable: string[];
}> {
  try {
    const viewer = await resolveHomeFeedViewer();
    return await loadHomeFeedPage(viewer, decodeHomeFeedCursor(cursor));
  } catch {
    return { items: [], nextCursor: null, unavailable: ["feed"] };
  }
}

/**
 * Save / unsave without leaving the Home. NET-SAVE-INLINE1: delegates to the one
 * Network writer so checks, analytics and revalidation stay identical everywhere.
 */
export async function toggleHomeFeedSavedCompany(companyId: string, save: boolean): Promise<{ ok: boolean; saved: boolean }> {
  const result = await toggleNetworkSavedCompany(companyId, save, "home_feed");
  return { ok: result.ok, saved: result.saved };
}

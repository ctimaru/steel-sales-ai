"use server";

import { revalidatePath } from "next/cache";

import { decodeHomeFeedCursor, type HomeFeedItem } from "@/lib/home-feed-model";
import { loadHomeFeedPage } from "@/lib/home-feed";
import { resolveHomeFeedViewer } from "@/lib/home-feed-viewer";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** Save / unsave without leaving the Home (the Network action redirects to /network). */
export async function toggleHomeFeedSavedCompany(companyId: string, save: boolean): Promise<{ ok: boolean; saved: boolean }> {
  if (typeof companyId !== "string" || !UUID.test(companyId)) return { ok: false, saved: !save };
  try {
    const viewer = await resolveHomeFeedViewer();
    if (!viewer.canInteract) return { ok: false, saved: !save };
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return { ok: false, saved: !save };
    // Same table, columns and RLS as saveNetworkCompany / removeSavedNetworkCompany.
    const { error } = save
      ? await supabase.from("network_saved_companies").upsert(
          { organization_id: viewer.organizationId, user_id: userId, network_company_id: companyId },
          { onConflict: "organization_id,user_id,network_company_id", ignoreDuplicates: true },
        )
      : await supabase
          .from("network_saved_companies")
          .delete()
          .eq("organization_id", viewer.organizationId)
          .eq("user_id", userId)
          .eq("network_company_id", companyId);
    if (error) return { ok: false, saved: !save };
    revalidatePath("/network/saved");
    return { ok: true, saved: save };
  } catch {
    return { ok: false, saved: !save };
  }
}

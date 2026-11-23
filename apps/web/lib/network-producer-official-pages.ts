import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Public source navigation, not a declaration of products or production capacity.
 * Only a tenant-gated RPC can read the private producer crawler's processed pages.
 * Fail closed for profiles not covered by the crawler or deployments before migration.
 */
export async function getNetworkProducerOfficialPages(
  organizationId: string,
  companyId: string,
  accessMode: "free" | "pro",
): Promise<string[]> {
  const db = await createClient();
  const { data, error } = await db.rpc("netprofile_prod1_official_pages", {
    p_organization_id: organizationId,
    p_company_id: companyId,
    p_access: accessMode,
  });
  if (error || data?.contract !== "netprofile-prod1-official-pages-v1"
    || !Array.isArray(data.items)) return [];

  const seen = new Set<string>();
  for (const item of data.items.slice(0, 4)) {
    if (typeof item?.url !== "string" || item.url.length > 1200) continue;
    try {
      const url = new URL(item.url);
      if (url.protocol !== "https:" || !url.hostname || url.username
        || url.password || (url.port && url.port !== "443")) continue;
      seen.add(url.toString());
    } catch {
      continue;
    }
  }
  return [...seen].slice(0, 4);
}

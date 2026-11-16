import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export type NetworkAccessState = {
  contract: string;
  organization_id: string;
  product_key: "network_access";
  state: "entitled" | "locked" | "expired" | "revoked";
  can_access_network: boolean;
  source_kind: string | null;
  source_reference: string | null;
  expires_at: string | null;
};

/**
 * NET-PROFILE-FAST1: memoized per request with React cache(). The workspace
 * layout, the page and requireNetworkAccess() used to call the same RPC up to
 * three times per page view; the answer cannot change within one request.
 */
export const getNetworkAccessState = cache(async function getNetworkAccessState(
  organizationId: string,
): Promise<NetworkAccessState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pa1_3_network_access_state", {
    p_organization_id: organizationId,
  });

  if (error || !data || typeof data !== "object") {
    throw new Error("network_access_state_unavailable");
  }

  return data as NetworkAccessState;
});

export async function requireNetworkAccess(
  fallback = "/network?locked=1",
) {
  const context = await getWorkspaceContext();
  const access = await getNetworkAccessState(context.organizationId);

  if (!access.can_access_network) redirect(fallback);

  return { context, access };
}

import "server-only";

import { canInteractWithNetwork, canWriteWorkspace } from "@/lib/access-policy";
import type { HomeFeedViewer } from "@/lib/home-feed";
import { getNetworkAccessState } from "@/lib/network-access";
import { isNetworkFreeReadEnabled, isNetworkFrontendEnabled } from "@/lib/network-flags";
import { getWorkspaceContext } from "@/lib/workspace-context";

/** HOME-FEED1: derive feed permissions from values the Home already computed. */
export function buildHomeFeedViewer(
  context: { organizationId: string; organizationName: string; role: string },
  networkEnabled: boolean,
  networkEntitled: boolean,
): HomeFeedViewer {
  const networkAccess = networkEntitled ? "pro" : networkEnabled && isNetworkFreeReadEnabled() ? "free" : null;
  return {
    organizationId: context.organizationId,
    organizationName: context.organizationName,
    networkAccess,
    // Saving and Connetti need the Pro entitlement and an interactive, writing role.
    canInteract: networkAccess === "pro" && canWriteWorkspace(context.role) && canInteractWithNetwork(context.role),
    isAdmin: context.role === "admin",
  };
}

/**
 * The viewer is always re-derived on the server from the session.
 * Nothing the browser sends (cursor included) can widen what is read.
 */
export async function resolveHomeFeedViewer(): Promise<HomeFeedViewer> {
  const context = await getWorkspaceContext();
  const networkEnabled = isNetworkFrontendEnabled();
  const entitled = networkEnabled
    ? await getNetworkAccessState(context.organizationId)
        .then((access) => access.can_access_network === true)
        .catch(() => false)
    : false;
  return buildHomeFeedViewer(context, networkEnabled, entitled);
}

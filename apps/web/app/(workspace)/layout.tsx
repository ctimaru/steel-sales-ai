import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { getNetworkAccessState } from "@/lib/network-access";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { parseWorkspaceNotificationSnapshot, type WorkspaceNotificationSnapshot } from "@/lib/workspace-notifications";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const metadata: Metadata = {
  robots: privateNoIndexRobots,
};

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  let viewerLabel = "demo@steel-sales-ai.local";
  let organizationName = "Demo Company";
  let organizationRole = "admin";
  let notificationSnapshot: WorkspaceNotificationSnapshot | null = null;
  let notificationVerifiedAt: string | null = null;
  let organizationId: string | null = null;
  let platformConsoleAccess = false;
  let guidedSetupComplete = true;
  const networkEnabled = isNetworkFrontendEnabled();
  let networkEntitled = !configured;

  if (configured) {
    const [context, supabase] = await Promise.all([
      getWorkspaceContext(),
      createClient(),
    ]);
    organizationId = context.organizationId;
    viewerLabel = context.viewerLabel;
    organizationName = context.organizationName;
    organizationRole = context.role;
    platformConsoleAccess = context.platformConsoleAccess;
    guidedSetupComplete = context.guidedSetupComplete;

    if (networkEnabled) {
      const networkAccess = await getNetworkAccessState(context.organizationId);
      networkEntitled = networkAccess.can_access_network;
    }

    // The bell must fail closed. RPC failures may not be represented as zero unread.
    try {
      const { data, error } = await supabase.rpc("nc31_workspace_notifications_read", {
        p_organization_id: context.organizationId,
        p_filter: "all",
        p_limit: 5,
        p_offset: 0,
      });
      notificationSnapshot = error ? null : parseWorkspaceNotificationSnapshot(data);
      notificationVerifiedAt = notificationSnapshot ? new Date().toISOString() : null;
    } catch {
      notificationSnapshot = null;
      notificationVerifiedAt = null;
    }
  }

  return (
    <AppShell
      viewerLabel={viewerLabel}
      organizationName={organizationName}
      organizationRole={organizationRole}
      demoMode={!configured}
      notificationSnapshot={notificationSnapshot}
      notificationVerifiedAt={notificationVerifiedAt}
      organizationId={organizationId}
      platformConsoleAccess={platformConsoleAccess}
      guidedSetupComplete={guidedSetupComplete}
      networkEnabled={networkEnabled}
      networkEntitled={networkEntitled}
    >
      {children}
    </AppShell>
  );
}

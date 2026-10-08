import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { getNetworkAccessState } from "@/lib/network-access";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { parseOperationalAlertSummary } from "@/lib/operational-alert-status";
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
  let alertNeedsAttention = false;
  let alertActiveCount = 0;
  let alertSummaryVerified = false;
  let platformConsoleAccess = false;
  let guidedSetupComplete = true;
  const networkEnabled = isNetworkFrontendEnabled();
  let networkEntitled = !configured;

  if (configured) {
    const [context, supabase] = await Promise.all([
      getWorkspaceContext(),
      createClient(),
    ]);
    viewerLabel = context.viewerLabel;
    organizationName = context.organizationName;
    organizationRole = context.role;
    platformConsoleAccess = context.platformConsoleAccess;
    guidedSetupComplete = context.guidedSetupComplete;

    if (networkEnabled) {
      const networkAccess = await getNetworkAccessState(context.organizationId);
      networkEntitled = networkAccess.can_access_network;
    }

    // Keep the rest of the workspace usable if the alert service fails.
    // An unavailable summary must show an unknown state, never a healthy zero.
    try {
      const { data, error } = await supabase.rpc("p1_operational_alerts_summary", {
        p_organization_id: context.organizationId,
      });
      const summary = error ? null : parseOperationalAlertSummary(data);
      if (summary) {
        alertSummaryVerified = true;
        alertNeedsAttention = summary.needs_attention;
        alertActiveCount = summary.active_count;
      }
    } catch {
      alertSummaryVerified = false;
    }
  }

  return (
    <AppShell
      viewerLabel={viewerLabel}
      organizationName={organizationName}
      organizationRole={organizationRole}
      demoMode={!configured}
      alertNeedsAttention={alertNeedsAttention}
      alertActiveCount={alertActiveCount}
      alertSummaryVerified={alertSummaryVerified}
      platformConsoleAccess={platformConsoleAccess}
      guidedSetupComplete={guidedSetupComplete}
      networkEnabled={networkEnabled}
      networkEntitled={networkEntitled}
    >
      {children}
    </AppShell>
  );
}

import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

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
  let platformSuperadmin = false;
  const networkEnabled = isNetworkFrontendEnabled();

  if (configured) {
    const context = await getWorkspaceContext();
    viewerLabel = context.viewerLabel;
    organizationName = context.organizationName;
    organizationRole = context.role;
    platformSuperadmin = context.platformSuperadmin;

    const supabase = await createClient();
    const { data: alertSummary } = await supabase.rpc("p1_operational_alerts_summary", {
      p_organization_id: context.organizationId,
    });

    if (alertSummary && typeof alertSummary === "object") {
      const summary = alertSummary as { needs_attention?: unknown; active_count?: unknown };
      alertNeedsAttention = summary.needs_attention === true;
      alertActiveCount = Math.max(0, Number(summary.active_count ?? 0) || 0);
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
      platformSuperadmin={platformSuperadmin}
      networkEnabled={networkEnabled}
    >
      {children}
    </AppShell>
  );
}

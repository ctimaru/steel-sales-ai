import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  let viewerLabel = "demo@steel-sales-ai.local";
  let alertNeedsAttention = false;
  let alertActiveCount = 0;
  let platformSuperadmin = false;

  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect("/login");

    viewerLabel = data.user.email ?? "Utente autenticato";
    await supabase.rpc("claim_pending_organization_invitations");

    const [{ data: memberships }, { data: superadminFlag }] = await Promise.all([
      supabase
        .from("organization_memberships")
        .select("organization_id,is_default,status")
        .eq("user_id", data.user.id)
        .eq("status", "active"),
      supabase.rpc("is_platform_superadmin"),
    ]);

    platformSuperadmin = superadminFlag === true;

    const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
    if (!membership) redirect("/onboarding");

    const { data: organization } = await supabase
      .from("organizations")
      .select("onboarding_status")
      .eq("id", membership.organization_id)
      .maybeSingle();
    if (!organization || organization.onboarding_status !== "completed") {
      redirect("/onboarding");
    }

    const { data: alertSummary } = await supabase.rpc("p1_operational_alerts_summary", {
      p_organization_id: membership.organization_id,
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
      demoMode={!configured}
      alertNeedsAttention={alertNeedsAttention}
      alertActiveCount={alertActiveCount}
      platformSuperadmin={platformSuperadmin}
    >
      {children}
    </AppShell>
  );
}

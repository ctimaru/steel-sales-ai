import { redirect } from "next/navigation";

import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID.test(id)) redirect(`${appRoutes.notifications}?unavailable=1`);

  const context = await getWorkspaceContext();
  const supabase = await createClient();
  let target: { type?: unknown; id?: unknown } | null = null;

  try {
    const { data, error } = await supabase.rpc("nc31_workspace_notification_destination", {
      p_recipient_id: id,
      p_organization_id: context.organizationId,
    });
    if (!error && data && typeof data === "object" && !Array.isArray(data)) {
      target = data as { type?: unknown; id?: unknown };
    }
  } catch {
    target = null;
  }

  const destinationId =
    typeof target?.id === "string" && UUID.test(target.id) ? target.id : null;

  if (target?.type === "rfq" && destinationId) {
    redirect(appRoutes.marketplace.rfqCampaign(destinationId));
  }
  if (target?.type === "marketplace" && destinationId) {
    redirect(appRoutes.marketplace.opportunity(destinationId));
  }
  if (target?.type === "uploads") redirect(appRoutes.operations.uploads);
  if (target?.type === "alerts") redirect(appRoutes.operations.alerts);

  redirect(`${appRoutes.notifications}?unavailable=1`);
}

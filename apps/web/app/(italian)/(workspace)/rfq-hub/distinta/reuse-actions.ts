"use server";

import { createBuyerRfqCampaign } from "@/app/(public)/distinta/actions";
import { getCommercialNetworkContext } from "@/lib/commercial-network-context";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceWriteRole } from "@/lib/workspace-context";

/**
 * NET-DISTINTA-REUSE1: turn an existing buyer-owned Distinta into a draft
 * request, or resume its preparation, with the originating Network supplier
 * pinned in step 2. No supplier is silently added and NO REQUEST IS SENT.
 * The UI is not a trust boundary: revalidate ownership, organization,
 * company publication/access and the campaign status on every click.
 */
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const PREPARATION = new Set(["draft", "ready"]);
export type ReuseNetworkDistintaResult =
  | { ok: true; href: string }
  | { ok: false; error: string };

export async function prepareSavedNetworkRdo(input: {
  distintaId: string;
  networkCompanyId: string;
}): Promise<ReuseNetworkDistintaResult> {
  if (!UUID.test(input.distintaId) || !UUID.test(input.networkCompanyId)) {
    return { ok: false, error: "Selezione non valida." };
  }
  const context = await requireWorkspaceWriteRole(appRoutes.rfqHub.home);
  const company = await getCommercialNetworkContext(context.organizationId, input.networkCompanyId)
    .catch(() => null);
  if (!company) {
    return { ok: false, error: "Questa azienda non è più disponibile per una richiesta." };
  }

  const db = await createClient();
  const { data: distinta, error: snapshotError } = await db.from("buyer_distintas")
    .select("id,line_count")
    .eq("id", input.distintaId)
    .eq("organization_id", context.organizationId)
    .eq("owner_user_id", context.userId)
    .is("archived_at", null)
    .gt("line_count", 0)
    .maybeSingle();
  if (snapshotError || !distinta) {
    return { ok: false, error: "Distinta non disponibile, archiviata o senza articoli." };
  }

  const { data: existing, error: lookupError } = await db.from("buyer_rfq_campaigns")
    .select("id,status")
    .eq("source_distinta_id", distinta.id)
    .eq("organization_id", context.organizationId)
    .eq("owner_user_id", context.userId)
    .limit(2);
  if (lookupError) {
    return { ok: false, error: "Impossibile verificare lo stato della richiesta." };
  }
  if ((existing ?? []).some((item) => !PREPARATION.has(item.status))) {
    return { ok: false, error: "Questa Distinta ha già una richiesta inviata o conclusa. Seleziona un'altra Distinta." };
  }

  const started = await createBuyerRfqCampaign(distinta.id);
  if (!started.ok || !started.rfqId) {
    return { ok: false, error: started.error || "Non è stato possibile preparare la RDO." };
  }

  // A concurrent transition to «sent» must not open a supplier-editing flow.
  const { data: campaign, error: campaignError } = await db.from("buyer_rfq_campaigns")
    .select("id,status")
    .eq("id", started.rfqId)
    .eq("source_distinta_id", distinta.id)
    .eq("organization_id", context.organizationId)
    .eq("owner_user_id", context.userId)
    .maybeSingle();
  if (campaignError || !campaign || !PREPARATION.has(campaign.status)) {
    return { ok: false, error: "La richiesta non è più modificabile. Aprila dal Centro RFQ." };
  }

  return {
    ok: true,
    href: appRoutes.rfqHub.campaign(campaign.id) + "?dal=" + encodeURIComponent(company.id),
  };
}

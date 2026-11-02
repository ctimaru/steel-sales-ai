import "server-only";

import { legalIdentityConfigured } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";
import type { RecipientReadinessStatus } from "@/lib/network-recipient-readiness";

/** NET-CONTACT1 — how a Network company can receive an RFQ.
 *  platform: active and connectable on the platform;
 *  email:    published company channel (generic mailbox on the company domain,
 *            reviewed under LR4) — the same rule rfqh2_add_supplier applies;
 *  none:     not reachable yet.
 * The address itself never leaves SQL. Before the migration is applied the
 * RPC is missing (PGRST202): fall back to readiness, i.e. platform-only.
 * RFQ-MAIL2: the email channel stays off until the controller identity is
 * configured (NEXT_PUBLIC_LEGAL_CONTROLLER_NAME/ADDRESS/PRIVACY_EMAIL); it
 * turns on with the first deployment that has those environment values.
 */
export function emailChannelEnabled(): boolean {
  return legalIdentityConfigured();
}
export type RfqChannel = "platform" | "email" | "none";
type Batch = { contract: "netcontact1-reach-v1"; items: { company_id: string; channel: RfqChannel }[] };
const CHANNELS = new Set<RfqChannel>(["platform", "email", "none"]);

export function channelFromReadiness(status: RecipientReadinessStatus | undefined): RfqChannel {
  return status === "available" || status === "connected" ? "platform" : "none";
}

export async function getNetworkRfqReachability(
  organizationId: string, ids: string[], readiness?: Map<string, RecipientReadinessStatus>,
): Promise<Map<string, RfqChannel>> {
  const distinct = [...new Set(ids)];
  if (!distinct.length) return new Map();
  if (distinct.length > 24) throw new Error("network_reachability_batch_too_large");
  const db = await createClient();
  const { data, error } = await db.rpc("netcontact1_rfq_reachability", {
    p_organization_id: organizationId, p_company_ids: distinct,
  });
  if (error) {
    if (error.code === "PGRST202" && readiness) {
      return new Map(distinct.map((id) => [id, channelFromReadiness(readiness.get(id))]));
    }
    throw new Error("network_reachability_unavailable");
  }
  const result = data as Batch | null;
  if (!result || result.contract !== "netcontact1-reach-v1" || !Array.isArray(result.items)) {
    throw new Error("network_reachability_invalid_contract");
  }
  const expected = new Set(distinct);
  const channels = new Map<string, RfqChannel>();
  for (const entry of result.items) {
    if (!entry || !expected.has(entry.company_id) || !CHANNELS.has(entry.channel)) {
      throw new Error("network_reachability_invalid_entry");
    }
    channels.set(entry.company_id, entry.channel === "email" && !emailChannelEnabled() ? "none" : entry.channel);
  }
  return channels;
}

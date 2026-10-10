import "server-only";

import { PLATFORM_IA_COCKPIT_SIGNALS } from "@/lib/platform-ia-contract";
import type { PlatformPermissionKey } from "@/lib/platform-access-contract";
import { createClient } from "@/lib/supabase/server";

export type PlatformCockpitKey = (typeof PLATFORM_IA_COCKPIT_SIGNALS)[number]["key"];

export type PlatformCockpitSignal = {
  key: PlatformCockpitKey;
  label: string;
  source: string;
  value: number | null;
  status: "verified" | "unavailable";
  verifiedAt: string | null;
};

export type PlatformCockpitSnapshot = {
  signals: PlatformCockpitSignal[];
  checkedAt: string | null;
};

type Payload = Record<string, unknown>;
type RpcResult = { data: unknown; error: { code?: string } | null };
type DomainRead = { payload: Payload | null; verifiedAt: string | null };

function record(value: unknown): Payload | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Payload
    : null;
}

function nonnegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function extract(read: DomainRead | undefined, ...fields: string[]): number | null {
  if (!read?.payload) return null;
  let current: unknown = read.payload;
  for (const field of fields) {
    const item = record(current);
    if (!item || !Object.prototype.hasOwnProperty.call(item, field)) return null;
    current = item[field];
  }
  return nonnegativeInteger(current);
}

/**
 * RPCs are permission-gated in private SQL implementations. Read only
 * authorized domains; ask for a single display row while SQL count fields
 * aggregate the full scope. Errors must never be represented as zero.
 */
export async function getPlatformCockpitSnapshot(
  context: { permissions: readonly PlatformPermissionKey[] },
): Promise<PlatformCockpitSnapshot> {
  const visible = PLATFORM_IA_COCKPIT_SIGNALS.filter((s) =>
    context.permissions.includes(s.permission)
  );
  if (visible.length === 0) return { signals: [], checkedAt: null };

  const supabase = await createClient();
  const allowed = (key: PlatformPermissionKey) => context.permissions.includes(key);

  async function safeRead(read: () => PromiseLike<RpcResult>): Promise<DomainRead> {
    try {
      const { data, error } = await read();
      const payload = error ? null : record(data);
      return { payload, verifiedAt: payload ? new Date().toISOString() : null };
    } catch {
      return { payload: null, verifiedAt: null };
    }
  }

  const [registrations, claims, discovery, networkTrust, knowledge] = await Promise.all([
    allowed("registrations.read")
      ? safeRead(() => supabase.rpc("hp6_registration_operations_queue", {
          p_status: null, p_query: null, p_limit: 1,
        }))
      : Promise.resolve(undefined),
    allowed("claims.read")
      ? safeRead(() => supabase.rpc("p3_6_admin_claim_queue", {
          p_status: null, p_limit: 1,
        }))
      : Promise.resolve(undefined),
    allowed("discovery.read")
      ? safeRead(() => supabase.rpc("p3_admin_discovery_queue", {
          p_status: "pending_review", p_limit: 1,
        }))
      : Promise.resolve(undefined),
    allowed("network_trust.read")
      ? safeRead(() => supabase.rpc("sa8_network_trust_queue", { p_limit: 1 }))
      : Promise.resolve(undefined),
    allowed("knowledge.read_drafts")
      ? safeRead(() => supabase.rpc("sa7_knowledge_queue", {
          p_workflow_status: null, p_limit: 1,
        }))
      : Promise.resolve(undefined),
  ]);

  const values: Record<PlatformCockpitKey, { value: number | null; date: string | null }> = {
    registrations_review: { value: extract(registrations, "summary", "pending_review"), date: registrations?.verifiedAt ?? null },
    registrations_activate: { value: extract(registrations, "summary", "ready_activation"), date: registrations?.verifiedAt ?? null },
    registration_identity_conflicts: { value: extract(registrations, "summary", "identity_conflicts"), date: registrations?.verifiedAt ?? null },
    claims_proof_pending: { value: extract(claims, "proof_pending"), date: claims?.verifiedAt ?? null },
    discovery_review: { value: extract(discovery, "total"), date: discovery?.verifiedAt ?? null },
    network_identity_candidates: { value: extract(networkTrust, "counts", "open_identity_candidates"), date: networkTrust?.verifiedAt ?? null },
    knowledge_review: { value: extract(knowledge, "in_review"), date: knowledge?.verifiedAt ?? null },
  };

  const signals = visible.map((definition) => {
    const item = values[definition.key];
    return {
      key: definition.key,
      label: definition.label,
      source: definition.source,
      value: item.value,
      status: item.value === null ? "unavailable" : "verified",
      verifiedAt: item.value === null ? null : item.date,
    } satisfies PlatformCockpitSignal;
  });

  const checkedAt = signals.reduce<string | null>((latest, item) => {
    if (!item.verifiedAt) return latest;
    return !latest || item.verifiedAt > latest ? item.verifiedAt : latest;
  }, null);

  return { signals, checkedAt };
}

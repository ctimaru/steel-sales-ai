/**
 * NET-UX1 — Network Experience & Free Social Graph Foundation.
 *
 * Pure domain contract only. This file intentionally does not alter PA1.3,
 * database RLS, RPC grants, or the existing production paywall.
 * A Free rollout requires verified backend read policies first.
 */
export const NETWORK_COMPANY_ROLES = [
  "producer",
  "trader_distributor",
  "processor_service_provider",
  "end_user",
] as const;

export type NetworkCompanyRole = (typeof NETWORK_COMPANY_ROLES)[number];

const discoveryPriority: Record<NetworkCompanyRole, readonly NetworkCompanyRole[]> = {
  producer: ["trader_distributor", "end_user", "processor_service_provider", "producer"],
  trader_distributor: ["end_user", "processor_service_provider", "producer", "trader_distributor"],
  processor_service_provider: ["trader_distributor", "end_user", "producer", "processor_service_provider"],
  end_user: ["trader_distributor", "processor_service_provider", "producer", "end_user"],
};

/** Priority affects presentation, never visibility: every category stays discoverable. */
export function recommendedNetworkRoles(viewerRole: NetworkCompanyRole | null): readonly NetworkCompanyRole[] {
  return viewerRole ? discoveryPriority[viewerRole] : NETWORK_COMPANY_ROLES;
}

export type NetworkDiscoveryCandidate = {
  id: string;
  roles: readonly { key: string }[];
};

/**
 * Stable ordering, client-side only, for the default unfiltered discovery view.
 * Explicit searches and filter selections must preserve server relevance ordering.
 * This helper never filters out a company or changes the underlying search total.
 */
export function orderNetworkDiscovery<T extends NetworkDiscoveryCandidate>(
  items: readonly T[],
  viewerRole: NetworkCompanyRole | null,
  explicitSearchOrFilter: boolean,
): T[] {
  if (!viewerRole || explicitSearchOrFilter) return [...items];
  const priority = recommendedNetworkRoles(viewerRole);
  const rank = (item: T) => {
    const ranks = item.roles.map((role) => priority.indexOf(role.key as NetworkCompanyRole))
      .filter((index) => index >= 0);
    return ranks.length ? Math.min(...ranks) : NETWORK_COMPANY_ROLES.length;
  };
  return items.map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map(({ item }) => item);
}

export type NetworkExperienceInput = {
  authenticated: boolean;
  activeOrganization: boolean;
  networkProEntitled: boolean;
  /** True ONLY after a reviewed RPC/RLS migration and multi-role acceptance. */
  freeReadBackendVerified: boolean;
};

/** Prospective product permissions; not yet wired to a runtime route. */
export function resolveNetworkExperience(input: NetworkExperienceInput) {
  const organizationReady = input.authenticated && input.activeOrganization;
  const basicRead = organizationReady && (input.networkProEntitled || input.freeReadBackendVerified);
  const pro = organizationReady && input.networkProEntitled;
  return {
    publicPreview: true,
    basicDirectory: basicRead,
    basicCompanyProfiles: basicRead,
    regionalDiscovery: basicRead,
    advancedTechnicalFilters: pro,
    savedCompanies: pro, // PA1.3 restrictive RLS still protects this table.
    following: pro, // Existing follow RPCs remain PA1.3-gated.
    intelligence: pro,
    connectionRequests: false, // NET-UX6 needs dedicated RPC/RLS, not follow or inquiry.
  } as const;
}

export type NetworkRelationshipState =
  | "none"
  | "outgoing_pending"
  | "incoming_pending"
  | "connected"
  | "declined"
  | "blocked";

/**
 * Social graph is Organization <-> Organization, never user <-> user.
 * Target must have an active, approved organization-to-Network-company link.
 * This pure function is NOT an authorization substitute for server RPCs/RLS.
 */
export function connectionRequestEligibility(input: {
  sourceOrganizationActive: boolean;
  sourceCanManageConnections: boolean;
  sourceNetworkCompanyId: string | null;
  targetNetworkCompanyId: string;
  targetPublished: boolean;
  targetOrganizationActiveAndLinked: boolean;
  relation: NetworkRelationshipState;
}) {
  if (!input.sourceOrganizationActive || !input.sourceCanManageConnections ||
      !input.sourceNetworkCompanyId) return { allowed: false, reason: "source_not_ready" } as const;
  if (input.sourceNetworkCompanyId === input.targetNetworkCompanyId)
    return { allowed: false, reason: "self_connection" } as const;
  if (!input.targetPublished || !input.targetOrganizationActiveAndLinked)
    return { allowed: false, reason: "target_unavailable" } as const;
  if (input.relation !== "none")
    return { allowed: false, reason: input.relation } as const;
  return { allowed: true, reason: "ready" } as const;
}

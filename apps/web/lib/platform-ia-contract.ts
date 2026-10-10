/**
 * PLR1 — Platform Information Architecture v1.
 *
 * A read-only design contract consumed from PLR2 onwards. This file DOES NOT
 * grant access, alter authorization, or implement a new menu. Server pages,
 * Server Actions, and Supabase RPC/RLS remain the source of authority.
 *
 * Every Platform route is inventoried. 'owner_only' is the PLANNED boundary;
 * if an existing route's guard differs, see docs/architecture/plr1-platform-ia-contract.md.
 */

import { appRoutes } from "@/lib/routes";
import type { PlatformPermissionKey } from "@/lib/platform-access-contract";

export const PLATFORM_IA_VERSION = "PLR1.v1.0" as const;

export const PLATFORM_IA_AREAS = [
  { key: "overview", label: "Centro di controllo", order: 0 },
  { key: "companies", label: "Aziende e accessi", order: 1 },
  { key: "network", label: "Network e fiducia", order: 2 },
  { key: "content", label: "Contenuti e laboratorio", order: 3 },
  { key: "growth", label: "Analytics e attivazione", order: 4 },
  { key: "strategy", label: "Strategia e investitori", order: 5 },
] as const;

export type PlatformIaAreaKey = (typeof PLATFORM_IA_AREAS)[number]["key"];

export type PlatformIaAccess =
  | { kind: "permission"; key: PlatformPermissionKey }
  | { kind: "owner_only" };

export type PlatformIaModule = {
  key: string;
  href: string;
  label: string;
  area: PlatformIaAreaKey;
  access: PlatformIaAccess;
  placement: "primary" | "secondary" | "utility";
  rollout: "ready_for_plr2" | "hold_for_guard_audit";
};

export const PLATFORM_IA_MODULES = [
  {
    key: "home", href: appRoutes.platform.home, label: "Centro di controllo",
    area: "overview", access: { kind: "permission", key: "platform.console.access" },
    placement: "primary", rollout: "ready_for_plr2",
  },
  {
    key: "notifications", href: appRoutes.platform.notifications, label: "Centro notifiche",
    area: "overview", access: { kind: "permission", key: "platform.console.access" },
    placement: "utility", rollout: "ready_for_plr2",
  },
  {
    key: "registrations", href: appRoutes.platform.registrations, label: "Registrazioni e attivazioni",
    area: "companies", access: { kind: "permission", key: "registrations.read" },
    placement: "primary", rollout: "ready_for_plr2",
  },
  {
    key: "people", href: appRoutes.platform.people, label: "Persone e deleghe",
    area: "companies", access: { kind: "owner_only" },
    placement: "secondary", rollout: "ready_for_plr2",
  },
  {
    key: "discovery", href: appRoutes.platform.discovery, label: "Discovery aziende",
    area: "network", access: { kind: "permission", key: "discovery.read" },
    placement: "primary", rollout: "ready_for_plr2",
  },
  {
    key: "claims", href: appRoutes.platform.claims, label: "Rivendicazioni profili",
    area: "network", access: { kind: "permission", key: "claims.read" },
    placement: "primary", rollout: "ready_for_plr2",
  },
  {
    key: "networkTrust", href: appRoutes.platform.networkTrust, label: "Verifiche e identità",
    area: "network", access: { kind: "permission", key: "network_trust.read" },
    placement: "primary", rollout: "ready_for_plr2",
  },
  {
    key: "knowledge", href: appRoutes.platform.knowledge, label: "Knowledge editoriale",
    area: "content", access: { kind: "permission", key: "knowledge.read_drafts" },
    placement: "primary", rollout: "ready_for_plr2",
  },
  {
    key: "steelPulse", href: "/platform/steel-pulse", label: "Steel Pulse editoriale",
    area: "content", access: { kind: "owner_only" },
    placement: "secondary", rollout: "ready_for_plr2",
  },
  {
    key: "privateLab", href: appRoutes.platform.novita, label: "Private Lab",
    area: "content", access: { kind: "owner_only" },
    placement: "secondary", rollout: "hold_for_guard_audit",
  },
  {
    key: "productAnalytics", href: appRoutes.platform.productAnalytics, label: "Product Analytics",
    area: "growth", access: { kind: "owner_only" },
    placement: "primary", rollout: "ready_for_plr2",
  },
  {
    key: "pilot", href: appRoutes.platform.pilot, label: "Pilot e attivazione",
    area: "growth", access: { kind: "owner_only" },
    placement: "primary", rollout: "ready_for_plr2",
  },
  {
    key: "businessPlan", href: appRoutes.platform.businessPlan, label: "Business Plan",
    area: "strategy", access: { kind: "owner_only" },
    placement: "primary", rollout: "ready_for_plr2",
  },
  {
    key: "marketing", href: appRoutes.platform.marketing, label: "Marketing e materiali",
    area: "strategy", access: { kind: "owner_only" },
    placement: "primary", rollout: "ready_for_plr2",
  },
  {
    key: "investorAccess", href: appRoutes.platform.investorAccess, label: "Accessi investitori",
    area: "strategy", access: { kind: "owner_only" },
    placement: "secondary", rollout: "ready_for_plr2",
  },
  {
    key: "fundraising", href: appRoutes.platform.fundraising, label: "Fundraising",
    area: "strategy", access: { kind: "owner_only" },
    placement: "secondary", rollout: "ready_for_plr2",
  },
  {
    key: "investorKpis", href: appRoutes.platform.investorKpis, label: "Investor KPI",
    area: "strategy", access: { kind: "owner_only" },
    placement: "secondary", rollout: "ready_for_plr2",
  },
] as const satisfies readonly PlatformIaModule[];

export type PlatformIaModuleKey = (typeof PLATFORM_IA_MODULES)[number]["key"];

/** Inventory of the app-router Platform page files (including nested paths). */
export const PLATFORM_IA_ROUTE_INVENTORY = [
  { path: "/platform", module: "home" },
  { path: "/platform/notifications", module: "notifications" },
  { path: "/platform/registrations", module: "registrations" },
  { path: "/platform/registrations/[id]", module: "registrations" },
  { path: "/platform/people", module: "people" },
  { path: "/platform/company-discovery", module: "discovery" },
  { path: "/platform/company-discovery/governance", module: "discovery" },
  { path: "/platform/company-claims", module: "claims" },
  { path: "/platform/network-trust", module: "networkTrust" },
  { path: "/platform/knowledge", module: "knowledge" },
  { path: "/platform/knowledge/[type]/[id]", module: "knowledge" },
  { path: "/platform/steel-pulse", module: "steelPulse" },
  { path: "/platform/novita", module: "privateLab" },
  { path: "/platform/novita/listini/[versionId]", module: "privateLab" },
  { path: "/platform/product-analytics", module: "productAnalytics" },
  { path: "/platform/pilot", module: "pilot" },
  { path: "/platform/business-plan", module: "businessPlan" },
  { path: "/platform/business-plan/details", module: "businessPlan" },
  { path: "/platform/marketing", module: "marketing" },
  { path: "/platform/marketing/one-pager", module: "marketing" },
  { path: "/platform/marketing/pitch-deck", module: "marketing" },
  { path: "/platform/marketing/investor-deck", module: "marketing" },
  { path: "/platform/marketing/visual-evidence-qa", module: "marketing" },
  { path: "/platform/marketing/fundraising-readiness", module: "marketing" },
  { path: "/platform/marketing/demo-room/[surface]", module: "marketing" },
  { path: "/platform/marketing/demo-room/companies", module: "marketing" },
  { path: "/platform/investor-access", module: "investorAccess" },
  { path: "/platform/fundraising", module: "fundraising" },
  { path: "/platform/investor-kpis", module: "investorKpis" },
] as const satisfies readonly { path: string; module: PlatformIaModuleKey }[];

/** No new privileges are created by these selectors. Call only with a verified server context. */
export function getPlatformIaVisibleModules(
  context: { is_platform_owner: boolean; permissions: readonly PlatformPermissionKey[] },
) {
  return PLATFORM_IA_MODULES.filter((module) => {
    if (module.rollout !== "ready_for_plr2") return false;
    return module.access.kind === "owner_only"
      ? context.is_platform_owner
      : context.permissions.includes(module.access.key);
  });
}

/**
 * PLR3 data source contract. Do not derive global totals from a paginated,
 * filtered or capped list (currently HP6 returns up to 200 applications).
 * Source unavailable or error => "da verificare", never pretend it equals 0.
 */
export const PLATFORM_IA_COCKPIT_SIGNALS = [
  { key: "registrations_review", label: "Registrazioni da revisionare", permission: "registrations.read", source: "hp6_registration_operations_queue.summary.pending_review", state: "aggregate_available" },
  { key: "registrations_activate", label: "Workspace da attivare", permission: "registrations.read", source: "hp6_registration_operations_queue.summary.ready_activation", state: "aggregate_available" },
  { key: "registration_identity_conflicts", label: "Conflitti identità", permission: "registrations.read", source: "hp6_registration_operations_queue.summary.identity_conflicts", state: "aggregate_available" },
  { key: "claims_proof_pending", label: "Claim da verificare", permission: "claims.read", source: "getAdminCompanyClaimQueue.proofPending", state: "validate_scope" },
  { key: "discovery_review", label: "Aziende da revisionare", permission: "discovery.read", source: "getCompanyDiscoveryQueue", state: "aggregate_required" },
  { key: "network_identity_candidates", label: "Identità in verifica", permission: "network_trust.read", source: "getNetworkTrustQueue.counts.open_identity_candidates", state: "validate_scope" },
  { key: "knowledge_review", label: "Knowledge in revisione", permission: "knowledge.read_drafts", source: "getPlatformKnowledgeQueue.inReview", state: "validate_scope" },
] as const satisfies readonly {
  key: string;
  label: string;
  permission: PlatformPermissionKey;
  source: string;
  state: "aggregate_available" | "validate_scope" | "aggregate_required";
}[];

/** Strict PLR3 requirements, not an implementation of the queue. */
export const PLATFORM_IA_QUEUE_POLICY = {
  scope: "authorized_domains_only",
  priorityOrder: ["identity_conflict", "registration_activation", "registration_review", "claim_proof", "discovery_review", "network_identity_review", "knowledge_review"],
  timestampMode: "server_source",
  unavailableLabel: "Dato da verificare",
  emptyLabel: "Nessuna attività in questa vista",
  allowPaginatedRowsAsGlobalCounters: false,
  revealTenantPrivateData: false,
  crossTenantJoin: false,
} as const;

export const PLATFORM_IA_GATES = {
  authorizedConsole: "platform.console.access",
  authoritySource: "requirePlatformConsoleContext + permission-checked RPCs",
  ownerSingleton: true,
  staffAccessMode: "explicit_permission_union",
  staffTenantDataAccess: false,
  ownerTenantDataAccessByDefault: false,
  staffSeesOwnerStrategy: false,
  internalPriceListsPublic: false,
  preserveUrls: true,
  noAutoActivation: true,
} as const;

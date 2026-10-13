/**
 * RQG2 — Review domains are deliberately independent authority scopes.
 * Platform queues come from governed platform modules; commercial review rows
 * remain owned by an organization and never flow into the Platform read model.
 * This catalogue is NAVIGATION only. RPC/RLS and Server Action gates decide.
 */
import { appRoutes } from "@/lib/routes";
import type { PlatformPermissionKey } from "@/lib/platform-access-contract";

export type PlatformReviewLane = {
  key: "registrations" | "claims" | "discovery" | "network_trust" | "knowledge";
  title: string;
  description: string;
  href: string;
  readPermission: PlatformPermissionKey;
  decisionPermission: PlatformPermissionKey;
};

export const PLATFORM_REVIEW_LANES: readonly PlatformReviewLane[] = [
  {
    key: "registrations",
    title: "Registrazioni e attivazioni",
    description: "Identità del richiedente e ammissione di nuove aziende alla piattaforma.",
    href: appRoutes.platform.registrations,
    readPermission: "registrations.read",
    decisionPermission: "registrations.review",
  },
  {
    key: "claims",
    title: "Rivendicazioni dei profili",
    description: "Prove di titolarità dei profili nel Network pubblico.",
    href: appRoutes.platform.claims,
    readPermission: "claims.read",
    decisionPermission: "claims.review_proof",
  },
  {
    key: "discovery",
    title: "Discovery e fonti",
    description: "Qualità delle fonti, duplicati e candidati prima della pubblicazione.",
    href: appRoutes.platform.discovery,
    readPermission: "discovery.read",
    decisionPermission: "discovery.review",
  },
  {
    key: "network_trust",
    title: "Identità e fiducia Network",
    description: "Verifiche e conflitti di identità sulle aziende del Network.",
    href: appRoutes.platform.networkTrust,
    readPermission: "network_trust.read",
    decisionPermission: "network_trust.review_changes",
  },
  {
    key: "knowledge",
    title: "Qualità Knowledge",
    description: "Norme, gradi, fonti e contenuti editoriali prima della pubblicazione.",
    href: appRoutes.platform.knowledge,
    readPermission: "knowledge.read_drafts",
    decisionPermission: "knowledge.review",
  },
] as const;

export function visiblePlatformReviewLanes(permissions: readonly PlatformPermissionKey[]) {
  return PLATFORM_REVIEW_LANES.filter((lane) => permissions.includes(lane.readPermission));
}

export const COMPANY_REVIEW_BOUNDARY = {
  route: appRoutes.operations.review,
  owner: "active_organization",
  reviewer: "active_organization_admin",
  data: "commercial_review_queue",
  source: "private_commercial_evidence",
} as const;

export const PLATFORM_REVIEW_BOUNDARY = {
  route: appRoutes.platform.review,
  owner: "platform",
  reviewer: "platform_staff_with_explicit_domain_permission",
  data: "existing_governed_platform_queues",
  includesTenantCommercialReview: false,
} as const;

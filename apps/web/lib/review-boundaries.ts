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
  decisionActions: readonly { label: string; permission: PlatformPermissionKey }[];
};

export const PLATFORM_REVIEW_LANES: readonly PlatformReviewLane[] = [
  {
    key: "registrations",
    title: "Registrazioni e attivazioni",
    description: "Identità del richiedente e ammissione di nuove aziende alla piattaforma.",
    href: appRoutes.platform.registrations,
    readPermission: "registrations.read",
    decisionActions: [
      { label: "Esamina", permission: "registrations.review" },
      { label: "Chiedi integrazioni", permission: "registrations.request_information" },
      { label: "Approva", permission: "registrations.approve" },
      { label: "Rifiuta", permission: "registrations.reject" },
      { label: "Attiva", permission: "registrations.activate" },
      { label: "Collega al Network", permission: "registrations.bridge_network" },
    ],
  },
  {
    key: "claims",
    title: "Rivendicazioni dei profili",
    description: "Prove di titolarità dei profili nel Network pubblico.",
    href: appRoutes.platform.claims,
    readPermission: "claims.read",
    decisionActions: [
      { label: "Verifica prova", permission: "claims.review_proof" },
      { label: "Approva claim", permission: "claims.approve" },
      { label: "Rifiuta claim", permission: "claims.reject" },
      { label: "Revoca claim", permission: "claims.revoke" },
    ],
  },
  {
    key: "discovery",
    title: "Discovery e fonti",
    description: "Qualità delle fonti, duplicati e candidati prima della pubblicazione.",
    href: appRoutes.platform.discovery,
    readPermission: "discovery.read",
    decisionActions: [
      { label: "Revisiona candidato", permission: "discovery.review" },
      { label: "Pubblica", permission: "discovery.publish" },
      { label: "Arricchisci", permission: "discovery.enrich" },
      { label: "Chiudi duplicati", permission: "discovery.close_duplicates" },
      { label: "Valida fonti", permission: "discovery.governance_review" },
    ],
  },
  {
    key: "network_trust",
    title: "Identità e fiducia Network",
    description: "Verifiche e conflitti di identità sulle aziende del Network.",
    href: appRoutes.platform.networkTrust,
    readPermission: "network_trust.read",
    decisionActions: [
      { label: "Verifica", permission: "network_trust.verify" },
      { label: "Revoca verifica", permission: "network_trust.revoke" },
      { label: "Decidi conflitto", permission: "network_trust.review_changes" },
      { label: "Decidi identità", permission: "network_trust.identity_review" },
    ],
  },
  {
    key: "knowledge",
    title: "Qualità Knowledge",
    description: "Norme, gradi, fonti e contenuti editoriali prima della pubblicazione.",
    href: appRoutes.platform.knowledge,
    readPermission: "knowledge.read_drafts",
    decisionActions: [
      { label: "Revisiona", permission: "knowledge.review" },
      { label: "Pubblica", permission: "knowledge.publish" },
    ],
  },
] as const;

export function visiblePlatformReviewLanes(permissions: readonly PlatformPermissionKey[]) {
  return PLATFORM_REVIEW_LANES.filter((lane) => permissions.includes(lane.readPermission));
}

/** UI guidance only; destination Actions and RPCs must independently authorize decisions. */
export function allowedPlatformReviewDecisions(
  lane: PlatformReviewLane, permissions: readonly PlatformPermissionKey[],
) {
  return lane.decisionActions.filter((action) => permissions.includes(action.permission));
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

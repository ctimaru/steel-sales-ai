import Link from "next/link";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { FocusHeader, FocusLink, FocusPage, FocusPanel } from "@/components/focus-ui";
import { getAdminCompanyClaimQueue } from "@/lib/company-claims";
import { getPlatformKnowledgeQueue } from "@/lib/platform-knowledge";
import { getNetworkTrustQueue } from "@/lib/platform-network-trust";
import {
  getRegistrationQueue,
  requirePlatformConsoleContext,
} from "@/lib/platform-admin";

export default async function PlatformHomePage() {
  const context = await requirePlatformConsoleContext();
  const canReadRegistrations = context.permissions.includes("registrations.read");
  const canReadDiscovery = context.permissions.includes("discovery.read");
  const canReadClaims = context.permissions.includes("claims.read");
  const canReadKnowledge = context.permissions.includes("knowledge.read_drafts");
  const canReadNetworkTrust = context.permissions.includes("network_trust.read");

  const [queue, claimQueue, knowledgeQueue, networkTrustQueue] = await Promise.all([
    canReadRegistrations ? getRegistrationQueue() : Promise.resolve(null),
    canReadClaims ? getAdminCompanyClaimQueue() : Promise.resolve(null),
    canReadKnowledge ? getPlatformKnowledgeQueue() : Promise.resolve(null),
    canReadNetworkTrust ? getNetworkTrustQueue() : Promise.resolve(null),
  ]);

  const counts = (queue?.applications ?? []).reduce<Record<string, number>>(
    (acc, application) => {
      acc[application.application_status] =
        (acc[application.application_status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const needsAttention =
    (counts.pending_review ?? 0) +
    (counts.needs_information ?? 0) +
    (counts.approved ?? 0);

  const hasAnyModule =
    context.is_platform_owner ||
    canReadRegistrations ||
    canReadDiscovery ||
    canReadClaims ||
    canReadKnowledge ||
    canReadNetworkTrust;

  return (
    <FocusPage>
      <FocusHeader
        eyebrow="Platform"
        title={context.is_platform_owner ? "Governance della piattaforma" : "Operazioni abilitate"}
        description={
          context.is_platform_owner
            ? "Mostra prima ciò che richiede una decisione. Gli strumenti amministrativi secondari restano compatti e separati dalla Commercial Memory dei tenant."
            : "Vedi soltanto i moduli consentiti dal tuo role template. L’accesso Platform non apre i dati commerciali privati delle aziende."
        }
      />

      {canReadRegistrations && needsAttention > 0 ? (
        <Link
          href="/platform/registrations"
          className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">Priorità</p>
            <p className="mt-1 text-lg font-semibold text-amber-950">
              {needsAttention} registrazioni richiedono attenzione
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Review, richiesta informazioni o activation.
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-amber-900">Apri →</span>
        </Link>
      ) : null}

      {canReadRegistrations ? (
        <FocusPanel muted>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {[
              ["Da revisionare", counts.pending_review ?? 0],
              ["In attesa dati", counts.needs_information ?? 0],
              ["Da attivare", counts.approved ?? 0],
              ["Attivati", counts.activated ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <p className="metric-number text-2xl font-semibold text-[#1d2824]">{Number(value)}</p>
                <p className="mt-1 text-xs text-[#66736e]">{label}</p>
              </div>
            ))}
          </div>
        </FocusPanel>
      ) : null}

      {hasAnyModule ? (
        <FocusPanel>
          <p className="app-kicker">Moduli</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {context.is_platform_owner ? (
              <FocusLink
                href="/platform/people"
                title="People & Access"
                description="Ruoli, deleghe e accessi Platform."
                meta="Governance"
              />
            ) : null}
            {canReadRegistrations ? (
              <FocusLink
                href="/platform/registrations"
                title="Registrazioni aziende"
                description="Review e attivazione delle nuove aziende."
              />
            ) : null}
            {canReadDiscovery ? (
              <FocusLink
                href="/platform/company-discovery"
                title="Company Discovery"
                description="Discovery e revisione delle aziende pubbliche."
              />
            ) : null}
            {canReadClaims ? (
              <FocusLink
                href="/platform/company-claims"
                title="Company Claims"
                description={`${claimQueue?.proofPending ?? 0} proof da verificare su ${claimQueue?.total ?? 0} claim visibili.`}
              />
            ) : null}
            {canReadKnowledge ? (
              <FocusLink
                href="/platform/knowledge"
                title="Knowledge Operations"
                description={`${knowledgeQueue?.inReview ?? 0} in revisione · ${knowledgeQueue?.approved ?? 0} approvati · ${knowledgeQueue?.published ?? 0} live.`}
              />
            ) : null}
            {canReadNetworkTrust ? (
              <FocusLink
                href="/platform/network-trust"
                title="Network Trust"
                description={`${networkTrustQueue?.counts.open_identity_candidates ?? 0} identity candidate · ${networkTrustQueue?.counts.open_change_reviews ?? 0} change review.`}
              />
            ) : null}
            {context.is_platform_owner ? (
              <FocusLink
                href="/platform/pilot"
                title="Pilot Cohort & Activation"
                description="Prerequisiti e attivazione del pilot commerciale."
                meta="Pilot"
              />
            ) : null}
          </div>
        </FocusPanel>
      ) : (
        <FirstUseEmptyState
          eyebrow="Accesso Platform"
          title="Nessun modulo operativo ancora abilitato"
          description="Il tuo account Platform Staff è attivo, ma i ruoli assegnati non concedono ancora accesso a un dominio operativo."
          primaryAction={{ href: "/staff/access", label: "Controlla il mio accesso" }}
          secondaryAction={{ href: "/dashboard", label: "Torna al workspace" }}
          note="Le autorizzazioni Platform sono separate dai ruoli aziendali."
        />
      )}
    </FocusPage>
  );
}

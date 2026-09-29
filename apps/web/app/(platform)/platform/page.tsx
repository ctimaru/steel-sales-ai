import Link from "next/link";

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
  const queue = canReadRegistrations ? await getRegistrationQueue() : null;
  const claimQueue = canReadClaims ? await getAdminCompanyClaimQueue() : null;
  const knowledgeQueue = canReadKnowledge ? await getPlatformKnowledgeQueue() : null;
  const networkTrustQueue = canReadNetworkTrust ? await getNetworkTrustQueue() : null;
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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="platform-surface rounded-3xl p-6 sm:p-8">
        <p className="platform-kicker">Platform Control Plane</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#18263d] sm:text-4xl">
          {context.is_platform_owner
            ? "Governance della piattaforma"
            : "Il tuo spazio operativo Platform"}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66768d]">
          {context.is_platform_owner
            ? "Governa staff, registrazioni e processi globali mantenendo separata la Commercial Memory dei tenant."
            : "Qui trovi solo le aree abilitate dai tuoi role template. L’accesso Platform non concede automaticamente accesso ai workspace o ai dati commerciali privati delle aziende."}
        </p>
      </section>

      {canReadRegistrations ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Da revisionare", counts.pending_review ?? 0],
              ["In attesa dati", counts.needs_information ?? 0],
              ["Approvate da attivare", counts.approved ?? 0],
              ["Tenant attivati", counts.activated ?? 0],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-[#dce2df] bg-white p-5"
              >
                <p className="metric-number text-3xl font-semibold text-[#1d2824]">
                  {Number(value)}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#66736e]">
                  {label}
                </p>
              </div>
            ))}
          </section>

          {needsAttention > 0 ? (
            <Link
              href="/platform/registrations"
              className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">
                  Richiede attenzione
                </p>
                <p className="mt-1 text-lg font-semibold text-amber-950">
                  {needsAttention} registrazioni da gestire
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Review, richiesta informazioni o activation in base ai tuoi permessi.
                </p>
              </div>
              <span className="text-sm font-semibold text-amber-900">
                Apri registrazioni →
              </span>
            </Link>
          ) : null}
        </>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        {context.is_platform_owner ? (
          <Link
            href="/platform/pilot"
            className="rounded-2xl border border-[#dce2df] bg-white p-6 transition hover:border-[#b8d2c8] hover:shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
              P5.6 · Commercial Pilot
            </p>
            <h2 className="mt-3 text-lg font-semibold text-[#1d2824]">
              Pilot Cohort &amp; Activation
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Seleziona buyer e supplier reali, verifica i prerequisiti e controlla l’attivazione del cohort senza generare usage sintetico.
            </p>
          </Link>
        ) : null}

        {context.is_platform_owner ? (
          <Link
            href="/platform/people"
            className="rounded-2xl border border-[#dce2df] bg-white p-6 transition hover:border-[#b8d2c8] hover:shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
              Governance
            </p>
            <h2 className="mt-3 text-lg font-semibold text-[#1d2824]">
              People &amp; Access
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Invita amministratori delegati, assegna role template prestabiliti e governa sospensione o revoca degli accessi.
            </p>
          </Link>
        ) : null}

        {canReadRegistrations ? (
          <Link
            href="/platform/registrations"
            className="rounded-2xl border border-[#dce2df] bg-white p-6 transition hover:border-[#b8d2c8] hover:shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
              Companies
            </p>
            <h2 className="mt-3 text-lg font-semibold text-[#1d2824]">
              Registrazioni aziende
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Revisiona le nuove aziende e completa le sole azioni consentite dal tuo profilo Platform.
            </p>
          </Link>
        ) : null}

        {canReadDiscovery ? (
          <Link
            href="/platform/company-discovery"
            className="rounded-2xl border border-[#dce2df] bg-white p-6 transition hover:border-[#b8d2c8] hover:shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
              Network population
            </p>
            <h2 className="mt-3 text-lg font-semibold text-[#1d2824]">
              Company Discovery
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Avvia o revisiona discovery pubbliche secondo le permission del tuo role template, senza accesso ai dati commerciali dei tenant.
            </p>
          </Link>
        ) : null}

        {canReadClaims ? (
          <Link
            href="/platform/company-claims"
            className="rounded-2xl border border-[#dce2df] bg-white p-6 transition hover:border-[#b8d2c8] hover:shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
              Trust &amp; ownership
            </p>
            <h2 className="mt-3 text-lg font-semibold text-[#1d2824]">
              Company Claims
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              {claimQueue?.proofPending ?? 0} ownership proof da verificare su {claimQueue?.total ?? 0} claim visibili.
            </p>
          </Link>
        ) : null}

        {canReadKnowledge ? (
          <Link
            href="/platform/knowledge"
            className="rounded-2xl border border-[#dce2df] bg-white p-6 transition hover:border-[#b8d2c8] hover:shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
              Public Knowledge
            </p>
            <h2 className="mt-3 text-lg font-semibold text-[#1d2824]">
              Knowledge Operations
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              {knowledgeQueue?.inReview ?? 0} in revisione · {knowledgeQueue?.approved ?? 0} approvati · {knowledgeQueue?.published ?? 0} live.
            </p>
          </Link>
        ) : null}

        {canReadNetworkTrust ? (
          <Link
            href="/platform/network-trust"
            className="rounded-2xl border border-[#dce2df] bg-white p-6 transition hover:border-[#b8d2c8] hover:shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
              Trust &amp; moderation
            </p>
            <h2 className="mt-3 text-lg font-semibold text-[#1d2824]">
              Network Trust
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              {networkTrustQueue?.counts.open_identity_candidates ?? 0} identity candidate · {networkTrustQueue?.counts.open_change_reviews ?? 0} change review · {networkTrustQueue?.counts.current_verifications ?? 0} verification correnti.
            </p>
          </Link>
        ) : null}
      </section>

      {!context.is_platform_owner && !canReadRegistrations && !canReadDiscovery && !canReadClaims && !canReadKnowledge && !canReadNetworkTrust ? (
        <section className="rounded-3xl border border-dashed border-[#cfdbea] bg-white/80 px-6 py-10 text-center">
          <p className="font-semibold text-[#1d2824]">
            Nessun modulo operativo ancora abilitato
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#7a899d]">
            Il tuo account Platform Staff è attivo, ma i domini associati ai tuoi ruoli non sono ancora stati portati sul nuovo permission model.
          </p>
        </section>
      ) : null}
    </div>
  );
}

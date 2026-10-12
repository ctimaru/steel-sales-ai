import Link from "next/link";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { FocusHeader, FocusPage } from "@/components/focus-ui";
import {
  PLATFORM_IA_AREAS,
  PLATFORM_IA_QUEUE_POLICY,
  getPlatformIaVisibleModules,
} from "@/lib/platform-ia-contract";
import {
  getPlatformCockpitSnapshot,
  type PlatformCockpitKey,
  type PlatformCockpitSignal,
} from "@/lib/platform-cockpit";
import { requirePlatformConsoleContext } from "@/lib/platform-admin";
import type { PlatformPermissionKey } from "@/lib/platform-access-contract";

export const dynamic = "force-dynamic";

type NextStep = {
  href: string;
  title: string;
  detail: string;
  actionPermission?: PlatformPermissionKey;
};

const SIGNAL_NEXT_STEP: Record<PlatformCockpitKey, NextStep> = {
  registration_identity_conflicts: {
    href: "/platform/registrations",
    title: "Conflitti d'identità",
    detail: "Controlla i profili prima dell'attivazione.",
    actionPermission: "registrations.bridge_network",
  },
  registrations_activate: {
    href: "/platform/registrations?status=approved",
    title: "Workspace da attivare",
    detail: "Le approvazioni non attivano automaticamente l'azienda.",
    actionPermission: "registrations.activate",
  },
  registrations_review: {
    href: "/platform/registrations?status=pending_review",
    title: "Registrazioni aziende",
    detail: "Richieste in attesa di una decisione.",
    actionPermission: "registrations.approve",
  },
  claims_proof_pending: {
    href: "/platform/company-claims",
    title: "Company Claims",
    detail: "Verifica le prove di proprietà dei profili.",
    actionPermission: "claims.review_proof",
  },
  discovery_review: {
    href: "/platform/company-discovery?status=pending_review",
    title: "Company Discovery",
    detail: "Candidati da esaminare prima della pubblicazione nel Network.",
    actionPermission: "discovery.review",
  },
  network_identity_candidates: {
    href: "/platform/network-trust",
    title: "Network Trust",
    detail: "Possibili corrispondenze d'identità da verificare.",
    actionPermission: "network_trust.identity_review",
  },
  knowledge_review: {
    href: "/platform/knowledge",
    title: "Knowledge Operations",
    detail: "Contenuti editoriali in revisione.",
    actionPermission: "knowledge.review",
  },
};

const PRIORITY_ORDER: readonly PlatformCockpitKey[] = [
  "registration_identity_conflicts",
  "registrations_activate",
  "registrations_review",
  "claims_proof_pending",
  "discovery_review",
  "network_identity_candidates",
  "knowledge_review",
];

function compactNumber(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("it-IT").format(value);
}

function friendlyTime(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(iso));
}

function MetricCard({ signal }: { signal: PlatformCockpitSignal }) {
  const step = SIGNAL_NEXT_STEP[signal.key];
  return (
    <Link
      href={step.href}
      className="group flex min-h-28 flex-col justify-between gap-3 rounded-2xl border border-[#dce2df] bg-white p-4 transition hover:border-[#96b9aa] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5a]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold text-[#53635d]">{signal.label}</span>
        <span aria-hidden="true" className="text-sm text-[#497469]">↗</span>
      </div>
      <div>
        <p className="metric-number text-3xl font-semibold tabular-nums text-[#1d2824]">
          {compactNumber(signal.value)}
        </p>
        {signal.status === "unavailable" ? (
          <p className="mt-1 text-xs text-amber-800">{PLATFORM_IA_QUEUE_POLICY.unavailableLabel}</p>
        ) : (
          <p className="mt-1 text-xs text-[#66736e]">Dato aggregato della coda</p>
        )}
      </div>
    </Link>
  );
}

export default async function PlatformHomePage() {
  const context = await requirePlatformConsoleContext();
  const canReadRegistrations = context.permissions.includes("registrations.read");
  const canReadDiscovery = context.permissions.includes("discovery.read");
  const canReadClaims = context.permissions.includes("claims.read");
  const canReadKnowledge = context.permissions.includes("knowledge.read_drafts");
  const canReadNetworkTrust = context.permissions.includes("network_trust.read");

  const availableModules = getPlatformIaVisibleModules(context);
  const domainModules = availableModules.filter(
    (module) => module.key !== "home" && module.placement !== "utility"
  );
  const hasAnyModule =
    context.is_platform_owner ||
    canReadRegistrations ||
    canReadDiscovery ||
    canReadClaims ||
    canReadKnowledge ||
    canReadNetworkTrust;

  const cockpit = await getPlatformCockpitSnapshot(context);
  const priorities = PRIORITY_ORDER
    .map((key) => cockpit.signals.find((item) => item.key === key))
    .filter((item): item is PlatformCockpitSignal =>
      Boolean(item && item.status === "verified" && item.value !== null && item.value > 0)
    );
  const unavailable = cockpit.signals.filter((item) => item.status === "unavailable");
  const operationalGroups = PLATFORM_IA_AREAS.filter((group) => group.key !== "overview")
    .map((group) => ({
      key: group.key,
      label: group.label,
      modules: domainModules.filter((module) => module.area === group.key),
    }))
    .filter((group) => group.modules.length > 0);
  const keyMetrics: readonly PlatformCockpitKey[] = [
    "registrations_review", "registrations_activate", "claims_proof_pending", "discovery_review",
  ];
  const overviewMetrics = [
    ...keyMetrics.map((key) => cockpit.signals.find((item) => item.key === key))
      .filter((item): item is PlatformCockpitSignal => Boolean(item)),
    ...cockpit.signals.filter((item) => !keyMetrics.includes(item.key)),
  ].slice(0, 4);

  return (
    <FocusPage className="space-y-5 sm:space-y-6">
      <FocusHeader
        eyebrow="Platform · Control Center"
        title={context.is_platform_owner ? "Governance della piattaforma" : "Operazioni abilitate"}
        description={
          context.is_platform_owner
            ? "Priorità e code operative di Smart Steel Sales. La gestione globale resta separata dai dati commerciali privati delle aziende."
            : "Vedi soltanto le operazioni delegate al tuo ruolo. I dati commerciali privati delle aziende rimangono separati."
        }
        actions={
          <Link href="/platform/notifications" className="inline-flex min-h-10 items-center rounded-xl border border-[#dce2df] bg-white px-4 text-sm font-semibold text-[#1a5144] hover:bg-[#f2f7f4]">
            Centro notifiche ↗
          </Link>
        }
      />

      {!hasAnyModule ? (
        <FirstUseEmptyState
          eyebrow="Accesso Platform"
          title="Nessun modulo operativo ancora abilitato"
          description="Il tuo account Platform Staff è attivo, ma i ruoli assegnati non concedono ancora accesso a un dominio operativo."
          primaryAction={{ href: "/staff/access", label: "Controlla il mio accesso" }}
          note="Le autorizzazioni Platform sono separate dai ruoli aziendali."
        />
      ) : (
        <>
          {overviewMetrics.length > 0 ? (
            <section aria-labelledby="platform-indicators">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <h2 id="platform-indicators" className="text-lg font-semibold text-[#1d2824]">
                  Stato operativo
                </h2>
                <p className="text-xs text-[#66736e]">
                  {cockpit.checkedAt
                    ? "Code consultate alle " + friendlyTime(cockpit.checkedAt) + " (Roma)"
                    : "Dati da verificare"}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {overviewMetrics.map((signal) => <MetricCard key={signal.key} signal={signal} />)}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="platform-attention" className="rounded-2xl border border-[#dce2df] bg-white p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="platform-attention" className="text-lg font-semibold text-[#1d2824]">
                  Cosa richiede attenzione
                </h2>
                <p className="mt-1 text-xs text-[#66736e]">
                  Code con attività operative, ordinate per priorità.
                </p>
              </div>
              <span className="text-xs text-[#66736e]">
                {priorities.length} {priorities.length === 1 ? "coda aperta" : "code aperte"}
              </span>
            </div>
            {priorities.length > 0 ? (
              <ul className="divide-y divide-[#e7ece9]">
                {priorities.map((signal) => {
                  const step = SIGNAL_NEXT_STEP[signal.key];
                  const canAct = !step.actionPermission ||
                    context.permissions.includes(step.actionPermission);
                  return (
                    <li key={signal.key}>
                      <Link href={step.href} className="group flex min-h-16 items-start justify-between gap-3 rounded-lg px-1 py-3 hover:bg-[#f7faf8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5a]">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#1d2824]">{step.title}</p>
                          <p className="mt-1 text-xs leading-5 text-[#66736e]">{step.detail}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <strong className="metric-number text-base tabular-nums text-[#173f35]">
                            {compactNumber(signal.value)}
                          </strong>
                          <span className="hidden text-xs font-semibold text-[#1a5144] sm:inline">
                            {canAct ? "Gestisci" : "Consulta"} →
                          </span>
                          <span className="text-[#1a5144] sm:hidden" aria-hidden="true">→</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-xl bg-[#f4f7f5] px-4 py-4 text-sm text-[#52615b]">
                {unavailable.length > 0
                  ? "Nessuna priorità confermata dalle fonti disponibili. Alcune code non sono verificabili."
                  : PLATFORM_IA_QUEUE_POLICY.emptyLabel}
              </p>
            )}
            {unavailable.length > 0 ? (
              <div className="mt-3 border-t border-[#e7ece9] pt-3" role="status">
                <p className="text-xs font-semibold text-amber-800">
                  {unavailable.length} {unavailable.length === 1
                    ? "fonte da verificare" : "fonti da verificare"} — nessun valore è stato sostituito con zero.
                </p>
                <p className="mt-1 text-xs leading-5 text-[#66736e]">
                  {unavailable.map((s) => s.label).join(" · ")}
                </p>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="platform-areas">
            <h2 id="platform-areas" className="text-lg font-semibold text-[#1d2824]">
              Aree di gestione
            </h2>
            <p className="mb-3 mt-1 text-xs text-[#66736e]">
              Strumenti disponibili per il tuo ruolo.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {operationalGroups.map((group) => (
                <section key={group.key} aria-label={group.label} className="rounded-2xl border border-[#dce2df] bg-white p-4">
                  <h3 className="text-sm font-semibold text-[#173f35]">{group.label}</h3>
                  <p className="mb-3 mt-1 text-xs text-[#74817c]">
                    {group.modules.length} {group.modules.length === 1 ? "modulo" : "moduli"} abilitati
                  </p>
                  <ul className="space-y-1">
                    {group.modules.slice(0, 3).map((module) => (
                      <li key={module.key}>
                        <Link href={module.href} className="block rounded-lg px-2 py-1.5 text-xs font-semibold text-[#4b6056] hover:bg-[#f2f7f4] focus-visible:outline-2 focus-visible:outline-[#1f6b5a]">
                          {module.label} <span aria-hidden="true">↗</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {group.modules.length > 3 ? (
                    <p className="mt-2 text-xs text-[#74817c]">
                      Altri moduli nel menu laterale
                    </p>
                  ) : null}
                </section>
              ))}
            </div>
          </section>

          {context.is_platform_owner ? (
            <div className="border-t border-[#e0e6e2] pt-3">
              <Link href="/platform/pilot" className="text-xs font-semibold text-[#496f60] hover:underline">
                Pilot Cohort &amp; Activation →
              </Link>
            </div>
          ) : null}
        </>
      )}
    </FocusPage>
  );
}

import Link from "next/link";

import { PilotEvent } from "@/components/pilot-event";
import { FocusHeader, FocusPage } from "@/components/focus-ui";
import { getCompanySetupState } from "@/lib/company-setup";
import { DashboardSteelPulse } from "@/components/dashboard-steel-pulse";
import { DashboardDiscoveryFeed } from "@/components/dashboard-discovery-feed";
import { loadDashboardPulse } from "@/lib/dashboard-pulse";
import { getDashboardData } from "@/lib/commercial-data";
import { getNetworkAccessState } from "@/lib/network-access";
import { getMarketplaceFeed } from "@/lib/marketplace";
import {
  getNetworkActivityFeed,
  getNetworkInquiries,
} from "@/lib/network";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { appRoutes } from "@/lib/routes";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { canWriteWorkspace } from "@/lib/access-policy";
import { createClient } from "@/lib/supabase/server";
import { getDashboardCompanySector } from "@/lib/dashboard-company-sector";
import { dashboardPresentation } from "@/lib/dashboard-role-contract";

function workspaceRoleLabel(role: string) {
  if (role === "admin") return "Amministratore aziendale";
  if (role === "viewer") return "Sola lettura";
  return "Membro";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ engagement_updated?: string; engagement_error?: string }>;
}) {
  const params = await searchParams;
  const context = await getWorkspaceContext();
  const networkEnabled = isNetworkFrontendEnabled();
  // The Network navigation can remain available as an upgrade/onboarding
  // entry, but its protected feed and inquiries require an actual entitlement.
  // Newly registered companies must never crash their normal Workspace.
  const networkEntitled = networkEnabled
    ? (await getNetworkAccessState(context.organizationId)).can_access_network
    : false;
  const isAdmin = context.role === "admin";
  const canWrite = canWriteWorkspace(context.role);

  const [setup, commercial, received, activity, sector, procurement, pulse, marketplace] = await Promise.all([
    isAdmin
      ? getCompanySetupState(context.organizationId)
      : Promise.resolve(null),
    getDashboardData(),
    networkEntitled
      ? getNetworkInquiries(context.organizationId, "received")
      : Promise.resolve({ items: [], total: 0 }),
    networkEntitled
      ? getNetworkActivityFeed(context.organizationId, false)
      : Promise.resolve({ items: [], total: 0, unread: 0 }),
    networkEntitled ? getDashboardCompanySector(context.organizationId) : Promise.resolve("unknown" as const),
    canWrite ? createClient().then((db) => db.rpc("rfqh10_procurement_inbox", { p_limit: 5 })).catch(() => ({ data: null, error: true })) : Promise.resolve({ data: null, error: null }),
    loadDashboardPulse(),
    // P5.2 already validates viewer identity, publication status and visibility.
    // Fetch only the permitted public teaser projection; never private RFQ lines.
    getMarketplaceFeed(context.organizationId, { limit: 10, offset: 0 }).catch(() => null),
  ]);

  const { metrics, recent, mode, operational } = commercial;
  // A verified company sector takes precedence; free users can also self-declare
  // a professional focus. This display-only fallback NEVER grants capabilities.
  const selfDeclaredSector = pulse.feed?.preferences.role_interest === "producer" ? "produttore"
    : pulse.feed?.preferences.role_interest === "trader" ? "commerciante"
    : pulse.feed?.preferences.role_interest === "processor" ? "terzista"
    : pulse.feed?.preferences.role_interest === "end_user" ? "utilizzatore"
    : "unknown";
  const displaySector = sector === "unknown" ? selfDeclaredSector : sector;
  const presentation = dashboardPresentation(context.role === "admin" || context.role === "viewer" ? context.role : "member", displaySector);
  const setupIncomplete = Boolean(
    setup && (!setup.profile_ready || !setup.data_ready || !setup.first_value_ready),
  );

  const nextSetupAction = setup
    ? !setup.profile_ready
      ? {
          href: appRoutes.company.profile,
          label: "Completa il profilo azienda",
          detail: "Aggiungi le informazioni che rendono utile e riconoscibile il profilo.",
        }
      : !setup.data_ready
        ? {
            href: appRoutes.company.setup,
            label: "Autorizza fonti e import",
            detail: "Completa il passaggio necessario per alimentare la memoria privata.",
          }
        : !setup.first_value_ready
          ? {
              href: appRoutes.operations.uploads,
              label: "Importa il primo dato reale",
              detail: "Porta nel workspace il primo documento, RFQ, offerta o ordine.",
            }
          : null
    : null;

  // Reuse the existing commercial snapshot; no extra queries or inferred open statuses.
  const operationalKpis = mode === "live" ? [
    { label: "RFQ registrate", value: operational.rfqs, href: appRoutes.commercial.search, detail: "Totale record · non solo aperte" },
    { label: "Offerte registrate", value: operational.offers, href: appRoutes.commercial.search, detail: "Totale record" },
    { label: "Ordini registrati", value: operational.orders, href: appRoutes.commercial.search, detail: "Totale record" },
  ] : [];
  // The existing procurement inbox RPC provides both actionable rows and aggregate
  // lifecycle totals. Keep missing/invalid data distinct from a genuine zero.
  const procurementPayload = !procurement.error && procurement.data && typeof procurement.data === "object" && !Array.isArray(procurement.data)
    ? procurement.data as {
        summary?: { attention_total?: number; urgent?: number; due_24h?: number; active_rfqs?: number };
        items?: Array<{ rfq_id?: string; headline?: string; detail?: string; requires_action?: boolean; priority?: string; stage?: string }>;
      }
    : null;
  const procurementSummary = procurementPayload?.summary;
  const procurementKpis = procurementSummary && [
    { label: "Azioni buyer", value: procurementSummary.attention_total, href: appRoutes.rfqHub.inbox },
    { label: "Urgenti", value: procurementSummary.urgent, href: appRoutes.rfqHub.inbox },
    { label: "RFQ attive", value: procurementSummary.active_rfqs, href: appRoutes.rfqHub.home },
  ].flatMap((entry) =>
    typeof entry.value === "number" && Number.isFinite(entry.value) && entry.value >= 0
      ? [{ ...entry, value: entry.value }]
      : [],
  );
  const procurementActions = (procurementPayload?.items ?? [])
    .filter((item) => item.requires_action === true && typeof item.rfq_id === "string" && /^[0-9a-f-]{36}$/i.test(item.rfq_id))
    .slice(0, 2);
  // Only user-owned buyer actions belong in the Workspace attention strip.
  // The tenant-scoped commercial_review_queue contains parser/extraction QA;
  // even though its rows are RLS-protected, it is NOT a buyer task.
  // The governed correction workflow remains separate from customer priorities.
  // Read/unread news and recent RFQs are informational, not urgent.
  const attentionItems = [
    ...procurementActions.map((item) => ({
      href: appRoutes.rfqHub.campaign(item.rfq_id!),
      value: null as number | null,
      title: item.headline || "RFQ da gestire",
      description: "Apri la richiesta e completa la prossima azione.",
      accent: item.priority === "urgent"
        ? "border-[#ddb977] bg-[#fff6e7] text-[#815017]"
        : "border-[#a9ccbb] bg-[#f2f8f4] text-[#225c47]",
    })),
  ];
  const attentionCount = attentionItems.length;

  const quickActions = [
    {
      href: appRoutes.commercial.search,
      title: "Cerca nello storico",
      description: "Prodotti, aziende, RFQ, offerte, ordini e documenti.",
    },
    {
      href: "/distinta",
      title: "Crea distinta",
      description: "Prepara una distinta pronta da copiare o trasformare in RFQ.",
    },
    canWrite
      ? {
          href: appRoutes.marketplace.rfqHub,
          title: "Apri RFQ Hub",
          description: "Gestisci richieste multi-fornitore e risposte ricevute.",
        }
      : {
          href: appRoutes.marketplace.home,
          title: "Apri Marketplace",
          description: "Consulta le opportunità visibili alla tua organizzazione.",
        },
    networkEnabled
      ? {
          href: appRoutes.network.directory,
          title: "Trova azienda",
          description: "Cerca produttori, commercianti, terzisti e utilizzatori.",
        }
      : {
          href: appRoutes.knowledge.schoolTubes,
          title: "Calcolo pesi",
          description: "Apri il calcolatore tecnico della Scuola.",
        },
  ];

  // Sector only orders already permitted shortcuts; it never changes access.
  const orderedQuickActions = presentation.primaryIntent === "create_rfq"
    ? [quickActions[1], quickActions[2], quickActions[0], quickActions[3]]
    : presentation.primaryIntent === "review_inquiries"
      ? [quickActions[2], quickActions[0], quickActions[1], quickActions[3]]
      : quickActions;

  return (
    <FocusPage className="max-w-[1360px] space-y-4 sm:space-y-5">
      <PilotEvent eventName="workspace_home_viewed" metadata={{ surface: "workspace_home" }} />
      <FocusHeader
        eyebrow="Steel Intelligence · La tua Home"
        title={<>Oggi in {context.organizationName}</>}
        description={
          <>
            Le notizie del tuo settore, gli strumenti e le attività che contano.
            <span className="mt-1 block text-xs font-medium text-[#53645b]">
              {workspaceRoleLabel(context.role)} · Workspace privato
            </span>
          </>
        }
      />

      <section aria-labelledby="quick-actions" className="rounded-xl border border-[#dce5df] bg-white px-3 py-2.5">
        <h2 id="quick-actions" className="sr-only">Azioni rapide</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden="true" className="mr-1 hidden text-[11px] font-bold uppercase tracking-[0.08em] text-[#506459] sm:inline">
            Azioni rapide
          </span>
          {orderedQuickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border border-[#b9d2c5] bg-[#f5faf7] px-3 text-xs font-semibold text-[#175640] transition hover:border-[#7fae97] hover:bg-[#e8f3ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246a50]"
            >
              <span className="truncate">{action.title}</span>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>

      {attentionCount > 0 ? (
        <section aria-labelledby="daily-priorities" className="rounded-xl border border-[#e7d4b4] bg-[#fffbf5] px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="daily-priorities" className="mr-1 text-xs font-semibold text-[#754a18]">
              Cosa richiede attenzione
              <span className="sr-only"> · Solo segnali con un’azione concreta.</span>
            </h2>
            <div className="flex min-w-0 flex-wrap gap-2">
              {attentionItems.map((item) => (
                <Link
                  key={item.href + item.title}
                  href={item.href}
                  className={"inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 " + item.accent}
                >
                  {item.value !== null ? <span className="font-bold tabular-nums">{item.value}</span> : null}
                  <span className="truncate">{item.title}</span>
                  <span className="sr-only">{item.description}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {setupIncomplete && setup && nextSetupAction ? (
        <section aria-label="Configurazione aziendale" className="rounded-xl border border-[#d9e8e2] bg-[#f7faf8] px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[#173f35]">Setup azienda</span>
                <span className="text-[11px] tabular-nums text-[#52615b]">{setup.essential_completed_count}/{setup.essential_total_count}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#52615b]">{nextSetupAction.label}</p>
            </div>
            <Link href={nextSetupAction.href} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-[#b8d2c8] bg-white px-3 text-xs font-semibold text-[#173f35] hover:bg-[#edf5f2] focus-visible:outline-2 focus-visible:outline-offset-2">
              Continua setup →
            </Link>
          </div>
        </section>
      ) : null}

      {params.engagement_updated === "1" ? (
        <p role="status" aria-live="polite" className="rounded-lg border border-[#b9d8ca] bg-[#eaf5ef] px-3 py-2 text-xs font-semibold text-[#175640]">
          La tua raccolta Steel Pulse è stata aggiornata.
        </p>
      ) : null}
      {params.engagement_error ? (
        <p role="alert" className="rounded-lg border border-[#e7d0a8] bg-[#fff8ed] px-3 py-2 text-xs text-[#815017]">
          Impossibile aggiornare l’articolo. Riprova più tardi.
        </p>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(275px,0.85fr)] lg:gap-6">
        <div className="min-w-0 space-y-8">
          <DashboardSteelPulse state={pulse} />
          <DashboardDiscoveryFeed
            networkEnabled={networkEnabled}
            networkEntitled={networkEntitled}
            activity={activity.items}
            marketplace={marketplace}
            interests={pulse.interests}
          />
        </div>

        <aside className="min-w-0 space-y-4" aria-label="Riepilogo del Workspace">
          <section aria-label="Indicatori commerciali" className="rounded-2xl border border-[#dce5df] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[#173f35]">Il tuo Workspace</h2>
              <Link href={appRoutes.commercial.search} className="text-xs font-semibold text-[#175640] underline underline-offset-4">
                Apri →
              </Link>
            </div>
            {mode === "live" && operationalKpis.length > 0 ? (
              <dl className="mt-3 divide-y divide-[#eaf0eb]">
                {operationalKpis.map((kpi) => (
                  <div key={kpi.label} className="flex items-center justify-between gap-2 py-2">
                    <dt className="text-xs text-[#52615b]">{kpi.label}</dt>
                    <dd className="metric-number text-base font-semibold tabular-nums text-[#173f35]">{kpi.value.toLocaleString("it-IT")}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p role="status" className="mt-3 text-xs leading-5 text-[#52615b]">
                I dati commerciali non sono disponibili o non ancora associati al workspace. Nessun dato dimostrativo viene mostrato come reale.
              </p>
            )}
          </section>

          {procurementKpis && procurementKpis.length > 0 ? (
            <section aria-label="RFQ lifecycle" className="rounded-2xl border border-[#dce5df] bg-white p-4">
              <h2 className="text-sm font-semibold text-[#173f35]">Acquisti e RFQ</h2>
              <div className="mt-3 space-y-1">
                {procurementKpis.map((kpi) => (
                  <Link href={kpi.href} key={kpi.label} className="flex min-h-10 items-center justify-between gap-2 rounded-lg px-2 text-xs text-[#52615b] hover:bg-[#f1f7f3] focus-visible:outline-2 focus-visible:outline-offset-2">
                    <span>{kpi.label}</span>
                    <span className="font-semibold tabular-nums text-[#173f35]">{kpi.value.toLocaleString("it-IT")}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {networkEntitled && (received.total > 0 || activity.unread > 0) ? (
            <section aria-label="Dalla tua rete" className="rounded-2xl border border-[#dce5df] bg-white p-4">
              <h2 className="text-sm font-semibold text-[#173f35]">Dalla tua rete</h2>
              {received.total > 0 ? (
                <Link href={appRoutes.network.inquiries + "?box=received"} className="mt-3 flex min-h-10 items-center justify-between gap-2 text-xs font-medium text-[#175640] underline underline-offset-4">
                  Inquiry ricevute <span className="tabular-nums">{received.total} →</span>
                </Link>
              ) : null}
              {activity.unread > 0 ? (
                <Link href={appRoutes.network.activity + "?unread=1"} className="mt-2 flex min-h-10 items-center justify-between gap-2 text-xs font-medium text-[#175640] underline underline-offset-4">
                  Aggiornamenti dalle aziende seguite <span className="tabular-nums">{activity.unread} →</span>
                </Link>
              ) : null}
            </section>
          ) : null}

          <section aria-labelledby="recent-activity" className="rounded-2xl border border-[#dce5df] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 id="recent-activity" className="text-sm font-semibold text-[#173f35]">Ultimi movimenti commerciali</h2>
              <Link href={appRoutes.commercial.search} className="shrink-0 text-xs font-semibold text-[#175640] underline underline-offset-4">Storico →</Link>
            </div>
            {mode === "awaiting_assignment" ? (
              <p role="status" className="mt-3 text-xs leading-5 text-[#52615b]">
                Storico non ancora associato al workspace.
              </p>
            ) : recent.length === 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-[#52615b]">Qui compariranno RFQ, offerte e ordini recenti.</p>
                <Link
                  href={canWrite ? appRoutes.operations.uploads : appRoutes.commercial.search}
                  className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4"
                >
                  {canWrite ? "Importa i primi documenti →" : "Apri Commerciale →"}
                </Link>
              </div>
            ) : (
              <div className="mt-3 divide-y divide-[#eaf0eb]">
                {recent.slice(0, 3).map((row) => (
                  <Link
                    href={row.operationalHref ?? appRoutes.commercial.conversation(row.conversationId)}
                    key={row.id}
                    className="block py-3 hover:bg-[#f8faf9] focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <p className="line-clamp-1 text-xs font-semibold text-[#173f35]">{row.product}</p>
                    <p className="mt-1 truncate text-[11px] text-[#52615b]">{row.date} · {row.company}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </FocusPage>
  );
}

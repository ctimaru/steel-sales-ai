import Link from "next/link";

import { PilotEvent } from "@/components/pilot-event";
import { WorkspaceHomePanels } from "@/components/workspace-home-panels";
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
import { searchNetwork } from "@/lib/network";
import { selectDashboardNetworkCompanies } from "@/lib/dashboard-network-discovery";
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
  // A transient entitlement lookup must never crash a user's first workspace
  // visit. Fail closed: missing access state means Network remains locked.
  const networkEntitled = networkEnabled
    ? await getNetworkAccessState(context.organizationId)
        .then((access) => access.can_access_network === true)
        .catch(() => false)
    : false;
  const isAdmin = context.role === "admin";
  const canWrite = canWriteWorkspace(context.role);

  const [setup, commercial, received, activity, sector, procurement, pulse, marketplace, networkCatalog] = await Promise.all([
    isAdmin
      ? getCompanySetupState(context.organizationId).catch(() => null)
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
    // Published M6 catalog only. Never query Network companies without entitlement.
    // The product filter is a broad industrial first page, not an AI recommendation.
    networkEnabled && networkEntitled
      ? searchNetwork({ product: "tubes_pipes", page: 1 }).catch(() => null)
      : Promise.resolve(null),
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
  const networkCompanies = networkEnabled && networkEntitled && networkCatalog
    ? selectDashboardNetworkCompanies(networkCatalog.items, displaySector, pulse.interests, context.organizationName)
    : [];
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
    { label: "Azioni buyer", value: procurementSummary.attention_total, href: appRoutes.commercial.home + "?view=sent#commercial-worklist" },
    { label: "Urgenti", value: procurementSummary.urgent, href: appRoutes.commercial.home + "?view=sent#commercial-worklist" },
    { label: "RFQ attive", value: procurementSummary.active_rfqs, href: appRoutes.commercial.home + "?view=sent#commercial-worklist" },
  ].flatMap((entry) =>
    typeof entry.value === "number" && Number.isFinite(entry.value) && entry.value >= 0
      ? [{ ...entry, value: entry.value }]
      : [],
  );
  const procurementActions = (procurementPayload?.items ?? [])
    .filter((item) => item.requires_action === true && typeof item.rfq_id === "string" && /^[0-9a-f-]{36}$/i.test(item.rfq_id))
    // Urgency is explicitly supplied by the tenant-scoped procurement inbox;
    // never infer urgency from recent news, parser QA, or unrelated records.
    .sort((a, b) => Number(b.priority === "urgent") - Number(a.priority === "urgent"))
    .slice(0, 3);
  // Only user-owned buyer actions belong in the Workspace attention strip.
  // The tenant-scoped commercial_review_queue contains parser/extraction QA;
  // even though its rows are RLS-protected, it is NOT a buyer task.
  // The governed correction workflow remains separate from customer priorities.
  // Read/unread news and recent RFQs are informational, not urgent.
  const attentionItems = [
    ...procurementActions.map((item) => ({
      // Commerciale is the canonical surface; the campaign key is resolved
      // with an organization-scoped read even if not on the first worklist page.
      href: appRoutes.commercial.home + "?view=sent&item=campaign:" + item.rfq_id! + "#commercial-detail",
      value: null as number | null,
      title: typeof item.headline === "string" && item.headline.trim()
        ? item.headline.trim().slice(0, 120) : "RFQ da gestire",
      description: typeof item.detail === "string" && item.detail.trim()
        ? item.detail.trim().slice(0, 170) : "Apri la richiesta e completa la prossima azione.",
      priorityLabel: item.priority === "urgent" ? "Urgente" : "Da gestire",
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
          href: appRoutes.commercial.home,
          title: "Gestisci richieste e offerte",
          description: "Un unico Commerciale per RFQ, risposte e lavoro quotidiano.",
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
  const orderedQuickActions = (presentation.primaryIntent === "create_rfq"
    ? [quickActions[1], quickActions[2], quickActions[0], quickActions[3]]
    : presentation.primaryIntent === "review_inquiries"
      ? [quickActions[2], quickActions[0], quickActions[1], quickActions[3]]
      : quickActions).filter((action) => action.href !== appRoutes.commercial.search);

  return (
    <FocusPage className="max-w-[1360px] space-y-3 sm:space-y-4">
      <PilotEvent eventName="workspace_home_viewed" metadata={{ surface: "workspace_home" }} />
      <FocusHeader
        compact
        eyebrow="Steel Intelligence · La tua Home"
        title={<>Oggi in {context.organizationName}</>}
        description={
          <>
            Il tuo spazio di lavoro commerciale.
            <span className="mt-0.5 block text-xs font-medium text-[#53645b]">
              {workspaceRoleLabel(context.role)} · Workspace privato
            </span>
          </>
        }
      />

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

      <WorkspaceHomePanels
        attentionCount={attentionCount}
        overview={
          <div className="space-y-3">
            <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1.85fr)_minmax(275px,0.85fr)]">
              <div className="min-w-0 space-y-3">
      <section aria-labelledby="quick-actions" className="overflow-hidden rounded-2xl border border-[#c5d8cd] bg-[linear-gradient(120deg,#edf6f0_0%,#ffffff_72%)] px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#28634f]">Steel Intelligence · Strumenti operativi</p>
            <h2 id="quick-actions" className="mt-1 text-lg font-semibold tracking-tight text-[#173f35] sm:text-xl">
              Come posso aiutarti oggi?
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#52645a] sm:text-sm">
              Prepara una distinta, consulta lo storico o interroga l’assistente commerciale.
            </p>
          </div>
          <Link
            href={appRoutes.commercial.assistant}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-[#176045] px-4 text-xs font-semibold !text-white transition hover:bg-[#114b36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176045]"
          >
            Apri assistente AI <span aria-hidden="true">→</span>
          </Link>
        </div>

        <Link
          href={appRoutes.commercial.search}
          aria-label="Cerca RFQ, offerte, ordini, aziende e documenti nello storico commerciale"
          className="mt-3 flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-[#c2d7ca] bg-white px-3 text-left shadow-[0_2px_10px_rgba(18,61,52,0.04)] transition hover:border-[#82b099] hover:bg-[#f9fcfa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176045] sm:px-4"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-[#32654f]">
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 5 5" strokeLinecap="round" />
          </svg>
          <span className="min-w-0 flex-1 truncate text-xs text-[#59695e] sm:text-sm">
            Cerca RFQ, offerte, ordini, aziende e documenti...
          </span>
          <span className="shrink-0 text-[11px] font-semibold text-[#176045]">Cerca <span aria-hidden="true">↗</span></span>
        </Link>

        <div data-testid="quick-action-shortcuts" className="mt-2 flex flex-wrap items-center gap-1.5">
          <span aria-hidden="true" className="mr-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#53675b]">Azioni rapide</span>
          {orderedQuickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              title={action.description}
              className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-[#b9d2c5] bg-[#f9fcfa] px-2.5 text-xs font-semibold text-[#175640] transition hover:border-[#7fae97] hover:bg-[#e8f3ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246a50]"
            >
              <span className="truncate">{action.title}</span>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>


                {attentionCount > 0 ? (
                  <section aria-label="Priorità in evidenza" className="rounded-xl border border-[#e5d1ae] bg-[#fffbf4] px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-[#173f35]">Richiede la tua attenzione</h2>
                      <span className="rounded-full bg-[#f4e9d6] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#805c31]">{attentionCount} da gestire</span>
                    </div>
                    {attentionItems.slice(0, 1).map((item) => (
                      <Link key={item.href} href={item.href} className="mt-2 flex min-h-11 items-center justify-between gap-3 rounded-lg border border-[#eadbc4] bg-white px-3 py-2 text-xs font-semibold text-[#173f35] hover:bg-[#fffaf1] focus-visible:outline-2 focus-visible:outline-offset-2">
                        <span className="min-w-0 truncate">{item.title}</span><span className="shrink-0 text-[#175640]">Apri →</span>
                      </Link>
                    ))}
                  </section>
                ) : null}
              </div>
              <div className="min-w-0 space-y-3">
          <section aria-label="Indicatori commerciali" className="rounded-2xl border border-[#dce5df] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[#173f35]">Il tuo Workspace</h2>
              <Link href={appRoutes.commercial.search} className="text-xs font-semibold text-[#175640] underline underline-offset-4">
                Apri →
              </Link>
            </div>
            {mode === "live" && operationalKpis.length > 0 ? (
              <>
                <dl className="mt-3 grid grid-cols-3 gap-2">
                  {operationalKpis.map((kpi) => (
                    <div key={kpi.label} className="min-w-0 rounded-xl bg-[#f3f8f5] px-2 py-3 text-center">
                      <dd className="metric-number text-xl font-semibold tabular-nums text-[#173f35]">{kpi.value.toLocaleString("it-IT")}</dd>
                      <dt className="mt-1 text-[10px] leading-4 text-[#53645b]">{kpi.label}</dt>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-[11px] leading-4 text-[#68766d]">Totali registrati · non rappresentano attività aperte.</p>
              </>
            ) : procurementKpis && procurementKpis.length > 0 ? (
              <>
                <div className="mt-3 space-y-1">
                  {procurementKpis.map((kpi) => (
                    <Link key={kpi.label} href={kpi.href} className="flex min-h-9 items-center justify-between rounded-lg px-2 text-xs text-[#52615b] hover:bg-[#f1f7f3] focus-visible:outline-2 focus-visible:outline-offset-2">
                      <span>{kpi.label}</span>
                      <span className="font-semibold tabular-nums text-[#173f35]">{kpi.value.toLocaleString("it-IT")}</span>
                    </Link>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-4 text-[#68766d]">Stato acquisti verificato · non è lo storico commerciale.</p>
              </>
            ) : nextSetupAction ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs leading-5 text-[#52615b]">Completa la configurazione per iniziare a valorizzare il tuo Workspace.</p>
                <Link href={nextSetupAction.href} className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4">
                  {nextSetupAction.label} →
                </Link>
              </div>
            ) : (
              <p role="status" className="mt-3 text-xs leading-5 text-[#52615b]">
                I dati commerciali non sono disponibili o non ancora associati al workspace. Nessun dato dimostrativo viene mostrato come reale.
              </p>
            )}
          </section>

              </div>
            </div>
          </div>
        }
        tasks={
          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#22634f]">Il tuo prossimo passo</p>
                <h2 className="mt-1 text-lg font-semibold text-[#173f35]">Da fare adesso</h2>
              </div>
              <Link href={appRoutes.commercial.home} className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4">Apri Commerciale →</Link>
            </div>
      {attentionCount > 0 ? (
        <section aria-labelledby="daily-priorities" className="rounded-2xl border border-[#e7d4b4] bg-[#fffbf5] px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#805c31]">Cosa richiede attenzione</p>
              <h2 id="daily-priorities" className="mt-0.5 text-base font-semibold text-[#173f35]">
                Da fare adesso
                <span className="sr-only"> · Solo segnali con un’azione concreta.</span>
              </h2>
            </div>
            <Link href={appRoutes.commercial.home + "?view=sent#commercial-worklist"} className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">
              Tutte le richieste →
            </Link>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {attentionItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={"group flex min-h-10 max-w-full flex-col gap-2 rounded-lg border px-3 py-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 hover:shadow-[0_3px_12px_rgba(18,61,52,0.06)] " + item.accent}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em]">{item.priorityLabel}</span>
                <span className="break-words text-sm font-semibold text-[#173f35]">{item.title}</span>
                <span className="line-clamp-2 leading-5 text-[#52615b]">{item.description}</span>
                <span className="mt-auto font-semibold text-[#175640]">Apri nel Commerciale <span aria-hidden="true">→</span></span>
              </Link>
            ))}
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


            {attentionCount === 0 ? (
              <p role="status" className="rounded-xl border border-[#dce7de] bg-white p-4 text-xs leading-5 text-[#52615b]">
                {procurementPayload ? "Nessuna azione buyer segnalata nella casella attuale." : "Le priorità buyer non sono verificabili adesso. Controlla le richieste in Commerciale."}
              </p>
            ) : null}
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

          </div>
        }
        opportunities={
          <div className="space-y-4">
          <DashboardDiscoveryFeed
            networkEnabled={networkEnabled}
            networkEntitled={networkEntitled}
            activity={activity.items}
            marketplace={marketplace}
            interests={pulse.interests}
            networkCompanies={networkCompanies}
            networkDiscoveryAvailable={networkCatalog !== null}
            canWriteCommercial={canWrite}
          />
          <section aria-label="Aree di lavoro" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#dce6df] pt-3 text-xs">
            <span className="font-semibold text-[#53675b]">Approfondisci:</span>
            <Link href={appRoutes.commercial.home} className="inline-flex min-h-10 items-center font-semibold text-[#175640] underline underline-offset-4">Commerciale →</Link>
            <Link href={networkEnabled ? appRoutes.network.directory : appRoutes.knowledge.workspace} className="inline-flex min-h-10 items-center font-semibold text-[#175640] underline underline-offset-4">
              {networkEnabled ? "Network" : "Scuola"} →
            </Link>
          </section>
          </div>
        }
        pulse={<DashboardSteelPulse state={pulse} />}
        activity={
          <div className="space-y-3">
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
                <p className="text-xs leading-5 text-[#52615b]">
                  {mode === "live"
                    ? operational.rfqs + operational.offers + operational.orders > 0
                      ? "Lo storico contiene dati commerciali, ma non ci sono movimenti recenti in questa vista."
                      : "Nessun movimento recente nello storico commerciale."

                    : "Nessun movimento recente disponibile per questo workspace."}
                </p>
                <Link
                  href={mode === "live" || !canWrite ? appRoutes.commercial.home + "#commercial-worklist" : appRoutes.operations.uploads}
                  className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4"
                >
                  {mode === "live" || !canWrite ? "Apri attività commerciali →" : "Importa i primi documenti →"}
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
          </div>
        }
      />
    </FocusPage>
  );
}

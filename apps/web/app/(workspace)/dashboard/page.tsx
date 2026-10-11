import Link from "next/link";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { PilotEvent } from "@/components/pilot-event";
import { FocusHeader, FocusPage, FocusSectionHeader } from "@/components/focus-ui";
import { Badge } from "@/components/ui/badge";
import { getCompanySetupState } from "@/lib/company-setup";
import { getDashboardData } from "@/lib/commercial-data";
import { getNetworkAccessState } from "@/lib/network-access";
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

function roleLabel(role: string) {
  if (role === "requested") return "Richiesta";
  if (role === "offered") return "Offerta";
  if (role === "ordered") return "Ordine";
  if (role === "delivered") return "Consegna";
  return role;
}

function workspaceRoleLabel(role: string) {
  if (role === "admin") return "Amministratore aziendale";
  if (role === "viewer") return "Sola lettura";
  return "Membro";
}

export default async function DashboardPage() {
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

  const [setup, commercial, received, activity, sector, procurement] = await Promise.all([
    isAdmin
      ? getCompanySetupState(context.organizationId)
      : Promise.resolve(null),
    getDashboardData(),
    networkEntitled
      ? getNetworkInquiries(context.organizationId, "received")
      : Promise.resolve({ items: [], total: 0 }),
    networkEntitled
      ? getNetworkActivityFeed(context.organizationId, true)
      : Promise.resolve({ items: [], total: 0, unread: 0 }),
    networkEntitled ? getDashboardCompanySector(context.organizationId) : Promise.resolve("unknown" as const),
    canWrite ? createClient().then((db) => db.rpc("rfqh10_procurement_inbox", { p_limit: 5 })).catch(() => ({ data: null, error: true })) : Promise.resolve({ data: null, error: null }),
  ]);

  const { metrics, recent, mode, operational } = commercial;
  const presentation = dashboardPresentation(context.role === "admin" || context.role === "viewer" ? context.role : "member", sector);
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
  const recentRfq = mode === "live"
    ? recent.find((row) => row.role === "requested" && row.operationalHref)
    : undefined;

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
  // The buyer-centric inbox remains available to any permitted operator;
  // display order adapts to business context without withholding authorized data.
  const prioritizeProcurement = presentation.audience === "demand";


  const procurementPriorityCards = procurementActions.map((item) => ({
      href: appRoutes.rfqHub.campaign(item.rfq_id!),
      value: null,
      title: item.headline || "RFQ da gestire",
      description: item.detail || "Apri la richiesta per completare l’azione.",
      accent: item.priority === "urgent" ? "border-amber-200 bg-amber-50" : "border-[#b8d2c8] bg-[#edf5f2]",
      valueClass: "text-[#173f35]",
    }));
  const attentionItems = [
    ...(prioritizeProcurement ? procurementPriorityCards : []),
    recentRfq && canWrite
      ? {
          href: recentRfq.operationalHref!,
          value: null,
          title: "Apri RFQ recente",
          description: "Consulta la richiesta registrata. Stato e scadenze nel dettaglio.",
          accent: "border-[#b8d2c8] bg-[#edf5f2]",
          valueClass: "text-[#173f35]",
        }
      : null,
    metrics.reviewFlags > 0
      ? {
          href: appRoutes.operations.review,
          value: metrics.reviewFlags,
          title: "Elementi da verificare",
          description: "Casi che richiedono una decisione umana.",
          accent: "border-amber-200 bg-amber-50",
          valueClass: "text-amber-900",
        }
      : null,
    networkEntitled && received.total > 0
      ? {
          href: appRoutes.network.inquiries + "?box=received",
          value: received.total,
          title: "Inquiry ricevute",
          description: "Nuovi contatti dal Network da leggere o gestire.",
          accent: "border-[#b8d2c8] bg-[#edf5f2]",
          valueClass: "text-[#173f35]",
        }
      : null,
    networkEntitled && activity.unread > 0
      ? {
          href: appRoutes.network.activity + "?unread=1",
          value: activity.unread,
          title: "Aggiornamenti Network",
          description: "Nuove attività dalle aziende che segui.",
          accent: "border-[#d9e8e2] bg-[#f3f7f5]",
          valueClass: "text-[#173f35]",
        }
      : null,
    ...(!prioritizeProcurement ? procurementPriorityCards : []),
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

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
    <FocusPage className="max-w-[1180px] space-y-5 sm:space-y-7">
      <PilotEvent eventName="workspace_home_viewed" metadata={{ surface: "workspace_home" }} />
      <FocusHeader
        eyebrow="Cockpit commerciale"
        title={<>Oggi in {context.organizationName}</>}
        description={
          <>
            Le tue attività prioritarie e gli strumenti per agire subito.
            <span className="mt-2 block text-xs font-semibold text-[#5d6a65]">
              {workspaceRoleLabel(context.role)} · Workspace privato
            </span>
          </>
        }
      />



      <section aria-labelledby="quick-actions">
        <FocusSectionHeader
          eyebrow="Azioni rapide"
          title={<span id="quick-actions">Parti da qui</span>}
        />
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {orderedQuickActions.map((action, index) => (
            <Link
              key={action.href}
              href={action.href}
              className={[
                "group min-w-0 rounded-xl border p-3 transition hover:shadow-sm sm:rounded-2xl sm:p-4",
                index === 0
                  ? "border-[#b8d2c8] bg-[#edf5f2] hover:border-[#82aa9b]"
                  : "border-[#dce2df] bg-white hover:border-[#b8d2c8]",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-[#1d2824]">{action.title}</h3>
                <span className="text-sm font-semibold text-[#173f35]" aria-hidden="true">
                  →
                </span>
              </div>
              <p className="mt-1 hidden text-xs leading-5 text-[#5d6a65] sm:block">{action.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {operationalKpis.length > 0 ? (
        <section aria-label="Indicatori commerciali" className="grid grid-cols-3 gap-2 sm:gap-3">
          {operationalKpis.map((kpi) => (
            <Link key={kpi.label} href={kpi.href} className="min-w-0 rounded-xl border border-[#dce2df] bg-white p-2 hover:border-[#b8d2c8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-4">
              <p className="text-[11px] font-medium leading-4 text-[#52615b] sm:text-xs">{kpi.label}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums text-[#1d2824] sm:text-2xl">{kpi.value.toLocaleString("it-IT")}</p>
              <p className="mt-1 hidden text-[11px] text-[#5d6a65] sm:block">{kpi.detail}</p>
            </Link>
          ))}
        </section>
      ) : null}

      {procurementKpis && procurementKpis.length > 0 ? (
        <section aria-label="RFQ lifecycle" className="grid grid-cols-3 gap-2 sm:gap-3">
          {procurementKpis.map((kpi) => (
            <Link key={kpi.label} href={kpi.href} className="min-w-0 rounded-xl border border-[#dce2df] bg-white p-2.5 hover:border-[#b8d2c8] sm:p-4">
              <p className="text-[11px] leading-4 text-[#52615b]">{kpi.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-[#1d2824] sm:text-2xl">{kpi.value.toLocaleString("it-IT")}</p>
            </Link>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="daily-priorities">
        <FocusSectionHeader
          eyebrow="Priorità"
          title={<span id="daily-priorities">Cosa richiede attenzione</span>}
          description="Solo segnali con un’azione concreta."
        />

        {attentionItems.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {attentionItems.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className={[
                  "group rounded-xl border p-3 transition hover:shadow-sm sm:rounded-2xl sm:p-5",
                  item.accent,
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  {item.value !== null ? <p className={["metric-number text-2xl font-semibold sm:text-3xl", item.valueClass].join(" ")}>{item.value}</p> : <span className="text-xs font-semibold text-[#173f35]">Apri dettaglio</span>}
                  <span className="text-sm font-semibold text-[#173f35]" aria-hidden="true">
                    →
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-[#1d2824]">{item.title}</h3>
                <p className="mt-1 text-xs leading-5 text-[#5d6a65]">{item.description}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-2xl border border-[#d9e8e2] bg-[#f3f7f5] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#173f35]">Nessuna urgenza operativa</p>
              <p className="mt-1 text-sm text-[#52615b]">
                Non risultano verifiche, inquiry o aggiornamenti Network non letti.
              </p>
            </div>
            <Link
              href={appRoutes.commercial.search}
              className="text-sm font-semibold text-[#173f35] hover:underline"
            >
              Cerca nella memoria →
            </Link>
          </div>
        )}
      </section>

      {setupIncomplete && setup && nextSetupAction ? (
        <section aria-label="Configurazione aziendale" className="rounded-xl border border-[#d9e8e2] bg-[#f7faf8] px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[#173f35]">Configurazione aziendale</span>
                <span className="text-[11px] tabular-nums text-[#52615b]">
                  {setup.essential_completed_count}/{setup.essential_total_count}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#52615b]">{nextSetupAction.label}</p>
            </div>
            <Link
              href={nextSetupAction.href}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-[#b8d2c8] bg-white px-3 text-xs font-semibold text-[#173f35] hover:bg-[#edf5f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Completa setup →
            </Link>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="recent-activity">
        <FocusSectionHeader
          eyebrow="Attività recente"
          title={<span id="recent-activity">Ultimi movimenti commerciali</span>}
          action={
            <Link href={appRoutes.commercial.search} className="text-xs font-semibold text-[#173f35] hover:underline">
              Apri storico →
            </Link>
          }
        />

        {mode === "awaiting_assignment" ? (
          <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">I dati commerciali non sono disponibili o non sono ancora associati a questo workspace. Nessun dato dimostrativo viene mostrato come reale.</div>
        ) : recent.length === 0 ? (
          <FirstUseEmptyState
            eyebrow="Storico ancora vuoto"
            title="Qui compariranno RFQ, offerte e ordini recenti"
            description="La Home mostrerà solo gli ultimi movimenti utili. Lo storico completo rimane nella sezione Commerciale."
            primaryAction={{
              href: canWrite ? appRoutes.operations.uploads : appRoutes.commercial.search,
              label: canWrite ? "Importa i primi documenti" : "Apri Commerciale",
            }}
            compact
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#dce2df] bg-white">
            {recent.slice(0, 5).map((row, index) => (
              <Link
                href={row.operationalHref ?? appRoutes.commercial.conversation(row.conversationId)}
                key={row.id}
                className={[
                  "flex flex-col gap-3 p-4 transition hover:bg-[#f8faf9] sm:flex-row sm:items-center sm:justify-between",
                  index > 0 ? "border-t border-[#edf1ef]" : "",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={row.role === "offered" ? "green" : row.role === "requested" ? "blue" : "violet"}>
                      {roleLabel(row.role)}
                    </Badge>
                    <span className="text-xs text-[#5d6a65]">{row.date}</span>
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-[#1d2824]">{row.product}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-[#5d6a65]">
                    {row.grade} · {row.standard} · {row.company}
                  </p>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-sm font-semibold text-[#1d2824]">{row.price ?? "—"}</p>
                  <p className="mt-1 text-xs text-[#5d6a65]">{Math.round(row.confidence * 100)}% affidabilità</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>



      <section aria-label="Steel Pulse" className="rounded-2xl border border-[#d9e7df] bg-[#f3f8f5] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#24634f]">Steel Pulse · Il tuo settore</p>
            <p className="mt-1 text-sm text-[#52615b]">Segui gli argomenti che contano per te, anche quando non hai una trattativa da gestire.</p>
          </div>
          <Link href={appRoutes.steelPulse} className="app-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-xs font-semibold">
            Personalizza il feed →
          </Link>
        </div>
      </section>

      {mode === "awaiting_assignment" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
          I dati commerciali non sono al momento disponibili o devono ancora essere associati al workspace.
        </p>
      ) : null}
    </FocusPage>
  );
}

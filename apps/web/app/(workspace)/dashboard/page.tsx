import Link from "next/link";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { PilotEvent } from "@/components/pilot-event";
import { FocusHeader, FocusPage, FocusSectionHeader } from "@/components/focus-ui";
import { Badge } from "@/components/ui/badge";
import { getCompanySetupState } from "@/lib/company-setup";
import { getDashboardData } from "@/lib/commercial-data";
import {
  getNetworkActivityFeed,
  getNetworkInquiries,
} from "@/lib/network";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { appRoutes } from "@/lib/routes";
import { getWorkspaceContext } from "@/lib/workspace-context";

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
  const isAdmin = context.role === "admin";
  const canWrite = context.role !== "viewer";

  const [setup, commercial, received, activity] = await Promise.all([
    isAdmin
      ? getCompanySetupState(context.organizationId)
      : Promise.resolve(null),
    getDashboardData(),
    networkEnabled
      ? getNetworkInquiries(context.organizationId, "received")
      : Promise.resolve({ items: [], total: 0 }),
    networkEnabled
      ? getNetworkActivityFeed(context.organizationId, true)
      : Promise.resolve({ items: [], total: 0, unread: 0 }),
  ]);

  const { metrics, recent, mode } = commercial;
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

  const attentionItems = [
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
    networkEnabled && received.total > 0
      ? {
          href: appRoutes.network.inquiries + "?box=received",
          value: received.total,
          title: "Inquiry ricevute",
          description: "Nuovi contatti dal Network da leggere o gestire.",
          accent: "border-[#b8d2c8] bg-[#edf5f2]",
          valueClass: "text-[#173f35]",
        }
      : null,
    networkEnabled && activity.unread > 0
      ? {
          href: appRoutes.network.activity + "?unread=1",
          value: activity.unread,
          title: "Aggiornamenti Network",
          description: "Nuove attività dalle aziende che segui.",
          accent: "border-[#d9e8e2] bg-[#f3f7f5]",
          valueClass: "text-[#173f35]",
        }
      : null,
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

  return (
    <FocusPage className="max-w-[1120px]">
      <PilotEvent eventName="workspace_home_viewed" metadata={{ surface: "workspace_home" }} />
      <FocusHeader
        eyebrow="Home"
        title={<>Oggi in {context.organizationName}</>}
        description={
          <>
            Le priorità da gestire, gli ultimi movimenti commerciali e le azioni che servono per lavorare.
            <span className="mt-2 block text-xs font-semibold text-[#5d6a65]">
              {workspaceRoleLabel(context.role)} · Workspace privato
            </span>
          </>
        }
      />

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

      {setupIncomplete && setup && nextSetupAction ? (
        <section className="rounded-2xl border border-[#b8d2c8] bg-[#edf5f2] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#173f35]">
                  Setup azienda
                </p>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#173f35]">
                  {setup.essential_completed_count}/{setup.essential_total_count}
                </span>
              </div>
              <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">
                {nextSetupAction.label}
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#52615b]">
                {nextSetupAction.detail}
              </p>
            </div>
            <Link
              href={nextSetupAction.href}
              className="app-primary inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-semibold"
            >
              Continua setup
            </Link>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="daily-priorities">
        <FocusSectionHeader
          eyebrow="Priorità"
          title={<span id="daily-priorities">Cosa richiede attenzione</span>}
          description="Solo segnali con un’azione concreta."
        />

        {attentionItems.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3">
            {attentionItems.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className={[
                  "group rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-sm",
                  item.accent,
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className={["metric-number text-3xl font-semibold", item.valueClass].join(" ")}>
                    {item.value}
                  </p>
                  <span className="text-sm font-semibold text-[#173f35]" aria-hidden="true">
                    →
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-[#1d2824]">{item.title}</h3>
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

        {recent.length === 0 ? (
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

      <section aria-labelledby="quick-actions">
        <FocusSectionHeader
          eyebrow="Azioni rapide"
          title={<span id="quick-actions">Parti da qui</span>}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, index) => (
            <Link
              key={action.href}
              href={action.href}
              className={[
                "group rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm",
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
              <p className="mt-2 text-xs leading-5 text-[#5d6a65]">{action.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {mode === "awaiting_assignment" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
          Il corpus validato è disponibile, ma deve ancora essere associato al workspace.
        </p>
      ) : null}
    </FocusPage>
  );
}

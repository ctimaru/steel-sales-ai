import Link from "next/link";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { PilotEvent } from "@/components/pilot-event";
import { FocusHeader, FocusPage, FocusSectionHeader } from "@/components/focus-ui";
import { Badge } from "@/components/ui/badge";
import { getDashboardData } from "@/lib/commercial-data";
import { BuyerDistintaBuilder } from "@/components/buyer-distinta-builder";
import { CommercialUnifiedWorklist } from "@/components/commercial-unified-worklist";
import { buildBuyerDistintaCatalogOptions } from "@/lib/buyer-distinta-catalog";
import { loadUnifiedCommercialData, type CommercialView } from "@/lib/commercial-unified-data";
import { listBuyerDistintaPublicDimensions } from "@/lib/public-knowledge";
import { canWriteWorkspace } from "@/lib/access-policy";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

function roleLabel(role: string) {
  if (role === "requested") return "RFQ";
  if (role === "offered") return "Offerta";
  if (role === "ordered") return "Ordine";
  if (role === "delivered") return "Consegna";
  return role;
}

const coreTools = [
  {
    href: appRoutes.commercial.products,
    title: "Prodotti",
    description: "Product 360 con richieste, offerte, ordini, prezzi ed evidenze.",
    meta: "Product 360",
  },
  {
    href: appRoutes.commercial.companies,
    title: "Aziende",
    description: "Company 360 con clienti, fornitori e storico delle relazioni private.",
    meta: "Company 360",
  },
  {
    href: appRoutes.commercial.assistant,
    title: "Assistente",
    description: "Interroga la memoria commerciale mantenendo fonti e provenienza.",
    meta: "AI privata",
  },
] as const;

const intelligenceGroups = [
  {
    title: "Prezzi & mercato",
    description: "Capisci prezzi, variazioni e segnali dal tuo storico commerciale.",
    links: [
      ["Prezzi", appRoutes.commercial.priceIntelligence],
      ["Mercato", appRoutes.commercial.marketIntelligence],
      ["Explorer", appRoutes.commercial.explorer],
    ],
  },
  {
    title: "Opportunità commerciali",
    description: "Trova domanda, account da riattivare e possibilità di conversione.",
    links: [
      ["Segnali di domanda", appRoutes.commercial.demand],
      ["Riattivazione", appRoutes.commercial.reengagement],
      ["Conversione", appRoutes.commercial.conversion],
    ],
  },
  {
    title: "Relazioni",
    description: "Ricostruisci connessioni tra conversazioni, aziende e trattative.",
    links: [["Relazioni cross-thread", appRoutes.commercial.crossThreadRelationships]],
  },
] as const;

export default async function CommercialHomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; item?: string; compose?: string }>;
}) {
  const params = await searchParams;
  const context = await getWorkspaceContext();
  const canWrite = canWriteWorkspace(context.role);
  const networkAvailable = isNetworkFrontendEnabled();
  const allowedViews: CommercialView[] = ["all", "received", "sent", "offers", "orders", "drafts"];
  const view: CommercialView = allowedViews.includes(params.view as CommercialView) ? params.view as CommercialView : "all";
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const selected = typeof params.item === "string" ? params.item.slice(0, 90) : "";
  const composing = canWrite && params.compose === "1";
  const [commercial, procurement, unified, catalogOptions] = await Promise.all([
    getDashboardData(),
    canWrite
      ? createClient().then((db) => db.rpc("rfqh10_procurement_inbox", { p_limit: 4 }))
          .catch(() => ({ data: null, error: true }))
      : Promise.resolve({ data: null, error: null }),
    loadUnifiedCommercialData(context.organizationId),
    composing ? listBuyerDistintaPublicDimensions().then(buildBuyerDistintaCatalogOptions) : Promise.resolve(null),
  ]);
  const { recent, mode, operational } = commercial;
  // Procurement is a distinct tenant-owned lifecycle; never mix its active
  // counts with the total historical commercial RFQ count.
  const procurementPayload = !procurement.error && procurement.data && typeof procurement.data === "object" && !Array.isArray(procurement.data)
    ? procurement.data as {
        summary?: { attention_total?: number; active_rfqs?: number };
        items?: Array<{ rfq_id?: string; headline?: string; requires_action?: boolean }>;
      }
    : null;
  const attentionTotal = procurementPayload?.summary?.attention_total;
  const actionableRfqs = (procurementPayload?.items ?? []).filter((item) =>
    item.requires_action === true && typeof item.rfq_id === "string" && /^[0-9a-f-]{36}$/i.test(item.rfq_id)
  ).slice(0, 3);
  const metricCards = [
    { label: "Richieste nello storico", value: operational.rfqs },
    { label: "Offerte nello storico", value: operational.offers },
    { label: "Ordini nello storico", value: operational.orders },
    ...(typeof procurementPayload?.summary?.active_rfqs === "number"
      ? [{ label: "RFQ acquisti attive", value: procurementPayload.summary.active_rfqs }]
      : []),
  ];

  return (
    <FocusPage className="max-w-[1280px]">
      <PilotEvent eventName="commercial_home_viewed" metadata={{ surface: "commercial_home" }} />
      <FocusHeader
        eyebrow="Commerciale"
        title="Tutto il lavoro commerciale, in un unico posto"
        description={
          <>
            La memoria commerciale della tua azienda, le richieste ai fornitori e le opportunità di Network e Marketplace.
            Parti da ciò che devi fare, senza cambiare ambiente. Tutto resta nel workspace privato della tua organizzazione.
            <span className="mt-2 block text-xs font-semibold text-[#5d6a65]">
              {mode === "live"
                ? "Dati live"
                : mode === "demo"
                  ? "Modalità demo"
                  : "Dati in attesa di associazione"}
            </span>
          </>
        }
      />

      <section aria-labelledby="commercial-today" className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl bg-[#173f35] p-4 text-white sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#c3e0d2]">Le tue attività</p>
          <h2 id="commercial-today" className="mt-1 text-xl font-semibold">Che cosa vuoi fare oggi?</h2>
          <p className="mt-1 text-sm text-[#d6e9dd]">Dalla distinta all’offerta, con le aziende giuste.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {canWrite ? (
              <Link href={appRoutes.commercial.home + "?compose=1#commercial-compose"} className="inline-flex min-h-10 items-center rounded-lg bg-white px-3 text-sm font-semibold text-[#173f35] hover:bg-[#e7f3eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                + Nuova richiesta
              </Link>
            ) : null}
            <Link href={appRoutes.commercial.home + "#commercial-worklist"} className="inline-flex min-h-10 items-center rounded-lg border border-[#9fcdb6] px-3 text-sm font-semibold text-white hover:bg-[#275a49] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              RFQ e offerte →
            </Link>
            {networkAvailable ? (
              <Link href={appRoutes.network.directory} className="inline-flex min-h-10 items-center rounded-lg border border-[#9fcdb6] px-3 text-sm font-semibold text-white hover:bg-[#275a49] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Trova aziende →
              </Link>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-[#dce2df] bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[#173f35]">Cosa richiede attenzione</h2>
            <Link href={appRoutes.rfqHub.inbox} className="text-xs font-semibold text-[#175640] underline-offset-2 hover:underline">Apri inbox →</Link>
          </div>
          {!canWrite ? (
            <p className="mt-3 text-sm text-[#52615b]">Consultazione disponibile in sola lettura. Le azioni operative sono riservate ai ruoli autorizzati.</p>
          ) : procurementPayload === null ? (
            <p className="mt-3 text-sm text-[#52615b]">Priorità non disponibili al momento. Puoi comunque aprire le tue RFQ.</p>
          ) : actionableRfqs.length ? (
            <div className="mt-3 space-y-2">
              {actionableRfqs.map((item) => (
                <Link key={item.rfq_id} href={appRoutes.rfqHub.campaign(item.rfq_id!)} className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-[#d6e5dd] bg-[#f7faf8] px-3 py-2 text-sm font-medium text-[#173f35] hover:border-[#8db9a2]">
                  <span className="min-w-0 truncate">{item.headline || "RFQ da gestire"}</span><span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[#52615b]">{attentionTotal === 0 ? "Nessuna azione buyer in sospeso." : "Controlla l’inbox per eventuali altre azioni."}</p>
          )}
        </div>
      </section>

      {composing && catalogOptions ? (
        <section id="commercial-compose" aria-labelledby="commercial-compose-heading" className="scroll-mt-36 space-y-3 rounded-2xl border border-[var(--border-strong)] bg-white p-3 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-primary)]">La tua nuova richiesta</p>
              <h2 id="commercial-compose-heading" className="text-lg font-semibold text-[var(--brand-deep)]">Crea distinta e RFQ senza lasciare Commerciale</h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">La creazione genera una bozza privata. Nessun invio ai fornitori avviene automaticamente.</p>
            </div>
            <Link href={appRoutes.commercial.home + "#commercial-worklist"} className="app-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold">Chiudi editor</Link>
          </div>
          <BuyerDistintaBuilder
            workspace
            authenticated
            returnToCommercial
            userId={context.userId}
            emailConfigured={Boolean(process.env.RESEND_API_KEY)}
            catalogOptions={catalogOptions}
          />
        </section>
      ) : null}

      <CommercialUnifiedWorklist
        data={unified}
        selected={selected}
        query={query}
        view={view}
        canWrite={canWrite}
      />

      <details className="rounded-2xl border border-[var(--border)] bg-white p-3 sm:p-4">
        <summary className="min-h-10 cursor-pointer select-none text-sm font-semibold text-[var(--brand-deep)]">
          Storico, memoria commerciale e intelligence · Apri approfondimenti
        </summary>
        <div className="space-y-4 pt-4">
      <section className="rounded-2xl border border-[#b8d2c8] bg-[#edf5f2] p-4 sm:p-5">
        <p className="app-kicker">Cerca nella Commercial Memory</p>
        <h2 className="mt-2 text-lg font-semibold text-[#173f35] sm:text-xl">
          Prodotto, cliente, RFQ, offerta, ordine o prezzo
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#52615b]">
          Parti da una parola, una misura, una norma, un grado o il nome di un&apos;azienda.
        </p>

        <form
          action={appRoutes.commercial.search}
          method="get"
          className="mt-5 flex flex-col gap-2 sm:flex-row"
        >
          <label htmlFor="commercial-memory-search" className="sr-only">
            Cerca nella memoria commerciale
          </label>
          <input
            id="commercial-memory-search"
            name="q"
            type="search"
            placeholder="Es. S355J2H, EN 10219, 100x100x5, cliente..."
            className="h-12 min-w-0 flex-1 rounded-xl border border-[#c9d9d3] bg-white px-4 text-sm text-[#1d2824] outline-none placeholder:text-[#5d6a65] focus:border-[#438d7a] focus:ring-4 focus:ring-[#dcebe6]"
          />
          <button
            type="submit"
            className="app-primary min-h-12 rounded-xl px-6 text-sm font-semibold"
          >
            Cerca
          </button>
        </form>
      </section>

      <section aria-labelledby="commercial-overview">
        <FocusSectionHeader
          eyebrow="Memoria disponibile"
          title={<span id="commercial-overview">Cosa contiene il workspace</span>}
          action={
            <Link href={appRoutes.commercial.explorer} className="text-xs font-semibold text-[#173f35] hover:underline">
              Esplora tutto →
            </Link>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metricCards.map((item) => (
            <div key={item.label} className="rounded-2xl border border-[#dce2df] bg-white p-4">
              <p className="metric-number text-2xl font-semibold text-[#173f35]">{item.value}</p>
              <p className="mt-1 text-xs font-semibold text-[#5d6a65]">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="commercial-recent">
        <FocusSectionHeader
          eyebrow="Attività recente"
          title={<span id="commercial-recent">Ultimi movimenti</span>}
          action={
            <Link href={appRoutes.commercial.search} className="text-xs font-semibold text-[#173f35] hover:underline">
              Apri storico →
            </Link>
          }
        />

        {recent.length === 0 ? (
          <FirstUseEmptyState
            eyebrow="Memoria ancora vuota"
            title="Qui compariranno le ultime RFQ, offerte e ordini"
            description="Quando il workspace contiene dati commerciali, questa sezione mostra solo gli ultimi movimenti utili."
            primaryAction={{
              href: appRoutes.commercial.search,
              label: "Apri la ricerca",
            }}
            compact
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#dce2df] bg-white">
            {recent.slice(0, 5).map((row, index) => (
              <Link
                key={row.id}
                href={row.operationalHref ?? appRoutes.commercial.conversation(row.conversationId)}
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
                  <p className="mt-1 text-xs text-[#5d6a65]">
                    {Math.round(row.confidence * 100)}% affidabilità
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="commercial-tools">
        <FocusSectionHeader
          eyebrow="Approfondisci"
          title={<span id="commercial-tools">Tre modi per leggere la memoria</span>}
        />

        <div className="grid gap-3 md:grid-cols-3">
          {coreTools.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#b8d2c8] hover:shadow-sm"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5d6a65]">
                {item.meta}
              </p>
              <div className="mt-2 flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-[#1d2824]">{item.title}</h3>
                <span className="font-semibold text-[#173f35]" aria-hidden="true">
                  →
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#5d6a65]">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="commercial-intelligence">
        <FocusSectionHeader
          eyebrow="Intelligence"
          title={<span id="commercial-intelligence">Analizza solo quando serve</span>}
          description="Gli strumenti avanzati sono raggruppati per obiettivo commerciale, non per architettura interna."
        />

        <div className="grid gap-3 lg:grid-cols-3">
          {intelligenceGroups.map((group) => (
            <div key={group.title} className="rounded-2xl border border-[#dce2df] bg-white p-5">
              <h3 className="text-base font-semibold text-[#1d2824]">{group.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#5d6a65]">{group.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.links.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="inline-flex min-h-10 items-center rounded-xl border border-[#d7dfdb] bg-[#f8faf9] px-3 text-xs font-semibold text-[#173f35] transition hover:border-[#9db9af] hover:bg-[#edf5f2]"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

        </div>
      </details>

      <p className="rounded-xl border border-[#d9e8e2] bg-[#f3f7f5] px-4 py-3 text-xs leading-5 text-[#52615b]">
        Commerciale riunisce i tuoi flussi di lavoro, ma i confini dei dati restano distinti: la memoria privata, le RFQ buyer, il Network e il Marketplace non condividono automaticamente prezzi, contatti o documenti.
      </p>
    </FocusPage>
  );
}

import Link from "next/link";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { PilotEvent } from "@/components/pilot-event";
import { FocusPage, FocusSectionHeader } from "@/components/focus-ui";
import { Badge } from "@/components/ui/badge";
import { getDashboardData } from "@/lib/commercial-data";
import { BuyerDistintaBuilder } from "@/components/buyer-distinta-builder";
import { CommercialCalculatorQuickAccess } from "@/components/commercial-calculator-quick-access";
import { CommercialAiCompanion } from "@/components/commercial-ai-companion";
import cinematic from "@/components/commercial-cinematic.module.css";
import { CommercialUnifiedWorklist } from "@/components/commercial-unified-worklist";
import { CommercialDirectorPriorityDesk } from "@/components/commercial-director-priority-desk";
import type { CommercialOperationsTab } from "@/components/commercial-campaign-operations";
import { buildBuyerDistintaCatalogOptions } from "@/lib/buyer-distinta-catalog";
import { loadUnifiedCommercialData, type CommercialView } from "@/lib/commercial-unified-data";
import { includeSelectedCommercialCampaign, isCommercialPagedView, loadCommercialPagedData, parseCommercialPage } from "@/lib/commercial-unified-paged";
import { isStreamView, loadCommercialStreams } from "@/lib/commercial-unified-streams";
import { listBuyerDistintaPublicDimensions, listPublicTubeDimensionPages } from "@/lib/public-knowledge";
import { canWriteWorkspace } from "@/lib/access-policy";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { getCommercialNetworkContext } from "@/lib/commercial-network-context";
import { getNetworkInquiries } from "@/lib/network";
import { getCommercialNetworkProspect, listCommercialNetworkProspects } from "@/lib/commercial-network-prospect";
import { getNetworkAccessState } from "@/lib/network-access";
import { confirmCommercialNetworkProspect, removeCommercialNetworkProspect } from "./network-prospect-actions";
import { loadCompanyDirectory } from "@/app/(workspace)/customers/actions";
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
  {
    href: appRoutes.commercial.knowledgeExplorer,
    title: "Memoria documentale",
    description: "Ricerca riservata su documenti, offerte e ordini, con fonti e permessi aziendali.",
    meta: "Memoria privata",
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
  searchParams: Promise<{ view?: string; q?: string; item?: string; compose?: string; tab?: string; page?: string; cursor?: string; network?: string; prospect?: string; prospects?: string }>;
}) {
  const params = await searchParams;
  const context = await getWorkspaceContext();
  const canWrite = canWriteWorkspace(context.role);
  const networkAvailable = isNetworkFrontendEnabled();
  const showProspects = networkAvailable && params.prospects === "1";
  const prospectAccess = showProspects
    ? await getNetworkAccessState(context.organizationId).catch(() => null)
    : null;
  const prospectList = showProspects && prospectAccess?.can_access_network && prospectAccess.organization_id === context.organizationId
    ? await listCommercialNetworkProspects(context.organizationId, context.userId)
    : null;
  const allowedViews: CommercialView[] = ["all", "received", "sent", "offers", "orders", "drafts"];
  const view: CommercialView = allowedViews.includes(params.view as CommercialView) ? params.view as CommercialView : "all";
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const page = parseCommercialPage(params.page);
  const selected = typeof params.item === "string" ? params.item.slice(0, 90) : "";
  const allowedTabs: CommercialOperationsTab[] = ["compare", "negotiate", "award", "po"];
  const tab: CommercialOperationsTab = allowedTabs.includes(params.tab as CommercialOperationsTab) ? params.tab as CommercialOperationsTab : "compare";
  const composing = canWrite && params.compose === "1";
  const [commercial, procurement, unified, catalogOptions, networkContext, calculatorReferences] = await Promise.all([
    getDashboardData(),
    canWrite
      ? createClient().then((db) => db.rpc("rfqh10_procurement_inbox", { p_limit: 4 }))
          .catch(() => ({ data: null, error: true }))
      : Promise.resolve({ data: null, error: null }),
    isCommercialPagedView(view)
      ? loadCommercialPagedData({ organizationId: context.organizationId, view, query, page })
      : isStreamView(view)
        ? loadCommercialStreams({ organizationId: context.organizationId, view, query, cursor: params.cursor })
        : loadUnifiedCommercialData(context.organizationId),
    composing ? listBuyerDistintaPublicDimensions().then(buildBuyerDistintaCatalogOptions) : Promise.resolve(null),
    // Explicit GET-only handoff; invalid/locked Network ids never trigger a profile read.
    getCommercialNetworkContext(context.organizationId, params.network),
    listPublicTubeDimensionPages(),
  ]);
  const [prospect, possibleCompanies, inquiries] = networkContext
    ? await Promise.all([
        getCommercialNetworkProspect(context.organizationId, context.userId, networkContext.id),
        loadCompanyDirectory(networkContext.name).catch(() => ({ total: 0, companies: [] })),
        getNetworkInquiries(context.organizationId, "sent").catch(() => null),
      ])
    : [{ status: "unavailable" as const, savedAt: null }, { total: 0, companies: [] }, null];
  // A name match is only a candidate for manual identity review. It is NOT a verified
  // Network-to-Company360 link, and never mutates canonical identities.
  const relevantInquiries = (inquiries?.items ?? [])
    .filter((inquiry) => inquiry.recipient_network_company_id === networkContext?.id)
    .slice(0, 3);
  const possibleMatches = possibleCompanies.companies
    .filter((candidate) => candidate.name.trim().toLocaleLowerCase("it-IT") === networkContext?.name.toLocaleLowerCase("it-IT"))
    .slice(0, 2);
  // Resolve a specifically selected RFQ with tenant RLS when it is older than
  // the first paginated Commerciale worklist page. Normal visits add no query.
  const displayedUnified = view === "sent" && selected.startsWith("campaign:")
    ? await includeSelectedCommercialCampaign(context.organizationId, selected, unified)
    : unified;
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
  const actionableRfqs = (procurementPayload?.items ?? []).filter((item): item is {
    rfq_id: string; headline?: string; requires_action?: boolean;
  } =>
    item.requires_action === true && typeof item.rfq_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.rfq_id)
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
    <FocusPage compact className={"max-w-[1480px] " + cinematic.page}>
      <PilotEvent eventName="commercial_home_viewed" metadata={{ surface: "commercial_home" }} />
      <section aria-label="Commerciale Smart Steel Sales" data-testid="comm-cine1-hero"
        className={"relative isolate overflow-hidden border border-[#174437] bg-[#082f28] text-white " + cinematic.hero}>
        <div className={"grid items-center gap-4 px-5 py-5 sm:px-7 lg:min-h-[172px] lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-7 lg:px-8 lg:py-5 " + cinematic.heroGrid}>
          <div className="relative z-10 min-w-0">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#add4bb]">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9fe4b5]" />
              Smart Steel Sales / Commerciale
            </div>
            <h1 className={"mt-2 text-[clamp(1.65rem,2.5vw,2.25rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-white " + cinematic.heroTitle}>
              Le tue trattative. <span className="text-[#b4dec2]">Un’unica visione.</span>
            </h1>
            <p className="mt-2 text-xs leading-5 text-[#d2e7db]">
              Richieste, offerte e ordini in un unico spazio.
            </p>
          </div>
          <div aria-label="Il tuo centro operativo" className={"relative z-10 hidden lg:block " + cinematic.heroMetrics}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a9d7bc]">Il tuo centro operativo</p>
            <dl className="grid grid-cols-3 gap-2">
              <div><dt className="text-[10px] text-[#c6ddce]">Richieste</dt><dd className="text-xl font-semibold tabular-nums text-white">{operational.rfqs}</dd></div>
              <div><dt className="text-[10px] text-[#c6ddce]">Offerte</dt><dd className="text-xl font-semibold tabular-nums text-white">{operational.offers}</dd></div>
              <div><dt className="text-[10px] text-[#c6ddce]">Ordini</dt><dd className="text-xl font-semibold tabular-nums text-white">{operational.orders}</dd></div>
            </dl>
            <p className="mt-2 text-[10px] font-medium text-[#b8d8c6]">
              {mode === "live" ? "Dati live" : mode === "demo" ? "Modalità demo" : "Dati in attesa di associazione"} · Workspace privato
            </p>
          </div>
        </div>
      </section>

      {/* COMM-NAV9.M: director decisions must precede tools on the mobile first
          viewport. The same DOM order on desktop preserves keyboard/screen-reader
          reading order; do not duplicate the priority links for responsive UX. */}
      <CommercialDirectorPriorityDesk
        canWrite={canWrite}
        attentionTotal={attentionTotal}
        actionableRfqs={actionableRfqs}
        procurementAvailable={procurementPayload !== null}
        data={displayedUnified}
        view={view}
      />

      <div data-testid="comm-cine13-first-workspace" className="relative z-10 px-1 sm:px-2">
        <CommercialAiCompanion canWrite={canWrite} />
      </div>

      <section id="commercial-tool-access" aria-label="Azioni rapide Commerciale"
        data-testid="commercial-primary-quick-actions"
        className="scroll-mt-28 rounded-2xl border border-[#d6e5db] bg-white px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CommercialCalculatorQuickAccess references={calculatorReferences} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {networkAvailable ? (
              <nav aria-label="Relazioni commerciali" className="flex flex-wrap items-center gap-3">
                <Link href={appRoutes.commercial.home + "?prospects=1#commercial-prospects"}
                  className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] hover:underline">
                  Aziende da seguire →
                </Link>
                <Link href={appRoutes.network.directory}
                  className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] hover:underline">
                  Network
                </Link>
              </nav>
            ) : null}
          {canWrite ? (
            <Link href={appRoutes.commercial.home + "?compose=1#commercial-compose"}
              className="app-primary inline-flex min-h-10 items-center rounded-lg border border-[#175640] bg-[#175640] px-3 text-xs font-semibold text-white hover:bg-[#104632] focus-visible:outline-2 focus-visible:outline-offset-2">
              + Nuova richiesta
            </Link>
          ) : null}
          </div>
        </div>
      </section>

      {composing && catalogOptions ? (
        <section id="commercial-compose" aria-labelledby="commercial-compose-heading" className="scroll-mt-36 space-y-3 rounded-2xl border border-[var(--border-strong)] bg-white p-3 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-primary)]">La tua nuova richiesta</p>
              <h2 id="commercial-compose-heading" className="text-lg font-semibold text-[var(--brand-deep)]">Crea distinta e RFQ senza lasciare Commerciale</h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">La creazione genera una bozza privata. Nessun invio ai fornitori avviene automaticamente.</p>
              {networkContext ? (
                <p className="mt-1 text-xs font-medium leading-5 text-[#175640]" data-testid="commercial-network-draft-disclaimer">
                  Provenienza: Network · {networkContext.name}. Compila la distinta e scegli i destinatari manualmente: questo contesto non precompila, collega né invia richieste all’azienda.
                </p>
              ) : null}
            </div>
            {canWrite ? (
             <Link href={appRoutes.commercial.home + "?compose=1#commercial-ai-intake"}
               className="inline-flex min-h-10 items-center rounded-lg border border-[#a9cbb9] bg-[#edf7f1] px-3 text-xs font-semibold text-[#175640] hover:bg-[#dcefe4]"
               data-testid="commercial-ai-intake-link">
               Assistente AI · prepara distinta
             </Link>
           ) : null}
           <Link href={appRoutes.commercial.home + "#commercial-worklist"} className="app-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold">Chiudi editor</Link>
          </div>
          <BuyerDistintaBuilder
            workspace
            authenticated
            returnToCommercial
            userId={context.userId}
            organizationId={context.organizationId}
            emailConfigured={Boolean(process.env.RESEND_API_KEY)}
            catalogOptions={catalogOptions}
          />
        </section>
      ) : null}

      <CommercialUnifiedWorklist
        data={displayedUnified}
        page={page}
        selected={selected}
        query={query}
        view={view}
        canWrite={canWrite}
        tab={tab}
      />


      {(networkContext || showProspects) ? (
        <section id="commercial-relations" aria-label="Relazioni dal Network" className="scroll-mt-28 space-y-3">

      {networkContext ? (
        <section
          id="network-commercial-context"
          aria-labelledby="network-commercial-heading"
          data-testid="commercial-network-context"
          className="scroll-mt-24 rounded-xl border border-[#bdd8c8] bg-[#f4faf6] px-3 py-3 sm:px-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-[#246c53]">Dal Network al Commerciale</p>
              <h2 id="network-commercial-heading" className="mt-0.5 break-words text-base font-semibold text-[#173f35]">
                {networkContext.name}
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-[#53665b]">
                {networkContext.role ? networkContext.role + " · " : ""}{networkContext.country}
                {" · "}{networkContext.verifiedIdentity ? "Identità verificata" : "Profilo Network pubblicato"}
                {networkContext.products.length ? " · Catalogo: " + networkContext.products.join(", ") : ""}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#52615b]">
                Contesto pubblico per valutazione commerciale, non una relazione CRM salvata.
                L’azienda non viene aggiunta ai destinatari RFQ: selezione e invio restano manuali.
              </p>
            </div>
            <Link
              href={appRoutes.commercial.home}
              className="inline-flex min-h-10 items-center rounded-lg px-2 text-xs font-semibold text-[#175640] underline underline-offset-4"
            >Rimuovi contesto</Link>
          </div>
          <div className="mt-3 rounded-lg border border-[#d6e7dc] bg-white px-3 py-3" data-testid="commercial-private-prospect">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#173f35]">Relazione da seguire · lista privata</p>
                <p className="mt-0.5 text-xs leading-5 text-[#52615b]">
                  Salva questa azienda nella tua lista personale di opportunità. Non crea una Company 360, non associa contatti e non comunica nulla all’azienda.
                </p>
              </div>
              <Link href={appRoutes.commercial.home + "?prospects=1#commercial-prospects"}
                className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4"
              >La mia lista →</Link>
            </div>
            {prospect.status === "saved" ? (
              <div>
                <div role="status" className="mt-2 rounded-md bg-[#eaf6ee] px-3 py-2 text-xs font-semibold text-[#175640]">
                  Salvata nella tua lista privata
                  {prospect.savedAt && !Number.isNaN(Date.parse(prospect.savedAt))
                    ? " · " + new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeZone: "Europe/Rome" }).format(new Date(prospect.savedAt))
                    : ""}
                  . Nessuna RFQ inviata.
                </div>
                {canWrite ? (
                  <form action={removeCommercialNetworkProspect} className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="network_company_id" value={networkContext.id} />
                    <label className="flex items-center gap-2 text-xs text-[#52615b]">
                      <input type="checkbox" name="confirm_remove" value="yes" required
                        className="h-4 w-4 accent-[#175640]" />
                      Confermo la rimozione dalla mia lista personale
                    </label>
                    <button type="submit"
                      className="inline-flex min-h-10 items-center rounded-lg border border-[#c9d7cf] px-3 text-xs font-semibold text-[#795521] hover:bg-[#fff6e9] focus-visible:outline-2 focus-visible:outline-offset-2"
                    >Rimuovi dalla mia lista</button>
                  </form>
                ) : null}
              </div>
            ) : prospect.status === "unavailable" ? (
              <p role="status" className="mt-2 text-xs text-[#75582a]">
                Salvataggio non verificabile al momento. Riprova dopo aver aggiornato la pagina.
              </p>
            ) : canWrite ? (
              <form action={confirmCommercialNetworkProspect} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="network_company_id" value={networkContext.id} />
                <label className="flex items-start gap-2 text-xs leading-5 text-[#52615b]">
                  <input name="confirm_prospect" type="checkbox" value="yes" required
                    className="mt-1 h-4 w-4 shrink-0 accent-[#175640]" />
                  Confermo il salvataggio privato nel mio workspace personale: nessuna associazione CRM e nessun invio automatico.
                </label>
                <button type="submit"
                  className="inline-flex min-h-10 w-fit items-center rounded-lg bg-[#175640] px-3 text-xs font-semibold text-white hover:bg-[#246c53] focus-visible:outline-2 focus-visible:outline-offset-2"
                >Salva azienda da seguire</button>
              </form>
            ) : (
              <p className="mt-2 text-xs leading-5 text-[#52615b]">
                Solo i ruoli commerciali autorizzati possono salvare nuove aziende.
              </p>
            )}
            {params.prospect === "saved" || params.prospect === "existing" || params.prospect === "removed" ? (
              <p role="status" className="mt-2 text-xs text-[#175640]">
                {params.prospect === "existing" ? "Azienda già presente nella tua lista: nessun duplicato creato." : params.prospect === "removed" ? "Azienda rimossa dalla tua lista privata." : "Azienda aggiunta alla tua lista privata."}
              </p>
            ) : params.prospect === "invalid" || params.prospect === "unavailable" || params.prospect === "denied" ? (
              <p role="alert" className="mt-2 text-xs text-[#945321]">
                Operazione non eseguita. Verifica autorizzazioni, conferma e disponibilità del Network.
              </p>
            ) : null}
          </div>
          {relevantInquiries.length > 0 ? (
            <section aria-label="Storico interazioni Network" className="mt-2 rounded-lg border border-[#d6e7dc] bg-white p-3" data-testid="commercial-prospect-activity">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-[#173f35]">Attività Network già avviate</h3>
                <Link href={appRoutes.network.inquiries}
                  className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4"
                >Apri interazioni →</Link>
              </div>
              <p className="text-[11px] leading-4 text-[#53665b]">
                Ultime richieste inviate dalla tua organizzazione a questa azienda; non sono automaticamente collegate alla Company 360.
              </p>
              <div className="mt-1 divide-y divide-[#e2ece6]">
                {relevantInquiries.map((inquiry) => (
                  <div key={inquiry.id} className="py-2">
                    <p className="break-words text-xs font-medium text-[#173f35]">{inquiry.subject}</p>
                    <p className="mt-0.5 text-[11px] text-[#52615b]">
                      Stato: {inquiry.status}
                      {inquiry.submitted_at && !Number.isNaN(Date.parse(inquiry.submitted_at))
                        ? " · " + new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeZone: "Europe/Rome" }).format(new Date(inquiry.submitted_at))
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {possibleMatches.length > 0 ? (
            <div className="mt-2 rounded-lg border border-[#eadbbc] bg-[#fffaf0] p-3" data-testid="commercial-identity-candidates">
              <p className="text-xs font-semibold text-[#795521]">Possibile azienda già nello storico commerciale</p>
              <p className="mt-1 text-xs leading-5 text-[#715d40]">
                Il nome coincide, ma l’identità non è stata verificata. Controlla la Company 360 prima di creare altre associazioni.
              </p>
              {possibleMatches.map((candidate) => (
                <Link key={candidate.company_id} href={appRoutes.commercial.company(candidate.company_id)}
                  className="mt-1 inline-flex min-h-10 items-center text-xs font-semibold text-[#795521] underline underline-offset-4"
                >Verifica {candidate.name} in Company 360 →</Link>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link
              href={appRoutes.commercial.search + "?q=" + encodeURIComponent(networkContext.name)}
              className="inline-flex min-h-10 items-center rounded-lg border border-[#b6d3c0] bg-white px-3 text-xs font-semibold text-[#175640] hover:bg-[#e7f3eb] focus-visible:outline-2 focus-visible:outline-offset-2"
            >Cerca nello storico →</Link>
            {canWrite ? (
              <Link
                href={appRoutes.commercial.home + "?network=" + encodeURIComponent(networkContext.id) + "&compose=1#commercial-compose"}
                className="inline-flex min-h-10 items-center rounded-lg bg-[#175640] px-3 text-xs font-semibold text-white hover:bg-[#246c53] focus-visible:outline-2 focus-visible:outline-offset-2"
              >Prepara RFQ privata →</Link>
            ) : (
              <span className="text-xs text-[#52615b]">Consultazione: nessuna modifica o invio disponibile.</span>
            )}
            <Link
              href={appRoutes.network.company(networkContext.id)}
              className="inline-flex min-h-10 items-center px-1 text-xs font-semibold text-[#175640] underline underline-offset-4"
            >Rivedi il profilo Network →</Link>
          </div>
        </section>
      ) : null}

      {showProspects ? (
        <section id="commercial-prospects" aria-labelledby="commercial-prospects-heading"
          className="scroll-mt-24 rounded-xl border border-[#d6e7dc] bg-white p-3 sm:p-4" data-testid="commercial-prospect-list">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#246c53]">Relazioni da esplorare</p>
              <h2 id="commercial-prospects-heading" className="mt-0.5 text-base font-semibold text-[#173f35]">La mia lista privata</h2>
              <p className="mt-0.5 text-xs leading-5 text-[#52615b]">
                Prospect salvati personalmente dal Network. Nessuna Company 360 o relazione CRM verificata viene creata automaticamente.
              </p>
            </div>
            <Link href={appRoutes.commercial.home}
              className="inline-flex min-h-10 items-center px-2 text-xs font-semibold text-[#175640] underline underline-offset-4"
            >Chiudi lista</Link>
          </div>
          {!prospectList ? (
            <p role="status" className="mt-3 text-xs text-[#795521]">
              Lista non disponibile: verifica il tuo accesso Network o riprova.
            </p>
          ) : prospectList.length === 0 ? (
            <p role="status" className="mt-3 text-xs text-[#52615b]">
              Nessuna azienda salvata per questo utente. Esplora il Network e conferma un prospect nel Commerciale.
            </p>
          ) : (
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
              {prospectList.map((item) => (
                <article key={item.id} className="min-w-0 rounded-lg border border-[#dce9df] bg-[#f9fcfa] p-3">
                  <h3 className="truncate text-sm font-semibold text-[#173f35]">{item.name}</h3>
                  <p className="mt-0.5 text-xs text-[#53665b]">
                    {item.country}
                    {item.savedAt && !Number.isNaN(Date.parse(item.savedAt))
                      ? " · Salvata " + new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeZone: "Europe/Rome" }).format(new Date(item.savedAt))
                      : ""}
                  </p>
                  <Link href={appRoutes.commercial.home + "?network=" + encodeURIComponent(item.id) + "#network-commercial-context"}
                    className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4"
                  >Apri in Commerciale →</Link>
                </article>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-[#64746a]">Fino alle ultime 12 aziende salvate, visibili esclusivamente a te.</p>
        </section>
      ) : null}

        </section>
      ) : null}

      <details id="commercial-memory-panel" className="group scroll-mt-28 overflow-hidden rounded-[22px] border border-[#dce8df] bg-white p-4 sm:p-5">
        <summary className="flex min-h-11 cursor-pointer select-none items-center text-base font-semibold text-[#175640] marker:text-[#175640]">
          Memoria commerciale e storico · Approfondisci
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

        </div>
      </details>

      <details id="commercial-tools-panel" className="group scroll-mt-28 overflow-hidden rounded-[22px] border border-[#dce8df] bg-white p-4 sm:p-5">
        <summary className="flex min-h-11 cursor-pointer select-none items-center text-base font-semibold text-[#175640] marker:text-[#175640]">
          Strumenti e intelligence avanzata · Apri
        </summary>
        <div className="space-y-4 pt-4">

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

      <p className="px-2 pb-2 text-[11px] leading-5 text-[#647568]">
        Commerciale riunisce i tuoi flussi di lavoro, ma i confini dei dati restano distinti: la memoria privata, le RFQ buyer, il Network e il Marketplace non condividono automaticamente prezzi, contatti o documenti.
      </p>
    </FocusPage>
  );
}

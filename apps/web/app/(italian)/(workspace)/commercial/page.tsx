import Link from "next/link";

import { PilotEvent } from "@/components/pilot-event";
import { FocusPage } from "@/components/focus-ui";
import { BuyerDistintaBuilder } from "@/components/buyer-distinta-builder";
import { CommercialCalculatorQuickAccess } from "@/components/commercial-calculator-quick-access";
import { CommercialAiCompanion } from "@/components/commercial-ai-companion";
import { CommercialAiNativeShell } from "@/components/commercial-ai-native-shell";
import cinematic from "@/components/commercial-cinematic.module.css";
import { CommercialRequestSummary } from "@/components/commercial-request-summary";
import { CommercialUnifiedWorklist } from "@/components/commercial-unified-worklist";
import { CommercialDirectorPriorityDesk } from "@/components/commercial-director-priority-desk";
import type { CommercialOperationsTab } from "@/components/commercial-campaign-operations";
import { buildBuyerDistintaCatalogOptions } from "@/lib/buyer-distinta-catalog";
import { loadUnifiedCommercialData, type CommercialView } from "@/lib/commercial-unified-data";
import { includeSelectedCommercialCampaign, isCommercialPagedView, loadCommercialPagedData, parseCommercialPage } from "@/lib/commercial-unified-paged";
import { withDealLabels } from "@/lib/commercial-deal-labels";
import { isStreamView, loadCommercialRequestSummary, loadCommercialStreams, parseCommercialFocus } from "@/lib/commercial-unified-streams";
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

export default async function CommercialHomePage({
  searchParams,
}: {
  searchParams: Promise<{ experience?: string; view?: string; q?: string; item?: string; compose?: string; method?: string; tab?: string; page?: string; cursor?: string; focus?: string; network?: string; prospect?: string; prospects?: string }>;
}) {
  const params = await searchParams;
  const context = await getWorkspaceContext();
  const canWrite = canWriteWorkspace(context.role);
  // COMM-AI-NATIVE1.CLEAN1: AI-first is the default Commerciale landing.
  // Explicit classic and all operational deep links preserve the established workbench.
  // COMM_AI_NATIVE_UI_ENABLED=0 remains an emergency rollback switch.
  const legacyRouteRequested =
    params.compose === "1" || params.view !== undefined || params.item !== undefined ||
    params.q !== undefined || params.page !== undefined || params.cursor !== undefined ||
    params.tab !== undefined || params.focus !== undefined || params.network !== undefined ||
    params.prospect !== undefined || params.prospects === "1";
  const aiNativeEnabled = params.experience === "ai" ||
    (params.experience !== "classic" && process.env.COMM_AI_NATIVE_UI_ENABLED !== "0");
  // COMM-DESK-AI1: la chat convive con la scrivania. L'assistente compatto
  // sostituisce l'hero scuro sopra contatori e trattative; nulla resta dietro
  // «Gestione completa». experience=classic e COMM_AI_NATIVE_UI_ENABLED=0
  // riportano l'hero precedente senza altre differenze.
  const aiDeskLanding = aiNativeEnabled && !legacyRouteRequested;
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
  const focus = view === "all" ? parseCommercialFocus(params.focus) : "";
  const page = parseCommercialPage(params.page);
  const selected = typeof params.item === "string" ? params.item.slice(0, 90) : "";
  const allowedTabs: CommercialOperationsTab[] = ["compare", "negotiate", "award", "po"];
  const tab: CommercialOperationsTab = allowedTabs.includes(params.tab as CommercialOperationsTab) ? params.tab as CommercialOperationsTab : "compare";
  const composing = canWrite && params.compose === "1";
  const aiFocused = composing && params.method === "ai";
  const [procurement, unified, catalogOptions, networkContext, calculatorReferences, requestSummary] = await Promise.all([
    canWrite
      ? createClient().then((db) => db.rpc("rfqh10_procurement_inbox", { p_limit: 4 }))
          .catch(() => ({ data: null, error: true }))
      : Promise.resolve({ data: null, error: null }),
    isCommercialPagedView(view)
      ? loadCommercialPagedData({ organizationId: context.organizationId, view, query, page })
      : isStreamView(view)
        ? loadCommercialStreams({ organizationId: context.organizationId, view, query, cursor: params.cursor, focus })
        : loadUnifiedCommercialData(context.organizationId),
    composing ? listBuyerDistintaPublicDimensions().then(buildBuyerDistintaCatalogOptions) : Promise.resolve(null),
    // Explicit GET-only handoff; invalid/locked Network ids never trigger a profile read.
    getCommercialNetworkContext(context.organizationId, params.network),
    listPublicTubeDimensionPages(),
    aiFocused ? Promise.resolve(null) : loadCommercialRequestSummary(context.organizationId).catch(() => null),
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
  const displayedUnified = await withDealLabels(
    view === "sent" && selected.startsWith("campaign:")
      ? await includeSelectedCommercialCampaign(context.organizationId, selected, unified)
      : unified,
    context.organizationId,
  );
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
  return (
    <FocusPage compact className={"max-w-[1480px] " + cinematic.page}>
      <PilotEvent eventName="commercial_home_viewed" metadata={{ surface: aiDeskLanding ? "commercial_ai_native" : "commercial_home" }} />
      {aiFocused ? (
        <header data-testid="commercial-rfq-ai-focused-header" aria-labelledby="commercial-rfq-ai-focused-heading"
          className={"relative " + cinematic.hero}>
          <div className={"flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6 " + cinematic.heroGrid}>
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-lg text-white">✦</span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#b4dec2]">Commerciale / Nuova richiesta</p>
                <h1 id="commercial-rfq-ai-focused-heading" className="mt-0.5 text-lg font-bold tracking-tight text-white sm:text-xl">
                  Crea una richiesta di offerta
                </h1>
                <p className="mt-0.5 text-xs text-[#d5eadc]">Descrivi i materiali, conferma gli articoli in distinta, poi crea la RFQ privata.</p>
              </div>
            </div>
            <Link href={appRoutes.commercial.home}
              className={"inline-flex min-h-10 items-center rounded-xl border border-white/40 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20 " + cinematic.heroAction}>
              ← Torna alla scrivania
            </Link>
          </div>
        </header>
      ) : (<>
      <h1 className="sr-only" data-testid="comm-cine1-hero">Commerciale · Le tue trattative</h1>

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

      {aiNativeEnabled ? (
        <CommercialAiNativeShell canWrite={canWrite} compact />
      ) : (
      <section data-testid="comm-cine13-first-workspace" aria-labelledby="commercial-create-heading"
        className={"relative z-10 " + cinematic.hero}>
        <div className={"grid gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-8 lg:p-8 " + cinematic.heroGrid}>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#b4dec2]">Nuova richiesta</p>
            <h2 id="commercial-create-heading"
              className={"mt-2 text-[clamp(1.6rem,2.6vw,2.35rem)] font-bold leading-[1.05] tracking-[-0.035em] text-white " + cinematic.heroTitle}>
              Crea una richiesta di offerta
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#d5eadc]">
              Scrivi cosa ti serve e l’assistente prepara la distinta, oppure compilala tu riga per riga. Nulla parte senza la tua conferma.
            </p>
            {canWrite ? (
              <Link href={appRoutes.commercial.home + "?compose=1#commercial-compose"}
                data-testid="commercial-manual-entry"
                className={"mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/50 bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white " + cinematic.heroAction}>
                <span aria-hidden="true">▤</span> Crea dalla distinta →
              </Link>
            ) : null}
          </div>
          <CommercialAiCompanion canWrite={canWrite} />
        </div>
      </section>
      )}

      <CommercialRequestSummary view={view} counts={requestSummary} tools={
        <details id="commercial-tool-access" data-testid="commercial-primary-quick-actions"
          className="group relative shrink-0 scroll-mt-28 [&_summary::-webkit-details-marker]:hidden">
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-[#d6e5db] bg-white px-3 text-xs font-semibold text-[#175640] hover:bg-[#f2f8f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]">
            Strumenti <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
          </summary>
          <div className="mt-1 flex min-w-[260px] flex-col items-stretch gap-2 rounded-xl border border-[#d6e5db] bg-white p-3 shadow-lg sm:absolute sm:right-0 sm:top-full sm:z-30"
            data-testid="commercial-alternative-methods">
            <CommercialCalculatorQuickAccess references={calculatorReferences} />
            <Link href={appRoutes.commercial.search} data-testid="commercial-history-entry"
              aria-label="Cerca RFQ, offerte, ordini e aziende già presenti nello storico commerciale"
              className="inline-flex min-h-10 items-center rounded-lg border border-[#d6e5db] bg-[#f3f7f4] px-3 text-xs font-semibold text-[#254f3d] hover:bg-[#e4f0e8] focus-visible:outline-2 focus-visible:outline-offset-2">
              Cerca nello storico ↗
            </Link>
          </div>
        </details>
      } />

      </>)}

      {composing && catalogOptions ? (
        <section id="commercial-compose" aria-labelledby="commercial-compose-heading" className={aiFocused ? "min-w-0" : "scroll-mt-36 space-y-3 rounded-2xl border border-[var(--border-strong)] bg-white p-3 sm:p-5"}>
          {!aiFocused ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-primary)]">La tua nuova richiesta</p>
              <h2 id="commercial-compose-heading" className="text-lg font-semibold text-[var(--brand-deep)]">{aiFocused ? "Verifica gli articoli e prepara la distinta" : "Crea distinta e RFQ senza lasciare Commerciale"}</h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">La creazione genera una bozza privata. Nessun invio ai fornitori avviene automaticamente.</p>
              {networkContext ? (
                <p className="mt-1 text-xs font-medium leading-5 text-[#175640]" data-testid="commercial-network-draft-disclaimer">
                  Provenienza: Network · {networkContext.name}. Compila la distinta e scegli i destinatari manualmente: questo contesto non precompila, collega né invia richieste all’azienda.
                </p>
              ) : null}
            </div>
            {canWrite && !aiFocused ? (
             <Link href={appRoutes.commercial.home + "?compose=1&method=ai#commercial-ai-intake"}
               className="inline-flex min-h-10 items-center rounded-lg border border-[#a9cbb9] bg-[#edf7f1] px-3 text-xs font-semibold text-[#175640] hover:bg-[#dcefe4]"
               data-testid="commercial-ai-intake-link">
               Assistente AI · prepara distinta
             </Link>
           ) : null}
           <Link href={appRoutes.commercial.home + "?experience=classic#commercial-worklist"} className="app-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold">Chiudi editor</Link>
          </div>
          ) : <h2 id="commercial-compose-heading" className="sr-only">Nuova distinta conversazionale</h2>}
          <BuyerDistintaBuilder
            workspace
            authenticated
            returnToCommercial
            focusAiIntake={aiFocused}
            userId={context.userId}
            organizationId={context.organizationId}
            emailConfigured={Boolean(process.env.RESEND_API_KEY)}
            catalogOptions={catalogOptions}
          />
        </section>
      ) : null}

      {!aiFocused ? (<>
      <CommercialUnifiedWorklist
        data={displayedUnified}
        page={page}
        selected={selected}
        query={query}
        view={view}
        canWrite={canWrite}
        tab={tab}
        focus={focus}
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
              >Aziende da seguire →</Link>
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
                >Salva nella mia lista</button>
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
            <Link href={appRoutes.network.directory}
              className="inline-flex min-h-10 items-center px-1 text-xs font-semibold text-[#175640] underline underline-offset-4"
            >Esplora il Network →</Link>
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

      <p className="px-2 pb-2 text-[11px] leading-5 text-[#647568]">
        Commerciale riunisce i tuoi flussi di lavoro, ma i confini dei dati restano distinti: la memoria privata, le RFQ buyer, il Network e il Marketplace non condividono automaticamente prezzi, contatti o documenti.
      </p>
      </>) : null}
    </FocusPage>
  );
}

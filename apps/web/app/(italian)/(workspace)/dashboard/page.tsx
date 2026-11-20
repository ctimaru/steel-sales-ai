import { newRequestHref } from "@/lib/new-request-href";
import Link from "next/link";

import { PilotEvent } from "@/components/pilot-event";
import { FocusPage } from "@/components/focus-ui";
import { HomeFeed } from "@/components/home-feed";
import { HomeNetworkProCard, summarizeNetworkProCoverage } from "@/components/home-network-pro-card";
import { WorkspaceFirstRunChecklist } from "@/components/workspace-first-run-checklist";
import { CompanyVerificationCard } from "@/components/company-verification-card";
import { loadCompanyVerification } from "@/lib/company-verification";
import { loadCompanyPostPublishState } from "@/lib/company-posts";
import { companyPostComposerMode } from "@/lib/company-posts-model";
import { canWriteWorkspace } from "@/lib/access-policy";
import { getDashboardData } from "@/lib/commercial-data";
import { dealDeskHref, parseDealIndex } from "@/lib/commercial-deal-model";
import { getCompanySetupState } from "@/lib/company-setup";
import { loadDashboardPulse } from "@/lib/dashboard-pulse";
import { loadHomeFeedPage } from "@/lib/home-feed";
import { initialHomeFeedCursor, pulseNewsItems, withPulseNews } from "@/lib/home-feed-model";
import { buildHomeFeedViewer } from "@/lib/home-feed-viewer";
import { getNetworkAccessState } from "@/lib/network-access";
import { getNetworkProCoverage } from "@/lib/network-pro-coverage";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { deriveWorkspaceFirstRun } from "@/lib/workspace-first-run";
import { organizationNameMatchesPerson, workspaceGreeting } from "@/lib/workspace-identity";

async function loadOwnRegistrationContactName(): Promise<string | null> {
  try {
    const db = await createClient();
    // RLS: "Applicants can read their own registration applications".
    const { data } = await db
      .from("company_registration_applications")
      .select("contact_name")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return typeof data?.contact_name === "string" ? data.contact_name : null;
  } catch {
    return null;
  }
}

/**
 * HOME-EMPTYSTATE1: shown instead of "Azioni buyer 0 · Urgenti 0 · RFQ attive 0".
 * Links only to existing creation surfaces; read-only roles get no create action.
 */
function RfqEmptyState({ canWrite, firstRun }: { canWrite: boolean; firstRun: boolean }) {
  return (
    <div role="status" data-testid="home-rfq-empty-state" className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-[#173f35]">Nessuna RFQ in corso</p>
      <p className="text-xs leading-5 text-[#52615b]">
        {canWrite
          ? "Prepara una distinta e inviala ai fornitori: qui vedrai risposte e azioni da gestire."
          : "Quando il tuo team invierà richieste di offerta, qui vedrai quelle da seguire."}
      </p>
      {canWrite ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            href={newRequestHref()}
            className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {firstRun ? "Crea la tua prima RFQ" : "Crea una RFQ"} <span aria-hidden="true">&nbsp;→</span>
          </Link>
          <Link
            href={appRoutes.rfqHub.createDistinta}
            className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Crea distinta <span aria-hidden="true">&nbsp;→</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function workspaceRoleLabel(role: string) {
  if (role === "admin") return "Amministratore aziendale";
  if (role === "viewer") return "Sola lettura";
  return "Membro";
}

/**
 * HOME-FEED1 (founder decision, 4 Nov 2026): the Home is a LinkedIn-style
 * workspace, not a page of links. Left: the company and what to do next.
 * Centre: company posts and the infinite feed. Right: Network PRO (HOME-NETPRO1).
 * Every read keeps its own server-side permission check; nothing here grants access.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ engagement_updated?: string; engagement_error?: string; verification?: string }>;
}) {
  const params = await searchParams;
  const context = await getWorkspaceContext();
  const networkEnabled = isNetworkFrontendEnabled();
  // A transient entitlement lookup must never crash a user's first workspace
  // visit. Fail closed: missing access state means Pro Network stays locked.
  const networkEntitled = networkEnabled
    ? await getNetworkAccessState(context.organizationId)
        .then((access) => access.can_access_network === true)
        .catch(() => false)
    : false;
  const isAdmin = context.role === "admin";
  const canWrite = canWriteWorkspace(context.role);
  const feedViewer = buildHomeFeedViewer(context, networkEnabled, networkEntitled);
  // HOME-FIRSTRUN1B: admin-only, RLS-scoped read of the viewer's own latest
  // registration contact name; any failure simply means no name hint.
  const registrantNamePromise = isAdmin ? loadOwnRegistrationContactName() : Promise.resolve(null);
  // SELFVER1: badge state for the caller's own organization; null hides the card.
  const verificationPromise = loadCompanyVerification(context.organizationId);
  // CPOST1: may this user publish for the session organization? null hides the composer.
  const postPublishPromise = loadCompanyPostPublishState(context.organizationId);

  const [setup, commercial, procurement, sales, pulse, feedPage, coverage] = await Promise.all([
    isAdmin
      ? getCompanySetupState(context.organizationId).catch(() => null)
      : Promise.resolve(null),
    getDashboardData(),
    canWrite ? createClient().then((db) => db.rpc("rfqh10_procurement_inbox", { p_limit: 5 })).catch(() => ({ data: null, error: true })) : Promise.resolve({ data: null, error: null }),
    // HOME-REVIEW1: the sales side of the cycle, same source and rules as the
    // «Richieste d'offerta» menu counter (comm_deals2_index, sales, RLS-scoped).
    canWrite
      ? createClient()
          .then((db) => db.rpc("comm_deals2_index", {
            p_organization_id: context.organizationId, p_segment: "sales", p_filter: "todo",
            p_query: "", p_limit: 1, p_offset: 0,
          }))
          .then(({ data, error }) => (error ? null : parseDealIndex(data)))
          .catch(() => null)
      : Promise.resolve(null),
    loadDashboardPulse(),
    loadHomeFeedPage(feedViewer, initialHomeFeedCursor).catch(() => ({ items: [], nextCursor: null, unavailable: [] })),
    // HOME-NETPRO2: real published counts for the Network PRO card; null simply hides the numbers.
    networkEnabled ? getNetworkProCoverage(context.organizationId) : Promise.resolve(null),
  ]);

  const { recent, mode, operational } = commercial;
  // The procurement inbox RPC provides aggregate lifecycle totals for the left rail.
  // Keep missing/invalid data distinct from a genuine zero.
  const procurementPayload = !procurement.error && procurement.data && typeof procurement.data === "object" && !Array.isArray(procurement.data)
    ? procurement.data as {
        summary?: { attention_total?: number; urgent?: number; due_24h?: number; active_rfqs?: number };
      }
    : null;
  const procurementSummary = procurementPayload?.summary;
  // HOME-FIRSTRUN1: admin-only, presentation-only. A company with any real
  // commercial record, active RFQ or buyer action is never "first access".
  const firstRun = deriveWorkspaceFirstRun(
    {
      setup,
      commercialRecords: mode === "live" ? operational.rfqs + operational.offers + operational.orders : 0,
      activeRfqs: procurementSummary?.active_rfqs,
      attentionTotal: procurementSummary?.attention_total,
    },
    {
      profile: appRoutes.company.profile,
      memory: appRoutes.company.setup,
      firstValue: appRoutes.operations.uploads,
      team: appRoutes.company.team,
    },
  );
  const registrantName = await registrantNamePromise;
  const verification = await verificationPromise;
  const postComposer = companyPostComposerMode(await postPublishPromise);
  const verificationFlash = params.verification === "requested" ? "requested" : params.verification === "error" ? "error" : null;
  // Soft hint only (a ditta individuale may legitimately carry the owner's name).
  const companyNameHint = firstRun.active && organizationNameMatchesPerson(context.organizationName, registrantName)
    ? { href: appRoutes.company.setup + "#company-name" }
    : null;
  // HOME-REVIEW1: each number opens the matching view of the Centro RFQ.
  const procurementKpis = procurementSummary && [
    { label: "Azioni da gestire", value: procurementSummary.attention_total, href: appRoutes.rfqHub.attention },
    { label: "Urgenti", value: procurementSummary.urgent, href: appRoutes.rfqHub.attention },
    { label: "RFQ attive", value: procurementSummary.active_rfqs, href: appRoutes.rfqHub.home },
  ].flatMap((entry) =>
    typeof entry.value === "number" && Number.isFinite(entry.value) && entry.value >= 0
      ? [{ ...entry, value: entry.value }]
      : [],
  );
  // HOME-EMPTYSTATE1: three verified zeros say "no RFQ in progress". Only when all
  // three are present; partial data keeps the rows so a missing value is never a zero.
  const procurementAllZero = Boolean(
    procurementKpis && procurementKpis.length === 3 && procurementKpis.every((kpi) => kpi.value === 0),
  );
  // HOME-REVIEW1: «Richieste d'offerta» (sales side), each number opens the filtered list.
  const salesKpis = sales ? [
    { label: "Da fare", value: sales.counts.filters.todo, href: dealDeskHref({ segment: "sales", filter: "todo" }) },
    { label: "In scadenza", value: sales.counts.filters.due, href: dealDeskHref({ segment: "sales", filter: "due" }) },
    { label: "In attesa del cliente", value: sales.counts.filters.waiting, href: dealDeskHref({ segment: "sales", filter: "waiting" }) },
  ] : null;
  const salesAllZero = Boolean(salesKpis && salesKpis.every((kpi) => kpi.value === 0));
  // HOME-REVIEW1: the box shows recent movements only; bare history totals said
  // «non rappresentano attività aperte» and contradicted the empty list.
  const showRecentMovements = mode === "live" && recent.length > 0;
  const showFirstImport = canWrite && firstRun.active && mode === "live" && recent.length === 0;
  // HOME-REVIEW1: once verified, the tick next to the name is enough.
  const verifiedQuietly = verification?.status === "verified" && !verificationFlash;
  const networkProStats = summarizeNetworkProCoverage(coverage);
  const feedItems = withPulseNews(feedPage.items, pulse.available ? pulseNewsItems(pulse.feed?.items ?? []) : []);

  return (
    <FocusPage className="max-w-[1280px]" compact>
      <PilotEvent
        eventName="workspace_home_viewed"
        metadata={{ surface: "workspace_home", source: firstRun.active ? "first_run" : null }}
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

      <div data-testid="home-layout" className="grid min-w-0 items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_280px]">
        {/* Left rail: the company and what to do next. */}
        <aside aria-label="La tua azienda" data-testid="home-left-rail" className="min-w-0 space-y-3 lg:sticky lg:top-20">
          <section className="overflow-hidden rounded-2xl border border-[#dce5df] bg-white">
            <div aria-hidden="true" className="h-14 bg-[linear-gradient(120deg,#1b6a4d_0%,#2f8a66_55%,#9fd0b5_100%)]" />
            <div className="-mt-6 px-4 pb-4">
              <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-white bg-[#176045] text-lg font-bold text-white">
                {(context.organizationName.trim()[0] || "•").toUpperCase()}
              </span>
              <h1 className="mt-2 text-lg font-semibold leading-tight tracking-tight text-[#173f35]">
                {workspaceGreeting()}, {context.organizationName}
              </h1>
              <p className="mt-0.5 text-xs text-[#53645b]">{workspaceRoleLabel(context.role)} · Workspace privato</p>
              {verifiedQuietly ? (
                <Link href={appRoutes.company.profile} data-testid="home-verified-badge"
                  className="mt-1.5 inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-[#176045] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                  <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full bg-[#176045] text-[10px] text-white">✓</span>
                  Azienda verificata
                </Link>
              ) : null}
            </div>
          </section>

          {verifiedQuietly ? null : (
            <CompanyVerificationCard
              state={verification}
              isAdmin={isAdmin}
              flash={verificationFlash}
              profileHref={appRoutes.company.profile}
            />
          )}

          <WorkspaceFirstRunChecklist state={firstRun} companyNameHint={companyNameHint} compact />

          <section aria-label="RFQ lifecycle" data-testid="home-rfq-summary" className="rounded-2xl border border-[#dce5df] bg-white p-4">
            <h2 className="text-sm font-semibold text-[#173f35]">Le tue RFQ</h2>
            {procurementAllZero ? (
              <RfqEmptyState canWrite={canWrite} firstRun={firstRun.active} />
            ) : procurementKpis && procurementKpis.length > 0 ? (
              <div className="mt-2 space-y-1">
                {procurementKpis.map((kpi) => (
                  <Link key={kpi.label} href={kpi.href} className="flex min-h-9 items-center justify-between rounded-lg px-2 text-xs text-[#52615b] hover:bg-[#f1f7f3] focus-visible:outline-2 focus-visible:outline-offset-2">
                    <span>{kpi.label}</span>
                    <span className="font-semibold tabular-nums text-[#173f35]">{kpi.value.toLocaleString("it-IT")}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p role="status" className="mt-2 text-xs leading-5 text-[#52615b]">
                {canWrite ? "Lo stato delle RFQ non è verificabile adesso." : "Le RFQ del tuo team compariranno qui."}
              </p>
            )}
          </section>

          {salesKpis ? (
            <section aria-labelledby="home-sales-heading" data-testid="home-sales-summary" className="rounded-2xl border border-[#dce5df] bg-white p-4">
              <h2 id="home-sales-heading" className="text-sm font-semibold text-[#173f35]">Richieste d’offerta</h2>
              {salesAllZero ? (
                <div role="status" className="mt-2 space-y-1">
                  <p className="text-xs leading-5 text-[#52615b]">Nessuna richiesta dei clienti da gestire adesso.</p>
                  <Link href={appRoutes.commercial.home} className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">
                    Apri Richieste d’offerta <span aria-hidden="true">&nbsp;→</span>
                  </Link>
                </div>
              ) : (
                <div className="mt-2 space-y-1">
                  {salesKpis.map((kpi) => (
                    <Link key={kpi.label} href={kpi.href} className="flex min-h-9 items-center justify-between rounded-lg px-2 text-xs text-[#52615b] hover:bg-[#f1f7f3] focus-visible:outline-2 focus-visible:outline-offset-2">
                      <span>{kpi.label}</span>
                      <span className="font-semibold tabular-nums text-[#173f35]">{kpi.value.toLocaleString("it-IT")}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {mode === "awaiting_assignment" ? (
            <section aria-labelledby="recent-activity" className="rounded-2xl border border-[#dce5df] bg-white p-4">
              <h2 id="recent-activity" className="text-sm font-semibold text-[#173f35]">Ultimi movimenti commerciali</h2>
              <p role="status" className="mt-2 text-xs leading-5 text-[#52615b]">
                Storico non ancora associato al workspace. Nessun dato dimostrativo viene mostrato come reale.
              </p>
            </section>
          ) : showRecentMovements ? (
            <section aria-labelledby="recent-activity" className="rounded-2xl border border-[#dce5df] bg-white p-4">
              <h2 id="recent-activity" className="text-sm font-semibold text-[#173f35]">Ultimi movimenti commerciali</h2>
              <div className="mt-2 divide-y divide-[#eaf0eb]">
                {recent.slice(0, 3).map((row) => (
                  <Link
                    href={row.operationalHref ?? appRoutes.commercial.conversation(row.conversationId)}
                    key={row.id}
                    className="block py-2 hover:bg-[#f8faf9] focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <p className="line-clamp-1 text-xs font-semibold text-[#173f35]">{row.product}</p>
                    <p className="mt-0.5 truncate text-[11px] text-[#52615b]">{row.date} · {row.company}</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : showFirstImport && operational.rfqs + operational.offers + operational.orders === 0 ? (
            <section aria-labelledby="recent-activity" className="rounded-2xl border border-[#dce5df] bg-white p-4">
              <h2 id="recent-activity" className="text-sm font-semibold text-[#173f35]">Ultimi movimenti commerciali</h2>
              <p className="mt-2 text-xs leading-5 text-[#52615b]">Nessun movimento recente nello storico commerciale.</p>
              <Link href={appRoutes.operations.uploads} className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4">
                Importa i primi documenti →
              </Link>
            </section>
          ) : null}
        </aside>

        {/* Centre: company posts composer and the infinite feed. HOME-FOCUS1 (founder decision,
            4 Nov 2026): no RFQ box and no attention strip here; RFQ status stays in the left
            rail and the Distinta starts from Commerciale. */}
        <section aria-label="Feed" data-testid="home-center" className="min-w-0 space-y-3">
          <HomeFeed initialItems={feedItems}
            initialCursor={feedPage.nextCursor}
            canInteract={feedViewer.canInteract}
            isAdmin={feedViewer.isAdmin}
            composer={postComposer}
            organizationName={context.organizationName}
          />
        </section>

        {/* Right rail (desktop only, like LinkedIn). HOME-NETPRO1 (founder request, 16 Nov 2026):
            "Aziende da conoscere" is replaced by the Network PRO card; the same companies
            already appear in the feed. Locked organizations see the offer, entitled ones a shortcut. */}
        <aside aria-label="Network PRO" data-testid="home-right-rail" className="hidden min-w-0 space-y-3 xl:sticky xl:top-20 xl:block">
          {networkEnabled ? <HomeNetworkProCard entitled={networkEntitled} stats={networkProStats} /> : null}
          <Link href={appRoutes.steelPulse} className="inline-flex min-h-9 items-center px-1 text-[11px] font-semibold text-[#175640] underline underline-offset-4">
            Personalizza il feed
          </Link>
        </aside>
      </div>
    </FocusPage>
  );
}

import Link from "next/link";

import { PilotEvent } from "@/components/pilot-event";
import { FocusPage } from "@/components/focus-ui";
import { HomeFeed, HomeSuggestedCompanies } from "@/components/home-feed";
import { WorkspaceFirstRunChecklist } from "@/components/workspace-first-run-checklist";
import { CompanyVerificationCard } from "@/components/company-verification-card";
import { loadCompanyVerification } from "@/lib/company-verification";
import { loadCompanyPostPublishState } from "@/lib/company-posts";
import { companyPostComposerMode } from "@/lib/company-posts-model";
import { canWriteWorkspace } from "@/lib/access-policy";
import { getDashboardData } from "@/lib/commercial-data";
import { getCompanySetupState } from "@/lib/company-setup";
import { loadDashboardPulse } from "@/lib/dashboard-pulse";
import { loadHomeFeedPage, loadHomeSuggestedCompanies } from "@/lib/home-feed";
import { initialHomeFeedCursor, pulseNewsItems, withPulseNews } from "@/lib/home-feed-model";
import { buildHomeFeedViewer } from "@/lib/home-feed-viewer";
import { getNetworkAccessState } from "@/lib/network-access";
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
            href={appRoutes.commercial.home + "?compose=1#commercial-compose"}
            className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {firstRun ? "Crea la tua prima RFQ" : "Crea una RFQ"} <span aria-hidden="true">&nbsp;→</span>
          </Link>
          <Link
            href="/distinta"
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
 * Centre: company posts and the infinite feed. Right: companies to meet.
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

  const [setup, commercial, procurement, pulse, feedPage, suggestions] = await Promise.all([
    isAdmin
      ? getCompanySetupState(context.organizationId).catch(() => null)
      : Promise.resolve(null),
    getDashboardData(),
    canWrite ? createClient().then((db) => db.rpc("rfqh10_procurement_inbox", { p_limit: 5 })).catch(() => ({ data: null, error: true })) : Promise.resolve({ data: null, error: null }),
    loadDashboardPulse(),
    loadHomeFeedPage(feedViewer, initialHomeFeedCursor).catch(() => ({ items: [], nextCursor: null, unavailable: [] })),
    loadHomeSuggestedCompanies(feedViewer).catch(() => []),
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
  const procurementKpis = procurementSummary && [
    { label: "Azioni da gestire", value: procurementSummary.attention_total, href: appRoutes.commercial.home + "?view=sent#commercial-worklist" },
    { label: "Urgenti", value: procurementSummary.urgent, href: appRoutes.commercial.home + "?view=sent#commercial-worklist" },
    { label: "RFQ attive", value: procurementSummary.active_rfqs, href: appRoutes.commercial.home + "?view=sent#commercial-worklist" },
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
  // Real recorded totals from the existing snapshot (never open pipelines).
  const operationalKpis = mode === "live" ? [
    { label: "RFQ", value: operational.rfqs },
    { label: "Offerte", value: operational.offers },
    { label: "Ordini", value: operational.orders },
  ] : [];
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
            </div>
          </section>

          <CompanyVerificationCard
            state={verification}
            isAdmin={isAdmin}
            flash={verificationFlash}
            profileHref={appRoutes.company.profile}
          />

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

          <section aria-labelledby="recent-activity" className="rounded-2xl border border-[#dce5df] bg-white p-4">
            <h2 id="recent-activity" className="text-sm font-semibold text-[#173f35]">Ultimi movimenti commerciali</h2>
            {mode === "live" && operationalKpis.length > 0 && operationalKpis.some((kpi) => kpi.value > 0) ? (
              <>
                <dl className="mt-2 grid grid-cols-3 gap-1.5">
                  {operationalKpis.map((kpi) => (
                    <div key={kpi.label} className="rounded-lg bg-[#f3f8f5] px-1 py-2 text-center">
                      <dd className="text-base font-semibold tabular-nums text-[#173f35]">{kpi.value.toLocaleString("it-IT")}</dd>
                      <dt className="text-[10px] text-[#53645b]">{kpi.label}</dt>
                    </div>
                  ))}
                </dl>
                <p className="mt-1.5 text-[10px] leading-4 text-[#68766d]">Totali registrati · non rappresentano attività aperte.</p>
              </>
            ) : null}
            {mode === "awaiting_assignment" ? (
              <p role="status" className="mt-2 text-xs leading-5 text-[#52615b]">
                Storico non ancora associato al workspace. Nessun dato dimostrativo viene mostrato come reale.
              </p>
            ) : mode !== "live" ? (
              <p role="status" className="mt-2 text-xs leading-5 text-[#52615b]">I dati commerciali non sono disponibili adesso.</p>
            ) : recent.length === 0 ? (
              <div className="mt-2 space-y-1">
                <p className="text-xs leading-5 text-[#52615b]">
                  {operational.rfqs + operational.offers + operational.orders > 0
                    ? "Lo storico contiene dati commerciali, ma non ci sono movimenti recenti in questa vista."
                    : "Nessun movimento recente nello storico commerciale."}
                </p>
                <Link
                  href={canWrite && firstRun.active ? appRoutes.operations.uploads : appRoutes.commercial.home + "#commercial-worklist"}
                  className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4"
                >
                  {canWrite && firstRun.active ? "Importa i primi documenti →" : "Apri attività commerciali →"}
                </Link>
              </div>
            ) : (
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
            )}
          </section>
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

        {/* Right rail: companies to meet (desktop only, like LinkedIn). */}
        <aside aria-label="Suggerimenti" data-testid="home-right-rail" className="hidden min-w-0 space-y-3 xl:sticky xl:top-20 xl:block">
          <HomeSuggestedCompanies companies={suggestions} canInteract={feedViewer.canInteract} />
          <p className="px-1 text-[11px] leading-4 text-[#65746c]">
            Il feed mostra post delle aziende verificate, aziende del Network, guide della Scuola, opportunità del Marketplace e notizie Steel Pulse verificate.{" "}
            <Link href={appRoutes.steelPulse} className="font-semibold text-[#175640] underline underline-offset-4">Personalizza</Link>
          </p>
        </aside>
      </div>
    </FocusPage>
  );
}

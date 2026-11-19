import Link from "next/link";

import { PilotEvent } from "@/components/pilot-event";
import { RfqHubStartButton } from "@/components/rfq-hub-start-button";
import { RfqNetworkSupplierReceiver } from "@/components/rfq-network-supplier-receiver";
import { SavedDistintaActions } from "@/components/saved-distinta-actions";
import { canWriteWorkspace } from "@/lib/access-policy";
import { appRoutes } from "@/lib/routes";
import { loadPurchasingAttention } from "@/lib/rfq-hub-attention";
import { formatHubDate } from "@/lib/rfq-hub-overview";
import {
  rfqHubArticlesLabel,
  rfqHubRecipientsLabel,
  rfqHubHref,
  rfqHubRowState,
  rfqHubToneClass,
  rfqHubView,
  type RfqHubRowCampaign,
  type RfqHubView,
} from "@/lib/rfq-hub-rows";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Centro RFQ", robots: privateNoIndexRobots };

const PAGE_SIZE = 25;

function pageNumber(raw: unknown): number {
  if (typeof raw !== "string" || !/^[1-9]\d{0,3}$/.test(raw)) return 1;
  return Math.min(Number(raw), 1000);
}
function tonnes(value: number | string | null): string {
  const number = Number(value);
  return value === null || !Number.isFinite(number) ? "—"
    : number.toLocaleString("it-IT", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

type DistintaRow = {
  id: string;
  title: string;
  owner_user_id: string;
  created_at: string;
  line_count: number;
  total_tonnes: number | string | null;
  archived_at: string | null;
};

/**
 * RFQHUB1 (founder decision, 18 Nov 2026): Centro RFQ is the Distinta and its
 * history in ONE list. One row per Distinta with the state its request reached
 * (draft, suppliers to choose, to send, waiting, offers, awarded/order).
 * «Inbox e risposte» and the separate «Distinte» page are folded in here:
 * «Da gestire» is a filter of the same list.
 */
export default async function BuyerRfqHubPage({
  searchParams,
}: {
  searchParams?: Promise<{ vista?: string; q?: string; page?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const view: RfqHubView = rfqHubView(params.vista);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const page = pageNumber(params.page);

  const context = await getWorkspaceContext();
  const canWrite = canWriteWorkspace(context.role);
  const supabase = await createClient();
  const organizationId = context.organizationId;

  // Open actions per RFQ: drives «Da gestire», its counter and the row badges.
  // Same loader as the menu counter, so the numbers always match.
  const loadedAttention = canWrite ? await loadPurchasingAttention(supabase, organizationId) : null;
  const attentionUnavailable = canWrite && !loadedAttention;
  const attention = loadedAttention?.byRfq ?? null;
  const todoDistintaIds: string[] | null = view === "da-gestire" ? loadedAttention?.distintaIds ?? [] : null;

  let request = supabase.from("buyer_distintas")
    .select("id,title,owner_user_id,created_at,line_count,total_tonnes,archived_at", { count: "exact" })
    .eq("organization_id", organizationId);
  if (view === "archiviate") request = request.not("archived_at", "is", null);
  else request = request.is("archived_at", null);
  if (todoDistintaIds) request = request.in("id", todoDistintaIds.length ? todoDistintaIds : ["00000000-0000-0000-0000-000000000000"]);
  if (query) request = request.ilike("title", "%" + query.replace(/[%_]/g, "") + "%");
  const { data: distinteData, error, count } = await request
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const distinte = (distinteData ?? []) as DistintaRow[];
  const pages = count === null ? 1 : Math.max(1, Math.ceil(count / PAGE_SIZE));

  // Requests of the visible rows, their recipients, answers and orders.
  const distintaIds = distinte.map((row) => row.id);
  const { data: campaignData } = distintaIds.length
    ? await supabase.from("buyer_rfq_campaigns")
      .select("id,status,due_at,created_at,source_distinta_id")
      .eq("organization_id", organizationId)
      .in("source_distinta_id", distintaIds)
      .order("created_at", { ascending: false })
    : { data: [] as Array<RfqHubRowCampaign & { source_distinta_id: string }> };
  const campaignsByDistinta = new Map<string, Array<RfqHubRowCampaign>>();
  for (const campaign of campaignData ?? []) {
    const list = campaignsByDistinta.get(campaign.source_distinta_id) ?? [];
    list.push(campaign);
    campaignsByDistinta.set(campaign.source_distinta_id, list);
  }
  const latestIds = [...campaignsByDistinta.values()].map((list) => list[0].id);
  const [suppliersResult, quotesResult, ordersResult, linesResult] = await Promise.all([
    latestIds.length ? supabase.from("buyer_rfq_suppliers").select("rfq_id,supplier_name,supplier_email_normalized")
      .in("rfq_id", latestIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [] }),
    latestIds.length ? supabase.from("buyer_rfq_quotes").select("rfq_id,supplier_id")
      .eq("organization_id", organizationId).in("rfq_id", latestIds).eq("status", "submitted") : Promise.resolve({ data: [] }),
    latestIds.length ? supabase.from("buyer_purchase_order_drafts").select("rfq_id,status,created_at")
      .eq("organization_id", organizationId).in("rfq_id", latestIds)
      .order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    // RFQHUB1D: the first articles tell rows with the same name apart.
    distintaIds.length ? supabase.from("buyer_distinta_lines").select("distinta_id,description,line_position")
      .in("distinta_id", distintaIds).lte("line_position", 2).order("line_position", { ascending: true }) : Promise.resolve({ data: [] }),
  ]);
  const supplierCount = new Map<string, number>();
  const supplierNames = new Map<string, string[]>();
  for (const row of (suppliersResult.data ?? []) as Array<{ rfq_id: string; supplier_name: string | null; supplier_email_normalized: string | null }>) {
    supplierCount.set(row.rfq_id, (supplierCount.get(row.rfq_id) ?? 0) + 1);
    const names = supplierNames.get(row.rfq_id) ?? [];
    names.push(row.supplier_name || row.supplier_email_normalized || "");
    supplierNames.set(row.rfq_id, names);
  }
  const articlesByDistinta = new Map<string, string[]>();
  for (const row of (linesResult.data ?? []) as Array<{ distinta_id: string; description: string | null }>) {
    const list = articlesByDistinta.get(row.distinta_id) ?? [];
    if (row.description) list.push(row.description);
    articlesByDistinta.set(row.distinta_id, list);
  }
  const responded = new Map<string, Set<string>>();
  for (const row of (quotesResult.data ?? []) as Array<{ rfq_id: string; supplier_id: string }>) {
    const set = responded.get(row.rfq_id) ?? new Set<string>();
    set.add(row.supplier_id);
    responded.set(row.rfq_id, set);
  }
  const orderStatus = new Map<string, string>();
  for (const row of (ordersResult.data ?? []) as Array<{ rfq_id: string; status: string }>) if (!orderStatus.has(row.rfq_id)) orderStatus.set(row.rfq_id, row.status);

  const tabs: Array<{ view: RfqHubView; label: string; count?: number }> = [
    { view: "attive", label: "Attive" },
    ...(canWrite ? [{ view: "da-gestire" as const, label: "Da gestire", count: loadedAttention?.distintaIds.length ?? 0 }] : []),
    { view: "archiviate", label: "Archiviate" },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-3 pb-8" data-testid="rfq-hub-simple-workspace">
      <PilotEvent eventName="rfq_hub_viewed" metadata={{ surface: "rfq_hub_dashboard" }} />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--brand-primary)]">Ufficio acquisti</p>
          <h1 className="mt-0.5 text-xl font-extrabold text-[var(--brand-deep)]">Centro RFQ</h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Ogni distinta con la sua richiesta: a che punto è e cosa fare.</p>
          <p className="sr-only">Distinte, richieste ai fornitori, offerte e ordini.</p>
        </div>
        {canWrite ? (
          <Link href={appRoutes.rfqHub.createDistinta}
            className="platform-primary inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-xs font-bold">
            + Nuova richiesta
          </Link>
        ) : <span className="text-xs font-semibold text-[var(--text-secondary)]">Consultazione</span>}
      </header>

      {/* Keep Network's explicit, org-scoped supplier handoff unchanged. */}
      <RfqNetworkSupplierReceiver userId={context.userId} organizationId={organizationId} />

      <section aria-label="Distinte e richieste" data-testid="rfq-hub-list"
        className="min-w-0 rounded-xl border border-[var(--border)] bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav aria-label="Filtra richieste" className="flex flex-wrap gap-1.5">
            {tabs.map((tab) => (
              <Link key={tab.view} href={rfqHubHref(tab.view, query)} aria-current={view === tab.view ? "page" : undefined}
                data-testid={"rfq-hub-tab-" + tab.view}
                className={"inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold " +
                  (view === tab.view ? "border-[#175640] bg-[#175640] text-white" : "border-[#d6e5db] bg-white text-[#2f5a45] hover:bg-[#f2f8f4]")}>
                {tab.label}
                {typeof tab.count === "number" && tab.count > 0 ? (
                  <span className={"rounded-full px-1.5 text-[10px] font-bold " + (view === tab.view ? "bg-white/20" : "bg-[#fff1d6] text-[#7a4d0e]")}>{tab.count}</span>
                ) : null}
              </Link>
            ))}
          </nav>
          <form method="get" action="/rfq-hub" role="search" className="flex min-w-0 items-center gap-1.5">
            {view !== "attive" ? <input type="hidden" name="vista" value={view} /> : null}
            <label className="sr-only" htmlFor="rfq-hub-search">Cerca per nome</label>
            <input id="rfq-hub-search" name="q" type="search" defaultValue={query} maxLength={80} placeholder="Cerca per nome"
              className="h-9 w-44 min-w-0 rounded-lg border border-[#d6e5db] bg-white px-2.5 text-xs text-[var(--brand-deep)] sm:w-56" />
          </form>
        </div>

        {attentionUnavailable ? (
          <p role="status" className="mt-2 text-[11px] text-[var(--text-secondary)]">Le attività da gestire non sono disponibili in questo momento.</p>
        ) : null}

        {error ? (
          <p role="status" className="py-4 text-sm text-[var(--text-secondary)]">Elenco temporaneamente non disponibile. Riprova più tardi.</p>
        ) : !distinte.length ? (
          <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
            {query ? "Nessuna distinta corrisponde alla ricerca."
              : view === "da-gestire" ? "Niente da gestire adesso."
              : view === "archiviate" ? "Nessuna distinta archiviata."
              : canWrite ? "Ancora nessuna richiesta. Inizia con «+ Nuova richiesta»." : "Le richieste condivise compariranno qui."}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {distinte.map((distinta) => {
              const campaigns = campaignsByDistinta.get(distinta.id) ?? [];
              const campaign = campaigns[0] ?? null;
              const facts = {
                campaign,
                previousCount: Math.max(0, campaigns.length - 1),
                supplierCount: campaign ? supplierCount.get(campaign.id) ?? 0 : 0,
                respondedCount: campaign ? responded.get(campaign.id)?.size ?? 0 : 0,
                orderStatus: campaign ? orderStatus.get(campaign.id) ?? null : null,
                attention: campaign && !distinta.archived_at ? attention?.get(campaign.id) ?? null : null,
                archived: Boolean(distinta.archived_at),
              };
              const articles = rfqHubArticlesLabel(articlesByDistinta.get(distinta.id) ?? [], distinta.line_count);
              const recipients = campaign && !distinta.archived_at ? rfqHubRecipientsLabel(supplierNames.get(campaign.id) ?? []) : null;
              const state = rfqHubRowState(facts);
              const owner = canWrite && distinta.owner_user_id === context.userId;
              const href = !campaign ? appRoutes.rfqHub.savedDistinta(distinta.id)
                : state.target === "step3" ? appRoutes.rfqHub.campaign(campaign.id) + "?passo=invia"
                : appRoutes.rfqHub.campaign(campaign.id);
              return (
                <li key={distinta.id} data-testid="rfq-hub-row" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                  <Link href={href} className="group min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[var(--brand-deep)] group-hover:underline">{distinta.title || "Distinta"}</span>
                    {articles && articles !== distinta.title ? (
                      <span data-testid="rfq-hub-row-articles" className="block truncate text-[11px] text-[var(--brand-deep)]/80">{articles}</span>
                    ) : null}
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--text-secondary)]">
                      <span className={"rounded-full px-2 py-0.5 font-semibold " + rfqHubToneClass[state.tone]}>{state.label}</span>
                      {recipients ? <span data-testid="rfq-hub-row-recipients" className="font-semibold text-[var(--brand-deep)]">{recipients}</span> : null}
                      {facts.attention?.label ? (
                        <span className={"font-semibold " + (facts.attention.urgent ? "text-[#8c431e]" : "text-[#7a4d0e]")}>→ {facts.attention.label}</span>
                      ) : null}
                      <span>{distinta.line_count} {distinta.line_count === 1 ? "articolo" : "articoli"} · {tonnes(distinta.total_tonnes)} t · {formatHubDate(campaign?.created_at ?? distinta.created_at)}</span>
                      {campaign?.due_at ? <span>· scadenza {formatHubDate(campaign.due_at)}</span> : null}
                      {facts.previousCount ? <span>· +{facts.previousCount} {facts.previousCount === 1 ? "richiesta precedente" : "richieste precedenti"}</span> : null}
                    </span>
                  </Link>
                  <span className="flex min-w-0 max-w-full items-center gap-1.5">
                    {!campaign && owner && !distinta.archived_at ? <RfqHubStartButton distintaId={distinta.id} /> : (
                      <Link href={href} className="inline-flex min-h-9 items-center rounded-lg bg-[var(--brand-primary-soft)] px-2.5 text-xs font-bold text-[var(--brand-deep)]">Apri</Link>
                    )}
                    {owner ? (
                      // Rename, duplicate and archive stay one click away, so the row shows one action.
                      <details data-testid="rfq-hub-row-more" className="relative">
                        <summary aria-label={"Altre azioni per " + (distinta.title || "la distinta")}
                          className="inline-flex min-h-9 cursor-pointer list-none items-center rounded-lg border border-[#d6e5db] bg-white px-2.5 text-xs font-bold text-[#2f5a45] hover:bg-[#f2f8f4] [&::-webkit-details-marker]:hidden">
                          ⋯
                        </summary>
                        <div className="absolute right-0 top-full z-20 mt-1 w-max max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--border)] bg-white p-2 shadow-lg">
                          <SavedDistintaActions id={distinta.id} title={distinta.title} archived={Boolean(distinta.archived_at)} compact />
                        </div>
                      </details>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {!error && pages > 1 ? (
          <nav aria-label="Pagine" className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
            <span className="text-[11px] text-[var(--text-secondary)]">Pagina {page} di {pages} · {count ?? "—"} distinte</span>
            <span className="flex items-center gap-2">
              {page > 1 ? <Link href={rfqHubHref(view, query, page - 1)} className="app-secondary inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-bold">← Precedente</Link> : null}
              {page < pages ? <Link href={rfqHubHref(view, query, page + 1)} className="app-secondary inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-bold">Successiva →</Link> : null}
            </span>
          </nav>
        ) : null}
      </section>
    </div>
  );
}

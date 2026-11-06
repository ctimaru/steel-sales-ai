import Link from "next/link";

import { PilotEvent } from "@/components/pilot-event";
import { RfqNetworkSupplierReceiver } from "@/components/rfq-network-supplier-receiver";
import { canWriteWorkspace } from "@/lib/access-policy";
import { appRoutes } from "@/lib/routes";
import {
  formatHubDate,
  parseHubInboxItems,
  rfqCampaignStatusLabel,
  rfqOrderStatusLabel,
} from "@/lib/rfq-hub-overview";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

function countText(count: number | null, error: unknown): string {
  return error || count === null ? "—" : new Intl.NumberFormat("it-IT").format(count);
}
function value(value: number | null | undefined, digits = 2): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "—";
}
function Tile({ label, number, foot, href, inactive = false }: { label: string; number: string; foot: string; href: string; inactive?: boolean }) {
  const content = (
    <>
      <span className="shrink-0 text-base font-extrabold tabular-nums text-[var(--brand-deep)]">{number}</span>
      <span className="min-w-0 text-[11px] font-semibold text-[var(--text-secondary)]">{label}</span>
      <span className="sr-only">{foot}</span>
    </>
  );
  const style = "flex min-h-9 min-w-0 items-center gap-2 rounded-lg px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]";
  return inactive ? (
    <div className={style} aria-label={label + ": " + number}>{content}</div>
  ) : (
    <Link href={href} className={style + " hover:bg-[var(--brand-primary-soft)]"}>{content}</Link>
  );
}
function BlockHeading({ title, href, action }: { title: string; href?: string; action?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
      <h2 className="text-sm font-bold text-[var(--brand-deep)]">{title}</h2>
      {href && action ? (
        <Link href={href} className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-[var(--brand-deep)] hover:bg-[var(--brand-primary-soft)]">{action} →</Link>
      ) : null}
    </div>
  );
}

export default async function BuyerRfqHubPage() {
  // Always scope to the selected workspace organization. RLS is also enforced
  // by Supabase for direct and team-level visibility of individual records.
  const context = await getWorkspaceContext();
  const canWrite = canWriteWorkspace(context.role);
  const supabase = await createClient();
  const organizationId = context.organizationId;

  const [
    saved, campaigns, quotes, orders,
    savedCount, campaignCount, quoteCount, orderCount,
  ] = await Promise.all([
    supabase.from("buyer_distintas")
      .select("id,title,owner_user_id,line_count,total_meters,total_tonnes,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }).limit(8),
    supabase.from("buyer_rfq_campaigns")
      .select("id,title,status,due_at,created_at,source_distinta_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }).limit(120),
    supabase.from("buyer_rfq_quotes")
      .select("id,rfq_id,status,revision_no,submitted_at")
      .eq("organization_id", organizationId).eq("status", "submitted")
      .order("submitted_at", { ascending: false }).limit(8),
    supabase.from("buyer_purchase_order_drafts")
      .select("id,rfq_id,po_draft_ref,status,supplier_name_snapshot,total_eur,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }).limit(8),
    supabase.from("buyer_distintas")
      .select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("buyer_rfq_campaigns")
      .select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("buyer_rfq_quotes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId).eq("status", "submitted"),
    supabase.from("buyer_purchase_order_drafts")
      .select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
  ]);

  const campaignsList = campaigns.data ?? [];
  const visibleRfqIds = new Set(campaignsList.map((campaign) => campaign.id));
  const relatedRfq = new Map<string, string>();
  for (const campaign of campaignsList) {
    if (campaign.source_distinta_id && !relatedRfq.has(campaign.source_distinta_id)) {
      relatedRfq.set(campaign.source_distinta_id, campaign.id);
    }
  }
  // Inbox RPC is a scoped, existing procurement engine. Display only items
  // belonging to visible RFQs of the active organization; never publish it.
  const inboxResult = canWrite
    ? await supabase.rpc("rfqh10_procurement_inbox", { p_limit: 100 })
    : null;
  const attention = inboxResult?.error
    ? null
    : inboxResult ? parseHubInboxItems(inboxResult.data, visibleRfqIds) : null;
  const problems = [
    saved.error, campaigns.error, quotes.error, orders.error,
    savedCount.error, campaignCount.error, quoteCount.error, orderCount.error,
  ].some(Boolean);

  const recentCampaigns = campaignsList.slice(0, 7);
  const recentSaved = saved.data ?? [];
  const recentQuotes = quotes.data ?? [];
  const recentOrders = orders.data ?? [];
  const campaignName = new Map(campaignsList.map((campaign) => [campaign.id, campaign.title]));

  return (
    <div className="min-w-0 max-w-full space-y-3 pb-8" data-testid="rfq-hub-simple-workspace">
      <PilotEvent eventName="rfq_hub_viewed" metadata={{ surface: "rfq_hub_dashboard" }} />
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-white px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--brand-primary)]">Workspace aziendale · Acquisti</p>
          <h1 className="mt-0.5 text-xl font-extrabold text-[var(--brand-deep)]">RFQ Hub</h1>
          <p className="hidden max-w-2xl text-xs text-[var(--text-secondary)] sm:mt-0.5 sm:block">
            Le tue richieste e Distinte in un unico spazio. Marketplace resta un canale opzionale di pubblicazione.
          </p>
          <p className="sr-only">Distinte, richieste ai fornitori, offerte e ordini.</p>
        </div>
        {canWrite ? (
          <Link href={appRoutes.rfqHub.createDistinta}
            className="platform-primary inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-xs font-bold">
            + Nuova distinta
          </Link>
        ) : <span className="text-xs font-semibold text-[var(--text-secondary)]">Consultazione</span>}
      </header>

      {/* Keep Network's explicit, org-scoped supplier handoff unchanged. */}
      <RfqNetworkSupplierReceiver userId={context.userId} organizationId={organizationId} />

      {problems ? (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Alcuni dati non sono temporaneamente disponibili. I conteggi mancanti sono indicati con —; riprova più tardi.
        </p>
      ) : null}

      {/* COMM-SIMPLE1: figures support the worklist instead of occupying four cards. */}
      <section aria-label="Riepilogo acquisti"
        data-testid="rfq-hub-compact-summary"
        className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-1 rounded-xl border border-[var(--border)] bg-white px-2 py-1.5 sm:grid-cols-4">
        <Tile label="Distinte salvate" number={countText(savedCount.count, savedCount.error)} foot="Snapshot aziendali visibili" href="#distinte" />
        <Tile label="Campagne RFQ" number={countText(campaignCount.count, campaignCount.error)} foot="Private e condivise" href="#campagne" />
        <Tile label="Offerte ricevute" number={countText(quoteCount.count, quoteCount.error)} foot="Revisioni attualmente inviate" href="#offerte"
          inactive={!quotes.error && quoteCount.count === 0} />
        <Tile label="Purchase Order" number={countText(orderCount.count, orderCount.error)} foot="Bozze e ordini in gestione" href="#ordini"
          inactive={!orders.error && orderCount.count === 0} />
      </section>

      {canWrite && attention && attention.length > 0 ? (
        <section aria-label="Da gestire" data-testid="rfq-hub-actionable"
          className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-[#cfdfd5] bg-[#f5faf6] px-3 py-2">
          <h2 className="shrink-0 text-xs font-bold text-[var(--brand-deep)]">Da gestire</h2>
          <div className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1">
            {attention.slice(0, 3).map((item) => (
              <Link key={item.item_id} href={appRoutes.rfqHub.campaign(item.rfq_id)}
                className="inline-flex min-h-8 min-w-0 max-w-full items-center gap-1 text-xs font-semibold text-[#175640] hover:underline">
                <span className="max-w-[20rem] truncate">{item.headline}</span>
                {item.priority === "urgent" || item.priority === "high" ?
                  <span className="shrink-0 text-[10px] font-medium text-[#8a5818]">{item.priority === "urgent" ? "Urgente" : "Alta"}</span> : null}
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
          <Link href={appRoutes.rfqHub.inbox} className="inline-flex min-h-8 items-center text-xs font-semibold text-[#175640] hover:underline">
            Apri Inbox →
          </Link>
        </section>
      ) : !canWrite ? (
        <p className="sr-only">Le attività operative sono disponibili ai ruoli autorizzati. Le RFQ condivise restano consultabili.</p>
      ) : attention === null ? (
        <p role="status" className="text-xs text-[var(--text-secondary)]">
          Coda acquisti temporaneamente non disponibile. Apri Inbox per verificare le attività.
        </p>
      ) : null}

      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <section id="campagne" aria-label="Campagne RFQ" data-testid="rfq-hub-primary-campaigns"
          className="min-w-0 scroll-mt-28 rounded-xl border border-[var(--border)] bg-white px-3 py-3 sm:px-4">
          <BlockHeading title="Campagne RFQ" />
          {campaigns.error ? (
            <p role="status" className="py-3 text-sm text-[var(--text-secondary)]">Elenco RFQ non disponibile.</p>
          ) : recentCampaigns.length === 0 ? (
            <div className="py-4 text-sm text-[var(--text-secondary)]">
              Nessuna campagna visibile. {canWrite ? "Crea e salva una distinta, poi avvia la prima RFQ." : "Le richieste condivise compariranno qui."}
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {recentCampaigns.map((campaign) => (
                <Link key={campaign.id} href={appRoutes.rfqHub.campaign(campaign.id)}
                  className="flex min-h-14 items-center justify-between gap-3 py-2.5 hover:text-[var(--brand-primary)]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--brand-deep)]">{campaign.title}</p>
                    <p className="mt-0.5 break-words text-xs text-[var(--text-secondary)]">
                      {rfqCampaignStatusLabel(campaign.status)} · {formatHubDate(campaign.created_at)}
                      {campaign.due_at ? " · Scadenza " + formatHubDate(campaign.due_at) : ""}
                    </p>
                  </div>
                  <span aria-hidden="true" className="shrink-0 text-[var(--brand-primary)]">→</span>
                </Link>
              ))}
            </div>
          )}
          {campaignCount.count !== null && campaignCount.count > recentCampaigns.length ? (
            <p className="mt-2 text-[11px] text-[var(--text-secondary)]">Ultime 7 campagne della tua azienda.</p>
          ) : null}
        </section>

        <div className="min-w-0 space-y-3">
          <section id="distinte" aria-label="Distinte salvate" data-testid="rfq-hub-primary-distinte"
            className="min-w-0 scroll-mt-28 rounded-xl border border-[var(--border)] bg-white px-3 py-3 sm:px-4">
            <BlockHeading title="Distinte salvate" href={appRoutes.rfqHub.savedDistinte} action="Archivio completo" />
            {saved.error ? (
              <p role="status" className="py-3 text-sm text-[var(--text-secondary)]">Archivio distinte non disponibile.</p>
            ) : recentSaved.length === 0 ? (
              <p className="py-4 text-sm text-[var(--text-secondary)]">
                Nessuna distinta salvata. Le bozze locali non sono ancora nell’archivio.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {recentSaved.map((draft) => (
                  <div key={draft.id} className="flex min-h-14 items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={appRoutes.rfqHub.savedDistinta(draft.id)}
                        className="block truncate text-sm font-bold text-[var(--brand-deep)] hover:underline">
                        {draft.title || "Distinta"}
                      </Link>
                      <p className="mt-0.5 break-words text-xs text-[var(--text-secondary)]">
                        {draft.line_count} righe · {value(Number(draft.total_tonnes), 3)} t · {formatHubDate(draft.created_at)}
                      </p>
                    </div>
                    <Link href={relatedRfq.has(draft.id) ? appRoutes.rfqHub.campaign(relatedRfq.get(draft.id)!) : appRoutes.rfqHub.savedDistinta(draft.id)}
                      className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-[var(--brand-primary-soft)] px-2.5 text-xs font-bold text-[var(--brand-deep)]">
                      {relatedRfq.has(draft.id) ? "Apri RFQ" : "Apri"}
                    </Link>
                  </div>
                ))}
              </div>
            )}
            {savedCount.count !== null && savedCount.count > recentSaved.length ? (
              <Link href={appRoutes.rfqHub.savedDistinte} className="mt-2 inline-flex text-[11px] font-semibold text-[var(--brand-deep)] hover:underline">
                Vedi tutte le Distinte →
              </Link>
            ) : null}
          </section>

          {/* Non riempire la schermata con card vuote. Un conteggio zero rimane nel riepilogo. */}
          {(quotes.error || recentQuotes.length > 0) ? (
            <section id="offerte" aria-label="Offerte ricevute" className="min-w-0 scroll-mt-28 rounded-xl border border-[var(--border)] bg-white px-3 py-3 sm:px-4">
              <BlockHeading title="Offerte ricevute" href={appRoutes.rfqHub.home + "#campagne"} action="Vai alle RFQ" />
              {quotes.error ? (
                <p role="status" className="py-3 text-sm text-[var(--text-secondary)]">Offerte non disponibili.</p>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {recentQuotes.map((quote) => (
                    <Link key={quote.id} href={appRoutes.rfqHub.campaign(quote.rfq_id)}
                      className="flex min-h-12 items-center justify-between gap-2 py-2 hover:text-[var(--brand-primary)]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--brand-deep)]">{campaignName.get(quote.rfq_id) || "Apri RFQ"}</p>
                        <p className="text-xs text-[var(--text-secondary)]">Offerta ricevuta · Revisione {quote.revision_no} · {formatHubDate(quote.submitted_at)}</p>
                      </div>
                      <span aria-hidden="true">→</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {(orders.error || recentOrders.length > 0) ? (
            <section id="ordini" aria-label="Ordini di acquisto" className="min-w-0 scroll-mt-28 rounded-xl border border-[var(--border)] bg-white px-3 py-3 sm:px-4">
              <BlockHeading title="Ordini di acquisto" href={appRoutes.rfqHub.home + "#campagne"} action="Vai alle RFQ" />
              {orders.error ? (
                <p role="status" className="py-3 text-sm text-[var(--text-secondary)]">Ordini non disponibili.</p>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {recentOrders.map((order) => (
                    <Link key={order.id} href={appRoutes.rfqHub.campaign(order.rfq_id)}
                      className="flex min-h-12 items-center justify-between gap-2 py-2 hover:text-[var(--brand-primary)]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--brand-deep)]">{order.po_draft_ref} · {order.supplier_name_snapshot}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{rfqOrderStatusLabel(order.status)} · {value(Number(order.total_eur))} €</p>
                      </div>
                      <span aria-hidden="true">→</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

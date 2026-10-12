import Link from "next/link";

import { PilotEvent } from "@/components/pilot-event";
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
function Tile({ label, number, foot, href }: { label: string; number: string; foot: string; href: string }) {
  return (
    <Link href={href} className="group min-w-0 rounded-xl border border-[var(--border-strong)] bg-white p-3.5 transition hover:border-[var(--brand-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]">
      <p className="text-[11px] font-bold text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-[var(--brand-deep)]">{number}</p>
      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{foot} <span aria-hidden="true">↗</span></p>
    </Link>
  );
}
function BlockHeading({ title, href, action }: { title: string; href: string; action: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
      <h2 className="text-base font-bold text-[var(--brand-deep)]">{title}</h2>
      <Link href={href} className="inline-flex min-h-10 items-center rounded-lg px-2 text-xs font-bold text-[var(--brand-deep)] hover:bg-[var(--brand-primary-soft)]">{action} →</Link>
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
    <div className="min-w-0 max-w-full space-y-4 pb-8">
      <PilotEvent eventName="rfq_hub_viewed" metadata={{ surface: "rfq_hub_dashboard" }} />
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-strong)] bg-white p-4 sm:p-5">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--brand-primary)]">Workspace aziendale · acquisti</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[var(--brand-deep)]">RFQ Hub</h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--text-secondary)]">
            Distinte, richieste ai fornitori, offerte e ordini dell'azienda attiva.
            Marketplace resta un canale opzionale di pubblicazione.
          </p>
        </div>
        {canWrite ? (
          <Link href={appRoutes.rfqHub.createDistinta}
            className="platform-primary inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-bold">
            + Nuova distinta
          </Link>
        ) : <span className="rounded-lg bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">Consultazione</span>}
      </header>

      {problems ? (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Alcuni dati non sono temporaneamente disponibili. I conteggi mancanti sono indicati con —; riprova più tardi.
        </p>
      ) : null}

      <section aria-label="Riepilogo acquisti" className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile label="Distinte salvate" number={countText(savedCount.count, savedCount.error)} foot="Snapshot aziendali visibili" href="#distinte" />
        <Tile label="Campagne RFQ" number={countText(campaignCount.count, campaignCount.error)} foot="Private e condivise" href="#campagne" />
        <Tile label="Offerte ricevute" number={countText(quoteCount.count, quoteCount.error)} foot="Revisioni attualmente inviate" href="#offerte" />
        <Tile label="Purchase Order" number={countText(orderCount.count, orderCount.error)} foot="Bozze e ordini in gestione" href="#ordini" />
      </section>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <section id="campagne" className="min-w-0 scroll-mt-28 rounded-xl border border-[var(--border)] bg-white p-4">
            <BlockHeading title="Campagne RFQ" href={appRoutes.rfqHub.home} action="Aggiorna" />
            {campaigns.error ? (
              <p className="py-4 text-sm text-[var(--text-secondary)]">Elenco RFQ non disponibile.</p>
            ) : recentCampaigns.length === 0 ? (
              <div className="py-5 text-sm text-[var(--text-secondary)]">
                Nessuna campagna visibile. {canWrite ? "Crea e salva una distinta, poi avvia la prima RFQ." : "Le richieste condivise compariranno qui."}
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {recentCampaigns.map((campaign) => (
                  <Link key={campaign.id} href={appRoutes.rfqHub.campaign(campaign.id)}
                    className="flex min-h-16 items-center justify-between gap-3 py-2.5 hover:text-[var(--brand-primary)]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--brand-deep)]">{campaign.title}</p>
                      <p className="mt-0.5 break-words text-xs text-[var(--text-secondary)]">
                        {rfqCampaignStatusLabel(campaign.status)} · Creata {formatHubDate(campaign.created_at)}
                        {campaign.due_at ? " · Scadenza " + formatHubDate(campaign.due_at) : ""}
                      </p>
                    </div>
                    <span aria-hidden="true" className="shrink-0 text-[var(--brand-primary)]">→</span>
                  </Link>
                ))}
              </div>
            )}
            {campaignCount.count !== null && campaignCount.count > recentCampaigns.length ? (
              <p className="mt-2 text-[11px] text-[var(--text-secondary)]">Mostrate le 7 campagne più recenti; il totale è riportato sopra.</p>
            ) : null}
          </section>

          <section id="distinte" className="min-w-0 scroll-mt-28 rounded-xl border border-[var(--border)] bg-white p-4">
            <BlockHeading title="Distinte salvate" href={appRoutes.rfqHub.savedDistinte} action="Archivio completo" />
            {saved.error ? (
              <p className="py-4 text-sm text-[var(--text-secondary)]">Archivio distinte non disponibile.</p>
            ) : recentSaved.length === 0 ? (
              <p className="py-5 text-sm text-[var(--text-secondary)]">Nessuna distinta salvata visibile. La bozza locale non è uno snapshot salvato.</p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {recentSaved.map((draft) => (
                  <div key={draft.id} className="flex min-h-16 items-center justify-between gap-3 py-2.5">
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
                      className="shrink-0 rounded-lg bg-[var(--brand-primary-soft)] px-2.5 py-2 text-xs font-bold text-[var(--brand-deep)]">
                      {relatedRfq.has(draft.id) ? "Apri RFQ" : "Apri"}
                    </Link>
                  </div>
                ))}
              </div>
            )}
            {savedCount.count !== null && savedCount.count > recentSaved.length ? (
              <p className="mt-2 text-[11px] text-[var(--text-secondary)]">Ultime 8 distinte. L'archivio completo sarà ampliato nel successivo intervento.</p>
            ) : null}
          </section>
        </div>

        <div className="min-w-0 space-y-3">
          <section className="min-w-0 rounded-xl border border-[var(--border)] bg-white p-4">
            <BlockHeading title="Da gestire" href={appRoutes.rfqHub.inbox} action="Apri Inbox" />
            {!canWrite ? (
              <p className="py-4 text-sm text-[var(--text-secondary)]">Le attività operative sono disponibili ai ruoli autorizzati. Le RFQ condivise restano consultabili.</p>
            ) : attention === null ? (
              <p className="py-4 text-sm text-[var(--text-secondary)]">Coda acquisti temporaneamente non disponibile. Apri Inbox per verificare le attività.</p>
            ) : attention.length === 0 ? (
              <p className="py-4 text-sm text-[var(--text-secondary)]">Nessuna attività da gestire nelle campagne recenti. Controlla Inbox per la coda completa.</p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {attention.map((item) => (
                  <Link key={item.item_id} href={appRoutes.rfqHub.campaign(item.rfq_id)}
                    className="block py-3 hover:text-[var(--brand-primary)]">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-[var(--brand-deep)]">{item.headline}</p>
                      {item.priority === "urgent" || item.priority === "high" ?
                        <span className="rounded bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-900">{item.priority === "urgent" ? "Urgente" : "Alta"}</span> : null}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{campaignName.get(item.rfq_id) ?? "RFQ"} · {item.detail}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section id="offerte" className="min-w-0 scroll-mt-28 rounded-xl border border-[var(--border)] bg-white p-4">
            <BlockHeading title="Offerte ricevute" href={appRoutes.rfqHub.home + "#campagne"} action="Vai alle RFQ" />
            {quotes.error ? <p className="py-4 text-sm text-[var(--text-secondary)]">Offerte non disponibili.</p>
              : recentQuotes.length === 0 ? <p className="py-4 text-sm text-[var(--text-secondary)]">Non risultano offerte inviate dai fornitori.</p>
                : <div className="divide-y divide-[var(--border)]">
                    {recentQuotes.map((quote) => (
                      <Link key={quote.id} href={appRoutes.rfqHub.campaign(quote.rfq_id)} className="flex items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[var(--brand-deep)]">{campaignName.get(quote.rfq_id) || "Apri RFQ"}</p>
                          <p className="text-xs text-[var(--text-secondary)]">Offerta ricevuta · Revisione {quote.revision_no} · {formatHubDate(quote.submitted_at)}</p>
                        </div><span className="text-[var(--brand-primary)]">→</span>
                      </Link>
                    ))}
                  </div>}
          </section>

          <section id="ordini" className="min-w-0 scroll-mt-28 rounded-xl border border-[var(--border)] bg-white p-4">
            <BlockHeading title="Ordini di acquisto" href={appRoutes.rfqHub.home + "#campagne"} action="Vai alle RFQ" />
            {orders.error ? <p className="py-4 text-sm text-[var(--text-secondary)]">Ordini non disponibili.</p>
              : recentOrders.length === 0 ? <p className="py-4 text-sm text-[var(--text-secondary)]">Nessun Purchase Order collegato alle RFQ.</p>
                : <div className="divide-y divide-[var(--border)]">
                    {recentOrders.map((order) => (
                      <Link key={order.id} href={appRoutes.rfqHub.campaign(order.rfq_id)} className="flex items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[var(--brand-deep)]">{order.po_draft_ref} · {order.supplier_name_snapshot}</p>
                          <p className="text-xs text-[var(--text-secondary)]">{rfqOrderStatusLabel(order.status)} · {value(Number(order.total_eur))} €</p>
                        </div><span className="text-[var(--brand-primary)]">→</span>
                      </Link>
                    ))}
                  </div>}
          </section>
        </div>
      </div>
    </div>
  );
}

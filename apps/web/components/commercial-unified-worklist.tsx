import Link from "next/link";
import cinematic from "@/components/commercial-cinematic.module.css";
import { CommercialDealFactBriefCopy } from "@/components/commercial-deal-fact-brief-copy";
import { CommercialDealQuickActions } from "@/components/commercial-deal-quick-actions";

import { getOperationalEntityData } from "@/lib/commercial-data";
import { isStreamView, mergedCommercialHref } from "@/lib/commercial-unified-streams";
import { CommercialCampaignOperations, type CommercialOperationsTab } from "@/components/commercial-campaign-operations";
import {
  commercialHref,
  commercialPageHref,
  filterCommercialItems,
  type CommercialView,
  type UnifiedCommercialData,
  type UnifiedCommercialItem,
} from "@/lib/commercial-unified-data";
import { formatHubDate } from "@/lib/rfq-hub-overview";
import { appRoutes } from "@/lib/routes";
import { commercialSearchHref } from "@/lib/commercial-search-context";

const views: ReadonlyArray<{ key: CommercialView; title: string }> = [
  { key: "all", title: "Tutte" },
  { key: "received", title: "Ricevute" },
  { key: "sent", title: "Inviate" },
  { key: "offers", title: "Offerte" },
  { key: "orders", title: "Ordini" },
  { key: "drafts", title: "Bozze" },
];

function itemType(item: UnifiedCommercialItem) {
  if (item.kind === "inbound-rfq") return "Richiesta cliente";
  if (item.kind === "inbound-offer") return "Offerta commerciale";
  if (item.kind === "inbound-order") return "Ordine cliente";
  if (item.kind === "campaign") return "RFQ ai fornitori";
  if (item.kind === "quote") return "Risposta fornitore";
  if (item.kind === "purchase-order") return "Ordine acquisti";
  return "Distinta salvata";
}

function route(view: CommercialView, query: string, key: string, page: number, cursor?: string | null) {
  const href = cursor && isStreamView(view) ? mergedCommercialHref(view, query, cursor, key) :
    page > 1 ? commercialPageHref(view, query, page, key) : commercialHref(view, query, key);
  return href.replace("#commercial-worklist", "#commercial-detail");
}

async function SelectedDetail({
  item, related, canWrite, tab, view, query, page, cursor,
}: {
  item: UnifiedCommercialItem;
  related: UnifiedCommercialItem[];
  canWrite: boolean;
  tab: CommercialOperationsTab;
  view: CommercialView;
  query: string;
  page: number;
  cursor?: string | null;
}) {
  const inboundKind = item.kind === "inbound-rfq" ? "rfq" :
    item.kind === "inbound-offer" ? "offer" :
    item.kind === "inbound-order" ? "order" : null;
  const detail = inboundKind ? await getOperationalEntityData(inboundKind, item.id) : null;
  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--brand-primary)]">{itemType(item)}</p>
        <h3 className="mt-1 break-words text-lg font-bold text-[var(--brand-deep)]">{item.title}</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.subtitle}</p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-[var(--surface-subtle)] p-2.5">
          <dt className="text-[var(--text-secondary)]">Stato</dt>
          <dd className="mt-1 font-semibold text-[var(--text-primary)]">{detail?.status ?? item.status}</dd>
        </div>
        <div className="rounded-lg bg-[var(--surface-subtle)] p-2.5">
          <dt className="text-[var(--text-secondary)]">Origine</dt>
          <dd className="mt-1 font-semibold text-[var(--text-primary)]">{item.origin}</dd>
        </div>
        {item.at ? (
          <div className="col-span-2 rounded-lg bg-[var(--surface-subtle)] p-2.5">
            <dt className="text-[var(--text-secondary)]">Registrata</dt>
            <dd className="mt-1 font-semibold text-[var(--text-primary)]">{formatHubDate(item.at)}</dd>
          </div>
        ) : null}
      </dl>
      {detail ? (
        <div className="space-y-3">
          {detail.metadata.length ? (
            <dl className="space-y-1.5 text-xs">
              {detail.metadata.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3 border-b border-[var(--border)] py-1.5">
                  <dt className="text-[var(--text-secondary)]">{row.label}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <h4 className="text-sm font-semibold text-[var(--brand-deep)]">Articoli della richiesta</h4>
          {detail.lines.length ? (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {detail.lines.map((line) => (
                <div key={line.id} className="rounded-lg border border-[var(--border)] p-3 text-xs">
                  <p className="break-words font-semibold text-[var(--text-primary)]">{line.product}</p>
                  <p className="mt-1 text-[var(--text-secondary)]">
                    {line.standard} · {line.grade} · {line.quantity} {line.price !== "—" ? " · " + line.price : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-[var(--text-secondary)]">Nessuna riga disponibile per questa voce.</p>}
          {detail.relationshipLinks.map((link) => (
            <Link key={link.href} href={link.href} className="block text-xs font-semibold text-[var(--brand-deep)] underline-offset-2 hover:underline">{link.label} →</Link>
          ))}
        </div>
      ) : inboundKind ? (
        <p role="status" className="text-xs text-[var(--text-secondary)]">Dettaglio non disponibile per il tuo accesso. Non vengono mostrati dati di altre aziende.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-secondary)]">
            Questa voce mantiene il collegamento alla campagna o alla distinta originale: nessuna duplicazione e nessuna pubblicazione automatica.
          </p>
          {related.length ? (
            <>
              <p className="text-xs font-semibold text-[var(--brand-deep)]">Attività collegate</p>
              {related.slice(0, 6).map((entry) => (
                <div key={entry.key} className="flex items-start justify-between gap-2 rounded-lg border border-[var(--border)] px-2.5 py-2 text-xs">
                  <span className="min-w-0 truncate">{itemType(entry)} · {entry.status}</span>
                  <span className="shrink-0 text-[var(--text-secondary)]">{entry.at ? formatHubDate(entry.at) : ""}</span>
                </div>
              ))}
            </>
          ) : null}
        </div>
      )}
      <section aria-labelledby="commercial-deal-next-step" data-testid="commercial-deal-next-step"
        className="rounded-xl border border-[#b5d7c3] bg-[#f3f9f5] p-3 sm:p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#246c53]">Prossimo passo</p>
        <h4 id="commercial-deal-next-step" className="mt-1 text-sm font-semibold text-[#173f35]">
          {canWrite ? "Continua questa trattativa" : "Consulta la trattativa"}
        </h4>
        <p className="mt-1 text-xs leading-5 text-[#52685b]">
          {item.kind === "campaign"
            ? "Apri la RFQ per verificare risposte e destinatari prima di ogni decisione."
            : item.kind === "quote"
              ? "Apri la risposta e verifica condizioni e materiale prima di procedere."
              : item.kind === "purchase-order"
                ? "Consulta l’ordine e i documenti della trattativa."
                : "Apri il dettaglio originale per continuare senza creare copie della richiesta."}
        </p>
        <Link href={item.href}
          className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#175640] px-4 text-xs font-semibold text-white hover:bg-[#104632] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246c53]">
          {canWrite ? "Continua →" : "Apri dettaglio →"}
        </Link>
      </section>
      <CommercialDealQuickActions canWrite={canWrite} composeHref={appRoutes.commercial.home + "?compose=1#commercial-compose"} originalHref={item.href} />
      <section aria-labelledby="commercial-deal-memory-heading" data-testid="commercial-deal-memory-entry"
        className="overflow-hidden rounded-2xl border border-[#c9e1d3] bg-[#f3faf5]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dbece1] px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#175640] text-sm text-white">✦</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#246c53]">Commercial Intelligence</p>
              <h4 id="commercial-deal-memory-heading" className="text-sm font-semibold text-[#173f35]">Analizza questa trattativa</h4>
            </div>
          </div>
          <span className="text-[10px] font-medium text-[#52685b]">Solo dati autorizzati</span>
        </div>
        <div className="space-y-3 px-3 py-3 sm:px-4">
          <CommercialDealFactBriefCopy key={item.key} kind={item.kind} dealId={item.id}
            status={detail?.status ?? item.status} title={item.title} origin={item.origin}
            relatedActivities={related.slice(0, 4).map((entry) => ({ kind: itemType(entry), status: entry.status }))} />
          <details data-testid="commercial-deal-fact-brief" className="border-t border-[#dbece1] pt-2 text-xs">
            <summary className="cursor-pointer font-semibold text-[#175640]">Dati di partenza della scheda</summary>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              <div><dt className="text-[#52685b]">Tipo</dt><dd className="font-medium text-[#173f35]">{itemType(item)}</dd></div>
              <div><dt className="text-[#52685b]">Stato</dt><dd className="font-medium text-[#173f35]">{detail?.status ?? item.status}</dd></div>
              <div><dt className="text-[#52685b]">Oggetto</dt><dd className="break-words font-medium text-[#173f35]">{item.title}</dd></div>
              <div><dt className="text-[#52685b]">Origine</dt><dd className="font-medium text-[#173f35]">{item.origin}</dd></div>
            </dl>
            <p className="mt-2 text-[11px] text-[#52685b]">Le offerte, i messaggi e i documenti non presenti non vengono dedotti da questa sintesi.</p>
          </details>
        </div>
      </section>
      {item.campaignId ? (
        <CommercialCampaignOperations
          rfqId={item.campaignId}
          selected={item.key}
          tab={tab}
          view={view}
          query={query}
          page={page}
          cursor={cursor}
        />
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
        <Link href={item.href}
          className="app-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold">
          {item.kind === "campaign" || item.kind === "quote" || item.kind === "purchase-order"
            ? canWrite ? "Confronto, negoziazione e ordini ↗" : "Consulta RFQ completa ↗"
            : "Apri dettaglio completo ↗"}
        </Link>
        {item.kind === "campaign" && canWrite ? (
          <Link href={appRoutes.network.directory} className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border-strong)] px-3 text-xs font-semibold text-[var(--brand-deep)]">
            Cerca fornitori nel Network ↗
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export async function CommercialUnifiedWorklist({
  data, selected, query, view, canWrite, tab, page,
}: {
  data: UnifiedCommercialData;
  selected: string;
  query: string;
  view: CommercialView;
  canWrite: boolean;
  tab: CommercialOperationsTab;
  page: number;
}) {
  // Paged views have already been searched inside SQL/RPC.
  const filtered = data.paging ? data.items : filterCommercialItems(data.items, view, query);
  const active = filtered.find((item) => item.key === selected) ?? null;
  const related = active?.campaignId
    ? data.items.filter((item) => item.campaignId === active.campaignId && item.key !== active.key)
    : [];

  return (
    <section id="commercial-worklist" aria-labelledby="commercial-worklist-title" data-testid="comm-cine2-deal-cockpit" className={"scroll-mt-28 space-y-3 " + cinematic.worklist}>
      <div data-testid="comm-cine9-workspace-heading"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-[#dce8df] bg-white px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#386b50]">Workspace commerciale / Deal cockpit</p>
          <h2 id="commercial-worklist-title" className="mt-0.5 text-xl font-semibold leading-tight tracking-[-0.025em] text-[#123c2f]">
            Le mie trattative
          </h2>
        </div>
        <div className="shrink-0 rounded-full border border-[#c7dece] bg-[#f6faf7] px-3 py-1.5 text-xs font-semibold tabular-nums text-[#276147]">
          {data.paging?.exact && data.paging.total !== null ? data.paging.total : filtered.length} attività in questa vista
        </div>
      </div>

      {data.partial ? (
        <p role="status" className="rounded-lg border border-[#dfc9a5] bg-[#fff9ed] px-3 py-2 text-xs text-[#795321]">
          {data.procurementUnavailable && data.inboundUnavailable ? "Alcuni dati commerciali e di acquisto non sono disponibili." :
            data.procurementUnavailable ? "Il caricamento di alcune attività acquisti non è riuscito." :
            "Lo storico commerciale non è disponibile o non ancora associato a questa azienda."}
          {" "}La lista potrebbe essere incompleta: nessun dato dimostrativo è presentato come reale.
        </p>
      ) : null}
      {data.paging?.pageSize === 50 ? (
        <p className="text-xs text-[var(--text-secondary)]">Le richieste cliente sono paginate per righe di origine; più righe possono riferirsi alla stessa richiesta.</p>
      ) : null}
      {data.truncated ? (
        <p className="text-xs text-[var(--text-secondary)]">
          {data.paging ? "Hai raggiunto il limite di navigazione: restringi la ricerca per trovare altre attività." : "Vista rapida delle attività più recenti, non archivio completo. Usa la ricerca nello storico per i record precedenti."}
        </p>
      ) : null}

      <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[#e1eae4] bg-white p-3 shadow-[0_12px_36px_-32px_rgba(4,46,32,0.4)] lg:flex-row lg:items-center" data-testid="commercial-compact-filters">
        <nav aria-label="Filtra attività commerciali" className="flex min-w-0 shrink-0 gap-0.5 overflow-x-auto rounded-xl bg-[#eef5f0] p-1">
          {views.map(({ key, title }) => (
            <Link key={key} href={commercialHref(key, query)} aria-current={key === view ? "page" : undefined}
              className={"inline-flex min-h-10 shrink-0 items-center rounded-md px-2.5 text-xs font-semibold transition " +
                (key === view ? "app-selected-solid" : "text-[var(--text-secondary)] hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-deep)]")}>
              {title}
            </Link>
          ))}
        </nav>
        <form action={appRoutes.commercial.home} method="get" role="search" className="flex min-w-0 flex-1 gap-2">
          {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
          <label htmlFor="commercial-worklist-q" className="sr-only">Filtra le attività visibili</label>
          <input id="commercial-worklist-q" type="search" name="q" maxLength={80} defaultValue={query}
            placeholder={isStreamView(view) ? "Cerca titolo RFQ, stato o riferimento ordine..." : "Filtra azienda, articolo o stato..."}
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]" />
          <button className="app-secondary min-h-10 shrink-0 rounded-lg px-3 text-xs font-semibold" type="submit">Filtra</button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--text-secondary)]">
        <span>{isStreamView(view)
          ? "Il filtro qui cerca nelle intestazioni RFQ, offerte e ordini."
          : "Qui filtri le attività visibili, non tutto l’archivio documentale."}</span>
        <Link href={commercialSearchHref(query)}
          className="font-semibold text-[var(--brand-deep)] underline-offset-2 hover:underline">
          Cerca anche aziende, articoli, misure e norme nello storico →
        </Link>
      </div>

      <div className={active ? "grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] 2xl:grid-cols-[minmax(0,1.3fr)_minmax(380px,0.9fr)]" : "grid min-w-0 gap-4"} data-testid="comm-cine2-split-view">
        <div data-testid="commercial-list-pane" className={(active ? "hidden lg:block " : "") + "min-w-0 overflow-hidden rounded-[22px] border border-[#dce7e0] bg-white shadow-[0_18px_55px_-40px_rgba(4,46,32,0.50)]"}>
          <div className="flex items-center justify-between border-b border-[#e0ebe3] bg-[#fafdfa] px-4 py-2.5">
            <p className="text-sm font-semibold tracking-tight text-[#173f35]">Trattative e attività</p>
            <span className="text-xs tabular-nums text-[var(--text-secondary)]">{data.paging?.exact && data.paging.total !== null
              ? data.paging.total + " totali"
              : filtered.length + " visualizzate"}</span>
          </div>
          {filtered.length ? (
            <div className="divide-y divide-[var(--border)]">
              {filtered.map((item) => (
                <Link key={item.key} href={route(view, query, item.key, data.paging?.page ?? page, data.paging?.currentCursor)}
                  aria-current={item.key === active?.key ? "true" : undefined}
                  className={"group grid min-h-[70px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-l-[3px] px-3 py-2 transition hover:bg-[#f3f8f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] sm:px-4 " +
                    (item.key === active?.key ? "border-l-[#175640] bg-[#edf6f0]" : "border-l-transparent")}>
                  <div className="min-w-0 space-y-0.5" data-testid="commercial-smart-deal-card">
                    <div className="flex min-w-0 items-center gap-1.5 text-[10px] leading-4">
                      <span className="shrink-0 font-bold uppercase tracking-wide text-[var(--brand-primary)]">{itemType(item)}</span>
                      <span aria-hidden="true" className="text-[var(--text-secondary)]">·</span>
                      <span className="min-w-0 truncate text-[var(--text-secondary)]">{item.origin}</span>
                    </div>
                    <p className="truncate text-sm font-semibold leading-5 text-[var(--brand-deep)]" title={item.title}>{item.title}</p>
                    {item.subtitle ? <p className="truncate text-xs leading-4 text-[var(--text-secondary)]">{item.subtitle}</p> : null}
                  </div>
                  <div className="flex min-w-[64px] max-w-[120px] flex-col items-end gap-1 text-right sm:min-w-[104px] sm:max-w-[180px]">
                    <span className="max-w-full truncate rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-0.5 text-[11px] font-semibold leading-4 text-[var(--brand-deep)]" title={item.status}>{item.status}</span>
                    <div className="flex items-center gap-2">
                      {item.at ? <time className="text-[10px] tabular-nums text-[var(--text-secondary)]">{formatHubDate(item.at)}</time> : null}
                      <span aria-hidden="true" className="text-[11px] font-semibold text-[var(--brand-primary)]">Apri →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <p className="text-sm font-semibold text-[var(--brand-deep)]">Nessuna attività in questa vista</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {data.partial ? "Il risultato potrebbe essere incompleto: controlla lo stato dei dati." :
                  query ? "Prova con un altro termine oppure scegli Tutte." :
                    "Quando sarà registrata un'attività pertinente, la vedrai qui."}
              </p>
              {canWrite ? <Link href={appRoutes.commercial.home + "?compose=1#commercial-compose"}
                className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-[var(--border-strong)] px-3 text-xs font-semibold text-[var(--brand-deep)]">
                Prepara una nuova richiesta →
              </Link> : null}
            </div>
          )}
          {data.paging ? (
            <nav aria-label="Pagine attività commerciali" className="flex items-center justify-between gap-2 border-t border-[var(--border)] p-3">
              {data.paging.page > 1 ? (
                <Link href={isStreamView(view) ? mergedCommercialHref(view, query, data.paging.previousCursor ?? undefined) : commercialPageHref(view, query, data.paging.page - 1)} className="app-secondary inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold">← Precedente</Link>
              ) : <span />}
              <span className="text-xs tabular-nums text-[var(--text-secondary)]">Pagina {data.paging.page}</span>
              {data.paging.hasNext ? (
                <Link href={isStreamView(view) ? mergedCommercialHref(view, query, data.paging.nextCursor ?? undefined) : commercialPageHref(view, query, data.paging.page + 1)} className="app-secondary inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold">Successiva →</Link>
              ) : <span />}
            </nav>
          ) : null}
        </div>

        {active ? (
          <aside id="commercial-detail" aria-label="Dettaglio attività selezionata" tabIndex={-1}
            className="scroll-mt-24 min-w-0 max-w-full rounded-[22px] border border-[#c9ded0] bg-white p-4 shadow-[0_22px_60px_-38px_rgba(4,46,32,0.55)] sm:scroll-mt-36 sm:p-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4e7a60]">Workspace / Dettaglio</p><h3 className="mt-1 text-base font-semibold tracking-tight text-[#173f35]">Trattativa selezionata</h3></div>
              <Link href={isStreamView(view) ? mergedCommercialHref(view, query, data.paging?.currentCursor ?? undefined) : commercialPageHref(view, query, page)} className="app-secondary inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold">
                Chiudi <span aria-hidden="true" className="ml-1">×</span>
              </Link>
            </div>
            <div className="min-w-0 max-w-full overflow-x-auto">
              <SelectedDetail item={active} related={related} canWrite={canWrite} tab={tab} view={view} query={query} page={data.paging?.page ?? page} cursor={data.paging?.currentCursor} />
            </div>
          </aside>
        ) : selected ? (
          <p role="status" className="rounded-lg border border-[var(--border)] bg-white p-4 text-xs text-[var(--text-secondary)]">
            Attività non trovata nella vista corrente o non autorizzata per questo account.
          </p>
        ) : null}
      </div>
    </section>
  );
}

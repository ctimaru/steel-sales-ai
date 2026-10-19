import Link from "next/link";

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
    <section id="commercial-worklist" aria-labelledby="commercial-worklist-title" className="scroll-mt-36 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-primary)]">Una pagina · Due flussi collegati</p>
          <h2 id="commercial-worklist-title" className="mt-1 text-xl font-bold text-[var(--brand-deep)]">Richieste, offerte e ordini</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Ricevute dai clienti e inviate ai fornitori, con identità e permessi distinti.</p>
        </div>
        {canWrite ? (
          <Link href={appRoutes.commercial.home + "?compose=1#commercial-compose"} className="app-primary inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold">
            + Nuova distinta
          </Link>
        ) : null}
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

      <nav aria-label="Filtra attività commerciali" className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-white p-1.5">
        {views.map(({ key, title }) => (
          <Link key={key} href={commercialHref(key, query)} aria-current={key === view ? "page" : undefined}
            className={"inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-xs font-semibold " +
              (key === view ? "bg-[var(--brand-deep)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-deep)]")}>
            {title}
          </Link>
        ))}
      </nav>

      <form action={appRoutes.commercial.home} method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
        {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
        <label htmlFor="commercial-worklist-q" className="sr-only">Filtra le attività visibili</label>
        <input id="commercial-worklist-q" type="search" name="q" maxLength={80} defaultValue={query}
          placeholder="Filtra azienda, articolo o stato..."
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]" />
        <button className="app-secondary min-h-10 rounded-lg px-4 text-xs font-semibold" type="submit">Filtra</button>
      </form>

      <div className={active ? (active.campaignId ? "grid min-w-0 gap-3" : "grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]") : ""}>
        <div data-testid="commercial-list-pane" className={(active ? "hidden lg:block " : "") + "min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white"}>
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
            <p className="text-xs font-semibold text-[var(--brand-deep)]">Attività visibili</p>
            <span className="text-xs tabular-nums text-[var(--text-secondary)]">{data.paging?.exact && data.paging.total !== null
              ? data.paging.total + " totali"
              : filtered.length + " visualizzate"}</span>
          </div>
          {filtered.length ? (
            <div className="max-h-[520px] divide-y divide-[var(--border)] overflow-y-auto">
              {filtered.map((item) => (
                <Link key={item.key} href={route(view, query, item.key, data.paging?.page ?? page, data.paging?.currentCursor)}
                  aria-current={item.key === active?.key ? "true" : undefined}
                  className={"flex min-h-16 items-start justify-between gap-2 p-3 transition hover:bg-[var(--brand-primary-soft)] " +
                    (item.key === active?.key ? "bg-[var(--brand-primary-soft)]" : "")}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{itemType(item)} · {item.origin}</p>
                    <p className="mt-1 truncate text-sm font-bold text-[var(--brand-deep)]">{item.title}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{item.subtitle}</p>
                    <p className="mt-1 text-[11px] font-medium text-[var(--brand-primary)]">{item.status}</p>
                  </div>
                  <span className="shrink-0 pt-1 text-[11px] text-[var(--text-secondary)]">{item.at ? formatHubDate(item.at) : "→"}</span>
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
            className="scroll-mt-24 min-w-0 max-w-full rounded-xl border border-[var(--border-strong)] bg-white p-3 sm:scroll-mt-36 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--brand-deep)]">Dettaglio nella stessa pagina</h3>
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

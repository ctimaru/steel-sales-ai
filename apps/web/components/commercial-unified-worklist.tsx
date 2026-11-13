import Link from "next/link";
import cinematic from "@/components/commercial-cinematic.module.css";
import { CommercialDealFactBriefCopy } from "@/components/commercial-deal-fact-brief-copy";
import { CommercialDealQuickActions } from "@/components/commercial-deal-quick-actions";
import { CommercialDealDecisionReadiness, CommercialDealIntelligence, loadCommercialDealFacts } from "@/components/commercial-deal-intelligence";
import { commercialDealNextStep, commercialDealOperationTab } from "@/lib/commercial-deal-next-step";

import { getOperationalEntityData } from "@/lib/commercial-data";
import {
  commercialFocusLabels, isStreamView, mergedCommercialHref,
  type CommercialFocus,
} from "@/lib/commercial-unified-streams";
import { CommercialDealLabelForm } from "@/components/commercial-deal-label-form";
import { CommercialCampaignOperations, operationsHref, type CommercialOperationsTab } from "@/components/commercial-campaign-operations";
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
import {
  commercialDueLabel, commercialRowGroup, commercialRowGroupLabels, commercialRowUrgency,
  sortByCommercialUrgency, type CommercialRowGroup, type CommercialRowUrgency,
} from "@/lib/commercial-row-urgency";

const views: ReadonlyArray<{ key: CommercialView; title: string }> = [
  { key: "all", title: "Tutte" },
  { key: "received", title: "Ricevute" },
  { key: "sent", title: "Inviate" },
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

// Priorità a colpo d'occhio: scadenze e risposte dovute risaltano, le bozze
// proprie restano discrete, gli esiti neutri. La regola vive in commercial-row-urgency.
const statusDotClass: Record<CommercialRowUrgency, string> = {
  due: "bg-[#c2410c]",
  reply: "bg-[#d9a62e]",
  draft: "border-2 border-[#d9a62e] bg-transparent",
  progress: "bg-[#3d8a63]",
  done: "border border-[#9fb3a8] bg-transparent",
};
const statusTextClass: Record<CommercialRowUrgency, string> = {
  due: "text-[#9a3412]",
  reply: "text-[#8a5a00]",
  draft: "text-[#6f5a2a]",
  progress: "text-[#276147]",
  done: "text-[#6b7d73]",
};
const groupLabelClass: Record<CommercialRowGroup, string> = {
  now: "bg-[#fff8e6] text-[#6b4a07]",
  complete: "bg-[#f7f9f8] text-[#4f6b5b]",
  rest: "bg-[#f7f9f8] text-[#4f6b5b]",
};

// Un filtro rapido senza risultati è una buona notizia, non una ricerca fallita.
const focusEmptyTitles: Record<CommercialFocus, string> = {
  due: "Niente in scadenza nei prossimi 7 giorni",
  reply: "Niente a cui rispondere adesso",
  waiting: "Niente in attesa di risposta",
};

function route(view: CommercialView, query: string, key: string, page: number, cursor?: string | null, focus: CommercialFocus | "" = "") {
  const href = (cursor || focus) && isStreamView(view) ? mergedCommercialHref(view, query, cursor ?? undefined, key, focus) :
    page > 1 ? commercialPageHref(view, query, page, key) : commercialHref(view, query, key);
  return href.replace("#commercial-worklist", "#commercial-detail");
}

async function SelectedDetail({
  item, related, canWrite, tab, view, query, page, cursor, focus = "",
}: {
  item: UnifiedCommercialItem;
  related: UnifiedCommercialItem[];
  canWrite: boolean;
  tab: CommercialOperationsTab;
  view: CommercialView;
  query: string;
  page: number;
  cursor?: string | null;
  focus?: CommercialFocus | "";
}) {
  const inboundKind = item.kind === "inbound-rfq" ? "rfq" :
    item.kind === "inbound-offer" ? "offer" :
    item.kind === "inbound-order" ? "order" : null;
  const detail = inboundKind ? await getOperationalEntityData(inboundKind, item.id) : null;
  const facts = await loadCommercialDealFacts(item, detail);
  const rawStatus = facts?.rawStatus ?? item.status;
  const nextStep = commercialDealNextStep(item.kind, rawStatus, canWrite, Boolean(facts));
  const operationTab = commercialDealOperationTab(item.kind, rawStatus, canWrite, Boolean(facts));
  // Keep all filters, the selected item and the active page/cursor when drilling
  // into the already governed RFQ operations. Never build an action for a
  // missing/unreadable parent campaign.
  const actionHref = operationTab && item.campaignId
    ? operationsHref(view, query, item.key, operationTab, page, cursor, focus)
    : item.href;
  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--brand-primary)]">{itemType(item)}</p>
        <h3 className="mt-1 break-words text-lg font-bold text-[var(--brand-deep)]">{item.title}</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.subtitle}</p>
      </div>
      {canWrite && inboundKind ? (
        <CommercialDealLabelForm kind={inboundKind} id={item.id} label={item.rowFacts?.label ?? ""} />
      ) : null}
      <div data-testid="commercial-decision-dock" className="overflow-hidden rounded-xl border border-[#b5d7c3] bg-white">
        <CommercialDealDecisionReadiness facts={facts} kind={item.kind} canWrite={canWrite} />
      <section aria-labelledby="commercial-deal-next-step" data-testid="commercial-deal-next-step"
        className="border-t border-[#d9e9df] bg-[#f3f9f5] p-3 sm:p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#246c53]">Prossimo passo</p>
        <h4 id="commercial-deal-next-step" className="mt-1 text-sm font-semibold text-[#173f35]">
          {nextStep.title}
        </h4>
        <p className="mt-1 text-xs leading-5 text-[#52685b]">
          {nextStep.description}
        </p>
        <Link href={actionHref} data-testid="commercial-deal-primary-action"
          className="app-primary mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#175640] px-4 text-xs font-semibold text-white hover:bg-[#104632] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246c53]">
          {nextStep.actionLabel}
        </Link>
      </section>
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
      <CommercialDealIntelligence facts={facts} />
      {detail ? (
        <details data-testid="commercial-deal-technical-details" className="rounded-xl border border-[var(--border)] bg-white p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-[var(--brand-deep)]">Approfondimenti tecnici e tracciabilità</summary>
          <div className="mt-3 space-y-3">
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
        </details>
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
          focus={focus}
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
  data, selected, query, view, canWrite, tab, page, focus = "",
}: {
  data: UnifiedCommercialData;
  selected: string;
  query: string;
  view: CommercialView;
  canWrite: boolean;
  tab: CommercialOperationsTab;
  page: number;
  focus?: CommercialFocus | "";
}) {
  // Paged views have already been searched inside SQL/RPC.
  const filtered = data.paging ? data.items : filterCommercialItems(data.items, view, query);
  const active = filtered.find((item) => item.key === selected) ?? null;
  const related = active?.campaignId
    ? data.items.filter((item) => item.campaignId === active.campaignId && item.key !== active.key)
    : [];

  // COMM-TRUST1.C: an unavailable source is not an empty archive, and a
  // filtered empty page is not a first-use state. Derive the next action from
  // the visible query/view without guessing whether a backend was assigned.
  const emptyCause = data.partial ? "unavailable" : query || focus ? "filtered" : view === "all" ? "workspace" : "view";
  const emptyTitle = emptyCause === "unavailable" ? "Impossibile verificare tutte le attività"
    : emptyCause === "filtered" ? (focus && !query ? focusEmptyTitles[focus] : "Nessun risultato per questo filtro")
    : emptyCause === "workspace" ? "Non ci sono ancora trattative da visualizzare"
    : view === "drafts" ? "Nessuna distinta salvata in questa vista"
    : view === "received" ? "Nessuna richiesta cliente in questa vista"
    : view === "sent" ? "Nessuna RFQ inviata in questa vista"
    : view === "offers" ? "Nessuna offerta in questa vista"
    : "Nessun ordine in questa vista";
  const emptyDescription = emptyCause === "unavailable"
    ? "Lo storico potrebbe essere incompleto o non associato: non possiamo confermare che sia vuoto. Consulta la ricerca per verificare i dati accessibili."
    : emptyCause === "filtered" ? (focus && !query
        ? "Nessuna trattativa aperta rientra in «" + commercialFocusLabels[focus] + "». Rimuovi il filtro per rivedere tutte le trattative."
        : "La ricerca non trova attività nella vista selezionata. Rimuovi il filtro senza perdere la vista.")
    : emptyCause === "workspace" ? "Le attività autorizzate appariranno qui quando saranno disponibili."
    : "La vista è vuota; altre richieste, offerte o ordini potrebbero essere presenti nelle altre viste.";
  const emptyAction = emptyCause === "unavailable"
    ? { href: commercialSearchHref(query), label: "Controlla lo storico" }
    : emptyCause === "filtered"
      ? { href: focus && !query ? appRoutes.commercial.home + "#commercial-worklist" : commercialHref(view), label: "Rimuovi filtro" }
      : (view === "drafts" || view === "all") && canWrite
        ? { href: appRoutes.commercial.home + "?compose=1&method=ai#commercial-ai-intake", label: "Prepara con la chat" }
        : { href: commercialHref("all"), label: "Mostra tutte le trattative" };

  // COMM-DESK-AI1.B: dentro la pagina caricata, prima ciò che chiede un'azione.
  // L'elenco resta piatto (una riga = una trattativa); le etichette di gruppo
  // compaiono solo se la pagina contiene più di un gruppo.
  const now = Date.now();
  const urgencyOf = (item: UnifiedCommercialItem) => commercialRowUrgency(item.kind, item.status, item.rowFacts?.dueAt, now);
  const ordered = sortByCommercialUrgency(filtered, urgencyOf);
  const groupCounts = new Map<CommercialRowGroup, number>();
  for (const item of ordered) {
    const group = commercialRowGroup(urgencyOf(item));
    groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
  }
  const showGroups = groupCounts.size > 1;

  // COMM-CLEAN-LIST1: una riga = una trattativa. Due righe di testo, stato come pallino.
  const renderRow = (item: UnifiedCommercialItem) => {
    const type = itemType(item);
    const tone = urgencyOf(item);
    const facts = item.rowFacts;
    const sameAsType = item.title.trim().toLocaleLowerCase("it-IT") === type.toLocaleLowerCase("it-IT");
    // Con un'etichetta personalizzata nel titolo, la controparte scende nella riga di dettaglio.
    const counterparty = facts?.counterparty && facts.counterparty.trim().toLocaleLowerCase("it-IT") !== item.title.trim().toLocaleLowerCase("it-IT")
      ? facts.counterparty : "";
    const reference = facts?.reference ? "rif. " + facts.reference : "";
    const customerRef = facts?.customerRef ? "ord. cliente " + facts.customerRef : "";
    const detail = item.rowFacts?.quantity && item.rowFacts?.lines && item.rowFacts.lines !== "1 riga"
      ? item.rowFacts.lines + " · " + item.rowFacts.quantity
      : item.rowFacts?.quantity ?? item.rowFacts?.lines ?? "";
    const meta = [sameAsType ? "" : type, counterparty, customerRef, reference, detail].filter(Boolean).join(" · ") || item.origin;
    const dueLabel = tone === "done" ? null : commercialDueLabel(facts?.dueAt, formatHubDate(facts?.dueAt), now);
    return (
      <Link key={item.key} href={route(view, query, item.key, data.paging?.page ?? page, data.paging?.currentCursor, focus)}
        aria-current={item.key === active?.key ? "true" : undefined}
        data-testid="commercial-smart-deal-card"
        className={"group flex min-h-[64px] items-center gap-3 px-4 py-2.5 transition hover:bg-[#f5faf7] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand-primary)] sm:px-5 " +
          (item.key === active?.key ? "bg-[#edf6f0]" : "")}>
        <span aria-hidden="true" className={"h-2.5 w-2.5 shrink-0 rounded-full " + statusDotClass[tone]} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[#143f30]">{item.title}</span>
          <span className="block truncate text-xs text-[#5c7063]">{meta}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          {dueLabel ? (
            <span data-testid="commercial-row-due"
              className={"text-xs font-semibold tabular-nums " + (tone === "due" ? "text-[#9a3412]" : "text-[#5c7063]")}>{dueLabel}</span>
          ) : item.at ? <time className="text-xs tabular-nums text-[#5c7063]">{formatHubDate(item.at)}</time> : null}
          <span className={"text-xs font-semibold " + statusTextClass[tone]}>{item.status}</span>
        </span>
        <span className="sr-only">Apri</span>
        <span aria-hidden="true" className="hidden text-[#9ab5a5] transition group-hover:translate-x-0.5 group-hover:text-[#175640] sm:inline">›</span>
      </Link>
    );
  };

  return (
    <section id="commercial-worklist" aria-labelledby="commercial-worklist-title" data-testid="comm-cine2-deal-cockpit" className={"scroll-mt-28 space-y-2 " + cinematic.worklist}>
      <h2 id="commercial-worklist-title" className="sr-only">Le mie trattative</h2>
      {focus ? (
        <p data-testid="commercial-focus-active" className="flex flex-wrap items-center gap-2 px-1 text-xs text-[#315c49]">
          Filtro attivo: <span className="font-semibold">{commercialFocusLabels[focus]}</span>
          <Link href={query ? commercialHref("all", query) : appRoutes.commercial.home + "#commercial-worklist"} className="font-semibold text-[#175640] underline underline-offset-2">Rimuovi ×</Link>
        </p>
      ) : null}

      {data.partial ? (
        <p role="status" className="rounded-lg border border-[#dfc9a5] bg-[#fff9ed] px-3 py-2 text-xs text-[#795321]">
          {data.procurementUnavailable && data.inboundUnavailable ? "Storico commerciale e attività acquisti non verificabili." :
            data.procurementUnavailable ? "Alcune attività acquisti non sono disponibili." :
            data.inboundUnavailable ? "Lo storico delle richieste clienti non è verificabile." :
            "La disponibilità dello storico non è confermata."}
          {" "}Le fonti potrebbero non essere associate oppure il caricamento potrebbe essere fallito. Non interpretare l'assenza di risultati come uno zero certo: nessun dato dimostrativo è presentato come reale.
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

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" data-testid="commercial-compact-filters">
        <nav aria-label="Filtra attività commerciali" className="flex min-w-0 shrink-0 gap-1 overflow-x-auto">
          {views.map(({ key, title }) => (
            <Link key={key} href={commercialHref(key, query)} aria-current={key === view ? "page" : undefined}
              className={"inline-flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] " +
                (key === view ? "bg-[#175640] text-white " + cinematic.tabActive : "text-[#4f6b5b] hover:bg-[#e8f3ec] hover:text-[#143f30]")}>
              {title}
            </Link>
          ))}
        </nav>
        <form action={appRoutes.commercial.home} method="get" role="search" className="relative min-w-0 sm:w-[300px]">
          {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
          {view === "all" && focus ? <input type="hidden" name="focus" value={focus} /> : null}
          <label htmlFor="commercial-worklist-q" className="sr-only">Filtra le attività visibili</label>
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#7a9184]">⌕</span>
          <input id="commercial-worklist-q" type="search" name="q" maxLength={80} defaultValue={query}
            title={isStreamView(view)
              ? "Il filtro qui cerca nelle intestazioni RFQ, offerte e ordini."
              : "Qui filtri le attività visibili, non tutto l’archivio documentale."}
            placeholder="Filtra queste trattative…"
            className="min-h-10 w-full min-w-0 rounded-full border border-[#d6e5db] bg-white pl-8 pr-4 text-sm text-[#143f30] placeholder:text-[#7a9184] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]" />
          <button className="sr-only" type="submit">Filtra</button>
        </form>
      </div>

      {query ? (
        <p data-testid="commercial-filter-scope" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-[#52685b]">
          <span>Filtro «{query}» solo sulle trattative di questo elenco.</span>
          <Link href={commercialSearchHref(query)} className="font-semibold text-[#175640] underline underline-offset-2">
            Cerca «{query}» in tutto lo storico →
          </Link>
          <Link href={commercialHref(view)} className="font-semibold text-[#52685b] underline underline-offset-2">Rimuovi filtro</Link>
        </p>
      ) : null}

      <div className={active ? "grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] 2xl:grid-cols-[minmax(0,1.3fr)_minmax(380px,0.9fr)]" : "grid min-w-0 gap-4"} data-testid="comm-cine2-split-view">
        <div data-testid="commercial-list-pane" className={(active ? "hidden lg:block " : "") + "min-w-0 overflow-hidden rounded-[22px] border border-[#dce7e0] bg-white shadow-[0_18px_55px_-40px_rgba(4,46,32,0.50)]"}>
          {filtered.length ? (
            <div className="divide-y divide-[#edf3ef]" data-testid="commercial-urgency-list">
              {ordered.map((item, index) => {
                const group = commercialRowGroup(urgencyOf(item));
                const first = showGroups && (index === 0 || commercialRowGroup(urgencyOf(ordered[index - 1])) !== group);
                return first ? [
                  <p key={"group:" + group} data-testid="commercial-urgency-group"
                    className={"flex items-center justify-between px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] sm:px-5 " + groupLabelClass[group]}>
                    <span>{commercialRowGroupLabels[group]}</span>
                    <span className="tabular-nums">{groupCounts.get(group)}</span>
                  </p>,
                  renderRow(item),
                ] : renderRow(item);
              })}
            </div>
          ) : (
            <div className="px-4 py-3 sm:px-5 sm:py-4" data-commercial-empty-state={emptyCause}>
              <p className="text-sm font-semibold text-[var(--brand-deep)]">{emptyTitle}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{emptyDescription}</p>
              <Link href={emptyAction.href}
                className="mt-2 inline-flex min-h-10 items-center rounded-lg border border-[var(--border-strong)] px-3 text-xs font-semibold text-[var(--brand-deep)]">
                {emptyAction.label} →
              </Link>
            </div>
          )}
          {data.paging && (data.paging.page > 1 || data.paging.hasNext) ? (
            <nav aria-label="Pagine attività commerciali" data-testid="commercial-pager" className="flex items-center justify-between gap-2 border-t border-[#edf3ef] px-4 py-3 sm:px-5">
              {data.paging.page > 1 ? (
                <Link href={isStreamView(view) ? mergedCommercialHref(view, query, data.paging.previousCursor ?? undefined, undefined, focus) : commercialPageHref(view, query, data.paging.page - 1)} className="inline-flex min-h-10 items-center rounded-full border border-[#d6e5db] bg-white px-4 text-sm font-semibold text-[#175640] transition hover:bg-[#eef6f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]">← Precedenti</Link>
              ) : <span aria-hidden="true" className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-[#b3c4ba]">← Precedenti</span>}
              <span className="text-xs font-semibold tabular-nums text-[#5c7063]">
                Pagina {data.paging.page}{data.paging.exact && data.paging.total !== null ? " di " + Math.max(1, Math.ceil(data.paging.total / data.paging.pageSize)) : ""}
              </span>
              {data.paging.hasNext ? (
                <Link href={isStreamView(view) ? mergedCommercialHref(view, query, data.paging.nextCursor ?? undefined, undefined, focus) : commercialPageHref(view, query, data.paging.page + 1)} className="inline-flex min-h-10 items-center rounded-full border border-[#d6e5db] bg-white px-4 text-sm font-semibold text-[#175640] transition hover:bg-[#eef6f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]">Successive →</Link>
              ) : <span aria-hidden="true" className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-[#b3c4ba]">Successive →</span>}
            </nav>
          ) : null}
        </div>

        {active ? (
          <aside id="commercial-detail" aria-label="Dettaglio attività selezionata" tabIndex={-1}
            className="scroll-mt-24 min-w-0 max-w-full rounded-[22px] border border-[#c9ded0] bg-white p-4 shadow-[0_22px_60px_-38px_rgba(4,46,32,0.55)] sm:scroll-mt-36 sm:p-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4e7a60]">Workspace / Dettaglio</p><h3 className="mt-1 text-base font-semibold tracking-tight text-[#173f35]">Trattativa selezionata</h3></div>
              <Link href={isStreamView(view) ? mergedCommercialHref(view, query, data.paging?.currentCursor ?? undefined, undefined, focus) : commercialPageHref(view, query, page)} className="app-secondary inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold">
                Chiudi <span aria-hidden="true" className="ml-1">×</span>
              </Link>
            </div>
            <div className="min-w-0 max-w-full overflow-x-auto">
              <SelectedDetail item={active} related={related} canWrite={canWrite} tab={tab} view={view} query={query} page={data.paging?.page ?? page} cursor={data.paging?.currentCursor} focus={focus} />
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

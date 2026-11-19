import { newRequestHref } from "@/lib/new-request-href";
import Link from "next/link";

import { CommercialAiNativeShell } from "@/components/commercial-ai-native-shell";
import { CommercialCalculatorQuickAccess } from "@/components/commercial-calculator-quick-access";
import { CommercialDealFactBriefCopy } from "@/components/commercial-deal-fact-brief-copy";
import { CommercialDealCycleActions } from "@/components/commercial-deal-cycle-actions";
import { CommercialDealLabelForm } from "@/components/commercial-deal-label-form";
import { dealCycleActions, outcomeText } from "@/lib/commercial-cycle";
import {
  dealDeskHref, isDealDue,
  type CommercialDeal, type DealDeskState, type DealFilter,
} from "@/lib/commercial-deal-model";
import { loadDealLines, type CommercialDealsPage } from "@/lib/commercial-deals";
import { commercialSearchHref } from "@/lib/commercial-search-context";
import type { PublicTubeDimensionSummary } from "@/lib/public-knowledge";
import { formatHubDate } from "@/lib/rfq-hub-overview";
import { appRoutes } from "@/lib/routes";

// COMM-DEALS1 — la pagina Commerciale è un elenco di trattative.
// COMM-CLIENTS1 (19 nov 2026) — è «Richieste d'offerta» dell'Ufficio
// commerciale: solo vendite. Le RFQ ai fornitori e le distinte vivono nel
// Centro RFQ dell'Ufficio acquisti.
// Una riga = una richiesta del cliente (RDO) con offerte e ordini collegati,
// in colonne: Richiesta · Cliente e materiale · Fase · Prossima azione.
// I documenti vivono dentro la richiesta, nel pannello laterale. Sopra la
// tabella: filtri e una barra assistente chiusa per impostazione predefinita.

export const DEALS_PAGE_SIZE = 20;
// Nota: globals.css imposta `a { color: inherit }` fuori dai layer di Tailwind,
// quindi sui link il colore del testo va forzato con `!text-…`.

const filters: ReadonlyArray<{ key: DealFilter; label: string }> = [
  { key: "todo", label: "Da fare" },
  { key: "waiting", label: "In attesa" },
  { key: "due", label: "In scadenza" },
  { key: "closed", label: "Archiviate" },
];
const emptyCopy: Record<DealFilter | "", { title: string; body: string }> = {
  "": { title: "Ancora nessuna richiesta d'offerta", body: "Le richieste dei clienti compariranno qui, una riga per richiesta, con offerte e ordini collegati." },
  todo: { title: "Niente da fare adesso", body: "Nessuna richiesta aspetta una tua azione." },
  waiting: { title: "Niente in attesa", body: "Nessuna offerta sta aspettando la risposta del cliente." },
  due: { title: "Niente in scadenza", body: "Nessuna richiesta aperta scade nei prossimi 7 giorni." },
  // Le bozze di distinta stanno nel Centro RFQ: qui il filtro non esiste più.
  drafts: { title: "Nessuna bozza", body: "Le distinte salvate sono nel Centro RFQ." },
  closed: { title: "Nessuna richiesta archiviata", body: "Qui compaiono le trattative vinte e quelle chiuse come non concluse, con il motivo." },
};

const actionTone: Record<CommercialDeal["bucket"], string> = {
  todo: "text-[#8a4b00]", waiting: "text-[#3f5248]", drafts: "text-[#6f5a2a]", progress: "text-[#276147]", closed: "text-[#6b7d73]",
};

// Classi letterali: Tailwind le trova solo scritte per intero. Con il dettaglio
// aperto la lista è più stretta e passa alle colonne solo da xl in su.
const COLUMNS_WIDE = "lg:grid lg:items-center lg:gap-x-3 lg:grid-cols-[minmax(220px,1.5fr)_minmax(170px,1.1fr)_minmax(130px,.75fr)_minmax(170px,1fr)]";
const COLUMNS_SPLIT = "xl:grid xl:items-center xl:gap-x-3 xl:grid-cols-[minmax(200px,1.4fr)_minmax(150px,1fr)_minmax(120px,.7fr)_minmax(150px,1fr)]";

// COMM-RDO2: fasi leggibili. Fatta = verde pieno; saltata (un ordine arrivato
// senza richiesta) = tratteggiata; da fare = grigia. Le etichette sono sempre
// leggibili dagli screen reader e, con `labelled`, anche a schermo.
function stepState(step: CommercialDeal["steps"][number]) {
  return step.done ? "fatta" : step.skipped ? "non presente" : "da fare";
}

function Steps({ deal, labelled = false }: { deal: CommercialDeal; labelled?: boolean }) {
  return (
    <span className={"flex " + (labelled ? "w-full gap-1" : "gap-[3px]")} data-testid="commercial-deal-steps">
      {deal.steps.map((step) => (
        <span key={step.label} className={labelled ? "min-w-0 flex-1" : ""} title={step.label + ": " + stepState(step)}>
          <span aria-hidden="true" className={"block h-[5px] rounded-full " + (labelled ? "w-full " : "w-5 ") +
            (step.done ? "bg-[#1d9e75]" : step.skipped ? "border border-dashed border-[#b9c9bf] bg-transparent" : "bg-[#d8e3dc]")} />
          {labelled ? (
            <span className={"mt-1 block truncate text-[10px] font-semibold " + (step.done ? "text-[#1f5e45]" : "text-[#6b7d73]")}>{step.label}</span>
          ) : null}
          <span className="sr-only">{step.label + ": " + stepState(step) + ". "}</span>
        </span>
      ))}
    </span>
  );
}

const DAY_MS = 86_400_000;
const originDate: Record<string, string> = {
  "Richiesta": "Ricevuta il ", "Offerta senza richiesta": "Offerta del ", "Ordine diretto": "Ordine del ",
};

/** «Ordine del 7 set 2026 · 73 gg fa»: la data commerciale, non quella di importazione. */
function sinceText(deal: CommercialDeal, now: number) {
  const value = deal.since ?? deal.at;
  if (!value) return "";
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return "";
  const days = Math.floor((now - at) / DAY_MS);
  const age = deal.bucket === "closed" || days < 1 ? "" : days === 1 ? " · ieri" : " · " + days + " gg fa";
  return (originDate[deal.origin ?? ""] ?? "Dal ") + formatHubDate(value) + age;
}

function dueText(deal: CommercialDeal, now: number) {
  if (!deal.dueAt || deal.bucket === "closed") return null;
  const due = Date.parse(deal.dueAt);
  if (!Number.isFinite(due)) return null;
  return (due < now ? "Scaduta il " : "Scade il ") + formatHubDate(deal.dueAt);
}

/** «l'ordine», «l'offerta», «la richiesta»: il documento più recente. */
function primaryDocLabel(deal: CommercialDeal): string {
  const latest = [...deal.documents].sort((a, b) => (Date.parse(b.at ?? "") || 0) - (Date.parse(a.at ?? "") || 0))[0];
  const kind = latest?.key.split(":")[0];
  return kind === "inbound-order" ? "l'ordine" : kind === "inbound-offer" ? "l'offerta" : "la richiesta";
}

/** Si lavora sul documento più recente della richiesta (richiesta, offerta o ordine). */
function primaryAction(deal: CommercialDeal): { href: string; label: string } {
  const latest = [...deal.documents].sort((a, b) => (Date.parse(b.at ?? "") || 0) - (Date.parse(a.at ?? "") || 0))[0];
  return { href: latest?.href ?? deal.href, label: deal.bucket === "todo" ? deal.action : "Apri " + (latest?.label.toLocaleLowerCase("it-IT") ?? "la richiesta") };
}

async function DealDetail({ deal, state, canWrite }: {
  deal: CommercialDeal; state: DealDeskState; canWrite: boolean;
}) {
  const lines = await loadDealLines(deal).catch(() => null);
  const now = Date.now();
  const due = dueText(deal, now);
  const primary = primaryAction(deal);
  const cycle = dealCycleActions(deal.cycle, deal.outcome);
  const hasCycle = canWrite && Boolean(cycle.primary || cycle.secondary.length || cycle.canClose || cycle.reopen);
  const labelKind = deal.kind === "inbound-rfq" ? "rfq" : deal.kind === "inbound-offer" ? "offer" : deal.kind === "inbound-order" ? "order" : null;
  const closeHref = dealDeskHref({ ...state, segment: "all", item: "" });
  return (
    <div className="space-y-4" data-testid="commercial-deal-detail">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs tabular-nums text-[#5c7063]">{[deal.reference, deal.origin].filter(Boolean).join(" · ")}</p>
          <h2 className="mt-1.5 break-words text-lg font-bold tracking-tight text-[#143f30]">{deal.title}</h2>
          <p className="mt-0.5 text-sm text-[#52685b]">
            {deal.counterparty || <span className="font-semibold text-[#8a4b00]">Cliente da collegare</span>}
            {[deal.material, deal.quantity].filter(Boolean).map((part) => " · " + part).join("")}
          </p>
          {!deal.counterparty && canWrite ? (
            <Link href={appRoutes.operations.reviewIdentities} className="mt-1 inline-flex text-xs font-semibold !text-[#175640] underline underline-offset-2">
              Collega il cliente →
            </Link>
          ) : null}
        </div>
        <Link href={closeHref} aria-label="Chiudi il dettaglio"
          className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-[#d6e5db] text-base !text-[#175640] hover:bg-[#f2f8f4]">×</Link>
      </div>

      <section aria-labelledby="commercial-deal-next" data-testid="commercial-deal-next-step"
        className="rounded-xl border border-[#cfe3d7] bg-[#f4faf6] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-[#3d6b52]">Prossimo passo</p>
          <span className="text-[11px] font-semibold text-[#3f5248]">{deal.stage}</span>
        </div>
        <div className="mt-2"><Steps deal={deal} labelled /></div>
        <h3 id="commercial-deal-next" className={"mt-1 text-base font-semibold " + actionTone[deal.bucket]}>{outcomeText(deal.outcome) || deal.action}</h3>
        {due ? <p className={"mt-0.5 text-xs " + (isDealDue(deal, now) ? "font-semibold text-[#9a3412]" : "text-[#5c7063]")}>{due}</p> : null}
        {deal.kind === "inbound-rfq" && canWrite && !deal.outcome && !deal.cycle?.order ? (
          <Link href={appRoutes.commercial.rfq(deal.id)} data-testid="commercial-offer-editor-link"
            className="mt-2 inline-flex min-h-10 items-center rounded-lg border border-[#a9d3b9] bg-white px-3 text-xs font-semibold !text-[#175640] hover:bg-[#ebf7ef]">
            Prepara / modifica l'offerta →
          </Link>
        ) : null}
        {hasCycle ? (
          // COMM-CYCLE1: le azioni si fanno qui; il documento resta a un clic.
          <div className="mt-3 space-y-2">
            <CommercialDealCycleActions {...cycle} outcome={deal.outcome ?? null} subject="La richiesta" />
            <Link href={primary.href} data-testid="commercial-deal-primary-action"
              className="inline-flex min-h-9 items-center text-xs font-semibold !text-[#175640] underline underline-offset-2">
              Apri {primaryDocLabel(deal)} ↗
            </Link>
          </div>
        ) : (
          <Link href={primary.href} data-testid="commercial-deal-primary-action"
            className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#175640] px-4 text-sm font-semibold !text-white hover:bg-[#104632] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246c53]">
            {primary.label} →
          </Link>
        )}
      </section>

      <section aria-labelledby="commercial-deal-documents">
        <h3 id="commercial-deal-documents" className="text-xs font-semibold text-[#3d6b52]">Documenti della richiesta</h3>
        <ol className="mt-2 divide-y divide-[#edf3ef] rounded-xl border border-[#e0eae4] bg-white" data-testid="commercial-deal-documents">
          {deal.documents.map((doc) => (
            <li key={doc.key}>
              <Link href={doc.href} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-[#f5faf7]">
                <span className="min-w-0 truncate font-medium text-[#173f35]">{doc.label}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-[#5c7063]">
                  <span>{doc.status}</span>
                  {doc.at ? <time className="tabular-nums">{formatHubDate(doc.at)}</time> : null}
                  <span aria-hidden="true" className="text-[#9ab5a5]">›</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {lines === null ? (
        <p role="status" className="text-xs text-[#795321]">Righe articolo non disponibili in questo momento.</p>
      ) : lines.length ? (
        <section aria-labelledby="commercial-deal-lines">
          <h3 id="commercial-deal-lines" className="text-xs font-semibold text-[#3d6b52]">Righe articolo · {lines.length}</h3>
          <ul className="mt-2 max-h-72 divide-y divide-[#edf3ef] overflow-y-auto rounded-xl border border-[#e0eae4] bg-white text-sm">
            {lines.map((line) => (
              <li key={line.id} className="flex items-baseline justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-[#173f35]">{line.description || line.spec || "Riga " + line.position}</span>
                  {line.description && line.spec ? <span className="block truncate text-xs text-[#5c7063]">{line.spec}</span> : null}
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-[#315c49]">{line.quantity}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="group rounded-xl border border-[#e0eae4] bg-white" data-testid="commercial-deal-more">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-xs font-semibold !text-[#175640] [&::-webkit-details-marker]:hidden">
          Altro <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
        </summary>
        <div className="space-y-3 border-t border-[#edf3ef] p-3">
          {canWrite && labelKind ? <CommercialDealLabelForm kind={labelKind} id={deal.id} label={deal.label ?? ""} /> : null}
          <CommercialDealFactBriefCopy key={deal.key} kind="Vendita" dealId={deal.id}
            status={deal.stage} title={deal.title} origin="memoria privata"
            relatedActivities={deal.documents.slice(0, 4).map((doc) => ({ kind: doc.label, status: doc.status }))} />
          <div className="flex flex-wrap gap-2">
            <Link href={deal.href}
              className="inline-flex min-h-10 items-center rounded-lg border border-[#d6e5db] px-3 text-xs font-semibold !text-[#175640] hover:bg-[#f2f8f4]">
              Apri pagina completa ↗
            </Link>
          </div>
        </div>
      </details>
    </div>
  );
}

export async function CommercialDealsDesk({
  data, state, canWrite, calculatorReferences,
}: {
  data: CommercialDealsPage;
  state: DealDeskState;
  canWrite: boolean;
  calculatorReferences: PublicTubeDimensionSummary[];
}) {
  // COMM-DEALS2: pagina, priorità e conteggi arrivano già calcolati su tutte le trattative.
  const now = Date.now();
  const { counts, page, pages } = data;
  const shown = data.rows;
  const active = data.selected;
  const columns = active ? COLUMNS_SPLIT : COLUMNS_WIDE;
  // Il segmento è sempre «vendite» (lo impone la pagina): non va negli URL.
  const keep = { filter: state.filter, query: state.query };

  return (
    <div className="space-y-3" data-testid="commercial-deals-desk">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="mr-1 text-xl font-bold tracking-tight text-[#143f30]">Richieste d&apos;offerta</h1>
        <span className="text-xs tabular-nums text-[#5c7063]" data-testid="commercial-deals-open-count">
          {counts.segments.sales === 1 ? "1 aperta" : counts.segments.sales + " aperte"}
        </span>
        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
          <form action={appRoutes.commercial.home} method="get" role="search" className="relative min-w-0">
            {state.filter ? <input type="hidden" name="f" value={state.filter} /> : null}
            <label htmlFor="commercial-deals-q" className="sr-only">Cerca tra le richieste d'offerta</label>
            <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#7a9184]">⌕</span>
            <input id="commercial-deals-q" type="search" name="q" maxLength={80} defaultValue={state.query}
              placeholder="Cliente, riferimento, materiale…"
              className="min-h-9 w-[220px] max-w-full rounded-full border border-[#d6e5db] bg-white pl-8 pr-3 text-sm text-[#143f30] placeholder:text-[#7a9184] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]" />
          </form>
          {canWrite ? (
            // Le richieste d'offerta arrivano dai clienti: da qui si prepara una
            // distinta per chiedere il materiale ai fornitori.
            <Link href={newRequestHref()} data-testid="commercial-new-request"
              className="inline-flex min-h-9 items-center rounded-full border border-[#175640] bg-white px-4 text-sm font-semibold !text-[#175640] hover:bg-[#f2f8f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246c53]">
              + Nuova distinta
            </Link>
          ) : null}
          <details className="group relative" data-testid="commercial-desk-tools">
            <summary aria-label="Altri strumenti"
              className="inline-flex min-h-9 min-w-9 cursor-pointer list-none items-center justify-center rounded-full border border-[#d6e5db] bg-white px-2.5 text-sm font-semibold !text-[#175640] hover:bg-[#f2f8f4] [&::-webkit-details-marker]:hidden">
              ⋯
            </summary>
            <div className="absolute right-0 top-[calc(100%+6px)] z-30 flex w-[270px] flex-col gap-2 rounded-xl border border-[#d6e5db] bg-white p-3 shadow-lg">
              <CommercialCalculatorQuickAccess references={calculatorReferences} />
              <Link href={commercialSearchHref(state.query)} data-testid="commercial-history-entry" className="rounded-lg px-2 py-2 text-sm font-medium !text-[#254f3d] hover:bg-[#f2f8f4]">Cerca nello storico</Link>
            </div>
          </details>
        </div>
      </header>

      <details id="commercial-assistant" className="group rounded-2xl border border-[#d6e5db] bg-white" data-testid="commercial-desk-assistant">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm text-[#52685b] [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-md bg-[#175640] text-xs !text-white">✦</span>
          <span className="font-semibold !text-[#175640]">Assistente</span>
          <span className="hidden truncate sm:inline">cerca aziende, chiarisci una norma, prepara una distinta o filtra le richieste</span>
          <span aria-hidden="true" className="ml-auto transition group-open:rotate-180">▾</span>
        </summary>
        <div className="border-t border-[#edf3ef] p-2">
          <CommercialAiNativeShell canWrite={canWrite} compact />
        </div>
      </details>

      <nav aria-label="Filtra le richieste d'offerta" className="flex gap-1.5 overflow-x-auto" data-testid="commercial-deal-filters">
        {filters.map((option) => {
          const on = state.filter === option.key;
          const urgent = option.key === "todo" && counts.filters.todo > 0;
          return (
            <Link key={option.key} href={dealDeskHref({ ...keep, filter: on ? "" : option.key })}
              aria-current={on ? "true" : undefined}
              className={"inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] " +
                (on ? "border-[#175640] bg-[#175640] !text-white"
                  : urgent ? "border-[#e2c27a] bg-[#fff4d6] !text-[#6b4a07] hover:bg-[#ffedc0]"
                  : "border-[#d6e5db] bg-white !text-[#3f5c4c] hover:bg-[#f2f8f4]")}>
              {option.label}
              {option.key !== "closed" ? <span className="tabular-nums">{counts.filters[option.key]}</span> : null}
              {on ? <span aria-hidden="true">×</span> : null}
            </Link>
          );
        })}
      </nav>

      {data.salesUnavailable || data.truncated || state.query ? (
        <p role="status" className="px-1 text-xs text-[#5c7063]" data-testid="commercial-deals-note">
          {data.salesUnavailable ? "Le richieste dei clienti non sono verificabili in questo momento: riprova tra poco. " : ""}
          {data.truncated ? "Mostro le 200 richieste più recenti. " : ""}
          {state.query || data.truncated ? (
            <Link href={commercialSearchHref(state.query)} className="font-semibold !text-[#175640] underline underline-offset-2">
              {state.query ? "Cerca «" + state.query + "» in tutto lo storico" : "Cerca nello storico"}
            </Link>
          ) : null}
        </p>
      ) : null}

      {state.item && !active ? (
        // Chiave sconosciuta, scaduta o di un'altra azienda: nessun dettaglio, nessun indizio su cosa esista.
        <p role="status" data-testid="commercial-deal-not-found"
          className="rounded-lg border border-[#e6d3ae] bg-[#fffaf0] px-3 py-2 text-xs text-[#795321]">
          Richiesta non trovata o non visibile con il tuo accesso.
        </p>
      ) : null}

      <section id="commercial-worklist" aria-label="Elenco richieste d'offerta" className="scroll-mt-28">
        <div className={active ? "grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,.9fr)]" : "min-w-0"}>
          <div className={(active ? "hidden lg:block " : "") + "min-w-0 overflow-hidden rounded-2xl border border-[#dce7e0] bg-white"} data-testid="commercial-deals-list">
            <div aria-hidden="true" className={"hidden border-b border-[#e4ece7] bg-[#f7faf8] px-4 py-2 text-[11px] font-semibold text-[#5c7063] " + columns}>
              <span>Richiesta</span><span>Cliente · materiale</span><span>Fase</span><span>Prossima azione</span>
            </div>
            {shown.length ? (
              <ul role="list">
                {shown.map((deal) => {
                  const due = dueText(deal, now);
                  const dueSoon = isDealDue(deal, now);
                  const selected = deal.key === active?.key;
                  return (
                    <li key={deal.key}>
                      <Link href={dealDeskHref({ ...keep, page, item: deal.key }, "commercial-detail")}
                        aria-current={selected ? "true" : undefined}
                        data-testid="commercial-deal-row"
                        className={"group flex min-w-0 flex-col gap-1 border-b border-[#edf2ef] px-4 py-3 transition-colors last:border-b-0 hover:bg-[#f5faf7] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#175640] " +
                          columns + " " + (selected ? "bg-[#edf6f0]" : "")}>
                        {/* Richiesta: cosa chiede il cliente (prodotto dalle righe) e come è arrivata. */}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[#143f30]">{deal.title}</span>
                          <span className="mt-0.5 block truncate text-xs tabular-nums text-[#5c7063]">
                            {[deal.reference, deal.origin].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        {/* Cliente · materiale: chi e quanto. Senza cliente lo diciamo, non lo nascondiamo. */}
                        <span className="min-w-0">
                          {deal.counterparty
                            ? <span className="block truncate text-sm font-medium text-[#173f35]">{deal.counterparty}</span>
                            : <span className="block truncate text-sm font-semibold text-[#8a4b00]" data-testid="commercial-deal-unlinked">Cliente da collegare</span>}
                          <span className="block truncate text-xs text-[#5c7063]">{[deal.material, deal.quantity].filter(Boolean).join(" · ") || "Materiale da leggere nel dettaglio"}</span>
                        </span>
                        {/* Fase: dove siamo, in parole, e il percorso Richiesta → Offerta → Ordine → Consegna. */}
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="truncate text-xs font-semibold text-[#3f5248]">{deal.stage}</span>
                          <Steps deal={deal} />
                        </span>
                        {/* Prossima azione: cosa fare e da quanto aspetta. */}
                        <span className="min-w-0">
                          <span className={"flex items-center gap-1 text-sm font-semibold " + (dueSoon && deal.bucket !== "closed" ? "text-[#9a3412]" : actionTone[deal.bucket])}>
                            <span className="truncate">{outcomeText(deal.outcome) || deal.action}</span>
                            {deal.bucket === "todo" ? <span aria-hidden="true" className="shrink-0 transition group-hover:translate-x-0.5">→</span> : null}
                          </span>
                          <span className={"block truncate text-xs tabular-nums " + (dueSoon ? "font-semibold text-[#9a3412]" : "text-[#5c7063]")}>
                            {due ?? sinceText(deal, now)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-4 py-6" data-testid="commercial-deals-empty">
                <p className="text-sm font-semibold text-[#143f30]">{state.query ? "Nessuna richiesta per «" + state.query + "»" : emptyCopy[state.filter].title}</p>
                <p className="mt-1 text-xs text-[#5c7063]">{state.query ? "Prova un altro nome o cerca in tutto lo storico." : emptyCopy[state.filter].body}</p>
                {state.filter || state.query ? (
                  <Link href={dealDeskHref({})}
                    className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-[#d6e5db] px-3 text-xs font-semibold !text-[#175640] hover:bg-[#f2f8f4]">
                    Rimuovi filtro
                  </Link>
                ) : null}
              </div>
            )}
            {pages > 1 ? (
              <nav aria-label="Pagine richieste d'offerta" className="flex items-center justify-between gap-2 border-t border-[#edf2ef] px-4 py-2.5" data-testid="commercial-deals-pager">
                {page > 1 ? (
                  <Link href={dealDeskHref({ ...keep, page: page - 1 })} className="inline-flex min-h-9 items-center rounded-full border border-[#d6e5db] px-3 text-xs font-semibold !text-[#175640] hover:bg-[#eef6f1]">← Precedenti</Link>
                ) : <span />}
                <span className="text-xs tabular-nums text-[#5c7063]">Pagina {page} di {pages}</span>
                {page < pages ? (
                  <Link href={dealDeskHref({ ...keep, page: page + 1 })} className="inline-flex min-h-9 items-center rounded-full border border-[#d6e5db] px-3 text-xs font-semibold !text-[#175640] hover:bg-[#eef6f1]">Successive →</Link>
                ) : <span />}
              </nav>
            ) : null}
          </div>

          {active ? (
            <aside id="commercial-detail" aria-label="Dettaglio richiesta d'offerta"
              className="min-w-0 scroll-mt-24 rounded-2xl border border-[#dce7e0] bg-white p-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
              <Link href={dealDeskHref({ ...keep, page })} className="mb-3 inline-flex min-h-9 items-center text-xs font-semibold !text-[#175640] lg:hidden">← Richieste d&apos;offerta</Link>
              <DealDetail deal={active} state={{ ...state, page }} canWrite={canWrite} />
            </aside>
          ) : null}
        </div>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Rfqc1OfferCard } from "@/components/rfqc1-offer-card";
import { useState } from "react";

import type { Rfqc1TimelineItem } from "@/lib/rfqc1-timeline";
import type { Rfqc1RecipientState } from "@/lib/rfqc1-recipient-status";
import { rfqc1StateLabels } from "@/lib/rfqc1-recipient-status";
import type { RfqComparisonData } from "@/components/rfq-quote-comparison";

export type Rfqc1ChatSupplier = {
  id: string;
  name: string;
  email: string | null;
  state: Rfqc1RecipientState;
  timeline: Rfqc1TimelineItem[];
};
export type Rfqc1ChatCampaign = {
  id: string;
  title: string;
  status: string;
  responseLabel: string;
};
export type Rfqc1ChatLine = {
  id: string;
  position: number;
  description: string;
  standard: string | null;
  grade: string | null;
  quantity: number | string;
  quantityMode: string;
  weightKgM: number | string | null;
};

type Props = {
  rfqId: string;
  title: string;
  status: string;
  dueAt: string | null;
  buyerMessage: string | null;
  campaigns: Rfqc1ChatCampaign[];
  suppliers: Rfqc1ChatSupplier[];
  lines: Rfqc1ChatLine[];
  responseLabel: string;
  comparison: RfqComparisonData | null;
  canExecute: boolean;
};

function number(value: number | string | null | undefined, digits = 2) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString("it-IT", { maximumFractionDigits: digits })
    : "—";
}
function date(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(d)
    : "—";
}
function stateClass(state: Rfqc1RecipientState) {
  if (state === "offered" || state === "awarded") return "border-[#b9d9c9] bg-[#ebf6ef] text-[#195d3e]";
  if (state === "delivery_error" || state === "declined") return "border-[#f4c5bd] bg-[#fff1ef] text-[#8b3d32]";
  if (state === "expired") return "border-[#eadbb6] bg-[#fff8e8] text-[#6f541a]";
  return "border-[#dae5e0] bg-[#f3f7f5] text-[#34594b]";
}

export function Rfqc1ChatWorkspace(props: Props) {
  const [supplierId, setSupplierId] = useState(props.suppliers[0]?.id ?? "");
  const [showList, setShowList] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [requestExpanded, setRequestExpanded] = useState(false);
  const supplier = props.suppliers.find(item => item.id === supplierId) ?? props.suppliers[0] ?? null;
  const compared = props.comparison?.suppliers ?? [];
  const bestPrice = compared.find(item => item.is_best_full_price) ?? null;
  const bestDelivery = compared.find(item => item.is_best_lead_time) ?? null;

  return (
    <section aria-label="RFQ come chat" data-testid="rfqc1-chat-workspace" className="overflow-hidden rounded-[22px] border border-[#d3dfd8] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[#e3ebe5] bg-[#f5faf7] px-3 py-3 lg:px-4">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#23624f]">RFQ Hub · Conversazioni private</p>
          <h1 className="truncate text-lg font-bold text-[#19392f] sm:text-xl">{props.title}</h1>
          <p className="text-xs text-[#5a6c63]">{props.responseLabel} risposte · {props.status} · Scadenza {date(props.dueAt)}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button type="button" aria-controls="rfqc1-campaign-list" aria-expanded={showList} onClick={() => setShowList(v => !v)}
            className="rounded-lg border border-[#bcd0c4] bg-white px-2.5 py-2 text-xs font-semibold text-[#214f3e] xl:hidden">RFQ</button>
          <button type="button" aria-controls="rfqc1-comparison" aria-expanded={showComparison} onClick={() => setShowComparison(v => !v)}
            className="rounded-lg border border-[#bcd0c4] bg-white px-2.5 py-2 text-xs font-semibold text-[#214f3e] xl:hidden">Confronto</button>
          <Link href="/rfq-hub" className="rounded-lg bg-[#174b3d] px-2.5 py-2 text-xs font-semibold text-white">Hub</Link>
        </div>
      </div>

      <div className="grid min-h-[620px] grid-cols-1 xl:grid-cols-[212px_minmax(0,1fr)_286px]">
        <aside id="rfqc1-campaign-list" aria-label="Elenco RFQ"
          className={(showList ? "block" : "hidden") + " border-b border-[#e2e9e5] bg-[#f6f9f7] p-2.5 xl:block xl:border-b-0 xl:border-r"}>
          <div className="mb-3 flex items-center justify-between px-2">
            <h2 className="text-xs font-bold text-[#254e3d]">Le tue RFQ</h2>
            <span className="text-[10px] text-[#66796d]">{props.campaigns.length}</span>
          </div>
          <nav className="max-h-[350px] space-y-1 overflow-y-auto xl:max-h-[650px]" aria-label="Seleziona RFQ">
            {props.campaigns.map(rfq => (
              <Link key={rfq.id} href={"/rfq-hub/" + encodeURIComponent(rfq.id)}
                aria-current={rfq.id === props.rfqId ? "page" : undefined}
                className={"block rounded-xl border px-3 py-2.5 transition " +
                  (rfq.id === props.rfqId
                    ? "border-[#99b8a8] bg-white shadow-sm"
                    : "border-transparent text-[#51675b] hover:bg-white")}>
                <div className="flex justify-between gap-1">
                  <span className="line-clamp-2 text-xs font-semibold">{rfq.title}</span>
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-[#24624a]">{rfq.responseLabel}</span>
                </div>
                <p className="mt-1 text-[10px] text-[#77867e]">{rfq.status}</p>
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col">
          <div className="border-b border-[#e4ebe6] bg-white px-3 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-[#284b3e]">Richiesta · {props.lines.length} articoli</p>
              <button type="button" onClick={() => setRequestExpanded(v => !v)}
                className="text-xs font-semibold text-[#17674c] underline-offset-2 hover:underline">
                {requestExpanded ? "Comprimi" : "Espandi distinta"}
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {(requestExpanded ? props.lines : props.lines.slice(0, 2)).map(line => (
                <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-[#f5f8f6] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#1e4033]">{line.position}. {line.description}</p>
                    <p className="truncate text-[10px] text-[#62756b]">{line.standard || "Norma n.d."} · {line.grade || "Grado n.d."}</p>
                  </div>
                  <div className="text-right text-xs font-semibold tabular-nums text-[#234f3b]">
                    {number(line.quantity)} {line.quantityMode === "tonnes" ? "t" : line.quantityMode === "bars" ? "barre" : "m"}
                  </div>
                </div>
              ))}
              {!requestExpanded && props.lines.length > 2 && (
                <p className="px-1 text-[11px] text-[#65746d]">+ {props.lines.length - 2} altri articoli</p>
              )}
              {props.buyerMessage && <p className="rounded-lg border border-[#e0e7e2] px-3 py-2 text-xs text-[#455b4c]">{props.buyerMessage}</p>}
            </div>
          </div>

          <div role="tablist" aria-label="Trattative private per fornitore"
            className="flex gap-1.5 overflow-x-auto border-b border-[#e2eae5] bg-[#fbfcfb] px-3 py-3 sm:px-5">
            {props.suppliers.map(item => (
              <button type="button" key={item.id} role="tab" aria-selected={supplier?.id === item.id}
                onClick={() => setSupplierId(item.id)}
                className={"shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition " +
                  (supplier?.id === item.id ? "border-[#1a5a40] bg-[#1e6149] text-white" : stateClass(item.state))}>
                {item.name} · {rfqc1StateLabels[item.state]}
              </button>
            ))}
            {props.suppliers.length === 0 && <p className="text-xs text-[#728077]">Nessun fornitore selezionato: completa l'invio nella gestione RFQ.</p>}
          </div>

          <div role="tabpanel" aria-label={supplier ? "Conversazione con " + supplier.name : "Conversazione"}
            className="min-h-[280px] flex-1 space-y-3 bg-[#f8faf9] px-3 py-4 sm:px-5">
            {supplier && (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#193f31]">{supplier.name}</p>
                  <p className="text-[11px] text-[#77857d]">{supplier.email || "Canale piattaforma"}</p>
                </div>
                <span className={"rounded-full border px-3 py-1 text-[11px] font-semibold " + stateClass(supplier.state)}>{rfqc1StateLabels[supplier.state]}</span>
              </div>
            )}
            {supplier?.timeline.map(item => (
              <article key={item.id} className={"max-w-[96%] rounded-2xl border p-3 shadow-[0_1px_2px_rgba(0,0,0,.035)] sm:max-w-[90%] " +
                (item.sender === "buyer" ? "ml-auto border-[#beddd0] bg-[#ecf6f0]" : "mr-auto border-[#e0e7e2] bg-white")}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-bold text-[#204c3b]">{item.title}</p>
                  <time dateTime={item.occurredAt} className="text-[10px] text-[#79877f]">{date(item.occurredAt)}</time>
                </div>
                {item.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#283e34]">{item.body}</p>}
                {item.quote && (
                  <Rfqc1OfferCard offer={item.quote} status={item.status} requestLines={props.lines} />
                )}
              </article>
            ))}
            {supplier && supplier.timeline.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#cbded3] bg-white p-5 text-center text-sm text-[#637970]">Il filo è pronto. Nessun messaggio o offerta ancora registrati.</div>
            )}
          </div>
          <div className="border-t border-[#dfe7e1] bg-white p-3 sm:px-5">
            <p className="text-[11px] text-[#637569]">
              {props.canExecute ? "Messaggi, chiarimenti, revisioni, counter target e BAFO si inviano dalla gestione avanzata finché il composer integrato non supera i test." :
                "L'accesso attuale è in sola lettura."}
            </p>
          </div>
        </div>

        <aside id="rfqc1-comparison" aria-label="Confronto offerte"
          className={(showComparison ? "block" : "hidden") + " border-t border-[#dce6df] bg-white p-3 xl:block xl:border-l xl:border-t-0"}>
          <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#2c7656]">Confronto RFQH5</p>
          <h2 className="mt-1 text-sm font-bold text-[#1c4232]">Decisione commerciale</h2>
          {props.comparison ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-[#dce9df] bg-[#f4faf5] p-3">
                <p className="text-[11px] text-[#62776a]">Migliore offerta completa</p>
                <p className="mt-1 text-sm font-bold text-[#24583c]">{bestPrice?.supplier_name || "Non disponibile"}</p>
                <p className="mt-1 text-xl font-extrabold tabular-nums text-[#183f2b]">€ {number(bestPrice?.full_request_total_eur, 2)}</p>
              </div>
              <div className="rounded-xl border border-[#e1e8df] p-3">
                <p className="text-[11px] text-[#64766b]">Consegna più rapida</p>
                <p className="mt-1 text-sm font-bold text-[#28533d]">{bestDelivery?.supplier_name || "Non disponibile"}</p>
                <p className="text-sm text-[#446353]">{bestDelivery?.effective_lead_time_days ?? "—"} giorni</p>
              </div>
              <p className="text-xs text-[#53695d]">{props.comparison.summary.comparable_supplier_count} offerte confrontabili · {props.comparison.summary.complete_offer_count} complete</p>
              <p className="text-[11px] leading-5 text-[#6f7f73]">Il confronto completo, l'aggiudicazione RFQH7 e i PO rimangono disponibili nella gestione commerciale sottostante fino alla loro integrazione in P1.</p>
            </div>
          ) : (
            <p className="mt-3 rounded-xl bg-[#f5f7f5] p-3 text-xs text-[#677a6d]">In attesa di offerte confrontabili.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

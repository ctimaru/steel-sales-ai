"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  prepareCustomerOffer, saveCustomerOffer, type QuoteActionState,
} from "@/app/(italian)/(workspace)/commercial/cycle2b-actions";
import {
  quoteEquivalentRate, quoteEstimatedTotal, type QuoteLineInput,
  type QuoteUnit,
} from "@/lib/comm-cycle2b-pricing";

export type CustomerOfferRevision = {
  id: string;
  revision: number;
  status: string;
  isManaged: boolean;
  editVersion: number;
  validity: string;
  delivery: string;
  payment: string;
  notes: string;
};
export type CustomerOfferLine = QuoteLineInput & {
  description: string;
  quantity: number | null;
  quantityUnit: string;
};
const initial: QuoteActionState = { status: "idle", message: "" };
const fmt = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const PRICE_UNIT_LABEL: Record<QuoteUnit,string> = { "EUR/t": "€/t", "EUR/m": "€/m" };

function StateMessage({ state }: { state: QuoteActionState }) {
  return state.message ? (
    <p role={state.status === "error" ? "alert" : "status"}
      className={"text-xs " + (state.status === "error" ? "font-semibold text-[#982f21]" : "font-medium text-[#175640]")}>
      {state.message}
    </p>
  ) : null;
}

export function CommercialCustomerOfferEditor({
  rfqId, revisions, lines, canWrite,
}: {
  rfqId: string;
  revisions: CustomerOfferRevision[];
  lines: CustomerOfferLine[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [prepareState, prepareAction, preparing] = useActionState(prepareCustomerOffer, initial);
  const [saveState, saveAction, saving] = useActionState(saveCustomerOffer, initial);
  const latest = revisions[0] ?? null;
  const editing = canWrite && Boolean(latest && latest.status === "draft" && latest.isManaged);
  const [draftLines, setDraftLines] = useState<CustomerOfferLine[]>(lines);
  const [validity, setValidity] = useState(latest?.validity ?? "");
  const [delivery, setDelivery] = useState(latest?.delivery ?? "");
  const [payment, setPayment] = useState(latest?.payment ?? "");
  const [notes, setNotes] = useState(latest?.notes ?? "");

  // Server action invalidates this request page. Refresh once when a mutation
  // succeeds; component key contains current offer id + optimistic edit version.
  useEffect(() => {
    if (prepareState.status === "saved" || saveState.status === "saved") router.refresh();
  }, [prepareState.status, saveState.status, router]);

  const totals = useMemo(() => {
    let total = 0;
    let priced = 0;
    let calculated = 0;
    for (const line of draftLines) {
      if (!line.rate.trim()) continue;
      priced++;
      const amount = quoteEstimatedTotal(line.rate,line.unit,line.quantity,line.quantityUnit,line.weight);
      if (amount !== null) { total += amount; calculated++; }
    }
    return { total, priced, calculated };
  }, [draftLines]);

  const update = (id: string, field: "rate" | "unit" | "weight", value: string) => {
    setDraftLines((old) => old.map((line) => line.line_id === id
      ? { ...line, [field]: value } : line));
  };
  const blocked = saving || preparing;
  return (
    <section data-testid="comm-cycle2b-offer-editor"
      className="mx-auto mt-5 max-w-6xl rounded-2xl border border-[#d7e7dd] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#3a7054]">Ciclo commerciale · Offerta al cliente</p>
          <h2 className="mt-1 text-lg font-semibold text-[#143e30]">Prepara e negozia l'offerta</h2>
          <p className="mt-1 text-xs text-[#566b5f]">
            La richiesta rimane il documento principale. Ogni offerta inviata resta nello storico.
          </p>
        </div>
        <span className="rounded-full bg-[#eff6f1] px-3 py-1 text-xs font-semibold text-[#175640]">
          {latest ? "Revisione " + latest.revision + " · " + latest.status : "Nessuna offerta"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Revisioni dell'offerta">
        {revisions.map((rev) => (
          <span key={rev.id}
            className={"rounded-lg border px-2.5 py-1 text-[11px] font-semibold " +
              (rev.id === latest?.id
                ? "border-[#9fcbb3] bg-[#f0f8f3] text-[#175640]"
                : "border-[#dce8e0] bg-white text-[#536a5d]")}>
            v{rev.revision} · {rev.status}
          </span>
        ))}
      </div>

      {(!latest || (latest.status === "sent" || latest.status === "expired")) && canWrite ? (
        <form action={prepareAction} aria-busy={preparing} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="rfq_id" value={rfqId}/>
          <button type="submit" disabled={preparing}
            className="min-h-11 rounded-lg bg-[#175640] px-4 text-sm font-semibold text-white hover:bg-[#104632] disabled:opacity-60">
            {preparing ? "Preparo…" : latest ? "Crea nuova revisione" : "Prepara l'offerta"}
          </button>
          <StateMessage state={prepareState}/>
        </form>
      ) : null}

      {latest && latest.status === "draft" && !latest.isManaged ? (
        <p className="mt-4 text-xs text-[#796443]">Questa è un'offerta importata: la modifica guidata è riservata alle offerte preparate dalla richiesta.</p>
      ) : null}
      {latest && latest.status !== "draft" && latest.status !== "sent" && latest.status !== "expired" ? (
        <p className="mt-4 text-xs text-[#566b5f]">La revisione è {latest.status}. Non viene modificata: lo storico commerciale resta integro.</p>
      ) : null}
      {latest?.status === "draft" && !canWrite ? (
        <p className="mt-4 text-xs text-[#8a4b00]">Hai accesso in sola lettura. Per modificare serve l'Ufficio commerciale o la Direzione.</p>
      ) : null}

      {latest && editing ? (
        <form action={saveAction} aria-busy={saving} className="mt-4 space-y-4">
          <input type="hidden" name="rfq_id" value={rfqId}/>
          <input type="hidden" name="offer_id" value={latest.id}/>
          <input type="hidden" name="version" value={latest.editVersion}/>
          <input type="hidden" name="lines" value={JSON.stringify(draftLines.map((line) => ({
            line_id: line.line_id, rate: line.rate, unit: line.unit, weight: line.weight,
          })))}/>

          <div className="space-y-2">
            {draftLines.map((line, index) => {
              const equivalent = quoteEquivalentRate(line.rate,line.unit,line.weight);
              const total = quoteEstimatedTotal(line.rate,line.unit,line.quantity,line.quantityUnit,line.weight);
              return (
                <fieldset key={line.line_id} disabled={blocked}
                  className="rounded-xl border border-[#e2ebe5] bg-[#f9fcfa] p-3">
                  <legend className="px-1 text-[11px] font-bold text-[#3b7257]">Riga {index + 1}</legend>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-[#173f35]">{line.description || "Materiale da precisare"}</p>
                      <p className="mt-1 text-xs text-[#5b6e62]">
                        Quantità: {line.quantity === null ? "da confermare" : line.quantity + " " + (line.quantityUnit || "unità")}
                      </p>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-2">
                      <label className="block min-w-0 text-[11px] font-semibold text-[#405e4b]">
                        Prezzo cliente
                        <input type="text" inputMode="decimal" value={line.rate}
                          onChange={(e) => update(line.line_id,"rate",e.target.value)}
                          placeholder="Es. 1.250,00" maxLength={40}
                          aria-label={"Prezzo cliente riga " + (index + 1)}
                          className="mt-1 min-h-10 w-full rounded-lg border border-[#bdd2c4] bg-white px-2 text-sm text-[#173f35]"/>
                      </label>
                      <label className="block text-[11px] font-semibold text-[#405e4b]">
                        Unità
                        <select value={line.unit}
                          onChange={(e) => update(line.line_id,"unit",e.target.value)}
                          aria-label={"Unità prezzo riga " + (index + 1)}
                          className="mt-1 min-h-10 w-full rounded-lg border border-[#bdd2c4] bg-white px-1 text-sm text-[#173f35]">
                          <option value="EUR/t">€/t</option><option value="EUR/m">€/m</option>
                        </select>
                      </label>
                    </div>
                    <label className="block text-[11px] font-semibold text-[#405e4b]">
                      Peso verificato (kg/m)
                      <input type="text" inputMode="decimal" value={line.weight}
                        onChange={(e) => update(line.line_id,"weight",e.target.value)}
                        placeholder="Facoltativo" maxLength={40}
                        aria-label={"Peso verificato kg/m riga " + (index + 1)}
                        className="mt-1 min-h-10 w-full rounded-lg border border-[#bdd2c4] bg-white px-2 text-sm text-[#173f35]"/>
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#536a5d]">
                    <span>{equivalent === null ? "Conversione non disponibile senza kg/m attendibile" :
                      "Equivalente indicativo: " + fmt.format(equivalent) + " " +
                      PRICE_UNIT_LABEL[line.unit === "EUR/t" ? "EUR/m" : "EUR/t"]}</span>
                    <span className="font-semibold">{total === null ? "Totale riga: da verificare" : "Totale riga: € " + fmt.format(total)}</span>
                  </div>
                </fieldset>
              );
            })}
            {!draftLines.length ? <p role="status" className="text-xs text-[#9a3412]">
              Questa richiesta non ha righe strutturate. Completa la richiesta prima di inviare un'offerta.
            </p> : null}
          </div>

          <div className="grid gap-3 rounded-xl border border-[#e1ebe4] bg-white p-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[#3e5c4b]">
              Valida fino al
              <input type="date" name="valid_until" value={validity} onChange={(e) => setValidity(e.target.value)}
                className="mt-1 min-h-10 w-full rounded-lg border border-[#bdd2c4] bg-white px-2 text-sm text-[#173f35]"/>
            </label>
            <label className="text-xs font-semibold text-[#3e5c4b]">
              Resa / consegna
              <input name="delivery_term" value={delivery} onChange={(e) => setDelivery(e.target.value)}
                maxLength={200} placeholder="Es. EXW stabilimento"
                className="mt-1 min-h-10 w-full rounded-lg border border-[#bdd2c4] bg-white px-3 text-sm text-[#173f35]"/>
            </label>
            <label className="text-xs font-semibold text-[#3e5c4b] sm:col-span-2">
              Pagamento
              <input name="payment_terms" value={payment} onChange={(e) => setPayment(e.target.value)}
                maxLength={200} placeholder="Es. Bonifico 30 giorni data fattura"
                className="mt-1 min-h-10 w-full rounded-lg border border-[#bdd2c4] bg-white px-3 text-sm text-[#173f35]"/>
            </label>
            <label className="text-xs font-semibold text-[#3e5c4b] sm:col-span-2">
              Note commerciali
              <textarea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                maxLength={500} rows={2}
                className="mt-1 w-full rounded-lg border border-[#bdd2c4] bg-white px-3 py-2 text-sm text-[#173f35]"/>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2ebe5] pt-3">
            <div className="min-w-0 text-xs text-[#4b6756]">
              <p className="font-bold">{totals.calculated > 0
                ? "Totale calcolabile: € " + fmt.format(totals.total)
                : "Totale da determinare"}</p>
              <p className="mt-1">Righe valorizzate {totals.priced}/{draftLines.length} · Totali calcolabili {totals.calculated}/{draftLines.length}</p>
            </div>
            <button type="submit" disabled={blocked}
              className="min-h-11 rounded-lg bg-[#175640] px-5 text-sm font-semibold text-white hover:bg-[#104632] disabled:opacity-60">
              {saving ? "Salvo…" : "Salva bozza"}
            </button>
          </div>
          <StateMessage state={saveState}/>
          <p className="text-[11px] text-[#667b6e]">Il salvataggio non invia email, non crea ordini e non rende visibili i prezzi interni.</p>
        </form>
      ) : null}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";

import {
  askCommercialAssistant,
  type AssistantFilters,
  type AssistantIntent,
  type AssistantObservation,
  type AssistantPayload,
  type AssistantState,
} from "@/app/(workspace)/assistant/actions";

const initialState: AssistantState = {
  status: "idle",
  query: "",
  message: "",
  payload: null,
  context: null,
  turns: [],
};

const initialSuggestions = [
  "Qual è l'ultimo prezzo del P265GH 406,4x6,3?",
  "Mostrami lo storico prezzi del P265GH 406,4x6,3",
  "Quali offerte sono senza ordine?",
  "Mostrami le richieste S355J2H con diametro superiore a 300 negli ultimi 12 mesi",
];

const followupSuggestions = [
  "e per spessore 7,1?",
  "e lo storico?",
  "solo negli ultimi 12 mesi",
  "e gli ordini?",
];

function numberLabel(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(number)
    : String(value);
}

function priceLabel(row: AssistantObservation): string {
  if (row.price_value === null) return "Prezzo non rilevato";
  const amount = Number(row.price_value);
  const currency = row.currency ?? "EUR";
  const formatted = Number.isFinite(amount)
    ? new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    : String(row.price_value);
  const unit = row.price_unit === "M"
    ? "/m"
    : row.price_unit === "T"
      ? "/t"
      : row.price_unit
        ? `/${row.price_unit}`
        : "";
  return `${formatted}${unit}`;
}

function sizeLabel(row: AssistantObservation): string {
  if (row.outer_diameter_mm !== null) {
    return `Ø ${numberLabel(row.outer_diameter_mm)}${
      row.thickness_mm !== null ? ` × ${numberLabel(row.thickness_mm)}` : ""
    }`;
  }
  if (row.width_mm !== null && row.height_mm !== null) {
    return `${numberLabel(row.width_mm)} × ${numberLabel(row.height_mm)}${
      row.thickness_mm !== null ? ` × ${numberLabel(row.thickness_mm)}` : ""
    }`;
  }
  return row.thickness_mm !== null ? `sp. ${numberLabel(row.thickness_mm)} mm` : "—";
}

function dateLabel(row: AssistantObservation): string {
  const raw = row.commercial_at ?? row.offered_at ?? null;
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

function intentLabel(intent: AssistantIntent): string {
  if (intent === "latest_price") return "Ultimo prezzo";
  if (intent === "price_history") return "Storico prezzi";
  if (intent === "offers_without_order") return "Offerte senza ordine";
  if (intent === "commercial_search") return "Ricerca commerciale";
  return "Richiesta non supportata";
}

function roleLabel(role: AssistantFilters["role"] | string | null | undefined): string | null {
  if (role === "requested") return "Richieste";
  if (role === "offered") return "Offerte";
  if (role === "ordered") return "Ordini";
  if (role === "delivered") return "Consegne";
  return null;
}

function filterLabels(filters: AssistantFilters): string[] {
  const result: string[] = [];
  const role = roleLabel(filters.role);
  if (role) result.push(role);
  if (filters.grade) result.push(filters.grade);
  if (filters.outer_diameter_mm !== null && filters.outer_diameter_mm !== undefined) {
    result.push(`Ø ${numberLabel(filters.outer_diameter_mm)} mm`);
  }
  if (filters.min_outer_diameter_mm !== null && filters.min_outer_diameter_mm !== undefined) {
    result.push(`Ø ≥ ${numberLabel(filters.min_outer_diameter_mm)} mm`);
  }
  if (filters.max_outer_diameter_mm !== null && filters.max_outer_diameter_mm !== undefined) {
    result.push(`Ø ≤ ${numberLabel(filters.max_outer_diameter_mm)} mm`);
  }
  if (filters.width_mm !== null && filters.width_mm !== undefined) {
    result.push(`${numberLabel(filters.width_mm)} × ${numberLabel(filters.height_mm)} mm`);
  }
  if (filters.thickness_mm !== null && filters.thickness_mm !== undefined) {
    result.push(`sp. ${numberLabel(filters.thickness_mm)} mm`);
  }
  if (filters.days) result.push(`ultimi ${filters.days} giorni`);
  return result;
}

function sourceRows(payload: AssistantPayload | null | undefined): AssistantObservation[] {
  const rows = payload?.observations ?? [];
  if (payload?.intent !== "offers_without_order") return rows.slice(0, 8);
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.thread_id)) return false;
    seen.add(row.thread_id);
    return true;
  }).slice(0, 8);
}

export function CommercialAssistant() {
  const [state, formAction, pending] = useActionState(askCommercialAssistant, initialState);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (state.turns.length > 0) setQuery("");
  }, [state.turns.length]);

  const suggestions = state.turns.length > 0 ? followupSuggestions : initialSuggestions;
  const contextLabels = useMemo(
    () => (state.context ? filterLabels(state.context.filters) : []),
    [state.context],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 rounded-2xl bg-slate-950 p-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">
                Grounded multi-turn assistant
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Puoi continuare la conversazione senza ripetere prodotto e filtri. Il contesto serve solo
                a costruire query commerciali strutturate: prezzi e risultati arrivano sempre dal database.
              </p>
            </div>
            {state.turns.length > 0 ? (
              <Link
                href="/assistant"
                className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Nuova conversazione
              </Link>
            ) : null}
          </div>

          {state.context ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Contesto attivo</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white">
                {intentLabel(state.context.intent)}
              </span>
              {contextLabels.map((label) => (
                <span key={label} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-300">
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <form action={formAction} className="space-y-4">
          <label className="block">
            <span className="sr-only">Domanda commerciale</span>
            <textarea
              name="query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder={
                state.turns.length > 0
                  ? "Continua: es. e per spessore 7,1?"
                  : "Es. Qual è l'ultimo prezzo del P265GH 406,4x6,3?"
              }
              className="w-full resize-none rounded-2xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuery(suggestion)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-950"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              Supporta anche richieste, offerte, ordini e consegne con qualità, dimensioni e periodo.
            </p>
            <button
              type="submit"
              disabled={pending || query.trim().length < 2}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Analizzo..." : state.turns.length > 0 ? "Continua" : "Chiedi all'assistente"}
            </button>
          </div>
        </form>
      </section>

      {state.turns.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-semibold text-slate-700">La conversazione apparirà qui.</p>
          <p className="mt-1 text-xs text-slate-500">
            Ogni risposta mostrerà criteri interpretati e collegamenti alle fonti originali.
          </p>
        </section>
      ) : (
        <section className="space-y-5">
          {state.turns.map((turn, index) => {
            const payload = turn.payload ?? null;
            const rows = sourceRows(payload);
            const labels = payload ? filterLabels(payload.filters) : [];
            return (
              <div key={`${index}-${turn.query}`} className="space-y-3">
                <div className="flex justify-end">
                  <div className="max-w-3xl rounded-2xl rounded-br-md bg-slate-950 px-4 py-3 text-sm font-medium leading-6 text-white">
                    {turn.query}
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="p-5 sm:p-6">
                    <div
                      className={`rounded-2xl p-5 ${
                        turn.status === "error" ? "bg-rose-50 text-rose-900" : "bg-indigo-50 text-slate-900"
                      }`}
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Steel Sales AI</p>
                      <p className="mt-2 text-base font-medium leading-7">{turn.message}</p>
                    </div>

                    {payload ? (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                          {intentLabel(payload.intent)}
                        </span>
                        {labels.map((filter) => (
                          <span
                            key={filter}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                          >
                            {filter}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {rows.length > 0 ? (
                    <div className="border-t border-slate-100 px-5 py-5 sm:px-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-sm font-semibold text-slate-950">Fonti commerciali</h2>
                          <p className="mt-1 text-xs text-slate-500">
                            Risultati verificabili collegati alla conversazione originale.
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-slate-400">fino a {rows.length} fonti</span>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {rows.map((row) => (
                          <Link
                            key={`${row.id}-${row.thread_id}`}
                            href={`/conversations/${row.thread_id}`}
                            className="rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-950">
                                  {row.grade ?? "Prodotto"} · {sizeLabel(row)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {roleLabel(row.item_role) ? `${roleLabel(row.item_role)} · ` : ""}
                                  {row.standard ?? "Norma non rilevata"} · {dateLabel(row)}
                                </p>
                              </div>
                              <span className="whitespace-nowrap text-sm font-semibold text-slate-900">
                                {priceLabel(row)}
                              </span>
                            </div>
                            <p className="mt-3 line-clamp-1 text-xs font-semibold text-indigo-600">
                              {row.thread_subject ?? "Apri trattativa"}
                            </p>
                            {row.source_text ? (
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{row.source_text}</p>
                            ) : null}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

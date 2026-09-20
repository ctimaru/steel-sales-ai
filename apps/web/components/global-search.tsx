"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  globalSearch,
  type GlobalResultType,
  type GlobalSearchResult,
  type GlobalSearchState,
} from "@/app/(workspace)/search/actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const initialState: GlobalSearchState = { status: "idle", message: "", results: [], count: 0, counts: {} };

const resultTypes: Array<{ value: GlobalResultType; label: string }> = [
  { value: "document", label: "Documenti" },
  { value: "product", label: "Prodotti" },
  { value: "company", label: "Aziende" },
  { value: "rfq", label: "RFQ" },
  { value: "offer", label: "Offerte" },
  { value: "order", label: "Ordini" },
  { value: "delivery", label: "Consegne" },
];

const examples = [
  "P265GH 406,4 x 6,3 EN 10224",
  "offerte S355J2H EN 10219 80x80x8",
  "richieste tubo 323,9 x 7,1",
];

function typeLabel(type: GlobalResultType) {
  return resultTypes.find((entry) => entry.value === type)?.label ?? type;
}

function typeTone(type: GlobalResultType): "blue" | "green" | "violet" | "amber" | "neutral" {
  if (type === "document") return "blue";
  if (type === "product") return "violet";
  if (type === "offer") return "green";
  if (type === "rfq") return "amber";
  return "neutral";
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

function formatNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return value.toLocaleString("it-IT", { maximumFractionDigits: 3 });
}

function formatPrice(result: GlobalSearchResult) {
  if (result.price_value === null) return null;
  const currency = result.currency === "EUR" ? "€" : result.currency ?? "";
  const unit = result.price_unit ? `/${result.price_unit.toLowerCase()}` : "";
  return `${currency} ${result.price_value.toLocaleString("it-IT", { maximumFractionDigits: 2 })}${unit}`.trim();
}

function technicalFacts(result: GlobalSearchResult) {
  return [
    result.grade,
    result.standard,
    result.outer_diameter_mm !== null ? `Ø ${formatNumber(result.outer_diameter_mm)} mm` : null,
    result.width_mm !== null && result.height_mm !== null
      ? `${formatNumber(result.width_mm)} × ${formatNumber(result.height_mm)} mm`
      : null,
    result.thickness_mm !== null ? `t ${formatNumber(result.thickness_mm)} mm` : null,
    result.length_mm !== null ? `L ${formatNumber(result.length_mm)} mm` : null,
    formatPrice(result),
  ].filter(Boolean) as string[];
}

function sharedReference(result: GlobalSearchResult) {
  const value = result.metadata?.shared_reference;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function sourceTarget(result: GlobalSearchResult) {
  if (result.thread_id) return `/conversations/${result.thread_id}`;
  const sourceUri = result.metadata?.source_uri;
  return typeof sourceUri === "string" && /^https?:\/\//i.test(sourceUri) ? sourceUri : null;
}

export function GlobalSearch() {
  const [state, formAction, pending] = useActionState(globalSearch, initialState);
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 bg-white">
        <div className="border-b border-white/10 bg-slate-950 px-5 py-5 text-white sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Structured + semantic</p>
          <h2 className="mt-2 text-xl font-semibold">Cerca in tutta la Commercial Memory</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            Un'unica ricerca combina documenti indicizzati, prodotti canonici ed eventi commerciali con filtri tecnici steel.
          </p>
        </div>

        <form action={formAction} className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Es. P265GH 406,4 x 6,3 EN 10224"
              aria-label="Global Search"
              minLength={2}
              required
              className="h-12 flex-1 text-base"
            />
            <button
              type="submit"
              disabled={pending || query.trim().length < 2}
              className="h-12 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-50"
            >
              {pending ? "Ricerca..." : "Cerca"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuery(example)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
              >
                {example}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tipi di risultato · nessuna selezione = tutti</p>
            <div className="flex flex-wrap gap-2">
              {resultTypes.map((entry) => (
                <label key={entry.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                  <input name="types" value={entry.value} type="checkbox" className="h-3.5 w-3.5 rounded" />
                  {entry.label}
                </label>
              ))}
            </div>
          </div>

          <details className="rounded-xl border border-slate-200 bg-slate-50/70">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">Filtri steel avanzati</summary>
            <div className="space-y-4 border-t border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input name="company" placeholder="Cliente / azienda" />
                <Input name="grade" placeholder="Grade, es. P265GH" />
                <Input name="standard" placeholder="Norma, es. EN 10224" />
                <Input name="product_family" placeholder="Famiglia prodotto" />
                <Input name="outer_diameter_mm" inputMode="decimal" placeholder="Diametro mm" />
                <Input name="thickness_mm" inputMode="decimal" placeholder="Spessore mm" />
                <Input name="width_mm" inputMode="decimal" placeholder="Larghezza mm" />
                <Input name="height_mm" inputMode="decimal" placeholder="Altezza mm" />
                <Input name="length_mm" inputMode="decimal" placeholder="Lunghezza mm" />
                <Input name="price_min" inputMode="decimal" placeholder="Prezzo minimo" />
                <Input name="price_max" inputMode="decimal" placeholder="Prezzo massimo" />
                <Input name="currency" maxLength={3} placeholder="Valuta, es. EUR" />
                <Input name="source" placeholder="Fonte / filename" />
                <Input name="source_type" placeholder="Tipo fonte" />
                <Input name="document_type" placeholder="Tipo documento" />
                <select name="item_role" defaultValue="" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                  <option value="">Qualsiasi ruolo</option>
                  <option value="requested">Richiesto</option>
                  <option value="offered">Offerto</option>
                  <option value="ordered">Ordinato</option>
                  <option value="delivered">Consegnato</option>
                </select>
                <label className="text-xs font-medium text-slate-500">Da data<input name="date_from" type="date" className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" /></label>
                <label className="text-xs font-medium text-slate-500">A data<input name="date_to" type="date" className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" /></label>
              </div>
            </div>
          </details>
        </form>
      </Card>

      {state.status === "error" ? <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{state.message}</Card> : null}

      {state.status === "success" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">{(state.count ?? 0).toLocaleString("it-IT")} risultati restituiti</p>
              <p className="mt-1 text-xs text-slate-500">
                {state.model?.model_name ? `Semantic index: ${state.model.model_name}` : "Ricerca strutturata"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(state.counts ?? {}).map(([type, count]) => (
                <Badge key={type} tone="neutral">{typeLabel(type as GlobalResultType)}: {count}</Badge>
              ))}
            </div>
          </div>

          {(state.results ?? []).map((result) => {
            const facts = technicalFacts(result);
            const date = formatDate(result.event_at);
            const target = sourceTarget(result);
            const reference = sharedReference(result);
            const referenceStatus = typeof reference?.resolution_status === "string"
              ? reference.resolution_status
              : null;
            return (
              <Card key={result.result_id} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={typeTone(result.result_type)}>{typeLabel(result.result_type)}</Badge>
                      {result.role ? <Badge tone="neutral">{result.role}</Badge> : null}
                      {date ? <span className="text-xs text-slate-400">{date}</span> : null}
                      {referenceStatus ? (
                        <Badge tone={referenceStatus === "matched" ? "green" : referenceStatus === "matched_canonical_missing" ? "amber" : "neutral"}>
                          {referenceStatus === "matched"
                            ? "Reference match"
                            : referenceStatus === "matched_canonical_missing"
                              ? "Reference · peso da completare"
                              : "Reference · verifica"}
                        </Badge>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-slate-950">{result.title}</h3>
                    {result.subtitle ? <p className="mt-1 text-sm text-slate-500">{result.subtitle}</p> : null}
                    {facts.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {facts.map((fact) => <Badge key={fact} tone="blue">{fact}</Badge>)}
                      </div>
                    ) : null}
                    {result.snippet ? <p className="mt-4 line-clamp-4 whitespace-pre-line text-sm leading-6 text-slate-700">{result.snippet}</p> : null}
                    {result.source_filename ? <p className="mt-3 truncate text-xs text-slate-400">Fonte: {result.source_filename}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-row items-start gap-2 lg:flex-col lg:items-end">
                    <span className="rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white">score {Number(result.score ?? 0).toFixed(4)}</span>
                    {target ? (
                      target.startsWith("http") ? (
                        <a href={target} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Apri fonte ↗</a>
                      ) : (
                        <Link href={target} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Apri thread →</Link>
                      )
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}

          {(state.results ?? []).length === 0 ? (
            <Card className="p-10 text-center">
              <p className="font-semibold text-slate-800">Nessun risultato</p>
              <p className="mt-2 text-sm text-slate-500">Prova una query più ampia oppure rimuovi uno dei filtri steel.</p>
            </Card>
          ) : null}
        </div>
      ) : null}

      {state.status === "idle" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5"><p className="font-semibold text-slate-900">Una query, più oggetti</p><p className="mt-2 text-sm leading-6 text-slate-500">Documenti, prodotti, RFQ, offerte, ordini e aziende confluiscono nella stessa ricerca.</p></Card>
          <Card className="p-5"><p className="font-semibold text-slate-900">Filtri steel nativi</p><p className="mt-2 text-sm leading-6 text-slate-500">Diametro, spessore, dimensioni, grade, standard, prezzo, data e fonte.</p></Card>
          <Card className="p-5"><p className="font-semibold text-slate-900">Evidence preservata</p><p className="mt-2 text-sm leading-6 text-slate-500">I risultati semantici mantengono chunk, documento, provenance e collegamento al thread originale.</p></Card>
        </div>
      ) : null}
    </div>
  );
}

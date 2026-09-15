"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  searchKnowledge,
  type KnowledgeSearchResult,
  type KnowledgeSearchState,
} from "@/app/(workspace)/knowledge-explorer/actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const initialState: KnowledgeSearchState = {
  status: "idle",
  message: "",
  results: [],
  count: 0,
};

const examples = [
  "Trova offerte S355J2H EN 10219 tubi rettangolari",
  "Ordini EN 10224 L275 spessore 7,1 mm",
  "Tubi P265GH diametro 406,4 mm disponibili",
];

function percent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function fixed(value: number | null, digits = 3) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function sourceTarget(result: KnowledgeSearchResult) {
  if (result.source_uri && /^https?:\/\//i.test(result.source_uri)) {
    return { href: result.source_uri, external: true };
  }
  const threadId = result.source_locator?.thread_id;
  if (typeof threadId === "string" && threadId) {
    return { href: `/conversations/${threadId}`, external: false };
  }
  return null;
}

function locationLabel(result: KnowledgeSearchResult) {
  const parts: string[] = [];
  if (result.page_start) {
    parts.push(
      result.page_end && result.page_end !== result.page_start
        ? `pagine ${result.page_start}–${result.page_end}`
        : `pagina ${result.page_start}`,
    );
  }
  if (result.section_path?.length) parts.push(result.section_path.join(" › "));
  return parts.join(" · ");
}

export function KnowledgeExplorer() {
  const [state, formAction, pending] = useActionState(searchKnowledge, initialState);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const grouped = new Map<string, KnowledgeSearchResult[]>();
    for (const result of state.results ?? []) {
      const key = result.document_id || result.chunk_id;
      const current = grouped.get(key) ?? [];
      current.push(result);
      grouped.set(key, current);
    }
    return Array.from(grouped.values());
  }, [state.results]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 to-slate-800 px-5 py-5 text-white sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Hybrid semantic retrieval
          </p>
          <h2 className="mt-2 text-xl font-semibold">Cerca nel knowledge layer</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            La query combina embedding E5, full-text, entità canoniche e filtri commerciali.
            I risultati mantengono sempre documento, chunk e provenance.
          </p>
        </div>

        <form action={formAction} className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Es. offerte S355J2H EN 10219 tubi rettangolari"
              aria-label="Query semantica"
              required
              minLength={2}
              className="h-12 flex-1 text-base"
            />
            <button
              type="submit"
              disabled={pending || query.trim().length < 2}
              className="h-12 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50"
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
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white"
              >
                {example}
              </button>
            ))}
          </div>

          <details className="rounded-xl border border-slate-200 bg-slate-50/70">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">
              Filtri strutturati
            </summary>
            <div className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input name="company" placeholder="Azienda" />
              <Input name="grade" placeholder="Qualità / materiale" />
              <Input name="standard" placeholder="Norma, es. EN 10219" />
              <Input name="product_family" placeholder="Famiglia prodotto" />
              <Input name="country" placeholder="Paese" />
              <select
                name="item_role"
                defaultValue=""
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
              >
                <option value="">Ruolo automatico</option>
                <option value="requested">Requested</option>
                <option value="offered">Offered</option>
                <option value="ordered">Ordered</option>
                <option value="delivered">Delivered</option>
              </select>
              <Input name="outer_diameter_mm" inputMode="decimal" placeholder="Diametro mm" />
              <Input name="thickness_mm" inputMode="decimal" placeholder="Spessore mm" />
              <Input name="width_mm" inputMode="decimal" placeholder="Larghezza mm" />
              <Input name="height_mm" inputMode="decimal" placeholder="Altezza mm" />
              <Input name="length_mm" inputMode="decimal" placeholder="Lunghezza mm" />
              <select
                name="limit"
                defaultValue="12"
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
              >
                <option value="10">10 risultati</option>
                <option value="12">12 risultati</option>
                <option value="20">20 risultati</option>
                <option value="30">30 risultati</option>
              </select>
            </div>
          </details>
        </form>
      </Card>

      {state.status === "error" ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {state.message}
        </Card>
      ) : null}

      {state.status === "success" ? (
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                {(state.count ?? 0).toLocaleString("it-IT")} risultati
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {groups.length.toLocaleString("it-IT")} documenti · modello {state.model?.model_name ?? "active"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(state.retrieval?.entity_filters ?? {}).flatMap(([key, values]) =>
                values.map((value) => (
                  <Badge key={`${key}-${value}`} tone="blue">
                    {key}: {value}
                  </Badge>
                )),
              )}
              {Object.entries(state.retrieval?.commercial_filters ?? {}).map(([key, value]) => (
                <Badge key={key} tone="violet">
                  {key}: {String(value)}
                </Badge>
              ))}
            </div>
          </div>

          {groups.map((results) => {
            const lead = results[0];
            const target = sourceTarget(lead);
            return (
              <Card key={lead.document_id} className="overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{lead.source_class ?? "source"}</Badge>
                      <Badge tone="blue">{lead.document_type ?? "document"}</Badge>
                      {lead.language_code ? <Badge tone="neutral">{lead.language_code}</Badge> : null}
                    </div>
                    <h3 className="mt-2 truncate text-sm font-semibold text-slate-950">
                      {lead.title || lead.filename || "Documento senza titolo"}
                    </h3>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {lead.filename || lead.source_name || lead.document_id}
                    </p>
                  </div>
                  {target ? (
                    target.external ? (
                      <a
                        href={target.href}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                      >
                        Apri fonte ↗
                      </a>
                    ) : (
                      <Link
                        href={target.href}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                      >
                        Apri thread →
                      </Link>
                    )
                  ) : null}
                </div>

                <div className="divide-y divide-slate-100">
                  {results.map((result, index) => {
                    const location = locationLabel(result);
                    return (
                      <div key={result.chunk_id} className="p-4 sm:p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-slate-400">
                                Evidence {index + 1}
                              </span>
                              {result.matched_entities.map((entity) => (
                                <Badge key={`${result.chunk_id}-${entity.entity_id}`} tone="green">
                                  {entity.canonical_name}
                                </Badge>
                              ))}
                            </div>
                            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
                              {result.content}
                            </p>
                            {location ? (
                              <p className="mt-3 text-xs text-slate-400">{location}</p>
                            ) : null}
                          </div>

                          <div className="grid shrink-0 grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:w-[360px] lg:grid-cols-2">
                            <div className="rounded-lg bg-slate-50 p-2.5">
                              <p className="text-slate-400">Semantic</p>
                              <p className="mt-1 font-semibold text-slate-800">
                                {percent(result.vector_similarity)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-2.5">
                              <p className="text-slate-400">Full-text</p>
                              <p className="mt-1 font-semibold text-slate-800">
                                {fixed(result.lexical_score)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-2.5">
                              <p className="text-slate-400">Entità</p>
                              <p className="mt-1 font-semibold text-slate-800">
                                {result.entity_match_count}
                              </p>
                            </div>
                            <div className="rounded-lg bg-slate-950 p-2.5 text-white">
                              <p className="text-slate-400">RRF score</p>
                              <p className="mt-1 font-semibold">{fixed(result.rrf_score, 4)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          {(state.results ?? []).length === 0 ? (
            <Card className="p-10 text-center">
              <p className="font-semibold text-slate-800">Nessuna evidence trovata</p>
              <p className="mt-2 text-sm text-slate-500">
                Prova una query più ampia oppure rimuovi uno dei filtri strutturati.
              </p>
            </Card>
          ) : null}
        </div>
      ) : null}

      {state.status === "idle" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-900">Ricerca cross-language</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Query in italiano o inglese sullo stesso corpus grazie agli embedding multilingual.
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-900">Filtri tecnici</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Combina grade, norme, aziende, ruoli commerciali e dimensioni del tubo.
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-900">Provenance verificabile</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Ogni match mostra evidence, documento, chunk, entità e segnali di ranking.
            </p>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import type { SchoolWorkspaceLocale } from "@/lib/school-workspace-i18n";
import { EXPLORER_LOCALES } from "@/lib/school-explorer-locales";
const explorerLabels = EXPLORER_LOCALES;

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

function locationLabel(result: KnowledgeSearchResult, locale: SchoolWorkspaceLocale) {
  const c=EXPLORER_LOCALES[locale];
  const parts: string[] = [];
  if (result.page_start) {
    parts.push(
      result.page_end && result.page_end !== result.page_start
        ? `${c.pages} ${result.page_start}–${result.page_end}`
        : `${c.page} ${result.page_start}`,
    );
  }
  if (result.section_path?.length) parts.push(result.section_path.join(" › "));
  return parts.join(" · ");
}

function displaySearchMessage(message: string, locale: SchoolWorkspaceLocale): string {
  if (locale === "it") return message;
  // Translate only well-known UI errors. Preserve unrecognized worker diagnostics.
  const known: Record<string,string> = {
    "Inserisci almeno 2 caratteri per la ricerca.": EXPLORER_LOCALES[locale].errorShort,
    "Sessione scaduta. Accedi di nuovo.": EXPLORER_LOCALES[locale].errorAuth,
    "Knowledge Explorer richiede Supabase Auth configurato.": EXPLORER_LOCALES[locale].errorConfig,
    "Worker non configurato nell'ambiente web.": EXPLORER_LOCALES[locale].errorWorker,
    "La ricerca semantica non è disponibile.": EXPLORER_LOCALES[locale].errorUnavailable,
    "Worker di ricerca non raggiungibile.": EXPLORER_LOCALES[locale].errorOffline,
  };
  return known[message] ?? message;
}

export function KnowledgeExplorer({locale="it"}:{locale?:SchoolWorkspaceLocale}) {
  const ui=explorerLabels[locale];
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
          <h2 className="mt-2 text-xl font-semibold">{ui.title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            {ui.description}
          </p>
        </div>

        <form action={formAction} className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={ui.placeholder}
              aria-label={ui.title}
              required
              minLength={2}
              className="h-12 flex-1 text-base"
            />
            <button
              type="submit"
              disabled={pending || query.trim().length < 2}
              className="h-12 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50"
            >
              {pending ? ui.searching : ui.search}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {ui.examples.map((example) => (
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
              {ui.filters}
            </summary>
            <div className="space-y-4 border-t border-slate-200 p-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {ui.entities}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Input name="company" placeholder={ui.company} />
                  <Input name="grade" placeholder={ui.grade} />
                  <Input name="standard" placeholder={ui.standard} />
                  <Input name="product_family" placeholder={ui.family} />
                  <Input name="country" placeholder={ui.country} />
                  <select
                    name="item_role"
                    defaultValue=""
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  >
                    <option value="">{ui.role}</option>
                    <option value="requested">{ui.roles[0]}</option>
                    <option value="offered">{ui.roles[1]}</option>
                    <option value="ordered">{ui.roles[2]}</option>
                    <option value="delivered">{ui.roles[3]}</option>
                  </select>
                  <Input name="outer_diameter_mm" inputMode="decimal" placeholder={ui.diameter} />
                  <Input name="thickness_mm" inputMode="decimal" placeholder={ui.thickness} />
                  <Input name="width_mm" inputMode="decimal" placeholder={ui.width} />
                  <Input name="height_mm" inputMode="decimal" placeholder={ui.height} />
                  <Input name="length_mm" inputMode="decimal" placeholder={ui.length} />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {ui.sources}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Input name="source_class" placeholder={ui.sourceClass} />
                  <Input name="source_type" placeholder={ui.sourceType} />
                  <Input name="document_type" placeholder={ui.documentType} />
                  <Input name="document_query" placeholder={ui.filename} />
                  <label className="text-xs font-medium text-slate-500">
                    {ui.from}
                    <input
                      name="date_from"
                      type="date"
                      className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-500">
                    {ui.to}
                    <input
                      name="date_to"
                      type="date"
                      className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    />
                  </label>
                  <select
                    name="limit"
                    defaultValue="12"
                    className="h-10 self-end rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  >
                    <option value="10">10 {ui.resultLimit}</option>
                    <option value="12">12 {ui.resultLimit}</option>
                    <option value="20">20 {ui.resultLimit}</option>
                    <option value="30">30 {ui.resultLimit}</option>
                  </select>
                </div>
              </div>
            </div>
          </details>
        </form>
      </Card>

      {state.status === "error" ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {displaySearchMessage(state.message,locale)}
        </Card>
      ) : null}

      {state.status === "success" ? (
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                {(state.count ?? 0).toLocaleString(locale)} {ui.results}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {groups.length.toLocaleString(locale)} {ui.documents} · {ui.model} {state.model?.model_name ?? ui.noModel}
              </p>
            </div>
            <div className="flex max-w-3xl flex-wrap justify-end gap-2">
              {Object.entries(state.retrieval?.entity_filters ?? {}).flatMap(([key, values]) =>
                values.map((value) => (
                  <Badge key={`${key}-${value}`} tone="blue">
                    {key}: {value}
                  </Badge>
                )),
              )}
              {Object.entries(state.retrieval?.commercial_filters ?? {}).map(([key, value]) => (
                <Badge key={`commercial-${key}`} tone="violet">
                  {key}: {String(value)}
                </Badge>
              ))}
              {Object.entries(state.retrieval?.document_filters ?? {}).map(([key, value]) => (
                <Badge key={`document-${key}`} tone="amber">
                  {key}: {String(value)}
                </Badge>
              ))}
            </div>
          </div>

          {groups.map((results) => {
            const lead = results[0];
            const target = sourceTarget(lead);
            return (
              <Card key={lead.document_id || lead.chunk_id} className="overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{lead.source_class ?? "source"}</Badge>
                      <Badge tone="blue">{lead.document_type ?? "document"}</Badge>
                      {lead.language_code ? <Badge tone="neutral">{lead.language_code}</Badge> : null}
                    </div>
                    <h3 className="mt-2 truncate text-sm font-semibold text-slate-950">
                      {lead.title || lead.filename || ui.untitled}
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
                        {ui.openSource} ↗
                      </a>
                    ) : (
                      <Link
                        href={target.href}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                      >
                        {ui.openThread} →
                      </Link>
                    )
                  ) : null}
                </div>

                <div className="divide-y divide-slate-100">
                  {results.map((result, index) => {
                    const location = locationLabel(result, locale);
                    return (
                      <div key={result.chunk_id} className="p-4 sm:p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-slate-400">
                                {ui.evidence} {index + 1}
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
                              <p className="text-slate-400">{ui.semantic}</p>
                              <p className="mt-1 font-semibold text-slate-800">
                                {percent(result.vector_similarity)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-2.5">
                              <p className="text-slate-400">{ui.fulltext}</p>
                              <p className="mt-1 font-semibold text-slate-800">
                                {fixed(result.lexical_score)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-2.5">
                              <p className="text-slate-400">{ui.entitiesScore}</p>
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
              <p className="font-semibold text-slate-800">{ui.empty}</p>
              <p className="mt-2 text-sm text-slate-500">
                {ui.emptyHelp}
              </p>
            </Card>
          ) : null}
        </div>
      ) : null}

      {state.status === "idle" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-900">{ui.idleTitles[0]}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {ui.idleDescriptions[0]}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-900">{ui.idleTitles[1]}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {ui.idleDescriptions[1]}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-900">{ui.idleTitles[2]}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {ui.idleDescriptions[2]}
            </p>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

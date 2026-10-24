"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import {
  globalSearch,
  type GlobalResultType,
  type GlobalSearchResult,
  type GlobalSearchState,
} from "@/app/(workspace)/search/actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { appRoutes } from "@/lib/routes";
import { commercialSearchHref, type CommercialSearchScope } from "@/lib/commercial-search-context";

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
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value.toLocaleString("it-IT", { maximumFractionDigits: 3 });
}

function formatPrice(result: GlobalSearchResult) {
  if (typeof result.price_value !== "number" || !Number.isFinite(result.price_value)) return null;
  const currency = result.currency === "EUR" ? "€" : result.currency ?? "";
  const unit = result.price_unit ? `/${result.price_unit.toLowerCase()}` : "";
  return `${currency} ${result.price_value.toLocaleString("it-IT", { maximumFractionDigits: 2 })}${unit}`.trim();
}

function technicalFacts(result: GlobalSearchResult) {
  const diameter = formatNumber(result.outer_diameter_mm);
  const width = formatNumber(result.width_mm);
  const height = formatNumber(result.height_mm);
  const thickness = formatNumber(result.thickness_mm);
  const length = formatNumber(result.length_mm);
  return [
    result.grade,
    result.standard,
    diameter !== null ? `Ø ${diameter} mm` : null,
    width !== null && height !== null ? `${width} × ${height} mm` : null,
    thickness !== null ? `t ${thickness} mm` : null,
    length !== null ? `L ${length} mm` : null,
    formatPrice(result),
  ].filter(Boolean) as string[];
}

function sharedReference(result: GlobalSearchResult) {
  const value = result.metadata?.shared_reference;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function companyTarget(result: GlobalSearchResult) {
  const companyId = result.metadata?.company_id;
  if (
    typeof companyId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(companyId)
  ) {
    return appRoutes.commercial.company(companyId);
  }
  return null;
}

function entityTarget(result: GlobalSearchResult) {
  const canonicalProductId = result.metadata?.canonical_product_id;
  if (
    result.result_type === "product" &&
    typeof canonicalProductId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(canonicalProductId)
  ) {
    return { href: appRoutes.commercial.product(canonicalProductId), label: "Apri prodotto →" };
  }

  const normalizedEntityId = result.metadata?.normalized_entity_id;
  if (
    typeof normalizedEntityId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedEntityId)
  ) {
    if (result.result_type === "rfq") return { href: appRoutes.commercial.rfq(normalizedEntityId), label: "Apri RFQ →" };
    if (result.result_type === "offer") return { href: appRoutes.commercial.offer(normalizedEntityId), label: "Apri offerta →" };
    if (result.result_type === "order") return { href: appRoutes.commercial.order(normalizedEntityId), label: "Apri ordine →" };
  }

  return null;
}

function sourceTarget(result: GlobalSearchResult) {
  const observationId = result.metadata?.observation_id;
  if (typeof observationId === "number" && Number.isInteger(observationId) && observationId > 0) {
    return `/evidence/${observationId}`;
  }
  const sourceUri = result.metadata?.source_uri;
  if (typeof sourceUri === "string" && /^https?:\/\//i.test(sourceUri)) return sourceUri;
  if (result.thread_id) return appRoutes.commercial.conversation(result.thread_id);
  return null;
}

export function GlobalSearch({ initialQuery = "", scope = "all" }: { initialQuery?: string; scope?: CommercialSearchScope }) {
  const [state, formAction, pending] = useActionState(globalSearch, initialState);
  const [query, setQuery] = useState(initialQuery);
  const submittedFromUrl = useRef<string | null>(null);
  // Header GET -> search result without a second click. This invokes the same
  // authenticated server action as manual search; no public/Network lookup.
  useEffect(() => {
    if (initialQuery.trim().length < 2) return;
    const requestKey = initialQuery + ":" + scope;
    if (submittedFromUrl.current === requestKey) return;
    submittedFromUrl.current = requestKey;
    const formData = new FormData();
    formData.set("query", initialQuery);
    formData.set("scope", scope);
    startTransition(() => formAction(formData));
  }, [initialQuery, scope, formAction]);

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden border-slate-200 bg-white">
        <form action={formAction} className="space-y-3 p-3 sm:p-4">
          <input type="hidden" name="scope" value={scope} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Es. P265GH 406,4 x 6,3 EN 10224"
              aria-label="Global Search"
              minLength={2}
              maxLength={160}
              required
              className="h-11 flex-1 text-base"
            />
            <button
              type="submit"
              disabled={pending || query.trim().length < 2}
              className="app-primary h-11 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-50"
            >
              {pending ? "Ricerca..." : "Cerca"}
            </button>
          </div>

          {!initialQuery ? <div className="flex flex-wrap gap-1.5">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuery(example)}
                className="rounded-full border border-[#dce2df] bg-[#f6f8f7] px-3 py-1.5 text-xs font-medium text-[#5d6a65] hover:bg-white"
              >
                {example}
              </button>
            ))}
          </div> : null}

          {scope === "all" ? <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#66736e]">Tipi di risultati · nessuna selezione = tutti</p>
            <div className="flex flex-wrap gap-2">
              {resultTypes.map((entry) => (
                <label key={entry.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#dce2df] bg-white px-3 py-2 text-xs font-medium text-[#43524c]">
                  <input name="types" value={entry.value} type="checkbox" className="h-3.5 w-3.5 rounded" />
                  {entry.label}
                </label>
              ))}
            </div>
          </div> : null}

          <details className="rounded-lg border border-[#dce2df] bg-[#f6f8f7]/70">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[#43524c]">Filtri tecnici opzionali</summary>
            <div className="space-y-4 border-t border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input name="company" aria-label="Cliente o azienda" placeholder="Cliente / azienda" />
                <Input name="grade" aria-label="Qualità acciaio" placeholder="Qualità, es. P265GH" />
                <Input name="standard" aria-label="Norma tecnica" placeholder="Norma, es. EN 10224" />
                <Input name="product_family" aria-label="Famiglia prodotto" placeholder="Famiglia prodotto" />
                <Input name="outer_diameter_mm" aria-label="Diametro esterno in millimetri" inputMode="decimal" placeholder="Diametro mm" />
                <Input name="thickness_mm" aria-label="Spessore in millimetri" inputMode="decimal" placeholder="Spessore mm" />
                <Input name="width_mm" aria-label="Larghezza in millimetri" inputMode="decimal" placeholder="Larghezza mm" />
                <Input name="height_mm" aria-label="Altezza in millimetri" inputMode="decimal" placeholder="Altezza mm" />
                <Input name="length_mm" aria-label="Lunghezza in millimetri" inputMode="decimal" placeholder="Lunghezza mm" />
                <Input name="price_min" aria-label="Prezzo minimo" inputMode="decimal" placeholder="Prezzo minimo" />
                <Input name="price_max" aria-label="Prezzo massimo" inputMode="decimal" placeholder="Prezzo massimo" />
                <Input name="currency" aria-label="Valuta" maxLength={3} placeholder="Valuta, es. EUR" />
                <Input name="source" aria-label="Fonte o nome file" placeholder="Fonte / nome file" />
                <Input name="source_type" aria-label="Tipo fonte" placeholder="Tipo fonte" />
                <Input name="document_type" aria-label="Tipo documento" placeholder="Tipo documento" />
                <select name="item_role" aria-label="Ruolo commerciale" defaultValue="" className="h-10 rounded-lg border border-[#dce2df] bg-white px-3 text-sm text-[#43524c]">
                  <option value="">Qualsiasi ruolo</option>
                  <option value="requested">Richiesto</option>
                  <option value="offered">Offerto</option>
                  <option value="ordered">Ordinato</option>
                  <option value="delivered">Consegnato</option>
                </select>
                <label className="text-xs font-medium text-[#66736e]">Da data<input name="date_from" type="date" className="mt-1 block h-10 w-full rounded-lg border border-[#dce2df] bg-white px-3 text-sm" /></label>
                <label className="text-xs font-medium text-[#66736e]">A data<input name="date_to" type="date" className="mt-1 block h-10 w-full rounded-lg border border-[#dce2df] bg-white px-3 text-sm" /></label>
              </div>
            </div>
          </details>
        </form>
      </Card>

      {pending ? <p role="status" className="text-xs font-medium text-[#53665b]">Ricerca privata in corso…</p> : null}
      {state.status === "error" ? <Card role="alert" className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{state.message}</Card> : null}

      {state.status === "success" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1d2824]">{(state.count ?? 0).toLocaleString("it-IT")} risultati restituiti</p>
              <p className="mt-1 text-xs text-[#66736e]">
                Risultati disponibili nella tua memoria privata, non nel Network pubblico.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(state.counts ?? {}).map(([type, count]) => (
                <Badge key={type} tone="neutral">{typeLabel(type as GlobalResultType)}: {count}</Badge>
              ))}
            </div>
          </div>
          {state.quality?.preview_limited ? (
            <p role="status" className="rounded-lg border border-[#dce2df] bg-[#f5f8f6] px-3 py-2.5 text-xs leading-5 text-[#43524c]">
              <strong>Anteprima dei risultati.</strong> Alcuni elementi dell'archivio potrebbero non essere mostrati.
              Restringi la ricerca o seleziona una categoria per vedere altre corrispondenze.
              {state.quality.backfill_incomplete ? " Alcune categorie non sono state caricate completamente." : ""}
            </p>
          ) : null}
          {state.quality ? (
            <p className="text-xs text-[#66736e]">
              {state.quality.source_references} risultati con un riferimento registrato alla fonte su {(state.results ?? []).length} visualizzati.
              Il riferimento non equivale a una verifica del contenuto.
            </p>
          ) : null}

          {(state.results ?? []).map((result) => {
            const facts = technicalFacts(result);
            const date = formatDate(result.event_at);
            const target = sourceTarget(result);
            const customerTarget = companyTarget(result);
            const entity = entityTarget(result);
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
                      {date ? <span className="text-xs text-[#66736e]">{date}</span> : null}
                      {referenceStatus ? (
                        <Badge tone={referenceStatus === "matched" ? "green" : referenceStatus === "matched_canonical_missing" ? "amber" : "neutral"}>
                          {referenceStatus === "matched"
                            ? "Riferimento verificato"
                            : referenceStatus === "matched_canonical_missing"
                              ? "Riferimento · peso da completare"
                              : "Riferimento da verificare"}
                        </Badge>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-[#1d2824]">{result.title}</h3>
                    {result.subtitle ? <p className="mt-1 text-sm text-[#66736e]">{result.subtitle}</p> : null}
                    {facts.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {facts.map((fact) => <Badge key={fact} tone="blue">{fact}</Badge>)}
                      </div>
                    ) : null}
                    {result.snippet ? <p className="mt-4 line-clamp-4 whitespace-pre-line text-sm leading-6 text-[#43524c]">{result.snippet}</p> : null}
                    {result.source_filename ? <p className="mt-3 truncate text-xs text-[#66736e]">Fonte: {result.source_filename}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-row items-start gap-2 lg:flex-col lg:items-end">
                    <span className="rounded-lg border border-[#dce2df] bg-[#f6f8f7] px-2.5 py-1.5 text-xs font-semibold text-[#43524c]">
                      {target ? "Riferimento alla fonte" : result.result_type === "company" ? "Scheda CRM" : "Fonte diretta non disponibile"}
                    </span>
                    {customerTarget ? (
                      <Link
                        href={customerTarget}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        Apri azienda →
                      </Link>
                    ) : null}
                    {entity ? (
                      <Link
                        href={entity.href}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        {entity.label}
                      </Link>
                    ) : null}
                    {target ? (
                      target.startsWith("http") ? (
                        <a href={target} target="_blank" rel="noreferrer" className="rounded-lg border border-[#dce2df] px-3 py-2 text-xs font-semibold text-[#43524c]">Apri fonte ↗</a>
                      ) : (
                        <Link href={target} target={target.startsWith("/evidence/") ? "_blank" : undefined} className="rounded-lg border border-[#dce2df] px-3 py-2 text-xs font-semibold text-[#43524c]">
                          {target.startsWith("/evidence/") ? "Apri originale ↗" : "Apri thread →"}
                        </Link>
                      )
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}

          {(state.results ?? []).length === 0 ? (
            <FirstUseEmptyState
              eyebrow="Ricerca senza risultati"
              title={scope === "companies" ? "Nessuna azienda normalizzata trovata" : "Nessun elemento corrisponde alla ricerca"}
              description={scope === "companies"
                ? "Le aziende compaiono qui solo se collegate a una scheda CRM autorizzata. Una menzione in email o RFQ non crea automaticamente un'azienda: prova a cercarla nelle attività o nei documenti."
                : "Prova una ricerca più ampia o un'altra categoria. I dati non vengono inventati e le fonti non sono sempre disponibili per ogni record."}
              primaryAction={{
                href: commercialSearchHref(query, scope === "companies" ? "activities" : "all"),
                label: scope === "companies" ? "Cerca in RFQ e offerte" : "Cerca in tutto lo storico",
              }}
              secondaryAction={{
                href: commercialSearchHref(query, "documents"),
                label: "Cerca nei documenti",
              }}
              compact
            />
          ) : null}
        </div>
      ) : null}

      {state.status === "idle" ? (
        <p className="rounded-lg border border-[#dce2df] bg-white px-3 py-3 text-xs leading-5 text-[#53665b]">
          Una ricerca, tutto lo storico: prodotti, documenti, richieste, offerte, ordini e aziende.
          Usa i filtri tecnici solo quando servono. Se esiste un riferimento navigabile puoi aprire la fonte originale; nessun collegamento CRM automatico.
        </p>
      ) : null}
    </div>
  );
}

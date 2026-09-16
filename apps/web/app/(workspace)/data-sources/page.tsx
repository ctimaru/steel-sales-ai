import Link from "next/link";

import {
  loadDataSourceCenter,
  type DataSourceState,
  type ImportHistoryItem,
} from "./actions";

export const dynamic = "force-dynamic";

const states: Array<{ value: DataSourceState; label: string }> = [
  { value: "all", label: "Tutti gli stati" },
  { value: "indexed", label: "Indicizzati" },
  { value: "indexing", label: "Da indicizzare" },
  { value: "processing", label: "In elaborazione" },
  { value: "duplicate", label: "Duplicati" },
  { value: "error", label: "Errori" },
  { value: "discarded", label: "Scartati" },
  { value: "ready", label: "Pronti" },
];

function scalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeState(value: string | undefined): DataSourceState {
  const allowed = states.map((entry) => entry.value);
  return allowed.includes(value as DataSourceState) ? (value as DataSourceState) : "all";
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatBytes(value: number | null): string {
  if (value === null || value < 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function stateLabel(state: ImportHistoryItem["state"]): string {
  return {
    ready: "Pronto",
    processing: "In elaborazione",
    duplicate: "Duplicato",
    error: "Errore",
    discarded: "Scartato",
  }[state];
}

function stateClass(state: ImportHistoryItem["state"]): string {
  return {
    ready: "bg-emerald-50 text-emerald-700",
    processing: "bg-amber-50 text-amber-700",
    duplicate: "bg-violet-50 text-violet-700",
    error: "bg-rose-50 text-rose-700",
    discarded: "bg-slate-100 text-slate-600",
  }[state];
}

function indexingLabel(state: ImportHistoryItem["indexing_state"]): string {
  return {
    indexed: "Indicizzato",
    indexing: "In indicizzazione",
    pending: "In attesa",
    no_content: "Nessun contenuto",
    not_available: "Non disponibile",
    not_applicable: "Non applicabile",
  }[state];
}

function indexingClass(state: ImportHistoryItem["indexing_state"]): string {
  return {
    indexed: "bg-sky-50 text-sky-700",
    indexing: "bg-amber-50 text-amber-700",
    pending: "bg-amber-50 text-amber-700",
    no_content: "bg-slate-100 text-slate-600",
    not_available: "bg-slate-100 text-slate-600",
    not_applicable: "bg-slate-100 text-slate-600",
  }[state];
}

export default async function DataSourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const search = (scalar(raw.q) ?? "").trim().slice(0, 160);
  const state = normalizeState(scalar(raw.state));
  const sourceKey = (scalar(raw.source) ?? "").trim().slice(0, 160);
  const page = positiveInteger(scalar(raw.page), 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const result = await loadDataSourceCenter({
    search: search || undefined,
    state,
    sourceKey: sourceKey || undefined,
    limit,
    offset,
  });

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          <p className="font-semibold">Data source center non disponibile</p>
          <p className="mt-1">{result.error}</p>
        </div>
      </div>
    );
  }

  const { summary, sources, items, total_filtered: totalFiltered } = result.data;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
  const currentPage = Math.min(page, totalPages);

  function pageHref(target: number) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (state !== "all") params.set("state", state);
    if (sourceKey) params.set("source", sourceKey);
    if (target > 1) params.set("page", String(target));
    const suffix = params.toString();
    return suffix ? `/data-sources?${suffix}` : "/data-sources";
  }

  return (
    <div className="space-y-8">
      <PageHeader />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Import totali" value={summary.total} detail={`${summary.processing} in elaborazione`} />
        <Metric
          label="Indicizzati"
          value={summary.indexed}
          detail={summary.active_model_key ? `Modello ${summary.active_model_key}` : "Modello non attivo"}
        />
        <Metric label="Da indicizzare" value={summary.indexing} detail="Pending + parziali" />
        <Metric label="Duplicati" value={summary.duplicates} detail="SHA-256 già presenti" />
        <Metric label="Errori / scartati" value={summary.errors + summary.discarded} detail={`${summary.errors} errori · ${summary.discarded} scartati`} />
        <Metric label="Ultimo sync" value={formatDate(summary.last_sync_at)} detail="Ultimo aggiornamento fonte" compact />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Fonti collegate</h2>
            <p className="mt-1 text-sm text-slate-500">
              Stato aggregato delle fonti che alimentano la memoria commerciale.
            </p>
          </div>
          {summary.active_model_name ? (
            <p className="text-xs text-slate-500">Indice semantico: {summary.active_model_name}</p>
          ) : null}
        </div>
        {sources.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sources.map((source) => (
              <Link
                key={`${source.source_type}:${source.source_key}`}
                href={`/data-sources?source=${encodeURIComponent(source.source_key)}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      {source.source_type.replaceAll("_", " ")}
                    </p>
                    <h3 className="mt-1 font-semibold text-slate-950">{source.source_name}</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {source.total_items}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-slate-400">Indicizzati</p>
                    <p className="mt-1 font-semibold text-slate-800">{source.indexed_items}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Duplicati</p>
                    <p className="mt-1 font-semibold text-slate-800">{source.duplicate_items}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Errori</p>
                    <p className="mt-1 font-semibold text-slate-800">{source.error_items}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-500">Ultimo sync {formatDate(source.last_sync_at)}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            Nessuna fonte ha ancora prodotto dati per questa organizzazione.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Import history</h2>
              <p className="mt-1 text-sm text-slate-500">
                File ed email storici e nuovi batch P1.2 in un'unica timeline.
              </p>
            </div>
            <p className="text-xs font-semibold text-slate-500">{totalFiltered} risultati</p>
          </div>
          <form className="mt-5 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_190px_220px_auto]" method="get">
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Cerca file, email, fonte o errore..."
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-slate-500"
            />
            <select
              name="state"
              defaultValue={state}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800"
            >
              {states.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
            <select
              name="source"
              defaultValue={sourceKey}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800"
            >
              <option value="">Tutte le fonti</option>
              {sources.map((source) => (
                <option key={`${source.source_type}:${source.source_key}`} value={source.source_key}>
                  {source.source_name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                Filtra
              </button>
              <Link
                href="/data-sources"
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset
              </Link>
            </div>
          </form>
        </div>

        {items.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Documento</th>
                  <th className="px-5 py-3">Fonte</th>
                  <th className="px-5 py-3">Import</th>
                  <th className="px-5 py-3">Indicizzazione</th>
                  <th className="px-5 py-3">Dettagli</th>
                  <th className="px-5 py-3">Ultimo sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.history_id} className="align-top hover:bg-slate-50/60">
                    <td className="max-w-md px-5 py-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-[10px] font-bold uppercase text-slate-600">
                          {item.media_type === "email" ? "EML" : "FILE"}
                        </span>
                        <div className="min-w-0">
                          <p className="break-words font-semibold text-slate-900">{item.display_name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Importato {formatDate(item.imported_at)} · {formatBytes(item.size_bytes)}
                          </p>
                          {item.error ? (
                            <p className="mt-2 line-clamp-2 text-xs text-rose-700" title={item.error}>
                              {item.error}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800">{item.source_name}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.source_type.replaceAll("_", " ")}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stateClass(item.state)}`}>
                        {stateLabel(item.state)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${indexingClass(item.indexing_state)}`}>
                        {indexingLabel(item.indexing_state)}
                      </span>
                      {item.chunk_count > 0 ? (
                        <p className="mt-2 text-xs text-slate-500">
                          {item.embedded_count}/{item.chunk_count} chunk
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      <p>{item.attempt_count ? `${item.attempt_count} tentativ${item.attempt_count === 1 ? "o" : "i"}` : "Nessun retry"}</p>
                      {item.deduplicated ? <p className="mt-1 font-medium text-violet-700">Contenuto già acquisito</p> : null}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                      {formatDate(item.last_sync_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">
            Nessun import corrisponde ai filtri selezionati.
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
            <p className="text-xs text-slate-500">
              Pagina {currentPage} di {totalPages}
            </p>
            <div className="flex gap-2">
              {currentPage > 1 ? (
                <Link href={pageHref(currentPage - 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  Precedente
                </Link>
              ) : null}
              {currentPage < totalPages ? (
                <Link href={pageHref(currentPage + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  Successiva
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Commercial memory</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Data source center</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Vista centralizzata di file ed email importati, copertura dell'indice semantico, duplicati,
          scarti, errori e ultimo sincronismo per fonte.
        </p>
      </div>
      <Link href="/uploads" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
        Nuovo import
      </Link>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  compact = false,
}: {
  label: string;
  value: number | string;
  detail: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 font-semibold text-slate-950 ${compact ? "text-lg" : "text-2xl"}`}>{value}</p>
      <p className="mt-1 truncate text-xs text-slate-500" title={detail}>{detail}</p>
    </div>
  );
}

import { loadMarketOverview, refreshMarketData, type MarketObservation, type MarketSourceOverview } from "./actions";

function numberLabel(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", { month: "short", year: "numeric" }).format(date);
}

function timestampLabel(value: string | null | undefined): string {
  if (!value) return "mai";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function changeLabel(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberLabel(value)}%`;
}

function latestValueLabel(source: MarketSourceOverview): string {
  const value = source.latest?.value ?? null;
  if (value === null) return "—";
  if (source.unit === "USD_PER_EUR") return `${numberLabel(value, 4)} USD/EUR`;
  return `${numberLabel(value, 2)}`;
}

function Sparkline({ series }: { series: MarketObservation[] }) {
  const rows = series.slice(-24).filter((row) => row.value !== null);
  if (rows.length < 2) {
    return <div className="grid h-36 place-items-center text-xs text-slate-400">Serie non ancora disponibile</div>;
  }

  const width = 640;
  const height = 150;
  const padding = 10;
  const values = rows.map((row) => Number(row.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = rows.map((row, index) => {
    const x = padding + (index / (rows.length - 1)) * (width - padding * 2);
    const y = padding + ((max - Number(row.value)) / span) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full" role="img" aria-label="Andamento degli ultimi 24 mesi">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" className="text-slate-200" />
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className="text-indigo-600" />
      </svg>
      <div className="flex justify-between text-[11px] font-medium text-slate-400">
        <span>{dateLabel(rows[0]?.period)}</span>
        <span>{dateLabel(rows.at(-1)?.period)}</span>
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: MarketSourceOverview }) {
  const warning = source.sync_error ?? source.last_error;
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">{source.provider}</p>
            <h2 className="mt-2 max-w-2xl text-lg font-semibold text-slate-950">{source.name}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {[source.geography, source.category, source.display_unit].filter(Boolean).join(" · ")}
            </p>
          </div>
          <a
            href={source.source_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
          >
            Fonte ufficiale ↗
          </a>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-950 p-4 text-white">
            <p className="text-xs font-semibold text-slate-400">Ultimo dato · {dateLabel(source.latest?.period)}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{latestValueLabel(source)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500">Variazione mensile</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{changeLabel(source.change_mom_pct)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500">Variazione annua</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{changeLabel(source.change_yoy_pct)}</p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <Sparkline series={source.series} />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span>{source.observation_count} osservazioni in cache</span>
          <span>Ultimo sync riuscito: {timestampLabel(source.last_success_at)}</span>
        </div>
        {warning ? (
          <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
            L&apos;ultimo tentativo di aggiornamento non è riuscito. I dati già verificati in cache restano visibili. Dettaglio: {warning}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default async function MarketIntelligencePage() {
  const state = await loadMarketOverview();
  const sources = state.data?.sources ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Market intelligence</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Segnali di mercato</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Indicatori esterni ufficiali per leggere il contesto dei nostri prezzi commerciali. Gli indici di mercato e i cambi restano separati dai prezzi interni in €/m o €/t: il confronto misura l&apos;andamento, non l&apos;equivalenza delle unità.
          </p>
        </div>
        <form action={refreshMarketData}>
          <button className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500">
            Aggiorna fonti
          </button>
        </form>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Fonti attive</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{sources.length}</p>
          <p className="mt-1 text-xs text-slate-500">Solo provider ufficiali configurati lato server</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Cache</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{state.data?.cache_hours ?? 12} h</p>
          <p className="mt-1 text-xs text-slate-500">Refresh automatico quando il dato diventa stale</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Provenance</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">100%</p>
          <p className="mt-1 text-xs text-slate-500">Ogni serie conserva provider e link alla fonte</p>
        </div>
      </section>

      {state.status === "error" ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          {state.message}
        </div>
      ) : null}

      {sources.length > 0 ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {sources.map((source) => <SourceCard key={source.key} source={source} />)}
        </div>
      ) : state.status === "success" ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Le fonti sono configurate ma non hanno ancora restituito osservazioni.
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-slate-950">Come leggere questi segnali</h2>
        <div className="mt-4 grid gap-4 text-sm leading-6 text-slate-600 md:grid-cols-2">
          <p>
            <strong className="text-slate-900">Eurostat C242</strong> è l&apos;indice mensile dei prezzi alla produzione sul mercato domestico per la fabbricazione di tubi, condotte, profilati cavi e relativi accessori in acciaio in Italia. È un indice 2021=100, non un prezzo in euro.
          </p>
          <p>
            <strong className="text-slate-900">ECB EUR/USD</strong> mostra il cambio di riferimento mensile espresso come dollari USA per un euro. È utile come segnale di contesto per input o benchmark denominati in USD, ma non viene applicato automaticamente ai nostri prezzi.
          </p>
        </div>
      </section>
    </div>
  );
}

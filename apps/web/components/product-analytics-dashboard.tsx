import Link from "next/link";

import { ProductAnalyticsRefresh } from "@/components/product-analytics-refresh";
import type {
  AnalyticsFunnelStep,
  PlatformAnalyticsSnapshot,
} from "@/lib/platform-product-analytics";
import { appRoutes } from "@/lib/routes";

function formatCount(value: number) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTrendLabel(value: string, hourly: boolean) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return hourly
    ? date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function MiniTrend({
  snapshot,
}: {
  snapshot: PlatformAnalyticsSnapshot;
}) {
  const max = Math.max(
    1,
    ...snapshot.trend.map((point) => Math.max(point.pageviews, point.visitors)),
  );
  const hourly = snapshot.range === "1d";

  if (snapshot.trend.length === 0) {
    return (
      <div className="mt-5 flex min-h-52 items-center justify-center rounded-2xl border border-dashed border-[#d9e1dd] bg-[#fafcfb] px-4 text-center text-sm text-[#7b8882]">
        Il trend inizierà a popolarsi con i primi pageview raccolti da AN1.
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-x-auto">
      <div
        className="grid min-w-[620px] items-end gap-2"
        style={{
          gridTemplateColumns: `repeat(${snapshot.trend.length}, minmax(28px, 1fr))`,
        }}
      >
        {snapshot.trend.map((point) => (
          <div key={point.label} className="group">
            <div className="flex h-44 items-end justify-center gap-1 rounded-xl bg-[#f8faf9] px-1.5 pb-2 pt-3">
              <div
                title={`${point.pageviews} pageview`}
                className="w-2.5 rounded-t bg-[#1a5144] transition group-hover:bg-[#123d34]"
                style={{
                  height: `${Math.max(3, (point.pageviews / max) * 100)}%`,
                }}
              />
              <div
                title={`${point.visitors} visitatori`}
                className="w-2.5 rounded-t bg-[#c8924a] transition group-hover:bg-[#ad7630]"
                style={{
                  height: `${Math.max(3, (point.visitors / max) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 truncate text-center text-[9px] font-semibold text-[#7d8984]">
              {formatTrendLabel(point.label, hourly)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-4 text-[10px] font-semibold text-[#66736e]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#1a5144]" />
          Pageview
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#c8924a]" />
          Visitatori
        </span>
      </div>
    </div>
  );
}

function RankedList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; pageviews: number; visitors: number }>;
}) {
  const max = Math.max(1, ...rows.map((row) => row.pageviews));

  return (
    <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight text-[#1d2824]">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-xl bg-[#f8faf9] p-4 text-sm text-[#7a8781]">
            Nessun dato ancora disponibile.
          </p>
        ) : (
          rows.map((row, index) => (
            <div key={row.label + index}>
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-xs font-semibold text-[#43524c]">
                  {row.label || "Direct / none"}
                </p>
                <p className="shrink-0 text-[11px] tabular-nums text-[#718078]">
                  {formatCount(row.pageviews)} pv · {formatCount(row.visitors)} visit.
                </p>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#edf1ef]">
                <div
                  className="h-full rounded-full bg-[#1a5144]"
                  style={{ width: `${Math.max(2, (row.pageviews / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Funnel({
  title,
  subtitle,
  steps,
}: {
  title: string;
  subtitle: string;
  steps: AnalyticsFunnelStep[];
}) {
  const max = Math.max(1, ...steps.map((step) => step.value));

  return (
    <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
        Funnel
      </p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#1d2824]">
        {title}
      </h2>
      <p className="mt-2 text-xs leading-5 text-[#718078]">{subtitle}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <div
            key={step.key}
            className="relative overflow-hidden rounded-2xl border border-[#e1e7e4] bg-[#f8faf9] p-4"
          >
            <span className="absolute right-3 top-3 text-[10px] font-bold text-[#a0aaa5]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="text-2xl font-semibold tabular-nums text-[#173f35]">
              {formatCount(step.value)}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#52615b]">{step.label}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-[#c8924a]"
                style={{
                  width: `${Math.max(2, (step.value / max) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[10px] text-[#87938e]">
              {step.conversionFromPrevious == null
                ? "base funnel"
                : `${step.conversionFromPrevious}% dallo step precedente`}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProductAnalyticsDashboard({
  snapshot,
}: {
  snapshot: PlatformAnalyticsSnapshot;
}) {
  if (!snapshot.configured) {
    return (
      <section className="rounded-3xl border border-[#e7d4ae] bg-[#fffaf1] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8b5d21]">
          Connessione Analytics
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#3d3429]">
          Dashboard pronta: manca solo il token server-side Vercel.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#6e6253]">
          AN1 raccoglie già i dati. AN1.1 legge la Web Analytics API solo dal server e
          richiede un access token Vercel salvato come secret
          <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-xs">VERCEL_ANALYTICS_TOKEN</code>.
          Il token non viene mai inviato al browser.
        </p>
        <p className="mt-3 text-xs leading-5 text-[#7f725f]">
          Dopo l&apos;aggiunta del secret è sufficiente un redeploy production: questa
          pagina inizierà a mostrare i dati senza altre modifiche.
        </p>
      </section>
    );
  }

  if (snapshot.error) {
    return (
      <section className="rounded-3xl border border-[#efc5bd] bg-[#fff5f3] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9f2f24]">
          Analytics temporaneamente non disponibile
        </p>
        <p className="mt-2 text-sm leading-6 text-[#744b45]">{snapshot.error}</p>
      </section>
    );
  }

  const viewsPerVisitor =
    snapshot.totals.visitors > 0
      ? snapshot.totals.pageviews / snapshot.totals.visitors
      : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="platform-kicker">AN1.1 · Production Analytics</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#1d2824]">
              Product Analytics Dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
              Traffico reale, acquisizione e attivazione prodotto. I dati arrivano
              dalla Web Analytics API di Vercel e restano separati dalle raw request
              infrastrutturali.
            </p>
          </div>
          <ProductAnalyticsRefresh generatedAt={snapshot.generatedAt} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ["1d", "24h"],
            ["7d", "7 giorni"],
            ["30d", "30 giorni"],
          ].map(([range, label]) => (
            <Link
              key={range}
              href={appRoutes.platform.productAnalytics + "?range=" + range}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-semibold",
                snapshot.range === range
                  ? "bg-[#173f35] text-white"
                  : "border border-[#d7dfdb] bg-white text-[#5f6d67] hover:bg-[#f4f7f5]",
              ].join(" ")}
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Visitatori", snapshot.totals.visitors, "utenti unici stimati da Vercel"],
          ["Pageview", snapshot.totals.pageviews, snapshot.rangeLabel],
          ["Pagine / visitatore", viewsPerVisitor.toFixed(2).replace(".", ","), "engagement medio"],
          ["Custom events", snapshot.totals.events, "azioni AN1 tracciate"],
          ["Utenti con eventi", snapshot.totals.eventVisitors, "visitatori che hanno attivato eventi"],
        ].map(([label, value, detail]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-[#dce2df] bg-white p-4"
          >
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-[#173f35]">
              {typeof value === "number" ? formatCount(value) : String(value)}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#52615b]">{String(label)}</p>
            <p className="mt-1 text-[10px] leading-4 text-[#87938e]">{String(detail)}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
              Traffic trend
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
              Visitatori e pageview
            </h2>
          </div>
          <p className="text-[10px] text-[#87938e]">{snapshot.rangeLabel}</p>
        </div>
        <MiniTrend snapshot={snapshot} />
      </section>

      <Funnel
        title="Acquisition → registrazione"
        subtitle="Misura quante persone passano dalla ricerca azienda alla richiesta aziendale effettivamente inviata."
        steps={snapshot.acquisitionFunnel}
      />

      <Funnel
        title="Utility → RFQ Hub"
        subtitle="Misura il percorso dalle utility concrete fino all'avvio e dispatch di una RFQ multi-fornitore."
        steps={snapshot.activationFunnel}
      />

      <section className="grid gap-6 xl:grid-cols-3">
        <RankedList title="Pagine più viste" rows={snapshot.topPages} />
        <RankedList title="Referrer" rows={snapshot.referrers} />
        <RankedList title="Paesi" rows={snapshot.countries} />
      </section>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
              Product signals
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
              Eventi AN1
            </h2>
          </div>
          <p className="text-[10px] text-[#87938e]">
            Nessun payload contiene email, P.IVA, nomi azienda, prezzi o testo RFQ.
          </p>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-[#e1e7e4]">
          <table className="min-w-[620px] w-full text-left text-xs">
            <thead className="bg-[#f8faf9] text-[#66736e]">
              <tr>
                <th className="px-4 py-3 font-semibold">Evento</th>
                <th className="px-4 py-3 text-right font-semibold">Azioni</th>
                <th className="px-4 py-3 text-right font-semibold">Visitatori</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.events.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-[#87938e]">
                    Nessun custom event ancora raccolto nel periodo selezionato.
                  </td>
                </tr>
              ) : (
                snapshot.events.map((event) => (
                  <tr key={event.name} className="border-t border-[#eef2f0]">
                    <td className="px-4 py-3 font-mono text-[11px] font-semibold text-[#43524c]">
                      {event.name}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCount(event.count)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#66736e]">
                      {formatCount(event.visitors)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[#d9e8e2] bg-[#f3f7f5] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">
          Lettura corretta
        </p>
        <p className="mt-2 text-sm leading-6 text-[#52615b]">
          Web Analytics è near real-time, ma non va usato come ledger transazionale:
          per ordini, RFQ, claim e registrazioni i sistemi canonici restano Supabase e
          i relativi audit ledger. Questa dashboard serve a misurare discovery,
          engagement e conversione prodotto.
        </p>
      </section>
    </div>
  );
}

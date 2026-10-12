import Link from "next/link";
import { PilotEvent } from "@/components/pilot-event";
import { appRoutes } from "@/lib/routes";

import {
  loadPriceHistory,
  type ComparablePrice,
  type PriceHistoryRow,
  type PriceTrend,
} from "../../actions";

export const dynamic = "force-dynamic";

function numberLabel(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: digits }).format(Number(value));
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

function rawPrice(row: Pick<PriceHistoryRow, "value" | "unit" | "currency"> | null | undefined) {
  if (!row || row.value === null) return "—";
  const symbol = row.currency === "EUR" ? "€" : row.currency ?? "";
  return `${symbol} ${numberLabel(row.value)}${row.unit ? `/${row.unit.toLowerCase()}` : ""}`.trim();
}

function normalizedPrice(value: number | null | undefined, currency: string | null | undefined, unit: "m" | "t") {
  if (value === null || value === undefined) return "—";
  const symbol = currency === "EUR" ? "€" : currency ?? "";
  return `${symbol} ${numberLabel(value)}/${unit}`.trim();
}

function kindLabel(kind: PriceHistoryRow["price_kind"] | ComparablePrice["price_kind"]) {
  if (kind === "quote") return "Offerta";
  if (kind === "order") return "Ordine";
  if (kind === "rfq_reference") return "RFQ / riferimento";
  if (kind === "delivery_reference") return "Consegna / riferimento";
  return "Riferimento";
}

function trendText(trend: PriceTrend | null | undefined) {
  if (!trend || trend.sample_count < 2 || trend.delta_pct === null) return "Dati insufficienti";
  const arrow = trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→";
  const sign = trend.delta_pct > 0 ? "+" : "";
  return `${arrow} ${sign}${numberLabel(trend.delta_pct)}% vs precedente`;
}

function productLabel(product: {
  product_type: string | null;
  outer_diameter_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  thickness_mm: number | null;
}) {
  if (product.product_type === "round_tube") {
    return `Ø ${numberLabel(product.outer_diameter_mm, 3)} × ${numberLabel(product.thickness_mm, 3)} mm`;
  }
  return `${numberLabel(product.width_mm, 3)} × ${numberLabel(product.height_mm, 3)} × ${numberLabel(product.thickness_mm, 3)} mm`;
}

function tierLabel(tier: ComparablePrice["comparability_tier"]) {
  if (tier === "high") return "Alta";
  if (tier === "medium") return "Media";
  return "Contestuale";
}

export default async function PriceHistoryPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const payload = await loadPriceHistory(productId);

  if (payload.error) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{payload.error}</div>;
  }
  if (!payload.found || !payload.product) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Nessuno storico prezzi trovato per questo prodotto nel tuo workspace.</p>
        <Link href={appRoutes.commercial.product(productId)} className="text-sm font-semibold text-indigo-600">← Torna al prodotto</Link>
      </div>
    );
  }

  const product = payload.product;
  const reference = payload.shared_reference;
  const quoteTrend = payload.trend?.quote;
  const orderTrend = payload.trend?.order;

  return (
    <>
      <PilotEvent eventName="price_history_viewed" entityType="product" entityId={productId} metadata={{ surface: "price_history" }} />
      <div className="mx-auto max-w-7xl space-y-7">
      <header>
        <Link href={appRoutes.commercial.product(productId)} className="text-xs font-semibold text-indigo-600">← Torna al prodotto</Link>
        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap gap-2">
              {product.grade ? <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{product.grade}</span> : null}
              {product.standard ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{product.standard}</span> : null}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Dati commerciali</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Storico prezzi · {productLabel(product)}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Offerte, ordini e comparabili verificabili. I prezzi grezzi restano autoritativi; la normalizzazione €/m ↔ €/t è evidenziata come teorica.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Peso teorico di riferimento</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {reference?.effective_weight_kg_m != null
                ? `${numberLabel(reference.effective_weight_kg_m, 3)} kg/m`
                : product.theoretical_weight_kg_m !== null
                  ? `${numberLabel(product.theoretical_weight_kg_m, 3)} kg/m`
                  : "Non disponibile"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {reference?.resolution_status === "matched"
                ? `Riferimento verificato · ${reference.effective_source_key ?? "fonte tecnica"}`
                : "Peso teorico della sezione"}
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Ultima offerta</p>
              <p className="mt-2 text-3xl font-semibold">{rawPrice(payload.latest_quote)}</p>
              <p className="mt-2 text-sm text-slate-300">{payload.latest_quote ? `${normalizedPrice(payload.latest_quote.normalized_per_tonne, payload.latest_quote.currency, "t")} normalizzato` : "Nessun prezzo offerta"}</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">Offerta</span>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs">
            <span className="text-slate-400">{dateLabel(payload.latest_quote?.at)}</span>
            <span className={quoteTrend?.direction === "up" ? "text-amber-300" : quoteTrend?.direction === "down" ? "text-emerald-300" : "text-slate-300"}>{trendText(quoteTrend)}</span>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Ultimo ordine</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{rawPrice(payload.latest_order)}</p>
              <p className="mt-2 text-sm text-slate-500">{payload.latest_order ? `${normalizedPrice(payload.latest_order.normalized_per_tonne, payload.latest_order.currency, "t")} normalizzato` : "Nessun prezzo ordine"}</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Ordine</span>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs">
            <span className="text-slate-400">{dateLabel(payload.latest_order?.at)}</span>
            <span className={orderTrend?.direction === "up" ? "text-amber-600" : orderTrend?.direction === "down" ? "text-emerald-600" : "text-slate-500"}>{trendText(orderTrend)}</span>
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Storico prezzi verificabile</h2>
            <p className="mt-1 text-xs text-slate-500">Offerte e ordini sono separati; richieste e consegne con prezzo restano riferimenti e non vengono mescolati nell’andamento.</p>
          </div>
          <p className="text-xs text-slate-400">{payload.history?.length ?? 0} prezzi trovati</p>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-2">Data</th><th>Tipo</th><th>Prezzo originale</th><th>Normalizzato</th><th>Quantità</th><th>Cliente / fornitore</th><th>Incoterm / resa</th><th>Fonte</th><th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(payload.history ?? []).map((row) => (
                <tr key={row.observation_id}>
                  <td className="py-3 text-slate-600">{dateLabel(row.at)}</td>
                  <td><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{kindLabel(row.price_kind)}</span></td>
                  <td className="font-semibold text-slate-950">{rawPrice(row)}</td>
                  <td>
                    <p className="font-medium text-slate-800">{normalizedPrice(row.normalized_per_tonne, row.currency, "t")}</p>
                    {row.normalized_per_m !== null ? <p className="mt-0.5 text-xs text-slate-400">{normalizedPrice(row.normalized_per_m, row.currency, "m")}</p> : null}
                  </td>
                  <td className="text-slate-600">{row.quantity !== null ? `${numberLabel(row.quantity, 3)} ${row.quantity_unit ?? ""}` : "—"}</td>
                  <td className="text-slate-600">{row.company?.name ?? row.company?.company_name ?? "Non disponibile"}</td>
                  <td>
                    <p className="text-slate-700">{row.delivery_term ?? "Non disponibile"}</p>
                    {row.payment_terms ? <p className="mt-0.5 text-xs text-slate-400">Pagamento: {row.payment_terms}</p> : null}
                  </td>
                  <td className="max-w-[180px] truncate text-slate-500">{row.source_filename ?? row.thread_subject ?? "—"}</td>
                  <td className="text-right">{row.observation_id ? <Link href={`/evidence/${row.observation_id}`} target="_blank" className="font-semibold text-indigo-600">Originale ↗</Link> : row.thread_id ? <Link href={appRoutes.commercial.conversation(row.thread_id)} className="font-semibold text-indigo-600">Apri thread →</Link> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(payload.history ?? []).length === 0 ? <p className="mt-4 text-sm text-slate-500">Nessun prezzo strutturato disponibile per questo prodotto.</p> : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Comparabili</h2>
            <p className="mt-1 text-xs text-slate-500">Solo stessa famiglia e stessa qualità. La rilevanza considera norma, geometria e spessore.</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Rilevanza 0–100</span>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="py-2">Prodotto</th><th>Tipo prezzo</th><th>Prezzo norm.</th><th>Rilevanza</th><th>Perché comparabile</th><th>Differenza</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(payload.comparables ?? []).map((row) => (
                <tr key={`${row.canonical_product_id}-${row.price_kind}`}>
                  <td className="py-3">
                    <Link href={`/products/${row.canonical_product_id}`} className="font-semibold text-slate-950 hover:text-indigo-600">{productLabel(row)}</Link>
                    <p className="mt-0.5 text-xs text-slate-400">{row.standard ?? "norma n/d"}</p>
                  </td>
                  <td><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{kindLabel(row.price_kind)}</span></td>
                  <td className="font-semibold text-slate-950">{normalizedPrice(row.normalized_per_tonne, row.currency, "t")}</td>
                  <td>
                    <p className="font-semibold text-slate-950">{numberLabel(row.comparability_score, 1)}/100</p>
                    <p className="text-xs text-slate-400">{tierLabel(row.comparability_tier)}</p>
                  </td>
                  <td className="max-w-[310px] text-xs leading-5 text-slate-500">{row.reasons?.join(" · ") || "—"}</td>
                  <td className="font-medium text-slate-700">{row.difference_vs_target_pct === null ? "—" : `${row.difference_vs_target_pct > 0 ? "+" : ""}${numberLabel(row.difference_vs_target_pct)}%`}</td>
                  <td className="text-right">{row.thread_id ? <Link href={appRoutes.commercial.conversation(row.thread_id)} className="font-semibold text-indigo-600">Apri thread →</Link> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(payload.comparables ?? []).length === 0 ? <p className="mt-4 text-sm text-slate-500">Nessun comparabile con prezzo strutturato disponibile oggi.</p> : null}
      </section>

      <aside className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        <p className="font-semibold">Come leggere la normalizzazione</p>
        <p className="mt-1">Il prezzo originale estratto dal documento non viene mai sostituito. Il riferimento tecnico valida norma, grado e geometria e rende visibile il peso di riferimento quando disponibile. Le normalizzazioni storiche €/m ↔ €/t già persistite usano il peso teorico della sezione secondo il metodo originario; restano etichettate secondo quel metodo e non vengono riscritte retroattivamente. Valute diverse non vengono convertite. Cliente/fornitore e Incoterm/resa sono mostrati solo quando esistono campi strutturati.</p>
      </aside>
      </div>
    </>
  );
}

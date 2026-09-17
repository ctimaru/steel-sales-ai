import Link from "next/link";

import { loadProduct360, type ProductPrice, type ProductTimelineEvent } from "../actions";

export const dynamic = "force-dynamic";

function numberLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(Number(value));
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

function priceLabel(price: ProductPrice | null | undefined) {
  if (!price || price.value === null) return "Nessun prezzo disponibile";
  const value = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(Number(price.value));
  return `${price.currency === "EUR" ? "€" : price.currency ?? ""} ${value}${price.unit ? `/${price.unit.toLowerCase()}` : ""}`.trim();
}

function eventLabel(event: ProductTimelineEvent) {
  if (event.event_type === "rfq") return "RFQ";
  if (event.event_type === "offer") return "Offerta";
  if (event.event_type === "order") return "Ordine";
  if (event.event_type === "delivery") return "Consegna";
  return "Evento";
}

export default async function ProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const payload = await loadProduct360(productId);

  if (payload.error) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{payload.error}</div>;
  }
  if (!payload.found || !payload.product || !payload.summary) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Prodotto non trovato nella Commercial Memory del tenant attivo.</p>
        <Link href="/products" className="text-sm font-semibold text-indigo-600">← Torna ai prodotti</Link>
      </div>
    );
  }

  const product = payload.product;
  const summary = payload.summary;
  const title = product.product_type === "round_tube"
    ? `Ø ${numberLabel(product.outer_diameter_mm)} × ${numberLabel(product.thickness_mm)} mm`
    : `${numberLabel(product.width_mm)} × ${numberLabel(product.height_mm)} × ${numberLabel(product.thickness_mm)} mm`;

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div>
        <Link href="/products" className="text-xs font-semibold text-indigo-600">← Product catalog</Link>
        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap gap-2">
              {product.grade ? <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{product.grade}</span> : null}
              {product.standard ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{product.standard}</span> : null}
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Tenant verified</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
            <p className="mt-2 max-w-3xl break-all text-xs leading-5 text-slate-400">{product.canonical_product_key}</p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Ultimo prezzo</p>
            <p className="mt-1 text-2xl font-semibold">{priceLabel(payload.latest_price)}</p>
            <p className="mt-1 text-xs text-slate-400">{dateLabel(payload.latest_price?.at)}</p>
            <Link href={`/products/${productId}/prices`} className="mt-3 inline-flex text-xs font-semibold text-indigo-300 hover:text-white">Apri Price History →</Link>
          </div>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Eventi", summary.event_count],
          ["RFQ", summary.requested_count],
          ["Offerte", summary.offered_count],
          ["Ordini", summary.ordered_count],
          ["Consegne", summary.delivered_count],
          ["Thread", summary.thread_count],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-semibold text-slate-950">{String(value)}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">Storico prezzi</h2>
          <p className="mt-1 text-xs text-slate-500">Solo prezzi realmente estratti da eventi con ruolo offerta. Per quote/order, trend e comparabili usa Price History.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <tr><th className="py-2">Data</th><th>Prezzo</th><th>Quantità</th><th>Fonte</th><th></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(payload.price_history ?? []).map((row) => (
                  <tr key={`${row.observation_id}-${row.at}`}>
                    <td className="py-3 text-slate-600">{dateLabel(row.at)}</td>
                    <td className="font-semibold text-slate-950">{priceLabel(row)}</td>
                    <td className="text-slate-600">{row.quantity !== null && row.quantity !== undefined ? `${numberLabel(row.quantity)} ${row.quantity_unit ?? ""}` : "—"}</td>
                    <td className="max-w-[220px] truncate text-slate-500">{row.source_filename ?? row.thread_subject ?? "—"}</td>
                    <td className="text-right">{row.thread_id ? <Link href={`/conversations/${row.thread_id}`} className="font-semibold text-indigo-600">Apri thread →</Link> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(payload.price_history ?? []).length === 0 ? <p className="mt-4 text-sm text-slate-500">Nessun prezzo offerto disponibile per questo prodotto.</p> : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">Profilo prodotto</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-1">
            {[
              ["Famiglia", product.product_type],
              ["Qualità", product.grade],
              ["Norma", product.standard],
              ["Material number", product.material_number],
              ["Diametro", product.outer_diameter_mm !== null ? `${numberLabel(product.outer_diameter_mm)} mm` : null],
              ["Sezione", product.width_mm !== null ? `${numberLabel(product.width_mm)} × ${numberLabel(product.height_mm)} mm` : null],
              ["Spessore", product.thickness_mm !== null ? `${numberLabel(product.thickness_mm)} mm` : null],
              ["Lunghezze osservate", product.observed_lengths_mm?.length ? product.observed_lengths_mm.map((value) => `${numberLabel(value)} mm`).join(", ") : null],
            ].map(([label, value]) => (
              <div key={String(label)} className="border-b border-slate-100 pb-3">
                <dt className="text-xs font-semibold text-slate-400">{label}</dt>
                <dd className="mt-1 font-medium text-slate-800">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Timeline commerciale</h2>
            <p className="mt-1 text-xs text-slate-500">Dal più recente: richieste, offerte, ordini e consegne collegati al prodotto canonico.</p>
          </div>
          <p className="text-xs text-slate-400">{dateLabel(summary.first_event_at)} → {dateLabel(summary.latest_event_at)}</p>
        </div>
        <div className="mt-5 space-y-3">
          {(payload.timeline ?? []).map((event) => (
            <div key={event.observation_id} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[130px_1fr_auto] md:items-start">
              <div>
                <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-bold text-white">{eventLabel(event)}</span>
                <p className="mt-2 text-xs text-slate-400">{dateLabel(event.commercial_at)}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">{event.thread_subject || event.source_filename || "Evento commerciale"}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{event.source_text || "Nessuno snippet sorgente disponibile."}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  {event.quantity !== null ? <span>Qtà {numberLabel(event.quantity)} {event.quantity_unit ?? ""}</span> : null}
                  {event.price_value !== null ? <span>{priceLabel({ value: event.price_value, unit: event.price_unit, currency: event.currency, at: event.commercial_at })}</span> : null}
                  {event.company_name ? <span>{event.company_name}</span> : null}
                </div>
              </div>
              {event.thread_id ? <Link href={`/conversations/${event.thread_id}`} className="text-xs font-semibold text-indigo-600">Evidence →</Link> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">Documenti sorgente</h2>
          <p className="mt-1 text-xs text-slate-500">File che hanno prodotto osservazioni per questo prodotto.</p>
          <div className="mt-4 space-y-3">
            {(payload.documents ?? []).map((doc) => (
              <div key={doc.source_filename} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{doc.source_filename}</p>
                  <p className="mt-1 text-xs text-slate-400">{doc.observation_count} osservazioni · {doc.roles?.join(", ")}</p>
                </div>
                {doc.sample_thread_id ? <Link href={`/conversations/${doc.sample_thread_id}`} className="shrink-0 text-xs font-semibold text-indigo-600">Apri →</Link> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">Clienti / fornitori collegati</h2>
          <p className="mt-1 text-xs text-slate-500">Mostrati solo quando esiste un collegamento company strutturato; nessuna inferenza dal testo.</p>
          <div className="mt-4 space-y-3">
            {(payload.counterparties ?? []).map((company) => (
              <div key={company.company_id ?? company.id ?? company.company_name ?? company.name} className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">{company.company_name ?? company.name ?? "Azienda"}</p>
                <p className="mt-1 text-xs text-slate-500">{company.company_type ?? company.type ?? "tipo non classificato"}{company.company_country ?? company.country ? ` · ${company.company_country ?? company.country}` : ""}</p>
              </div>
            ))}
            {(payload.counterparties ?? []).length === 0 ? <p className="text-sm text-slate-500">Nessuna controparte strutturata disponibile oggi; verrà popolata con Company 360.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

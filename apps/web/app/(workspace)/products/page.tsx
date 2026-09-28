import Link from "next/link";

import { appRoutes } from "@/lib/routes";

import { loadProductCatalog, type ProductCatalogItem } from "./actions";

export const dynamic = "force-dynamic";

function numberLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(Number(value));
}

function productLabel(item: ProductCatalogItem) {
  if (item.product_type === "round_tube") {
    return `Tubo tondo Ø ${numberLabel(item.outer_diameter_mm) ?? "—"} × ${numberLabel(item.thickness_mm) ?? "—"} mm`;
  }
  if (item.product_type === "square_tube") {
    return `Tubo quadro ${numberLabel(item.width_mm) ?? "—"} × ${numberLabel(item.height_mm) ?? "—"} × ${numberLabel(item.thickness_mm) ?? "—"} mm`;
  }
  if (item.product_type === "rectangular_tube") {
    return `Tubo rettangolare ${numberLabel(item.width_mm) ?? "—"} × ${numberLabel(item.height_mm) ?? "—"} × ${numberLabel(item.thickness_mm) ?? "—"} mm`;
  }
  return item.product_type ?? "Prodotto steel";
}

function priceLabel(item: ProductCatalogItem) {
  const price = item.latest_price;
  if (!price || price.value === null) return "Nessun prezzo offerto";
  const amount = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(Number(price.value));
  return `${price.currency === "EUR" ? "€" : price.currency ?? ""} ${amount}${price.unit ? `/${price.unit.toLowerCase()}` : ""}`.trim();
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const catalog = await loadProductCatalog(query || undefined);

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2f6fed]">Commercial Memory</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1e2b45]">Product 360</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#68788e]">
          Un prodotto, tutta la sua storia: richieste, offerte, ordini, consegne, prezzi, quantità,
          conversazioni e documenti originali.
        </p>
      </div>

      <section className="rounded-3xl border border-[#e1e8f2] bg-white p-5 shadow-sm sm:p-6">
        <form method="get" className="flex flex-col gap-3 sm:flex-row">
          <input
            name="q"
            defaultValue={query}
            placeholder="Cerca qualità, norma o dimensione — es. P265GH 406,4"
            className="h-12 flex-1 rounded-xl border border-[#dbe5f1] px-4 text-sm text-[#1e2b45] outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
          />
          <button className="h-12 rounded-xl bg-[#2f6fed] px-5 text-sm font-semibold text-white hover:bg-[#245ed1]">
            Cerca prodotti
          </button>
        </form>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-[#68788e]">
          <span>{catalog.total} prodotti{query ? ` per “${query}”` : ""}</span>
          {query ? <Link href={appRoutes.commercial.products} className="font-semibold text-[#2f6fed]">Azzera ricerca</Link> : null}
        </div>
      </section>

      {catalog.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{catalog.error}</div>
      ) : catalog.results.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dbe5f1] bg-white px-6 py-12 text-center text-sm text-[#68788e]">
          Nessun prodotto trovato con questi criteri.
        </div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {catalog.results.map((item) => (
            <Link
              key={item.canonical_product_id}
              href={appRoutes.commercial.product(item.canonical_product_id)}
              className="rounded-3xl border border-[#e1e8f2] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#bdd1f4] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    {item.grade ? <span className="rounded-full bg-[#eaf2ff] px-2.5 py-1 text-[#245ed1]">{item.grade}</span> : null}
                    {item.standard ? <span className="rounded-full bg-[#eef3fa] px-2.5 py-1 text-slate-600">{item.standard}</span> : null}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-[#1e2b45]">{productLabel(item)}</h2>
                  <p className="mt-1 text-xs text-[#91a0b2]">{item.event_count} attività · {item.thread_count} conversazioni</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#1e2b45]">{priceLabel(item)}</p>
                  <p className="mt-1 text-[11px] text-[#91a0b2]">ultimo prezzo offerto</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-4 gap-2 border-t border-slate-100 pt-4 text-center">
                {[
                  ["RFQ", item.requested_count],
                  ["Offerte", item.offered_count],
                  ["Ordini", item.ordered_count],
                  ["Consegne", item.delivered_count],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-[#f8fafd] px-2 py-2">
                    <p className="text-base font-semibold text-[#34445c]">{String(value)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-[#91a0b2]">{label}</p>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

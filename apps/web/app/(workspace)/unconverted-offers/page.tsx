import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

type OfferObservation = {
  id: number;
  thread_id: string;
  grade: string | null;
  standard: string | null;
  outer_diameter_mm: number | string | null;
  width_mm: number | string | null;
  height_mm: number | string | null;
  thickness_mm: number | string | null;
  length_mm: number | string | null;
  quantity: number | string | null;
  quantity_unit: string | null;
  price_value: number | string | null;
  price_unit: string | null;
  currency: string | null;
  source_text: string | null;
  source_filename: string | null;
  confidence: number | string | null;
  offered_at: string | null;
  thread_subject: string | null;
};

type OffersPayload = {
  found?: boolean;
  count?: number;
  thread_count?: number;
  observations?: OfferObservation[];
  detail?: string;
};

function numberLabel(value: number | string | null): string {
  if (value === null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(number)
    : String(value);
}

function dateLabel(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

function priceLabel(row: OfferObservation): string {
  if (row.price_value === null) return "—";
  const amount = Number(row.price_value);
  const currency = row.currency ?? "EUR";
  const formatted = Number.isFinite(amount)
    ? new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    : String(row.price_value);
  const unit = row.price_unit === "M"
    ? "/m"
    : row.price_unit === "T"
      ? "/t"
      : row.price_unit
        ? `/${row.price_unit}`
        : "";
  return `${formatted}${unit}`;
}

function sizeLabel(row: OfferObservation): string {
  if (row.outer_diameter_mm !== null) {
    return `Ø ${numberLabel(row.outer_diameter_mm)}${
      row.thickness_mm !== null ? ` × ${numberLabel(row.thickness_mm)}` : ""
    }`;
  }
  if (row.width_mm !== null && row.height_mm !== null) {
    return `${numberLabel(row.width_mm)} × ${numberLabel(row.height_mm)}${
      row.thickness_mm !== null ? ` × ${numberLabel(row.thickness_mm)}` : ""
    }`;
  }
  return row.thickness_mm !== null ? `sp. ${numberLabel(row.thickness_mm)} mm` : "—";
}

async function loadOffersWithoutOrder(grade: string, months: number) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const ownerId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!ownerId) {
    return { error: "Sessione scaduta. Accedi di nuovo.", rows: [], count: 0, threadCount: 0 };
  }

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  if (!workerUrl) {
    return { error: "Worker non configurato nell'ambiente web.", rows: [], count: 0, threadCount: 0 };
  }

  const since = months > 0
    ? new Date(Date.now() - months * 30.4375 * 24 * 60 * 60 * 1000).toISOString()
    : undefined;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (process.env.WORKER_INTERNAL_TOKEN) {
    headers["x-worker-token"] = process.env.WORKER_INTERNAL_TOKEN;
  }

  try {
    const response = await fetch(`${workerUrl}/v1/ai/offers-without-order`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        owner_id: ownerId,
        grade: grade || undefined,
        since,
        limit: 200,
      }),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as OffersPayload | null;
    if (!response.ok) {
      return {
        error: payload?.detail ?? "Impossibile recuperare le offerte senza ordine.",
        rows: [],
        count: 0,
        threadCount: 0,
      };
    }
    return {
      error: null,
      rows: payload?.observations ?? [],
      count: payload?.count ?? 0,
      threadCount: payload?.thread_count ?? 0,
    };
  } catch {
    return { error: "Worker non raggiungibile.", rows: [], count: 0, threadCount: 0 };
  }
}

export default async function UnconvertedOffersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const read = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const grade = (read("grade") ?? "").trim().toUpperCase();
  const monthsValue = Number(read("months") ?? 0);
  const months = [0, 3, 6, 12, 24].includes(monthsValue) ? monthsValue : 0;
  const data = await loadOffersWithoutOrder(grade, months);
  const pricedRows = data.rows.filter((row) => row.price_value !== null).length;
  const latestDate = data.rows[0]?.offered_at ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
          Commercial follow-up
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Offerte senza ordine
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Individua le offerte presenti in trattative che non contengono alcun ordine. Ogni riga
          mantiene il collegamento alla conversazione originale per il follow-up commerciale.
        </p>
      </div>

      <form className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
        <label className="space-y-2 text-sm font-semibold text-slate-900">
          <span>Qualità</span>
          <input
            name="grade"
            defaultValue={grade}
            placeholder="es. S355J2H"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-900">
          <span>Periodo</span>
          <select
            name="months"
            defaultValue={String(months)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500"
          >
            <option value="0">Tutto lo storico</option>
            <option value="3">Ultimi 3 mesi</option>
            <option value="6">Ultimi 6 mesi</option>
            <option value="12">Ultimi 12 mesi</option>
            <option value="24">Ultimi 24 mesi</option>
          </select>
        </label>
        <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
          Applica filtri
        </button>
      </form>

      {data.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {data.error}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Thread da seguire", String(data.threadCount)],
              ["Righe offerte", String(data.count)],
              ["Con prezzo", String(pricedRows)],
              ["Più recente", dateLabel(latestDate)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
              </div>
            ))}
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Follow-up commerciale</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Una trattativa compare qui solo se nello stesso thread non è stato rilevato alcun ordine.
                </p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {data.threadCount} thread aperti
              </span>
            </div>

            {data.rows.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                Nessuna offerta senza ordine per i filtri selezionati.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Data</th>
                      <th className="px-5 py-3">Prodotto</th>
                      <th className="px-5 py-3">Norma</th>
                      <th className="px-5 py-3">Quantità</th>
                      <th className="px-5 py-3">Prezzo</th>
                      <th className="px-5 py-3">Trattativa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rows.map((row) => (
                      <tr key={row.id} className="align-top hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {dateLabel(row.offered_at)}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-950">{row.grade ?? "—"}</p>
                          <p className="mt-1 whitespace-nowrap text-xs text-slate-500">{sizeLabel(row)}</p>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{row.standard ?? "—"}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {row.quantity !== null
                            ? `${numberLabel(row.quantity)} ${row.quantity_unit ?? ""}`.trim()
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-950">
                          {priceLabel(row)}
                        </td>
                        <td className="max-w-sm px-5 py-4">
                          <Link
                            href={`/conversations/${row.thread_id}`}
                            className="font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            {row.thread_subject ?? "Apri trattativa"}
                          </Link>
                          {row.source_text ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                              {row.source_text}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

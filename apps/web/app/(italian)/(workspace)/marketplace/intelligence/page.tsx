import Link from "next/link";

import { FocusHeader, FocusPage } from "@/components/focus-ui";
import { appRoutes } from "@/lib/routes";
import type { ProcurementIntelligenceData } from "@/lib/rfqh12-procurement-intelligence";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ days?: string }>;

const PERIODS = [
  { value: "90", label: "Ultimi 90 giorni" },
  { value: "365", label: "Ultimi 12 mesi" },
  { value: "0", label: "Tutto lo storico" },
] as const;

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown, digits = 1) {
  return num(value).toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatCurrency(value: unknown) {
  return num(value).toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    dateStyle: "medium",
  }).format(date);
}

function formatResponseHours(value: unknown) {
  const hours = num(value);
  if (!hours) return "—";
  return hours < 24 ? `${formatNumber(hours, 1)} h` : `${formatNumber(hours / 24, 1)} gg`;
}

function toneForDelta(value: unknown) {
  const delta = Number(value);
  if (!Number.isFinite(delta) || delta === 0) return "text-[#52615b]";
  return delta < 0 ? "text-[#1a6a54]" : "text-[#9a4f36]";
}

export default async function ProcurementIntelligencePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requestedDays = Number(params.days ?? 365);
  const days = requestedDays === 0 || requestedDays === 90 || requestedDays === 365
    ? requestedDays
    : 365;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rfqh12_procurement_intelligence", {
    p_days: days,
  });

  const intelligence =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as ProcurementIntelligenceData)
      : null;

  const summary = intelligence?.summary ?? {};
  const suppliers = intelligence?.supplier_performance ?? [];
  const articles = intelligence?.articles ?? [];
  const priceHistory = intelligence?.price_history ?? [];
  const awards = intelligence?.awards ?? [];

  return (
    <FocusPage>
      <FocusHeader
        eyebrow="RFQH12 · Procurement Intelligence"
        title="Dallo storico acquisti a decisioni misurabili"
        description={
          <>
            Una vista buyer-side che trasforma RFQ, quote, award e PO in indicatori leggibili:
            saving vs target, copertura offerte, tempi di risposta, lead time, performance supplier
            e storico prezzi per articolo. Nessun punteggio unico o ranking opaco.
          </>
        }
        actions={
          <>
            <Link
              href={appRoutes.marketplace.suppliers}
              className="app-secondary inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
            >
              Rubrica supplier
            </Link>
            <Link
              href={appRoutes.marketplace.rfqHub}
              className="app-primary inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
            >
              RFQ Hub
            </Link>
          </>
        }
      />

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#dce2df] bg-white p-4"
      >
        <label className="text-xs font-semibold text-[#52615b]">
          Periodo di analisi
          <select
            name="days"
            defaultValue={String(days)}
            className="mt-1.5 h-11 min-w-52 rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824]"
          >
            {PERIODS.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
        </label>
        <button className="h-11 rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white">
          Aggiorna
        </button>
        <p className="text-xs leading-5 text-[#718078]">
          I KPI usano solo dati procurement strutturati e riconducibili a RFQ, quote, award e PO.
        </p>
      </form>

      {error ? (
        <section className="rounded-2xl border border-[#ead0cb] bg-[#fff7f5] p-5 text-sm font-semibold text-[#8a3e35]">
          Procurement Intelligence non è temporaneamente disponibile.
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Spesa aggiudicata", formatCurrency(summary.awarded_total_eur)],
          ["Saving vs target", formatCurrency(summary.savings_eur)],
          ["Saving %", summary.savings_pct == null ? "—" : `${formatNumber(summary.savings_pct, 2)}%`],
          ["Quote coverage", `${formatNumber(summary.quote_coverage_pct, 1)}%`],
          ["Response rate", `${formatNumber(summary.response_rate_pct, 1)}%`],
          ["Lead medio", summary.avg_lead_time_days == null ? "—" : `${formatNumber(summary.avg_lead_time_days, 1)} gg`],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#718078]">
              {label}
            </p>
            <p className="mt-1 text-xl font-semibold text-[#1d2824]">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#dce2df] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
            Funnel procurement
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3"><span>RFQ</span><strong>{summary.rfq_count ?? 0}</strong></div>
            <div className="flex justify-between gap-3"><span>Inviti supplier</span><strong>{summary.supplier_invite_count ?? 0}</strong></div>
            <div className="flex justify-between gap-3"><span>Risposte</span><strong>{summary.supplier_response_count ?? 0}</strong></div>
            <div className="flex justify-between gap-3"><span>Quote comparabili</span><strong>{summary.comparable_quote_count ?? 0}</strong></div>
            <div className="flex justify-between gap-3"><span>Quote complete</span><strong>{summary.complete_quote_count ?? 0}</strong></div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#dce2df] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
            Award economics
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3"><span>Award</span><strong>{summary.award_count ?? 0}</strong></div>
            <div className="flex justify-between gap-3"><span>Target cumulato</span><strong>{formatCurrency(summary.target_total_eur)}</strong></div>
            <div className="flex justify-between gap-3"><span>Valore aggiudicato</span><strong>{formatCurrency(summary.awarded_total_eur)}</strong></div>
            <div className="flex justify-between gap-3"><span>Saving</span><strong>{formatCurrency(summary.savings_eur)}</strong></div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#dce2df] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
            Base informativa
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3"><span>Supplier</span><strong>{summary.supplier_count ?? 0}</strong></div>
            <div className="flex justify-between gap-3"><span>Campioni prezzo</span><strong>{summary.price_sample_count ?? 0}</strong></div>
            <div className="flex justify-between gap-3"><span>Articoli osservati</span><strong>{articles.length}</strong></div>
            <div className="flex justify-between gap-3"><span>Storico righe esposto</span><strong>{priceHistory.length}</strong></div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white">
        <div className="border-b border-[#e7ece9] px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
            Supplier performance
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">
            Metriche separate, senza score sintetico
          </h2>
        </div>

        {suppliers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#66736e]">
            Nessuno storico supplier disponibile nel periodo selezionato.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#dce2df] text-[#66736e]">
                  <th className="px-5 py-3">Supplier</th>
                  <th className="px-3 py-3 text-right">RFQ</th>
                  <th className="px-3 py-3 text-right">Response</th>
                  <th className="px-3 py-3 text-right">Coverage</th>
                  <th className="px-3 py-3 text-right">Risposta media</th>
                  <th className="px-3 py-3 text-right">Lead</th>
                  <th className="px-3 py-3 text-right">Award rate</th>
                  <th className="px-3 py-3 text-right">Award €</th>
                  <th className="px-3 py-3 text-right">Saving €</th>
                  <th className="px-5 py-3 text-right">PO confermati</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier, index) => (
                  <tr key={supplier.profile_id ?? `${supplier.name}:${index}`} className="border-b border-[#edf0ee]">
                    <td className="px-5 py-3">
                      {supplier.profile_id ? (
                        <Link
                          href={appRoutes.marketplace.supplier(supplier.profile_id)}
                          className="font-semibold text-[#173f35] hover:underline"
                        >
                          {supplier.name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-[#1d2824]">{supplier.name}</span>
                      )}
                      {supplier.preferred ? (
                        <span className="ml-2 rounded-full bg-[#edf5f2] px-2 py-0.5 text-[9px] font-bold uppercase text-[#1a5144]">
                          Preferito
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-right">{supplier.rfq_count}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(supplier.response_rate_pct, 1)}%</td>
                    <td className="px-3 py-3 text-right">{formatNumber(supplier.avg_quote_coverage_pct, 1)}%</td>
                    <td className="px-3 py-3 text-right">{formatResponseHours(supplier.avg_response_hours)}</td>
                    <td className="px-3 py-3 text-right">
                      {supplier.avg_lead_time_days == null ? "—" : `${formatNumber(supplier.avg_lead_time_days, 1)} gg`}
                    </td>
                    <td className="px-3 py-3 text-right">{formatNumber(supplier.award_rate_pct, 1)}%</td>
                    <td className="px-3 py-3 text-right font-semibold">{formatCurrency(supplier.awarded_total_eur)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-[#1a6a54]">{formatCurrency(supplier.savings_total_eur)}</td>
                    <td className="px-5 py-3 text-right">
                      {supplier.confirmed_po_count}/{supplier.po_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white">
        <div className="border-b border-[#e7ece9] px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
            Price intelligence
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">
            Storico prezzi per articolo
          </h2>
        </div>

        {articles.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#66736e]">
            I trend appariranno quando saranno disponibili quote strutturate.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#dce2df] text-[#66736e]">
                  <th className="px-5 py-3">Articolo</th>
                  <th className="px-3 py-3">Norma / grado</th>
                  <th className="px-3 py-3 text-right">Campioni</th>
                  <th className="px-3 py-3 text-right">Supplier</th>
                  <th className="px-3 py-3 text-right">Ultimo €/t</th>
                  <th className="px-3 py-3 text-right">Precedente</th>
                  <th className="px-3 py-3 text-right">Δ %</th>
                  <th className="px-3 py-3 text-right">Min / Max</th>
                  <th className="px-5 py-3 text-right">Data</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.article_key} className="border-b border-[#edf0ee]">
                    <td className="px-5 py-3 font-semibold text-[#1d2824]">{article.description}</td>
                    <td className="px-3 py-3">
                      {[article.standard_code, article.grade_code, article.finish_code].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-3 text-right">{article.sample_count}</td>
                    <td className="px-3 py-3 text-right">{article.supplier_count}</td>
                    <td className="px-3 py-3 text-right font-semibold text-[#173f35]">
                      {article.latest_eur_t == null ? "—" : `€ ${formatNumber(article.latest_eur_t, 2)}`}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {article.previous_eur_t == null ? "—" : `€ ${formatNumber(article.previous_eur_t, 2)}`}
                    </td>
                    <td className={`px-3 py-3 text-right font-semibold ${toneForDelta(article.change_pct)}`}>
                      {article.change_pct == null ? "—" : `${formatNumber(article.change_pct, 2)}%`}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {article.min_eur_t == null ? "—" : `€ ${formatNumber(article.min_eur_t, 0)} / € ${formatNumber(article.max_eur_t, 0)}`}
                    </td>
                    <td className="px-5 py-3 text-right">{formatDate(article.latest_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#dce2df] bg-white">
          <div className="border-b border-[#e7ece9] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">Savings vs Target</p>
            <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">Award confermati</h2>
          </div>
          {awards.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[#66736e]">Nessun award nel periodo selezionato.</p>
          ) : (
            <div className="divide-y divide-[#edf0ee]">
              {awards.slice(0, 12).map((award) => (
                <article key={award.award_id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        href={appRoutes.marketplace.rfqCampaign(award.rfq_id)}
                        className="font-semibold text-[#173f35] hover:underline"
                      >
                        {award.rfq_title}
                      </Link>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[#87908c]">
                        {award.award_mode} · {award.supplier_count} supplier · {formatDate(award.confirmed_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[#1d2824]">{formatCurrency(award.total_eur)}</p>
                      <p className="mt-1 text-xs font-semibold text-[#1a6a54]">
                        Saving {formatCurrency(award.savings_eur)}
                        {award.savings_pct == null ? "" : ` · ${formatNumber(award.savings_pct, 2)}%`}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#dce2df] bg-white">
          <div className="border-b border-[#e7ece9] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">Drill-down prezzi</p>
            <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">Ultime quote ricevute</h2>
          </div>
          {priceHistory.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[#66736e]">Nessuna riga prezzo disponibile.</p>
          ) : (
            <div className="divide-y divide-[#edf0ee]">
              {priceHistory.slice(0, 12).map((row) => (
                <article key={`${row.quote_id}:${row.line_position}`} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1d2824]">{row.description}</p>
                      <p className="mt-1 text-[10px] text-[#718078]">
                        {row.profile_id ? (
                          <Link href={appRoutes.marketplace.supplier(row.profile_id)} className="font-semibold text-[#173f35] hover:underline">
                            {row.supplier_name}
                          </Link>
                        ) : row.supplier_name}
                        {" · "}
                        <Link href={appRoutes.marketplace.rfqCampaign(row.rfq_id)} className="hover:underline">
                          {row.rfq_title}
                        </Link>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[#173f35]">
                        {row.eur_t == null ? "—" : `€ ${formatNumber(row.eur_t, 2)}/t`}
                      </p>
                      <p className="mt-1 text-[10px] text-[#87908c]">{formatDate(row.submitted_at)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#cddbd6] bg-[#f7faf8] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">Governance RFQH12</p>
        <p className="mt-2 text-sm leading-6 text-[#66736e]">
          Il sistema non assegna un voto al supplier e non prende decisioni di award. Ogni metrica è
          separata e riconducibile allo storico operativo; il buyer mantiene il controllo della decisione commerciale.
        </p>
      </section>
    </FocusPage>
  );
}
